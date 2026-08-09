"use client";

/**
 * Command-palette search.
 *
 * Opens on ⌘K / Ctrl-K, or from the header and mobile tab bar. Fully keyboard
 * driven: arrows move the selection, Enter opens, Escape closes. Requests are
 * debounced and each one aborts the previous, so a fast typist never sees an
 * earlier response overwrite a later one.
 */

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Building2, CornerDownLeft, Loader2, Search, TrendingUp, User, X } from "lucide-react";
import { GameCover } from "@/components/game/GameCover";
import { useDebouncedValue, useLockBodyScroll } from "@/hooks";
import { cn } from "@/lib/utils/cn";

/**
 * One search result, which may be a game, a character or a studio.
 *
 * Mirrors `IgdbSearchHit` on the server. Kept as a local shape rather than
 * imported so the palette never pulls the provider module — and its
 * credentials — into the client bundle.
 */
interface SearchHit {
  kind: "game" | "character" | "company";
  id: number;
  name: string;
  slug: string;
  subtitle: string | null;
  image: string | null;
}

/** Stable identity for the "no results" case. */
const EMPTY_RESULTS: SearchHit[] = [];

/** Every hit kind now has a real page of its own. */
function hrefForHit(hit: SearchHit): string {
  switch (hit.kind) {
    case "character":
      return `/character/${hit.slug}`;
    case "company":
      return `/studio/${hit.slug}`;
    default:
      return `/game/${hit.slug}`;
  }
}

const GROUP_LABELS: Record<SearchHit["kind"], string> = {
  game: "Games",
  character: "Characters",
  company: "Studios",
};

/**
 * Thumbnail per result kind.
 *
 * Games keep the 3:4 poster treatment; characters get a square portrait; a
 * studio logo is a transparent mark that needs padding and `object-contain`,
 * not a cover crop, or it ends up sliced.
 */
function HitThumb({ hit }: { hit: SearchHit }) {
  if (hit.kind === "game") {
    return (
      <span className="relative h-14 w-11 shrink-0 overflow-hidden rounded-lg">
        <GameCover
          name={hit.name}
          slug={hit.slug}
          image={hit.image}
          imageFallback={null}
          width={96}
          sizes="44px"
        />
      </span>
    );
  }

  if (!hit.image) {
    return (
      <span className="grid h-14 w-11 shrink-0 place-items-center rounded-lg bg-white/5 text-faint">
        {hit.kind === "character" ? <User size={16} /> : <Building2 size={16} />}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "relative h-14 w-11 shrink-0 overflow-hidden rounded-lg bg-white/5",
        hit.kind === "company" && "p-1.5",
      )}
    >
      <Image
        src={hit.image}
        alt=""
        fill
        sizes="44px"
        className={hit.kind === "company" ? "object-contain" : "object-cover"}
      />
    </span>
  );
}

