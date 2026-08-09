"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BellRing,
  BookOpenCheck,
  Cloud,
  Clock3,
  Copy,
  Gamepad2,
  Layers3,
  LibraryBig,
  Sparkles,
  Star,
  Trophy,
  Zap,
} from "lucide-react";
import { GameCover } from "@/components/game/GameCover";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Container } from "@/components/ui/SectionHeading";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { getUserReviews, type Review } from "@/lib/firebase/db";
import { useWatchlist } from "@/lib/firebase/WatchlistProvider";
import { buildLibraryStats, type RankedStat } from "@/lib/games/stats";
import type { Ref } from "@/lib/games/types";
import { canonicalEntryHref } from "@/lib/notifications/model";
import { cn } from "@/lib/utils/cn";

export function StatsView({ genreDirectory }: { genreDirectory: Ref[] }) {
  const { user } = useAuth();
  const { entries, loading } = useWatchlist();
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const stats = useMemo(() => buildLibraryStats(entries, genreDirectory), [entries, genreDirectory]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void getUserReviews(user.uid)
      .then((items) => { if (active) setReviews(items); })
      .catch(() => { if (active) setReviews([]); });
    return () => { active = false; };
  }, [user]);

  if (loading) return <StatsSkeleton />;
  if (stats.uniqueGames === 0) {
    return (
      <Container className="py-12">
        <EmptyState
          icon={<BarChart3 size={24} />}
          title="Your story starts with one game"
          body="Track a game and its Firebase record will immediately begin shaping this private stats studio."
          action={{ href: "/browse", label: "Explore the catalogue" }}
          secondaryAction={{ href: "/upcoming", label: "See upcoming games" }}
        />
      </Container>
    );
  }

  const reviewedAverage = reviews?.length
    ? Math.round((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length) * 10) / 10
    : null;
  const maxTimeline = Math.max(1, ...stats.timeline.flatMap((month) => [month.added, month.completed]));
  const recent = stats.games.slice(0, 5);

  return (
    <Container className="space-y-5 py-8 lg:space-y-7 lg:py-12">
      <Reveal className="noise relative isolate overflow-hidden rounded-[2rem] border border-brand/25 bg-[radial-gradient(circle_at_10%_0%,rgba(124,92,255,0.28),transparent_34%),radial-gradient(circle_at_95%_90%,rgba(34,211,238,0.14),transparent_38%),linear-gradient(145deg,#111126,#07070e)] p-6 shadow-[0_45px_130px_-65px_rgba(124,92,255,0.9)] sm:p-8 lg:p-10">
        <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-end">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-brand-soft"><Sparkles size={13} /> Live Firebase intelligence</p>
            <h2 className="mt-3 max-w-3xl font-display text-4xl font-black leading-[0.98] tracking-[-0.05em] sm:text-6xl">Your gaming life,<br /><span className="text-gradient">beautifully measured.</span></h2>
            <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">Every headline counts unique games. Extra platform copies are preserved as their own insight—never allowed to inflate your library total.</p>
          </div>
          <div className="flex items-center gap-5 rounded-3xl border border-white/10 bg-black/25 p-5 backdrop-blur-xl">
            <ProgressRing value={stats.completionRate} />
            <div><p className="font-display text-xl font-black">Completion arc</p><p className="mt-1 text-xs leading-relaxed text-muted">{stats.played} of {stats.uniqueGames} tracked games completed</p></div>
          </div>
        </div>
      </Reveal>

      <Stagger className="grid grid-cols-2 gap-3 lg:grid-cols-4" onMount gap={0.04}>
        <Metric icon={<LibraryBig size={18} />} label="Unique games" value={stats.uniqueGames} tone="brand" />
        <Metric icon={<Layers3 size={18} />} label="Owned games" value={stats.ownedGames} note={stats.platformCopies > stats.ownedGames ? `${stats.platformCopies} platform copies` : undefined} tone="mint" />
        <Metric icon={<Trophy size={18} />} label="Completed" value={stats.played} tone="gold" />
        <Metric icon={<Gamepad2 size={18} />} label="Playing now" value={stats.playing} tone="neon" />
      </Stagger>

      <Stagger className="grid grid-cols-2 gap-3 lg:grid-cols-4" onMount gap={0.04}>
        <Metric icon={<BellRing size={18} />} label="Games followed" value={stats.followedGames} note={stats.upcomingFollowed ? `${stats.upcomingFollowed} upcoming` : "Release + DLC alerts"} tone="brand" />
        <Metric icon={<Cloud size={18} />} label="Via subscription" value={stats.subscriptionGames} note={stats.subscriptionAccesses > stats.subscriptionGames ? `${stats.subscriptionAccesses} service/platform records` : undefined} tone="neon" />
        <Metric icon={<Copy size={18} />} label="Extra copies" value={stats.extraCopies} note="Never inflate game count" tone="gold" />
        <Metric icon={<Zap size={18} />} label="Completed in 90 days" value={stats.completedLast90Days} note={stats.collectionAgeDays ? `${stats.collectionAgeDays} days of history` : undefined} tone="mint" />
      </Stagger>

      <Reveal className="grid gap-3 rounded-[1.75rem] border border-line bg-[linear-gradient(135deg,rgba(124,92,255,0.08),rgba(34,211,238,0.035))] p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
        <Insight label="Playable access" value={`${stats.accessibleGames}/${stats.uniqueGames}`} detail="Owned or reached through a subscription" />
        <Insight label="Owned backlog" value={stats.unplayedOwned} detail="Owned games not marked completed" />
        <Insight label="85+ critic picks" value={stats.highScorers} detail="Highly scored games in your orbit" />
        <Insight label="Known backlog" value={stats.backlogHours ? `${stats.backlogHours}h` : "—"} detail="Estimated time across unfinished records" />
      </Reveal>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <Reveal className="glass rounded-[1.75rem] p-5 sm:p-7">
          <PanelHeading icon={<BarChart3 size={17} />} eyebrow="Twelve-month signal" title="Collection momentum" />
          <div className="mt-8 overflow-x-auto pb-2 no-scrollbar">
          <div className="flex h-56 min-w-[680px] items-end gap-3" role="img" aria-label="Games added and completed over the last twelve months">
            {stats.timeline.map((month) => (
              <div key={month.key} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <div className="flex h-44 w-full items-end justify-center gap-1.5">
                  <span title={`${month.added} added`} className="w-[38%] min-w-2 rounded-t-lg bg-gradient-to-t from-brand/35 to-brand" style={{ height: `${Math.max(month.added ? 10 : 2, (month.added / maxTimeline) * 100)}%` }} />
                  <span title={`${month.completed} completed`} className="w-[38%] min-w-2 rounded-t-lg bg-gradient-to-t from-mint/30 to-mint" style={{ height: `${Math.max(month.completed ? 10 : 2, (month.completed / maxTimeline) * 100)}%` }} />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">{month.label}</span>
              </div>
            ))}
          </div>
          </div>
          <div className="mt-4 flex gap-5 border-t border-line pt-4 text-[11px] text-muted"><Legend tone="bg-brand" label="Added" /><Legend tone="bg-mint" label="Completed" /></div>
        </Reveal>

        <Reveal delay={0.05} className="glass rounded-[1.75rem] p-5 sm:p-7">
          <PanelHeading icon={<BookOpenCheck size={17} />} eyebrow="Status mix" title="Your current orbit" />
          <div className="mt-7 space-y-5">
            <StatusBar label="Want to play" value={stats.wanted} total={stats.uniqueGames} tone="bg-brand" />
            <StatusBar label="Playing" value={stats.playing} total={stats.uniqueGames} tone="bg-neon" />
            <StatusBar label="Completed" value={stats.played} total={stats.uniqueGames} tone="bg-mint" />
          </div>
          <div className="mt-7 grid grid-cols-2 gap-3 border-t border-line pt-5">
            <MiniFact icon={<Clock3 size={14} />} value={stats.completedHours ? `${stats.completedHours}h` : "—"} label="Known hours finished" />
            <MiniFact icon={<Star size={14} />} value={stats.averageCritic ?? "—"} label="Average critic score" />
          </div>
        </Reveal>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <RankPanel title="Where your collection lives" eyebrow="Ownership platforms" items={stats.platforms} empty="Mark where you own games to unlock this view." />
        <RankPanel title="The shape of your taste" eyebrow="Top genres" items={stats.genres} empty="Genre intelligence will appear as you track IGDB games." />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <RankPanel title="Services that carried your play" eyebrow="Subscription history" items={stats.subscriptions} empty="Record Game Pass, PlayStation Plus, or another service on a game page." />
        <RankPanel title="Where you actually played" eyebrow="Play platforms" items={stats.playedPlatforms} empty="Set a play platform or add a subscription access record." />
        <RankPanel title="Your release-era fingerprint" eyebrow="Games by decade" items={stats.decades} empty="Release dates will build your era profile." />
        <RankPanel title="Quality distribution" eyebrow="Critic score bands" items={stats.scoreBands} empty="Scored games will build your quality curve." />
      </div>

      <Reveal className="glass overflow-hidden rounded-[1.75rem]">
        <div className="flex flex-col justify-between gap-3 border-b border-line p-5 sm:flex-row sm:items-end sm:p-7">
          <PanelHeading icon={<LibraryBig size={17} />} eyebrow="Latest Firebase records" title="Recently added" />
          <Button href="/library" size="sm" variant="secondary">Open library</Button>
        </div>
        <div className="grid gap-px bg-line sm:grid-cols-5">
          {recent.map((game) => (
            <Link key={game.gameId} href={canonicalEntryHref(game)} className="group flex gap-3 bg-bg-elev p-4 transition-colors hover:bg-panel sm:flex-col">
              <span className="relative aspect-[3/4] w-16 shrink-0 overflow-hidden rounded-xl border border-line sm:w-full"><GameCover name={game.name} slug={game.slug} image={game.image} imageFallback={game.imageFallback} width={360} sizes="(max-width:640px) 64px, 18vw" /></span>
              <span className="min-w-0"><span className="line-clamp-2 text-sm font-bold leading-snug transition-colors group-hover:text-brand-soft">{game.name}</span><span className="mt-1 block text-[10px] uppercase tracking-[0.12em] text-faint">{game.status === "played" ? "Completed" : game.status === "playing" ? "Playing" : "Want to play"}</span></span>
            </Link>
          ))}
        </div>
      </Reveal>

      <Reveal className="flex flex-col justify-between gap-4 rounded-3xl border border-line bg-white/[0.025] p-5 sm:flex-row sm:items-center sm:p-6">
        <div><p className="text-sm font-bold">Your private record is synchronized</p><p className="mt-1 text-xs leading-relaxed text-muted">Watchlist, ownership, status timestamps, preferences, notification history, and {reviews === null ? "review data" : `${reviews.length} review${reviews.length === 1 ? "" : "s"}`} live in Firebase.{reviewedAverage !== null ? ` Your average review score is ${reviewedAverage}/10.` : ""}</p></div>
        <Button href="/profile" variant="secondary" size="sm">View profile</Button>
      </Reveal>
    </Container>
  );
}

