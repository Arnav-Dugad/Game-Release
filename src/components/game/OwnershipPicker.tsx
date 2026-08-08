"use client";

/**
 * Records where the reader owns a game.
 *
 * Multi-select on purpose: owning the same game on two storefronts is
 * completely ordinary, and forcing a single choice would quietly lose that.
 * Selections are optimistic and roll back on failure, so toggling feels
 * instant rather than waiting on a round-trip.
 */

import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { Check, Library, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { BrandIcon } from "@/components/brand/BrandIcon";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useWatchlist } from "@/lib/firebase/WatchlistProvider";
import { useToast } from "@/components/ui/Toast";
import { useClickOutside, useEscapeKey } from "@/hooks";
import { OWNERSHIP_PLATFORMS } from "@/lib/games/stores-catalog";
import { cn } from "@/lib/utils/cn";
import type { GameSummary } from "@/lib/games/types";

export function OwnershipPicker({
  game,
  className,
}: {
  game: GameSummary;
  className?: string;
}) {
  const { user, enabled } = useAuth();
  const { isWatched, ownershipOf, setOwnership, toggle } = useWatchlist();
  const { toast } = useToast();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside(ref, () => setOpen(false), open);
  useEscapeKey(() => setOpen(false), open);

  const owned = pending ?? ownershipOf(game.id);

  const choose = async (slug: string) => {
    if (!enabled) {
      toast("Sign-in isn't configured for this deployment yet.", "info");
      return;
    }
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/game/${game.slug}`)}`);
      return;
    }

    const next = owned.includes(slug)
      ? owned.filter((entry) => entry !== slug)
      : [...owned, slug];

    setPending(next);
    try {
      // Ownership lives on the watchlist document, so the game has to be
      // tracked before it can hold anything.
      if (!isWatched(game.id)) await toggle(game);
      await setOwnership(game.id, next);
    } catch (err) {
      setPending(null);
      toast(err instanceof Error ? err.message : "Couldn't save that.", "error");
      return;
    }
    setPending(null);
  };

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={cn(
          "inline-flex min-h-12 items-center gap-2 rounded-full border px-5 text-sm font-semibold transition-all duration-300 active:scale-[0.97]",
          owned.length > 0
            ? "border-mint/45 bg-mint/15 text-white"
            : "border-line-strong bg-white/[0.05] text-text fine:hover:bg-white/10",
        )}
      >
        <Library size={17} />
        {owned.length > 0 ? `Owned on ${owned.length}` : "I own this"}
        {owned.length > 0 && (
          <span className="flex items-center -space-x-1">
            {owned.slice(0, 3).map((slug) => {
              const platform = OWNERSHIP_PLATFORMS.find((p) => p.slug === slug);
              return platform?.icon ? (
                <BrandIcon key={slug} name={platform.icon} size={14} title={null} tinted />
              ) : null;
            })}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="glass glass-blur absolute left-0 top-[calc(100%+8px)] z-40 w-64 origin-top-left overflow-hidden rounded-2xl p-1.5"
          >
            <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
              Where do you own it?
            </p>
            <ul className="max-h-72 overflow-y-auto overscroll-contain">
              {OWNERSHIP_PLATFORMS.map((platform) => {
                const active = owned.includes(platform.slug);
                return (
                  <li key={platform.slug}>
                    <button
                      type="button"
                      onClick={() => choose(platform.slug)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                        active ? "bg-mint/12 text-text" : "text-muted hover:bg-white/6 hover:text-text",
                      )}
                    >
                      {platform.icon ? (
                        <BrandIcon name={platform.icon} size={15} title={null} tinted={active} />
                      ) : (
                        <Plus size={15} className="text-faint" />
                      )}
                      <span className="flex-1">{platform.name}</span>
                      {active && <Check size={14} className="text-mint" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
