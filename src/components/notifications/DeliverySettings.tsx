"use client";

import { useEffect, useState } from "react";
import { Check, Clock3, Mail, Send, ShieldCheck, Smartphone } from "lucide-react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { getFirebaseApp } from "@/lib/firebase/config";
import { getUserPreferences, saveUserPreferences, type UserPreferences } from "@/lib/firebase/db";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils/cn";

interface ChannelStatus {
  enabled: boolean;
  devices: number;
  pushConfigured: boolean;
  emailConfigured: boolean;
  schedulerConfigured: boolean;
}

export function DeliverySettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<UserPreferences>({});
  const [status, setStatus] = useState<ChannelStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      const token = await user.getIdToken();
      const [saved, response] = await Promise.all([
        getUserPreferences(user.uid),
        fetch("/api/notifications/subscription", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (cancelled) return;
      setPreferences(saved ?? {});
      if (response.ok) setStatus((await response.json()) as ChannelStatus);
    };
    void load().catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  if (!user) {
    return <p className="rounded-2xl border border-line bg-white/[0.025] p-4 text-sm leading-relaxed text-muted">Sign in to enable email or device delivery. In-app notifications continue to work without outbound channels.</p>;
  }

  const update = async (patch: UserPreferences, message?: string) => {
    setPreferences((current) => ({ ...current, ...patch }));
    await saveUserPreferences(user.uid, patch);
    if (message) toast(message, "success");
  };

  const enablePush = async () => {
    if (!status?.pushConfigured || !status.schedulerConfigured) {
      toast("Push delivery needs the VAPID key and scheduler environment variables.", "error");
      return;
    }
    setBusy(true);
    try {
      if (!("Notification" in window) || !("serviceWorker" in navigator)) throw new Error("This browser does not support web push.");
      const supported = await import("firebase/messaging").then(({ isSupported }) => isSupported());
      if (!supported) throw new Error("Push notifications are not supported in this browser.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Notification permission was not granted.");
      const app = getFirebaseApp();
      if (!app) throw new Error("Firebase is unavailable.");
      const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      const [{ getMessaging, register: registerMessaging }, { getInstallations, getId }] = await Promise.all([
        import("firebase/messaging"),
        import("firebase/installations"),
      ]);
      await registerMessaging(getMessaging(app), {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: registration,
      });
      const fid = await getId(getInstallations(app));
      const token = await user.getIdToken();
      const response = await fetch("/api/notifications/subscription", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ fid, label: navigator.userAgent.includes("Mobile") ? "Mobile browser" : "Desktop browser" }),
      });
      if (!response.ok) throw new Error("The device could not be registered.");
      await update({
        notificationPushEnabled: true,
        notificationTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setStatus((current) => current ? { ...current, enabled: true, devices: Math.max(1, current.devices) } : current);
      toast("Device push is active", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Push setup failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  const disablePush = async () => {
    setBusy(true);
    try {
      const app = getFirebaseApp();
      let fid = "";
      if (app) {
        const [{ getMessaging, unregister }, { getInstallations, getId }] = await Promise.all([
          import("firebase/messaging"),
          import("firebase/installations"),
        ]);
        fid = await getId(getInstallations(app));
        await unregister(getMessaging(app)).catch(() => {});
      }
      const token = await user.getIdToken();
      await fetch("/api/notifications/subscription", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(fid ? { fid } : { all: true }),
      });
      await update({ notificationPushEnabled: false });
      setStatus((current) => current ? { ...current, enabled: false, devices: Math.max(0, current.devices - 1) } : current);
      toast("Device push disabled", "info");
    } finally {
      setBusy(false);
    }
  };

  const pushActive = preferences.notificationPushEnabled === true && status?.enabled === true;
  const emailActive = preferences.notificationEmailEnabled === true;
  const schedulerReady = status?.schedulerConfigured === true;
  const pushReady = status?.pushConfigured === true && schedulerReady;
  const emailReady = status?.emailConfigured === true && schedulerReady;

  return (
    <div className="mt-5 space-y-4 border-t border-line pt-5">
      <div className="flex items-center justify-between gap-4">
        <div><p className="flex items-center gap-2 text-sm font-semibold"><Send size={15} className="text-brand-soft" /> Outbound delivery</p><p className="mt-1 text-xs leading-relaxed text-muted">Scheduled alerts arrive even when LUDEX is closed.</p></div>
        <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]", schedulerReady ? "border-mint/25 bg-mint/10 text-mint" : "border-gold/25 bg-gold/10 text-gold")}>{schedulerReady ? "Scheduler ready" : "Setup needed"}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ChannelCard icon={<Smartphone size={17} />} title="Device push" detail={pushActive ? `${status?.devices ?? 1} registered device${status?.devices === 1 ? "" : "s"}` : schedulerReady ? "Instant browser notifications" : "Connect the scheduler to activate"} active={pushActive} configured={pushReady} busy={busy} onClick={pushActive ? disablePush : enablePush} />
        <ChannelCard icon={<Mail size={17} />} title="Email alerts" detail={emailReady ? user.email ?? "Account email" : status?.emailConfigured ? "Connect the scheduler to activate" : "Connect Resend to activate"} active={emailActive} configured={emailReady} onClick={() => void update({ notificationEmailEnabled: !emailActive, notificationTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone }, !emailActive ? "Email alerts enabled" : "Email alerts disabled")} />
      </div>

      <div className="grid gap-3 rounded-2xl border border-line bg-black/15 p-4 sm:grid-cols-2">
        <TimeField label="Quiet from" value={preferences.notificationQuietStart ?? "22:00"} onChange={(value) => void update({ notificationQuietStart: value, notificationTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone })} />
        <TimeField label="Quiet until" value={preferences.notificationQuietEnd ?? "08:00"} onChange={(value) => void update({ notificationQuietEnd: value, notificationTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone })} />
      </div>
      <p className="flex items-center gap-2 text-[11px] leading-relaxed text-faint"><ShieldCheck size={13} className="text-mint" /> Permission is device-specific. Delivery identifiers are stored privately and never exposed to other users.</p>
    </div>
  );
}

function ChannelCard({ icon, title, detail, active, configured, busy = false, onClick }: { icon: React.ReactNode; title: string; detail: string; active: boolean; configured: boolean; busy?: boolean; onClick: () => void }) {
  const disabled = busy || (!configured && !active);
  return <button type="button" disabled={disabled} onClick={onClick} className={cn("flex min-h-24 items-center gap-3 rounded-2xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60", active ? "border-mint/30 bg-mint/[0.08]" : "border-line bg-white/[0.025] hover:border-line-strong")}><span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", active ? "bg-mint/12 text-mint" : "bg-white/[0.05] text-faint")}>{active ? <Check size={17} /> : icon}</span><span className="min-w-0"><span className="block text-sm font-semibold">{title}</span><span className="mt-1 block truncate text-xs text-muted">{detail}</span><span className={cn("mt-1 block text-[10px] uppercase tracking-[0.1em]", configured ? active ? "text-mint" : "text-faint" : "text-gold")}>{configured ? active ? "Active" : "Off" : "Not configured"}</span></span></button>;
}

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-xs text-muted"><span className="mb-2 flex items-center gap-1.5 font-semibold text-text"><Clock3 size={13} className="text-brand-soft" /> {label}</span><input type="time" value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:border-brand" /></label>;
}
