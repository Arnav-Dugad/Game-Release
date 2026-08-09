import { FieldValue } from "firebase-admin/firestore";
import { getAdminServices } from "@/lib/firebase/admin";
import { dispatchNotifications } from "@/lib/notifications/delivery";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return Response.json({ error: "Scheduler is not configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const services = getAdminServices();
  if (!services) return Response.json({ error: "Firebase Admin is not configured" }, { status: 503 });
  const lock = services.db.collection("systemJobs").doc("notificationDispatch");
  const acquired = await services.db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(lock);
    const startedAt = snapshot.data()?.startedAt?.toMillis?.() ?? 0;
    if (snapshot.data()?.status === "running" && Date.now() - startedAt < 15 * 60_000) return false;
    transaction.set(lock, { status: "running", startedAt: FieldValue.serverTimestamp() }, { merge: true });
    return true;
  });
  if (!acquired) return Response.json({ ok: true, skipped: "already-running" });

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  try {
    const summary = await dispatchNotifications(dryRun);
    await lock.set({ status: "complete", completedAt: FieldValue.serverTimestamp(), summary }, { merge: true });
    return Response.json({ ok: true, ...summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dispatch failed";
    await lock.set({ status: "failed", completedAt: FieldValue.serverTimestamp(), error: message.slice(0, 500) }, { merge: true });
    console.error("[notifications] dispatch failed", error);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
