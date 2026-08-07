import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Real anchor-based pagination — crawlable, middle-clickable and works without
 * JS. Rendered on the server so page links carry the full existing filter set.
 */
export function Pagination({
  page,
  hasNext,
  totalPages,
  basePath,
  params,
}: {
  page: number;
  hasNext: boolean;
  /** Omit when the total is unknown; only prev/next render. */
  totalPages?: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const hrefFor = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) search.set(key, value);
    }
    if (target > 1) search.set("page", String(target));
    const qs = search.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  if (page === 1 && !hasNext) return null;

  const windowed = totalPages ? pageWindow(page, totalPages) : [];

  return (
    <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-2">
      <PageLink
        href={hrefFor(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
        className="px-3"
      >
        <ChevronLeft size={16} />
        <span className="hidden sm:inline">Prev</span>
      </PageLink>

      <ul className="flex items-center gap-1.5">
        {windowed.map((entry, i) =>
          entry === "gap" ? (
            <li key={`gap-${i}`} className="px-1 text-faint">
              …
            </li>
          ) : (
            <li key={entry}>
              <PageLink
                href={hrefFor(entry)}
                active={entry === page}
                aria-label={`Page ${entry}`}
                aria-current={entry === page ? "page" : undefined}
                className="w-11 justify-center tabular-nums"
              >
                {entry}
              </PageLink>
            </li>
          ),
        )}
      </ul>

      <PageLink
        href={hrefFor(page + 1)}
        disabled={!hasNext}
        aria-label="Next page"
        className="px-3"
      >
        <span className="hidden sm:inline">Next</span>
        <ChevronRight size={16} />
      </PageLink>
    </nav>
  );
}

function PageLink({
  href,
  children,
  disabled,
  active,
  className,
  ...rest
}: {
  href: string;
  children: React.ReactNode;
  disabled?: boolean;
  active?: boolean;
  className?: string;
} & React.AriaAttributes) {
  const classes = cn(
    "inline-flex min-h-11 items-center gap-1 rounded-full border text-sm font-medium transition-colors duration-200",
    active
      ? "border-brand/50 bg-brand/20 text-white"
      : "border-line bg-white/[0.03] text-muted fine:hover:border-line-strong fine:hover:text-text",
    disabled && "pointer-events-none opacity-35",
    className,
  );

  if (disabled) {
    return (
      <span className={classes} aria-disabled {...rest}>
        {children}
      </span>
    );
  }

  return (
    <Link href={href} className={classes} scroll {...rest}>
      {children}
    </Link>
  );
}

/** First, last, current ±1, with gaps collapsed. */
function pageWindow(page: number, total: number): (number | "gap")[] {
  const capped = Math.min(total, 500);
  if (capped <= 7) return Array.from({ length: capped }, (_, i) => i + 1);

  const out: (number | "gap")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(capped - 1, page + 1);

  if (start > 2) out.push("gap");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < capped - 1) out.push("gap");
  out.push(capped);
  return out;
}
