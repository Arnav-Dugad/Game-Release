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
  if (source === "live") return null;

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-gold/20 bg-gold/[0.06] px-4 py-3 text-[13px] leading-relaxed">
      <Database size={15} className="mt-0.5 shrink-0 text-gold" />
      <p className="text-muted">
        <span className="font-semibold text-gold">Sample catalogue.</span> You&rsquo;re seeing the
        bundled dataset. Add a free{" "}
        <a
          href="https://rawg.io/apidocs"
          target="_blank"
          rel="noopener noreferrer"
          className="text-text underline decoration-gold/40 underline-offset-2 transition-colors hover:decoration-gold"
        >
          RAWG API key
        </a>{" "}
        as <code className="rounded bg-white/8 px-1 py-0.5 font-mono text-[11px]">RAWG_API_KEY</code>{" "}
        to switch to the live release calendar with artwork and full metadata.
      </p>
    </div>
  );
}
