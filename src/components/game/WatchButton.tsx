"use client";

/**
 * Explicit follow toggle.
 *
 * Two presentations from one behaviour: an icon-only button that sits in a card
 * corner, and a full-width labelled button for the detail page. Signed-out
 * users get routed to sign-in with a `next` param so they land back where they
 * started.
 */

import { motion, AnimatePresence } from "motion/react";
import { BellPlus, BellRing } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useWatchlist } from "@/lib/firebase/WatchlistProvider";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils/cn";
import type { GameSummary } from "@/lib/games/types";

interface WatchButtonProps {
  game: GameSummary;
  variant?: "icon" | "full";
  className?: string;
}

export function WatchButton({ game, variant = "icon", className }: WatchButtonProps) {
  const { user, enabled } = useAuth();
  const { isFollowed, toggleFollow, syncFollow } = useWatchlist();
  const { toast } = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const followed = isFollowed(game.id);

  useEffect(() => {
    if (!followed || !("dlcs" in game)) return;
    void syncFollow(game).catch(() => {});
  }, [followed, game, syncFollow]);

  const handleClick = async (event: React.MouseEvent) => {
    // These render inside <Link> cards — never navigate on a toggle.
    event.preventDefault();
    event.stopPropagation();

    if (!enabled) {
      toast("Sign-in isn't configured for this deployment yet.", "info");
      return;
    }
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/game/${game.slug}`)}`);
      return;
    }

    setBusy(true);
    try {
      const nowFollowed = await toggleFollow(game);
      toast(
        nowFollowed
          ? `Following ${game.name} — release and DLC alerts are on`
          : `Unfollowed ${game.name}`,
        nowFollowed ? "success" : "info",
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't update your watchlist.", "error");
    } finally {
      setBusy(false);
    }
  };

  const label = followed ? `Unfollow ${game.name}` : `Follow ${game.name}`;

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        aria-label={label}
        aria-pressed={followed}
        title={label}
        className={cn(
          "grid h-9 w-9 place-items-center rounded-full border backdrop-blur-md transition-all duration-300",
          "coarse:h-11 coarse:w-11",
          followed
            ? "border-brand/50 bg-brand/30 text-white"
            : "border-white/15 bg-black/45 text-white/85 fine:hover:bg-black/70 fine:hover:text-white",
          busy && "opacity-60",
          className,
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={followed ? "on" : "off"}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 26 }}
          >
            {followed ? <BellRing size={16} /> : <BellPlus size={16} />}
          </motion.span>
        </AnimatePresence>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-pressed={followed}
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border px-6 text-sm font-semibold transition-all duration-300 active:scale-[0.97]",
        followed
          ? "border-brand/50 bg-brand/20 text-white"
          : "border-line-strong bg-white/[0.05] text-text fine:hover:bg-white/10",
        busy && "opacity-60",
        className,
      )}
    >
      {followed ? <BellRing size={17} /> : <BellPlus size={17} />}
      {followed ? "Following" : "Follow game"}
    </button>
  );
}
