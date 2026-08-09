import "server-only";

import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminServices } from "@/lib/firebase/admin";
import type { UserPreferences, WatchlistEntry } from "@/lib/firebase/db";
import {
  isQuietHours,
  releaseNotifications,
  type AppNotification,
} from "./model";

const MAX_USERS = 200;

export interface DispatchSummary {
  users: number;
  candidates: number;
  delivered: number;
  skipped: number;
  failed: number;
  truncated: boolean;
  dryRun: boolean;
}

interface DeliveryPreferences extends UserPreferences {
  notificationPushEnabled?: boolean;
  notificationEmailEnabled?: boolean;
  notificationQuietStart?: string;
  notificationQuietEnd?: string;
  notificationTimezone?: string;
}

function deliveryId(notificationId: string) {
  return createHash("sha256").update(notificationId).digest("hex").slice(0, 40);
}

function subscriptionId(fid: string) {
  return createHash("sha256").update(fid).digest("hex").slice(0, 32);
}

function absoluteUrl(href: string) {
  const deploymentUrl = process.env.NEXT_PUBLIC_SITE_URL
    || process.env.VERCEL_PROJECT_PRODUCTION_URL
    || process.env.VERCEL_URL;
  const base = deploymentUrl
    ? `${/^https?:\/\//.test(deploymentUrl) ? "" : "https://"}${deploymentUrl}`.replace(/\/$/, "")
    : "http://localhost:3000";
  return `${base}${href.startsWith("/") ? href : `/${href}`}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]!);
}

async function sendEmail(to: string, notification: AppNotification) {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.NOTIFICATION_FROM_EMAIL?.trim();
  if (!key || !from) return { status: "unconfigured" as const };
  const url = absoluteUrl(notification.href);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject: notification.title,
      html: `<div style="font-family:Inter,Arial,sans-serif;background:#08080f;color:#f5f3ff;padding:32px;border-radius:20px"><p style="color:#a78bfa;font-size:12px;text-transform:uppercase;letter-spacing:.12em">LUDEX notification</p><h1 style="font-size:24px;line-height:1.25">${escapeHtml(notification.title)}</h1><p style="color:#b7b4c7;line-height:1.7">${escapeHtml(notification.body)}</p><a href="${escapeHtml(url)}" style="display:inline-block;margin-top:14px;background:#fff;color:#08080f;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700">Open in LUDEX</a></div>`,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Resend returned ${response.status}`);
  return { status: "sent" as const };
}

async function collectNotifications(entries: WatchlistEntry[], preferences: DeliveryPreferences) {
  return preferences.notificationReleases === false ? [] : releaseNotifications(entries);
}

export async function dispatchNotifications(dryRun = false): Promise<DispatchSummary> {
  const services = getAdminServices();
  if (!services) throw new Error("Firebase Admin is not configured.");
  const emailConfigured = Boolean(
    process.env.RESEND_API_KEY?.trim() && process.env.NOTIFICATION_FROM_EMAIL?.trim(),
  );
  const usersSnapshot = await services.db.collection("users").limit(MAX_USERS + 1).get();
  const users = usersSnapshot.docs.slice(0, MAX_USERS);
  const summary: DispatchSummary = {
    users: users.length,
    candidates: 0,
    delivered: 0,
    skipped: 0,
    failed: 0,
    truncated: usersSnapshot.size > MAX_USERS,
    dryRun,
  };

  for (const user of users) {
    const [watchlistSnapshot, preferencesSnapshot, subscriptionsSnapshot] = await Promise.all([
      user.ref.collection("watchlist").get(),
      user.ref.collection("settings").doc("preferences").get(),
      user.ref.collection("pushSubscriptions").where("enabled", "==", true).limit(20).get(),
    ]);
    const entries = watchlistSnapshot.docs.map((entry) => entry.data() as WatchlistEntry);
    if (entries.length === 0) continue;
    const preferences = (preferencesSnapshot.data() ?? {}) as DeliveryPreferences;
    const pushEnabled = preferences.notificationPushEnabled === true;
    const emailEnabled = preferences.notificationEmailEnabled === true
      && typeof user.data().email === "string"
      && emailConfigured;
    const fids = pushEnabled
      ? subscriptionsSnapshot.docs.map((entry) => String(entry.data().fid ?? "")).filter(Boolean)
      : [];
    if (!emailEnabled && fids.length === 0) continue;

    const timeZone = preferences.notificationTimezone || "UTC";
    if (isQuietHours(Date.now(), timeZone, preferences.notificationQuietStart, preferences.notificationQuietEnd)) {
      summary.skipped++;
      continue;
    }

    const notifications = await collectNotifications(entries, preferences);
    summary.candidates += notifications.length;
    for (const notification of notifications) {
      if (dryRun) continue;
      const ref = user.ref.collection("notificationDeliveries").doc(deliveryId(notification.id));
      try {
        await ref.create({
          notificationId: notification.id,
          kind: notification.kind,
          title: notification.title,
          body: notification.body,
          href: notification.href,
          gameName: notification.gameName,
          image: notification.image,
          imageFallback: notification.imageFallback,
          status: "processing",
          channels: {},
          createdAt: FieldValue.serverTimestamp(),
        });
      } catch (error) {
        if ((error as { code?: number | string }).code === 6 || (error as { code?: number | string }).code === "already-exists") {
          summary.skipped++;
          continue;
        }
        throw error;
      }

      const channels: Record<string, { status: string; attempted: number; sent?: number }> = {};
      try {
        if (fids.length > 0) {
          const result = await services.messaging.sendEachForMulticast({
            fids,
            data: {
              title: notification.title,
              body: notification.body,
              href: notification.href,
              image: notification.image ?? "",
              kind: notification.kind,
            },
            webpush: { headers: { Urgency: notification.priority >= 90 ? "high" : "normal" } },
          });
          const expiredFids = result.responses.flatMap((response, index) => {
            const code = response.error?.code;
            return !response.success && (
              code === "messaging/registration-token-not-registered"
              || code === "messaging/invalid-registration-token"
            ) ? [fids[index]] : [];
          });
          if (expiredFids.length > 0) {
            await Promise.all(expiredFids.map((fid) => user.ref
              .collection("pushSubscriptions")
              .doc(subscriptionId(fid))
              .delete()));
          }
          channels.push = { status: result.successCount > 0 ? "sent" : "failed", attempted: fids.length, sent: result.successCount };
        }
        if (emailEnabled) {
          const email = await sendEmail(String(user.data().email), notification);
          channels.email = { status: email.status, attempted: 1, sent: email.status === "sent" ? 1 : 0 };
        }
        const delivered = Object.values(channels).some((channel) => channel.status === "sent");
        await ref.update({ status: delivered ? "delivered" : "failed", channels, completedAt: FieldValue.serverTimestamp() });
        if (delivered) summary.delivered++;
        else summary.failed++;
      } catch (error) {
        summary.failed++;
        await ref.update({ status: "failed", channels, error: error instanceof Error ? error.message.slice(0, 240) : "Delivery failed", completedAt: FieldValue.serverTimestamp() });
      }
    }
  }

  return summary;
}
