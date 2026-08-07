"use client";

/**
 * The signed-in watchlist.
 *
 * Entries carry a play status (want / playing / played) that the user can
 * change inline. Sorting puts imminent releases first, because "what's out
 * next" is the question this page exists to answer — undated and already-played
 * titles sink to the bottom.
 */

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { BookmarkX, Trash2 } from "lucide-react";
import { GameCover } from "./GameCover";
import { CountdownInline } from "./Countdown";
import { useWatchlist } from "@/lib/firebase/WatchlistProvider";
import { useToast } from "@/components/ui/Toast";
import { ScorePill } from "@/components/ui/ScoreRing";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/SectionHeading";
import { GameCardSkeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/format";
import type { WatchStatus } from "@/lib/firebase/db";

const FILTERS: { value: WatchStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "want", label: "Want to play" },
  { value: "playing", label: "Playing" },
  { value: "played", label: "Played" },
];

const STATUS_LABEL: Record<WatchStatus, string> = {
  want: "Want to play",
  playing: "Playing",
  played: "Played",
};

export function WatchlistView() {
  const { entries, loading, setStatus, remove } = useWatchlist();
  const { toast } = useToast();
  const [filter, setFilter] = useState<WatchStatus | "all">("all");

  const counts = useMemo(() => {
    const base: Record<string, number> = { all: entries.length, want: 0, playing: 0, played: 0 };
    for (const entry of entries) base[entry.status] = (base[entry.status] ?? 0) + 1;
    return base;
  }, [entries]);

  const visible = useMemo(() => {
    const list = filter === "all" ? entries : entries.filter((e) => e.status === filter);
    const today = new Date().toISOString().slice(0, 10);
    return [...list].sort((a, b) => {
      // Upcoming, soonest first; then released, newest first; undated last.
      const rank = (released: string | null, tba: boolean) => {
        if (tba || !released) return 2;
        return released >= today ? 0 : 1;
      };
      const [ra, rb] = [rank(a.released, a.tba), rank(b.released, b.tba)];
      if (ra !== rb) return ra - rb;
      if (ra === 0) return (a.released ?? "").localeCompare(b.released ?? "");
      if (ra === 1) return (b.released ?? "").localeCompare(a.released ?? "");
      return b.addedAt - a.addedAt;
    });
  }, [entries, filter]);

  if (loading) {
    return (
      <Container className="py-10">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <GameCardSkeleton key={i} />
          ))}
        </div>
      </Container>
    );
  }

  if (entries.length === 0) {
    return (
      <Container className="flex flex-col items-center justify-center py-24 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-2xl border border-line bg-white/[0.04]">
          <BookmarkX size={24} className="text-faint" />
        </span>
        <h2 className="mt-6 font-display text-2xl font-bold">Nothing saved yet</h2>
        <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-muted">
          Tap the bookmark on any game to start tracking it. Releases you save show up
          here with a live countdown.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button href="/upcoming">See upcoming releases</Button>
          <Button href="/browse" variant="secondary">
            Browse the database
          </Button>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-8 lg:py-12">
      <div className="mb-6 flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            className={cn(
              "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-[13px] font-medium transition-colors",
              filter === option.value
                ? "border-brand/50 bg-brand/20 text-white"
                : "border-line bg-white/[0.03] text-muted fine:hover:text-text",
            )}
          >
            {option.label}
            <span className="text-[11px] tabular-nums opacity-60">
              {counts[option.value] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">
          Nothing in this list yet.
        </p>
      ) : (
        <ul className="space-y-2.5">
          <AnimatePresence initial={false}>
            {visible.map((entry) => (
              <motion.li
                key={entry.gameId}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="group flex items-center gap-3 rounded-2xl border border-line bg-panel/50 p-2.5 transition-colors fine:hover:border-line-strong sm:gap-4 sm:p-3"
              >
                <Link
                  href={`/game/${entry.slug}`}
                  className="relative h-[70px] w-[52px] shrink-0 overflow-hidden rounded-xl sm:h-20 sm:w-16"
                  aria-hidden
                  tabIndex={-1}
                >
                  <GameCover
                    name={entry.name}
                    slug={entry.slug}
                    image={entry.image}
                    width={160}
                    sizes="64px"
                  />
                </Link>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <Link href={`/game/${entry.slug}`} className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold leading-snug sm:text-[15px]">
                        {entry.name}
                      </h3>
                    </Link>
                    <ScorePill score={entry.metacritic} className="mt-0.5 shrink-0" />
                  </div>

                  <p className="mt-1 flex flex-wrap items-center gap-x-3 text-[11px] text-muted sm:text-xs">
                    <span>{entry.tba ? "Date TBA" : formatDate(entry.released)}</span>
                    {!entry.tba && entry.released && (
                      <span className="text-brand-soft">
                        <CountdownInline date={entry.released} />
                      </span>
                    )}
                  </p>

                  <div className="mt-2">
                    <label className="sr-only" htmlFor={`status-${entry.gameId}`}>
                      Play status for {entry.name}
                    </label>
                    <select
                      id={`status-${entry.gameId}`}
                      value={entry.status}
                      onChange={async (e) => {
                        try {
                          await setStatus(entry.gameId, e.target.value as WatchStatus);
                        } catch {
                          toast("Couldn't update the status.", "error");
                        }
                      }}
                      className="min-h-9 rounded-full border border-line bg-white/[0.04] px-3 text-[12px] text-muted outline-none transition-colors focus-visible:border-brand"
                    >
                      {(Object.keys(STATUS_LABEL) as WatchStatus[]).map((status) => (
                        <option key={status} value={status} className="bg-panel text-text">
                          {STATUS_LABEL[status]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await remove(entry.gameId);
                      toast(`${entry.name} removed`, "info");
                    } catch {
                      toast("Couldn't remove that game.", "error");
                    }
                  }}
                  aria-label={`Remove ${entry.name} from watchlist`}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-faint transition-colors hover:bg-flare/10 hover:text-flare"
                >
                  <Trash2 size={16} />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Container>
  );
}
