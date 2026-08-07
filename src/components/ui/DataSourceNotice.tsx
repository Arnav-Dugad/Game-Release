import { WifiOff } from "lucide-react";
import type { DataSource } from "@/lib/games/types";

/**
 * Honest signal that live data couldn't be reached.
 *
 * There is no placeholder catalogue behind this site — every game shown comes
 * from IGDB or Steam. When neither answers, this says so plainly instead of
 * quietly rendering an empty page, which would look like a bug rather than
 * what it is: a temporary outage.
 */
export function DataSourceNotice({ source }: { source: DataSource }) {
  if (source !== "unavailable") return null;

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-flare/25 bg-flare/[0.06] px-4 py-3 text-[13px] leading-relaxed">
      <WifiOff size={15} className="mt-0.5 shrink-0 text-flare" />
      <p className="text-muted">
        <span className="font-semibold text-flare">Live data is unreachable right now.</span>{" "}
        We couldn&rsquo;t reach IGDB or Steam. This is usually temporary —
        try refreshing in a moment.
      </p>
    </div>
  );
}

/**
 * Small provenance line for live results. Both backends ask to be credited, and
 * it also tells the reader why a PC-only page looks the way it does.
 */
export function SourceAttribution({ source }: { source: DataSource }) {
  if (source === "unavailable") return null;

  return (
    <p className="text-[11px] text-faint">
      {source === "igdb" ? (
        <>
          Game data from{" "}
          <a
            href="https://www.igdb.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 transition-colors hover:text-muted"
          >
            IGDB
          </a>
        </>
      ) : (
        <>
          Game data from the{" "}
          <a
            href="https://store.steampowered.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 transition-colors hover:text-muted"
          >
            Steam storefront
          </a>{" "}
          — PC titles only. Add IGDB credentials for console coverage.
        </>
      )}
    </p>
  );
}
