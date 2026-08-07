"use client";

/**
 * Records which platform the user plays a tracked game on.
 *
 * Only offers platforms the game actually released on — asking someone whether
 * they played a PlayStation exclusive on Xbox is noise. When the game's
 * platform list is unknown, it falls back to the full family set rather than
 * showing an empty control.
 */

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { BrandIcon } from "@/components/brand/BrandIcon";
import { brandIcon } from "@/components/brand/brand-icons";
import { Monitor } from "lucide-react";
import { useWatchlist } from "@/lib/firebase/WatchlistProvider";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils/cn";
import { platformKeys, type PlatformKey } from "@/lib/utils/format";

const ALL: PlatformKey[] = ["pc", "playstation", "xbox", "nintendo", "mac", "linux", "mobile"];

const LABELS: Record<PlatformKey, string> = {
  pc: "PC",
  playstation: "PlayStation",
  xbox: "Xbox",
  nintendo: "Nintendo",
  mac: "macOS",
  linux: "Linux",
  mobile: "Mobile",
  web: "Browser",
};

export function PlatformPicker({
  gameId,
  gameName,
  available,
  value,
  className,
}: {
  gameId: number;
  gameName: string;
  /** Platform slugs the game released on. */
  available: string[];
  value: string | null;
  className?: string;
}) {
  const { setPlatform } = useWatchlist();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const derived = platformKeys(available.map((slug) => ({ slug })));
  const options = derived.length > 0 ? derived : ALL;

  const choose = async (platform: string | null) => {
    setOpen(false);
    setBusy(true);
    try {
      await setPlatform(gameId, platform);
    } catch {
      toast("Couldn't save that platform.", "error");
    } finally {
      setBusy(false);
    }
  };

  const selected = value as PlatformKey | null;

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        aria-expanded={open}
        aria-label={`Platform played for ${gameName}`}
        className={cn(
          "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-2.5 text-[12px] transition-colors",
          selected
            ? "border-brand/40 bg-brand/12 text-text"
            : "border-line bg-white/[0.04] text-faint hover:text-muted",
          busy && "opacity-60",
        )}
      >
        {selected ? (
          <>
            <Glyph platform={selected} />
            {LABELS[selected]}
          </>
        ) : (
          "Set platform"
        )}
        <ChevronDown size={12} className={cn("transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <>
          {/* Click-away layer; cheaper and more reliable here than a listener. */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-20 cursor-default"
            onClick={() => setOpen(false)}
          />
          <ul className="glass glass-blur absolute left-0 top-[calc(100%+6px)] z-30 w-44 overflow-hidden rounded-xl p-1">
            {options.map((platform) => (
              <li key={platform}>
                <button
                  type="button"
                  onClick={() => choose(platform)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-muted transition-colors hover:bg-white/8 hover:text-text"
                >
                  <Glyph platform={platform} />
                  <span className="flex-1">{LABELS[platform]}</span>
                  {selected === platform && <Check size={13} className="text-brand-soft" />}
                </button>
              </li>
            ))}
            {selected && (
              <li className="mt-1 border-t border-line pt-1">
                <button
                  type="button"
                  onClick={() => choose(null)}
                  className="w-full rounded-lg px-2.5 py-2 text-left text-[13px] text-faint transition-colors hover:bg-white/8 hover:text-text"
                >
                  Clear
                </button>
              </li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}

function Glyph({ platform }: { platform: PlatformKey }) {
  if (platform !== "pc" && platform !== "web" && brandIcon(platform)) {
    return <BrandIcon name={platform} size={13} title={null} />;
  }
  return <Monitor size={13} aria-hidden />;
}