function ProgressRing({ value }: { value: number }) {
  return <div className="relative grid h-24 w-24 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(var(--color-mint) ${value}%, rgba(255,255,255,.08) 0)` }}><span className="absolute inset-[7px] rounded-full bg-bg-elev" /><span className="relative font-display text-xl font-black tabular-nums">{value}%</span></div>;
}

function Metric({ icon, label, value, note, tone }: { icon: React.ReactNode; label: string; value: number; note?: string; tone: "brand" | "mint" | "gold" | "neon" }) {
  const colors = { brand: "bg-brand/10 text-brand-soft", mint: "bg-mint/10 text-mint", gold: "bg-gold/10 text-gold", neon: "bg-neon/10 text-neon" };
  return <StaggerItem><div className="glass h-full rounded-3xl p-5 sm:p-6"><span className={cn("grid h-10 w-10 place-items-center rounded-2xl", colors[tone])}>{icon}</span><p className="mt-5 font-display text-3xl font-black tabular-nums sm:text-4xl">{value}</p><p className="mt-1 text-xs text-muted">{label}</p>{note && <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.11em] text-faint">{note}</p>}</div></StaggerItem>;
}

function PanelHeading({ icon, eyebrow, title }: { icon: React.ReactNode; eyebrow: string; title: string }) {
  return <div><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-soft">{icon}{eyebrow}</p><h2 className="mt-2 font-display text-xl font-black sm:text-2xl">{title}</h2></div>;
}

