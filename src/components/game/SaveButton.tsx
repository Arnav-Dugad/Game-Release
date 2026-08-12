"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useWatchlist } from "@/lib/firebase/WatchlistProvider";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils/cn";
import type { GameSummary } from "@/lib/games/types";

/** Saving is intentionally independent from following, ownership and progress. */
export function SaveButton({ game, className }: { game: GameSummary; className?: string }) {
  const { user, enabled } = useAuth();
  const { isWatchlisted, toggleWatchlist } = useWatchlist();
  const { toast } = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const saved = isWatchlisted(game.id);

  const toggle = async () => {
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
      const next = await toggleWatchlist(game);
      toast(
        next ? `${game.name} saved to your watchlist` : `${game.name} removed from your watchlist`,
        next ? "success" : "info",
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : "Couldn't update your watchlist.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={saved}
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border px-6 text-sm font-semibold transition-all duration-300 active:scale-[0.97]",
        saved
          ? "border-mint/45 bg-mint/15 text-white"
          : "border-line-strong bg-white/[0.05] text-text fine:hover:bg-white/10",
        busy && "opacity-60",
        className,
      )}
    >
      {saved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
      {saved ? "Saved" : "Save game"}
    </button>
  );
}
