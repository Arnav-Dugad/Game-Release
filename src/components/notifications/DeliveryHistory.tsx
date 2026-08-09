"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, History, Mail, Smartphone } from "lucide-react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { cn } from "@/lib/utils/cn";

interface DeliveryRecord {
  id: string;
  title: string;
  body: string;
  href: string;
  createdAt: number;
  status: string;
  channels: Record<string, { status?: string; sent?: number }>;
}

export function DeliveryHistory() {
  const { user } = useAuth();
  const [records, setRecords] = useState<DeliveryRecord[] | null>(null);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    void user.getIdToken().then((token) => fetch("/api/notifications/history", {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })).then((response) => response.ok ? response.json() : { deliveries: [] })
      .then((data: { deliveries?: DeliveryRecord[] }) => setRecords(data.deliveries ?? []))
      .catch((error) => { if (error instanceof Error && error.name !== "AbortError") setRecords([]); });
    return () => controller.abort();
  }, [user]);

  if (!records || records.length === 0) return null;

  return (
    <section className="mt-12">
      <Reveal className="mb-5 flex items-end justify-between gap-4">
        <div><p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-soft"><History size={13} /> Delivery log</p><h2 className="mt-1.5 font-display text-2xl font-bold">Sent beyond the inbox</h2><p className="mt-2 text-sm text-muted">A private record of scheduled push and email attempts.</p></div>
        <span className="rounded-full border border-line bg-white/[0.03] px-3 py-1.5 text-xs text-faint">Last {records.length}</span>
      </Reveal>
      <Stagger as="ul" className="space-y-2.5" gap={0.03} onMount>
        {records.slice(0, 12).map((record) => (
          <StaggerItem as="li" key={record.id}>
            <Link href={record.href} className="group flex items-center gap-4 rounded-2xl border border-line bg-panel/30 p-4 transition-colors hover:border-line-strong hover:bg-panel/50">
              <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", record.status === "delivered" ? "bg-mint/10 text-mint" : "bg-gold/10 text-gold")}>{record.status === "delivered" ? <CheckCircle2 size={17} /> : <Clock3 size={17} />}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{record.title}</span><span className="mt-1 block truncate text-xs text-muted">{record.body}</span></span>
              <span className="flex shrink-0 items-center gap-1.5 text-faint">{record.channels.push && <Smartphone size={14} aria-label="Push attempted" />}{record.channels.email && <Mail size={14} aria-label="Email attempted" />}</span>
              <time className="hidden shrink-0 text-[11px] text-faint sm:block">{record.createdAt ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(record.createdAt) : "Pending"}</time>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}
