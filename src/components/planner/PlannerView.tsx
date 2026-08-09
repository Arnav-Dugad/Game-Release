"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  Gamepad2,
  Gauge,
  Hourglass,
  Layers3,
  Sparkles,
  Target,
} from "lucide-react";
import { GameCover } from "@/components/game/GameCover";
import { Reveal } from "@/components/motion/Reveal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Container } from "@/components/ui/SectionHeading";
import { useToast } from "@/components/ui/Toast";
import { useWatchlist } from "@/lib/firebase/WatchlistProvider";
import {
  buildPlannerIcs,
  buildPlannerSnapshot,
  FALLBACK_GAME_HOURS,
  type PlannedGame,
  type ReleaseConflict,
} from "@/lib/games/planner";
import { canonicalEntryHref } from "@/lib/notifications/model";
import { usePreferences } from "@/lib/preferences/PreferencesProvider";
import { formatDate, relativeRelease } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export function PlannerView() {
  const { entries, loading } = useWatchlist();
  const { ready, plannerWeeklyHours, setPlannerWeeklyHours } = usePreferences();
  const { toast } = useToast();
  // One stable planning instant per mount keeps every relative label aligned.
  const [now] = useState(() => Date.now());
  const snapshot = useMemo(
    () => buildPlannerSnapshot(entries, plannerWeeklyHours, now),
    [entries, plannerWeeklyHours, now],
  );

  if (loading || !ready) return <PlannerSkeleton />;

  if (entries.length === 0) {
    return (
      <Container className="py-12 lg:py-16">
        <div className="noise relative overflow-hidden rounded-[2rem] border border-line bg-panel/45 px-6 py-16 text-center sm:px-10">
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(124,92,255,0.17),transparent_45%)]" />
          <span className="relative mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-brand/25 bg-brand/10 text-brand-soft">
            <CalendarDays size={27} />
          </span>
          <h2 className="relative mt-6 text-2xl font-black sm:text-3xl">Build your first release runway</h2>
          <p className="relative mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
            Track a few games and LUDEX will arrange exact dates, keep uncertain windows honest,
            flag crowded weeks, and suggest what fits your available time.
          </p>
          <div className="relative mt-7 flex flex-wrap justify-center gap-3">
            <Button href="/upcoming" icon={<Sparkles size={16} />}>Explore upcoming games</Button>
            <Button href="/browse" variant="secondary">Browse everything</Button>
          </div>
        </div>
      </Container>
    );
  }

  const exportCalendar = () => {
    if (snapshot.upcoming.length === 0) return;
    const contents = buildPlannerIcs(entries, window.location.origin);
    const url = URL.createObjectURL(new Blob([contents], { type: "text/calendar;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "ludex-release-plan.ics";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    toast(`${snapshot.upcoming.length} release ${snapshot.upcoming.length === 1 ? "date" : "dates"} ready for your calendar`, "success");
  };

  return (
    <Container className="space-y-8 py-8 sm:py-10 lg:space-y-12 lg:py-14">
      <Reveal>
        <section className="noise relative overflow-hidden rounded-[2rem] border border-line-strong bg-panel/60 p-5 shadow-[0_30px_100px_-55px_rgba(124,92,255,0.8)] sm:p-7 lg:p-9">
          <div aria-hidden className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand/15 blur-3xl" />
          <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)] lg:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={snapshot.conflicts.length ? "gold" : "mint"} icon={snapshot.conflicts.length ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}>
                  {snapshot.conflicts.length ? `${snapshot.conflicts.length} schedule ${snapshot.conflicts.length === 1 ? "collision" : "collisions"}` : "Runway clear"}
                </Badge>
                <Badge>{snapshot.upcoming.length} exact {snapshot.upcoming.length === 1 ? "date" : "dates"}</Badge>
              </div>
              <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.2em] text-brand-soft">Your weekly briefing</p>
              <h2 className="mt-2 max-w-3xl text-2xl font-black leading-tight sm:text-3xl lg:text-4xl">
                {briefingHeadline(snapshot.releasesIn30Days, snapshot.conflicts.length, snapshot.nextRelease?.name)}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-[15px]">
                {briefingBody(snapshot.backlogHours, snapshot.weeksToClear, snapshot.estimatedBacklogCount)}
              </p>
            </div>

            <div className="rounded-2xl border border-line bg-black/15 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <label htmlFor="weekly-hours" className="text-sm font-semibold">Weekly play budget</label>
                  <p className="mt-1 text-xs text-faint">Used only for workload warnings.</p>
                </div>
                <output htmlFor="weekly-hours" className="font-display text-2xl font-black tabular-nums text-white">
                  {plannerWeeklyHours}<span className="ml-1 text-xs font-medium text-muted">hrs</span>
                </output>
              </div>
              <input
                id="weekly-hours"
                type="range"
                min="1"
                max="40"
                step="1"
                value={plannerWeeklyHours}
                onChange={(event) => setPlannerWeeklyHours(Number(event.target.value))}
                aria-valuetext={`${plannerWeeklyHours} hours per week`}
                className="mt-5 h-2 w-full cursor-pointer accent-[var(--color-brand)]"
              />
              <div className="mt-2 flex justify-between text-[10px] uppercase tracking-wider text-faint"><span>Light · 1h</span><span>Deep · 40h</span></div>
              <Button
                variant="secondary"
                size="sm"
                fullWidth
                className="mt-5"
                icon={<CalendarPlus size={15} />}
                onClick={exportCalendar}
                disabled={snapshot.upcoming.length === 0}
              >
                Export exact dates
              </Button>
              <p className="mt-2 text-center text-[10px] leading-relaxed text-faint">Generated privately on this device · .ics format</p>
            </div>
          </div>
        </section>
      </Reveal>

      <section aria-labelledby="planner-overview" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <h2 id="planner-overview" className="sr-only">Planner overview</h2>
        <Metric icon={<CalendarDays size={17} />} label="Next 30 days" value={String(snapshot.releasesIn30Days)} detail="tracked releases" tone="brand" />
        <Metric icon={<AlertTriangle size={17} />} label="Collision radar" value={String(snapshot.conflicts.length)} detail="crowded weeks" tone={snapshot.conflicts.length ? "gold" : "mint"} />
        <Metric icon={<Hourglass size={17} />} label="Active backlog" value={`${snapshot.backlogHours}h`} detail={snapshot.estimatedBacklogCount ? `${snapshot.estimatedBacklogCount} estimated` : "provider playtime"} tone="neon" />
        <Metric icon={<Gauge size={17} />} label="Clearance time" value={`${snapshot.weeksToClear}w`} detail={`at ${snapshot.weeklyHours}h per week`} tone="mint" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(330px,0.55fr)]">
        <div className="min-w-0 space-y-5">
          <SectionIntro eyebrow="The runway" title="Every exact release, in order" description="A date stays on this runway only when the source knows the day. Collision markers compare launch-week load with your play budget." />
          {snapshot.months.length ? (
            <div className="space-y-6">
              {snapshot.months.map((month) => (
                <div key={month.key} className="overflow-hidden rounded-3xl border border-line bg-panel/35">
                  <div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-6">
                    <h3 className="text-base font-bold sm:text-lg">{month.label}</h3>
                    <span className="text-xs tabular-nums text-faint">{month.entries.length} {month.entries.length === 1 ? "release" : "releases"}</span>
                  </div>
                  <ul className="divide-y divide-line">
                    {month.entries.map((entry) => (
                      <li key={entry.gameId}><ReleaseRow entry={entry} conflict={conflictFor(entry, snapshot.conflicts)} now={now} /></li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <QuietPanel icon={<CalendarDays size={22} />} title="No exact dates yet" body="Your tracked release windows are preserved below. As soon as a day is announced, it will move onto the runway automatically." />
          )}
        </div>

        <aside className="space-y-5">
          <SectionIntro eyebrow="Decision engine" title="What should I play next?" description="LUDEX favors what you have started, then games already released and ready to play." />
          {snapshot.nextPlay ? <NextPlayCard entry={snapshot.nextPlay} weeklyHours={snapshot.weeklyHours} /> : <QuietPanel icon={<Gamepad2 size={22} />} title="Nothing is waiting" body="Your active list contains only future releases. Enjoy the breathing room—or add something already out." />}

          <div className="rounded-3xl border border-line bg-panel/35 p-5 sm:p-6">
            <div className="flex items-center gap-2"><Target size={17} className="text-brand-soft" /><h3 className="font-bold">Planning notes</h3></div>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
              <Note>Played games do not inflate your active workload.</Note>
              <Note>Unknown completion times use a clearly marked {FALLBACK_GAME_HOURS}-hour planning estimate.</Note>
              <Note>Release windows and TBA games never create false calendar events.</Note>
            </ul>
          </div>
        </aside>
      </section>

      {snapshot.conflicts.length > 0 && (
        <section aria-labelledby="collision-title">
          <SectionIntro eyebrow="Collision radar" title="Weeks that need a decision" description="These launches share a Monday-to-Sunday window. The warning becomes high pressure when their projected load exceeds your weekly budget." id="collision-title" />
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {snapshot.conflicts.map((conflict) => <ConflictCard key={conflict.weekStart} conflict={conflict} weeklyHours={snapshot.weeklyHours} />)}
          </div>
        </section>
      )}

      {(snapshot.releaseWindows.length > 0 || snapshot.undated.length > 0) && (
        <section aria-labelledby="holding-title">
          <SectionIntro eyebrow="Holding area" title="Announced, but not pretending to be exact" description="These games stay visible without inventing a calendar day. They graduate to your runway automatically when an exact date lands." id="holding-title" />
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {snapshot.releaseWindows.length > 0 && <HoldingGroup title="Release windows" icon={<Layers3 size={17} />} entries={snapshot.releaseWindows} />}
            {snapshot.undated.length > 0 && <HoldingGroup title="Date TBA" icon={<Clock3 size={17} />} entries={snapshot.undated} />}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line py-4">
        <p className="text-sm text-muted">Need to add, remove, or change a play status?</p>
        <Button href="/watchlist" variant="secondary" size="sm" iconRight={<ArrowRight size={14} />}>Manage watchlist</Button>
      </div>
    </Container>
  );
}

function briefingHeadline(releases: number, conflicts: number, nextName?: string) {
  if (releases === 0) return "The next month is yours—no tracked launch is crowding it.";
  if (conflicts > 0) return `${releases} releases are approaching, with ${conflicts} week${conflicts === 1 ? "" : "s"} asking for a choice.`;
  return `${nextName ?? "Your next tracked game"} leads a clean, conflict-free month.`;
}

function briefingBody(hours: number, weeks: number, estimates: number) {
  if (hours === 0) return "Your released backlog is clear, so every available hour can go toward the next launch.";
  return `Your active released backlog carries about ${hours} hours—roughly ${weeks} ${weeks === 1 ? "week" : "weeks"} at your current pace.${estimates ? ` ${estimates} ${estimates === 1 ? "title uses" : "titles use"} a visible fallback estimate.` : ""}`;
}

function Metric({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: string; detail: string; tone: "brand" | "gold" | "mint" | "neon" }) {
  const colors = { brand: "text-brand-soft bg-brand/10 border-brand/20", gold: "text-gold bg-gold/10 border-gold/20", mint: "text-mint bg-mint/10 border-mint/20", neon: "text-neon bg-neon/10 border-neon/20" };
  return <div className="rounded-2xl border border-line bg-panel/35 p-5"><span className={cn("grid h-9 w-9 place-items-center rounded-xl border", colors[tone])}>{icon}</span><p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-faint">{label}</p><p className="mt-1 font-display text-3xl font-black tabular-nums">{value}</p><p className="mt-1 text-xs text-muted">{detail}</p></div>;
}

function SectionIntro({ eyebrow, title, description, id }: { eyebrow: string; title: string; description: string; id?: string }) {
  return <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-soft">{eyebrow}</p><h2 id={id} className="mt-2 text-2xl font-black sm:text-3xl">{title}</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{description}</p></div>;
}

function conflictFor(entry: PlannedGame, conflicts: ReleaseConflict[]) {
  return conflicts.find((conflict) => conflict.entries.some((candidate) => candidate.gameId === entry.gameId));
}

function ReleaseRow({ entry, conflict, now }: { entry: PlannedGame; conflict?: ReleaseConflict; now: number }) {
  return (
    <Link href={canonicalEntryHref(entry)} className="group grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 p-4 transition-colors hover:bg-white/[0.035] sm:grid-cols-[56px_minmax(0,1fr)_auto] sm:gap-4 sm:px-6">
      <span className="relative aspect-[3/4] overflow-hidden rounded-lg bg-panel-2"><GameCover name={entry.name} slug={entry.slug} image={entry.image} imageFallback={entry.imageFallback} width={140} sizes="56px" /></span>
      <span className="min-w-0"><span className="block truncate text-sm font-bold transition-colors group-hover:text-brand-soft sm:text-base">{entry.name}</span><span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted"><span>{formatDate(entry.released)}</span><span aria-hidden>·</span><span>{relativeRelease(entry.released, new Date(now))}</span>{conflict && <Badge tone={conflict.severity === "crunch" ? "flare" : "gold"} className="ml-1">Same-week collision</Badge>}</span></span>
      <span className="hidden text-right sm:block"><span className="block text-xs font-semibold tabular-nums">{entry.planningHours}h</span><span className="mt-1 block text-[10px] text-faint">{entry.hoursAreEstimated ? "estimate" : "playtime"}</span></span>
    </Link>
  );
}

function NextPlayCard({ entry, weeklyHours }: { entry: PlannedGame; weeklyHours: number }) {
  const weeks = Math.max(1, Math.ceil(entry.planningHours / weeklyHours));
  return (
    <Link href={canonicalEntryHref(entry)} className="group relative block overflow-hidden rounded-3xl border border-brand/25 bg-panel/60 p-5 shadow-[0_25px_80px_-55px_rgba(124,92,255,0.9)] sm:p-6">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_90%_10%,rgba(124,92,255,0.2),transparent_45%)]" />
      <div className="relative flex gap-4"><span className="relative h-28 w-[84px] shrink-0 overflow-hidden rounded-xl bg-panel-2 shadow-xl"><GameCover name={entry.name} slug={entry.slug} image={entry.image} imageFallback={entry.imageFallback} width={220} sizes="84px" /></span><span className="min-w-0"><Badge tone="brand" icon={<Sparkles size={11} />}>{entry.status === "playing" ? "Continue playing" : (entry.ownedOn?.length ?? 0) > 0 ? "Ready in your library" : "Best available match"}</Badge><h3 className="mt-3 text-xl font-black leading-tight transition-colors group-hover:text-brand-soft">{entry.name}</h3><p className="mt-2 text-xs leading-relaxed text-muted">About {entry.planningHours} hours · {weeks} {weeks === 1 ? "week" : "weeks"} at your pace{entry.hoursAreEstimated ? " · estimated" : ""}</p></span></div>
      <span className="relative mt-5 flex items-center justify-between border-t border-line pt-4 text-sm font-semibold"><span>Open game details</span><ArrowRight size={15} className="transition-transform group-hover:translate-x-1" /></span>
    </Link>
  );
}

function ConflictCard({ conflict, weeklyHours }: { conflict: ReleaseConflict; weeklyHours: number }) {
  const over = Math.max(0, conflict.hours - weeklyHours);
  return <div className={cn("rounded-3xl border p-5 sm:p-6", conflict.severity === "crunch" ? "border-flare/30 bg-flare/[0.055]" : "border-gold/25 bg-gold/[0.045]")}><div className="flex items-start justify-between gap-4"><div><Badge tone={conflict.severity === "crunch" ? "flare" : "gold"}>{conflict.severity === "crunch" ? "Capacity warning" : "Choice point"}</Badge><h3 className="mt-3 font-bold">Week of {formatDate(conflict.weekStart)}</h3><p className="mt-1 text-xs text-muted">{formatDate(conflict.weekStart)}–{formatDate(conflict.weekEnd)}</p></div><span className="text-right"><span className="block font-display text-2xl font-black tabular-nums">{conflict.hours}h</span><span className="text-[10px] text-faint">projected</span></span></div><div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/8"><div className={cn("h-full rounded-full", over ? "bg-flare" : "bg-gold")} style={{ width: `${Math.min(100, (conflict.hours / weeklyHours) * 100)}%` }} /></div><p className="mt-2 text-xs leading-relaxed text-muted">{over ? `${over} hours above your weekly budget. Pick a launch-day priority and let the others wait.` : `${conflict.entries.length} releases share the week, but their projected load fits your budget.`}</p><div className="mt-4 flex flex-wrap gap-2">{conflict.entries.map((entry) => <Link key={entry.gameId} href={canonicalEntryHref(entry)} className="rounded-full border border-line bg-white/[0.04] px-3 py-1.5 text-xs font-medium transition-colors hover:border-line-strong hover:text-text text-muted">{entry.name}</Link>)}</div></div>;
}

function HoldingGroup({ title, icon, entries }: { title: string; icon: React.ReactNode; entries: PlannedGame[] }) {
  return <div className="rounded-3xl border border-line bg-panel/35 p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 font-bold"><span className="text-brand-soft">{icon}</span>{title}</h3><span className="text-xs tabular-nums text-faint">{entries.length}</span></div><ul className="mt-4 space-y-2">{entries.slice(0, 8).map((entry) => <li key={entry.gameId}><Link href={canonicalEntryHref(entry)} className="group flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-white/[0.04]"><span className="truncate font-medium text-muted transition-colors group-hover:text-text">{entry.name}</span><Badge>{entry.releaseWindow ?? "TBA"}</Badge></Link></li>)}</ul>{entries.length > 8 && <p className="mt-3 px-3 text-xs text-faint">+ {entries.length - 8} more safely held in your watchlist</p>}</div>;
}

function QuietPanel({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return <div className="rounded-3xl border border-dashed border-line bg-panel/20 px-6 py-10 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-line bg-white/[0.04] text-faint">{icon}</span><h3 className="mt-4 font-bold">{title}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">{body}</p></div>;
}

function Note({ children }: { children: React.ReactNode }) {
  return <li className="flex gap-2.5"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-mint" /><span>{children}</span></li>;
}

function PlannerSkeleton() {
  return <Container className="space-y-6 py-10 lg:py-14"><Skeleton className="h-72 rounded-[2rem]" /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-36 rounded-2xl" />)}</div><div className="grid gap-6 lg:grid-cols-3"><Skeleton className="h-96 rounded-3xl lg:col-span-2" /><Skeleton className="h-80 rounded-3xl" /></div></Container>;
}
