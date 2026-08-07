import { Database } from "lucide-react";
import type { DataSource } from "@/lib/games/types";

/**
 * Honest labelling of where the data came from.
 *
 * Rendered only in sample mode. Without it, the bundled catalogue could be
 * mistaken for a live release calendar — which it deliberately is not, since it
 * carries no speculative dates for unreleased titles.
 */
export function DataSourceNotice({ source }: { source: DataSource }) {
  if (source !== "sample") return null;

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-gold/20 bg-gold/[0.06] px-4 py-3 text-[13px] leading-relaxed">
      <Database size={15} className="mt-0.5 shrink-0 text-gold" />
      <p className="text-muted">
        <span className="font-semibold text-gold">Sample catalogue.</span> Live data
        isn&rsquo;t reachable right now, so this is the bundled dataset. Connect{" "}
        <a
          href="https://api-docs.igdb.com/#getting-started"
          target="_blank"
          rel="noopener noreferrer"
          className="text-text underline decoration-gold/40 underline-offset-2 transition-colors hover:decoration-gold"
        >
          IGDB
        </a>{" "}
        with a free Twitch client id and secret for the full multi-platform
        database — or deploy as-is and the Steam storefront fills in
        automatically, no credentials needed.
      </p>
    </div>
  );
}

/**
 * Small provenance line for live results. Both backends ask to be credited, and
 * it also tells the reader why a PC-only page looks the way it does.
 */
export function SourceAttribution({ source }: { source: DataSource }) {
  if (source === "sample") return null;

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