function Legend({ tone, label }: { tone: string; label: string }) { return <span className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", tone)} />{label}</span>; }

function StatusBar({ label, value, total, tone }: { label: string; value: number; total: number; tone: string }) {
  const percent = total ? Math.round((value / total) * 100) : 0;
  return <div><div className="mb-2 flex items-center justify-between text-xs"><span className="font-semibold">{label}</span><span className="tabular-nums text-muted">{value} · {percent}%</span></div><div className="h-2 overflow-hidden rounded-full bg-white/[0.06]"><div className={cn("h-full rounded-full", tone)} style={{ width: `${percent}%` }} /></div></div>;
}

function MiniFact({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) { return <div><span className="text-brand-soft">{icon}</span><p className="mt-2 font-display text-lg font-black tabular-nums">{value}</p><p className="mt-0.5 text-[10px] leading-tight text-faint">{label}</p></div>; }

function Insight({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-4"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-faint">{label}</p><p className="mt-2 font-display text-2xl font-black tabular-nums">{value}</p><p className="mt-1 text-[11px] leading-relaxed text-muted">{detail}</p></div>;
}

function RankPanel({ title, eyebrow, items, empty }: { title: string; eyebrow: string; items: RankedStat[]; empty: string }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return <Reveal className="glass rounded-[1.75rem] p-5 sm:p-7"><PanelHeading icon={<Layers3 size={17} />} eyebrow={eyebrow} title={title} /><div className="mt-6 space-y-4">{items.length ? items.slice(0, 6).map((item, index) => <div key={item.key} className="grid grid-cols-[24px_minmax(0,1fr)_28px] items-center gap-3"><span className="font-mono text-[10px] text-faint">{String(index + 1).padStart(2, "0")}</span><div className="min-w-0"><div className="mb-1.5 truncate text-xs font-semibold">{item.label}</div><div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-gradient-to-r from-brand to-neon" style={{ width: `${Math.max(5, (item.value / max) * 100)}%` }} /></div></div><span className="text-right text-xs font-bold tabular-nums">{item.value}</span></div>) : <p className="rounded-2xl border border-dashed border-line p-5 text-sm leading-relaxed text-muted">{empty}</p>}</div></Reveal>;
}

function StatsSkeleton() { return <Container className="space-y-5 py-10"><Skeleton className="h-96 rounded-[2rem]" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-40 rounded-3xl" />)}</div><div className="grid gap-5 lg:grid-cols-2"><Skeleton className="h-80 rounded-[1.75rem]" /><Skeleton className="h-80 rounded-[1.75rem]" /></div></Container>; }
