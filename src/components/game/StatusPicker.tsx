"use client";

/**
 * Where the reader is with a game: want to play, playing, or played.
 *
 * A segmented control rather than a dropdown, because there are exactly three
 * mutually-exclusive states and showing all of them makes the current one
 * readable at a glance — which is the point on a page you land on to remember
 * what you were doing.
 *
 * Selecting any state creates a personal record if needed. Status never owns
 * that record: tapping it cannot erase follows, ownership, or subscription
 * history stored alongside it.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Check, Gamepad2, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useWatchlist } from "@/lib/firebase/WatchlistProvider";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils/cn";
import type { WatchStatus } from "@/lib/firebase/db";
import type { GameSummary } from "@/lib/games/types";

const OPTIONS: { value: WatchStatus; label: string; icon: typeof Bookmark }[] = [
  { value: "want", label: "Want to play", icon: Bookmark },
  { value: "playing", label: "Playing", icon: Gamepad2 },
  { value: "played", label: "Played", icon: Check },
];

export function StatusPicker({
  game,
  className,
}: {
  game: GameSummary;
  className?: string;
}) {
  const { user, enabled } = useAuth();
  const { statusOf, setStatus, ensure } = useWatchlist();
  const { toast } = useToast();
  const router = useRouter();

  const [busy, setBusy] = useState<WatchStatus | null>(null);
  const current = statusOf(game.id);

  const choose = async (value: WatchStatus) => {
    if (!enabled) {
      toast("Sign-in isn't configured for this deployment yet.", "info");
      return;
    }
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/game/${game.slug}`)}`);
      return;
    }

    setBusy(value);
    try {
      if (current === value) return;
      await ensure(game);
      await setStatus(game.id, value);
      toast(`Marked as ${OPTIONS.find((o) => o.value === value)?.label.toLowerCase()}`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save that.", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      role="group"
      aria-label="Your status with this game"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-line bg-white/[0.04] p-1",
        className,
      )}
    >
      {OPTIONS.map((option) => {
        const active = current === option.value;
        const Icon = busy === option.value ? Loader2 : option.icon;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => choose(option.value)}
            aria-pressed={active}
            disabled={busy !== null}
            className={cn(
              "inline-flex min-h-10 items-center gap-2 rounded-full px-3.5 text-[13px] font-medium transition-all duration-300",
              "disabled:opacity-60",
              active
                ? "bg-[linear-gradient(120deg,var(--color-brand),#9d7bff)] text-white shadow-lg"
                : "text-muted fine:hover:bg-white/8 fine:hover:text-text",
            )}
          >
            <Icon size={14} className={cn(busy === option.value && "animate-spin")} />
            <span className="hidden sm:inline">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