const QUICK_LINKS = [
  { label: "Upcoming releases", href: "/upcoming" },
  { label: "Browse all games", href: "/browse" },
  { label: "Top rated", href: "/browse?ordering=-metacritic" },
  { label: "New this month", href: "/browse?ordering=-released" },
];

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  /**
   * The last response we actually received, tagged with the term that produced
   * it. Deriving `results` and `loading` from this — rather than tracking them
   * as separate state — means an in-flight request can never briefly show the
   * previous term's results, and there's no loading flag to get stuck.
   */
  const [settled, setSettled] = useState<{ term: string; results: SearchHit[] }>({
    term: "",
    results: [],
  });
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const debounced = useDebouncedValue(query, 260);
  const term = debounced.trim();
  const searchable = term.length >= 2;

  // Memoised so the empty-array branch doesn't produce a new identity every
  // render and invalidate everything downstream that depends on it.
  const results = useMemo(
    () => (searchable && settled.term === term ? settled.results : EMPTY_RESULTS),
    [searchable, settled, term],
  );
  const loading = searchable && settled.term !== term;
  // Results can shrink between renders; never index past the end.
  const activeIndex = results.length > 0 ? Math.min(cursor, results.length - 1) : 0;

  useLockBodyScroll(open);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  // Reset on close so reopening never shows a stale result set. Deferred past
  // the exit animation so the list doesn't visibly empty on the way out.
  useEffect(() => {
    if (open) return;
    const id = setTimeout(() => {
      setQuery("");
      setSettled({ term: "", results: [] });
      setCursor(0);
    }, 200);
    return () => clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (term.length < 2) return;

    // Cleanup aborts the previous request, so responses can only ever settle
    // for the term currently being typed.
    const controller = new AbortController();

    fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { hits: [] }))
      .then((data: { hits?: SearchHit[] }) => {
        setSettled({ term, results: data.hits ?? [] });
        setCursor(0);
      })
      .catch((err) => {
        if (err instanceof Error && err.name !== "AbortError") {
          console.error("[search] failed", err);
          setSettled({ term, results: [] });
        }
      });

    return () => controller.abort();
  }, [term]);

  const submit = useCallback(
    (target?: SearchHit) => {
      const hit = target ?? results[activeIndex];
      if (hit) {
        router.push(hrefForHit(hit));
      } else if (query.trim()) {
        router.push(`/browse?search=${encodeURIComponent(query.trim())}`);
      }
      onClose();
    },
    [results, activeIndex, query, router, onClose],
  );

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((c) => (results.length ? (c + 1) % results.length : 0));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((c) => (results.length ? (c - 1 + results.length) % results.length : 0));
    }
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[250] flex items-start justify-center p-0 sm:p-6 sm:pt-[12vh]">
          <motion.div
            className="absolute inset-0 bg-black/75 backdrop-blur-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Search games"
            className="glass glass-blur relative z-10 flex h-dvh-safe w-full flex-col overflow-hidden sm:h-auto sm:max-h-[72vh] sm:max-w-2xl sm:rounded-3xl"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.99 }}
            transition={{ type: "spring", stiffness: 400, damping: 34 }}
            onKeyDown={onKeyDown}
          >
            <div className="flex items-center gap-3 border-b border-line px-4 py-4 safe-t sm:px-5">
              <Search size={18} className="shrink-0 text-faint" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search games, studios, genres…"
                aria-label="Search games"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-faint"
              />
              {loading && <Loader2 size={16} className="shrink-0 animate-spin text-faint" />}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close search"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-faint transition-colors hover:bg-white/8 hover:text-text"
              >
                <X size={16} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 safe-b">
              {query.trim().length < 2 ? (
                <div className="p-3">
                  <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
                    Jump to
                  </p>
                  <ul className="space-y-1">
                    {QUICK_LINKS.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          onClick={onClose}
                          className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-muted transition-colors hover:bg-white/6 hover:text-text"
                        >
                          <TrendingUp size={15} className="text-faint" />
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : results.length === 0 && !loading ? (
                <div className="px-5 py-14 text-center">
                  <p className="text-sm text-muted">
                    No matches for <span className="text-text">“{query.trim()}”</span>
                  </p>
                  <p className="mt-1 text-xs text-faint">Try a shorter or differently spelled title.</p>
                </div>
              ) : (
                <ul className="space-y-1">
                  {results.map((hit, i) => {
                    // A section label whenever the kind changes, so a mixed
                    // result list reads as grouped rather than jumbled.
                    const newGroup = i === 0 || results[i - 1].kind !== hit.kind;
                    return (
                      <li key={`${hit.kind}-${hit.id}`}>
                        {newGroup && (
                          <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
                            {GROUP_LABELS[hit.kind]}
                          </p>
                        )}
                        <Link
                          href={hrefForHit(hit)}
                          onClick={onClose}
                          onPointerEnter={() => setCursor(i)}
                          className={cn(
                            "flex items-center gap-3 rounded-xl p-2 transition-colors",
                            i === activeIndex ? "bg-white/8" : "hover:bg-white/5",
                          )}
                        >
                          <HitThumb hit={hit} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{hit.name}</span>
                            {hit.subtitle && (
                              <span className="mt-0.5 block truncate text-xs text-faint">
                                {hit.subtitle}
                              </span>
                            )}
                          </span>
                          {i === activeIndex && (
                            <CornerDownLeft
                              size={14}
                              className="hidden shrink-0 text-faint fine:block"
                            />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="hidden items-center justify-between gap-4 border-t border-line px-5 py-3 text-[11px] text-faint fine:flex">
              <span className="flex items-center gap-3">
                <Key>↑</Key>
                <Key>↓</Key>
                to navigate
              </span>
              <span className="flex items-center gap-2">
                <Key>↵</Key> to open
                <Key>esc</Key> to close
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-grid h-5 min-w-5 place-items-center rounded border border-line bg-white/5 px-1 font-sans text-[10px] text-muted">
      {children}
    </kbd>
  );
}
