"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  BadgePercent,
  BookmarkCheck,
  Check,
  Clock3,
  History,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Tag,
} from "lucide-react";
import { GameCover } from "@/components/game/GameCover";
import { WatchButton } from "@/components/game/WatchButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Container } from "@/components/ui/SectionHeading";
import { Stagger, StaggerItem } from "@/components/motion/Reveal";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useWatchlist } from "@/lib/firebase/WatchlistProvider";
import type { WatchlistEntry } from "@/lib/firebase/db";
import { filterDeals, type DealSort } from "@/lib/games/deals";
import {
  getPriceHistory,
  parseAmount,
  priceInsight,
  recordPrice,
  type PricePoint,
} from "@/lib/games/price-history";
import { STEAM_REGIONS } from "@/lib/games/stores-catalog";
import type { DealListing, GameSummary, Price } from "@/lib/games/types";
import { usePreferences } from "@/lib/preferences/PreferencesProvider";
import { cn } from "@/lib/utils/cn";

const MAX_WATCHLIST_CHECKS = 48;
const HISTORY_LIMIT = 18;
const CONCURRENCY = 4;

interface DealsResponse {
  deals: DealListing[];
  region: string;
  refreshedAt: string | null;
  unavailable?: boolean;
}

interface PriceResponse {
  price: Price | null;
  appId: number | null;
}

async function mapWithLimit<T, R>(items: T[], worker: (item: T) => Promise<R>): Promise<R[]> {
  const output: R[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return output;
}

function summaryFromEntry(entry: WatchlistEntry): GameSummary {
  return {
    id: entry.gameId,
    slug: entry.slug,
    name: entry.name,
    released: entry.released,
    releaseWindow: entry.releaseWindow,
    tba: entry.tba,
    image: entry.image,
    imageFallback: entry.imageFallback,
    rating: 0,
    ratingsCount: 0,
    metacritic: entry.metacritic,
    platforms: [],
    parentPlatforms: [],
    genres: [],
    screenshots: [],
    esrb: null,
    popScore: null,
    heroTrailer: null,
    playtime: 0,
    added: 0,
  };
}

function personalListing(entry: WatchlistEntry, data: PriceResponse, currency: string): DealListing | null {
  if (!data.price || data.price.discountPercent <= 0 || !data.appId) return null;
  return {
    game: summaryFromEntry(entry),
    canonicalSlug: /-s\d+$/.test(entry.slug) ? null : entry.slug,
    price: data.price,
    steamAppId: data.appId,
    currentAmount: parseAmount(data.price.current) ?? Number.MAX_SAFE_INTEGER,
    currency,
    storeUrl: `https://store.steampowered.com/app/${data.appId}/`,
  };
}

export function DealsView() {
  const { region, regionInfo, setRegion, ready } = usePreferences();
  const { user, enabled: authEnabled } = useAuth();
  const { entries, loading: watchlistLoading } = useWatchlist();
  const [response, setResponse] = useState<DealsResponse | null>(null);
  const [personalResponse, setPersonalResponse] = useState<{
    key: string;
    deals: DealListing[];
  } | null>(null);
  const [histories, setHistories] = useState<Record<number, PricePoint[]>>({});
  const [mode, setMode] = useState<"all" | "watchlist">("all");
  const [query, setQuery] = useState("");
  const [minimumDiscount, setMinimumDiscount] = useState(0);
  const [sort, setSort] = useState<DealSort>("discount");

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    fetch(`/api/deals?cc=${encodeURIComponent(region)}&limit=48`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("Deals feed unavailable");
        return (await res.json()) as DealsResponse;
      })
      .then((data) => setResponse(data))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setResponse({ deals: [], region, refreshedAt: null, unavailable: true });
      });
    return () => controller.abort();
  }, [ready, region]);

  const candidates = useMemo(
    () =>
      [...entries]
        .sort(
          (a, b) =>
            Number((a.ownedOn ?? []).length > 0) - Number((b.ownedOn ?? []).length > 0) ||
            b.addedAt - a.addedAt,
        )
        .slice(0, MAX_WATCHLIST_CHECKS),
    [entries],
  );
  const candidateKey = candidates
    .map((entry) => `${entry.gameId}:${entry.steamAppId ?? ""}`)
    .join(",");
  const personalRequestKey = `${user?.uid ?? "signed-out"}:${region}:${candidateKey}`;

  useEffect(() => {
    if (!ready || watchlistLoading || !user || candidates.length === 0) return;
    const controller = new AbortController();
    void mapWithLimit(candidates, async (entry) => {
      try {
        const lookup = entry.steamAppId
          ? `appid=${entry.steamAppId}`
          : `slug=${encodeURIComponent(entry.slug)}`;
        const res = await fetch(`/api/price?${lookup}&cc=${encodeURIComponent(region)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return null;
        return personalListing(entry, (await res.json()) as PriceResponse, regionInfo.currency);
      } catch {
        return null;
      }
    }).then((results) => {
      if (controller.signal.aborted) return;
      setPersonalResponse({
        key: personalRequestKey,
        deals: results
          .filter((deal): deal is DealListing => deal !== null)
          .sort((a, b) => b.price.discountPercent - a.price.discountPercent),
      });
    });
    return () => controller.abort();
    // candidateKey intentionally captures exactly the persisted fields used by the requests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateKey, personalRequestKey, ready, region, regionInfo.currency, user, watchlistLoading]);

  const currentResponse = response?.region === region ? response : null;
  const allDeals = useMemo(() => currentResponse?.deals ?? [], [currentResponse]);
  const personal = useMemo(
    () =>
      !user || candidates.length === 0
        ? []
        : personalResponse?.key === personalRequestKey
          ? personalResponse.deals
          : null,
    [user, candidates.length, personalResponse, personalRequestKey],
  );
  const visibleSource = useMemo(
    () => (mode === "watchlist" ? (personal ?? []) : allDeals),
    [mode, personal, allDeals],
  );
  const visible = useMemo(
    () => filterDeals(visibleSource, { query, minimumDiscount, sort }),
    [visibleSource, query, minimumDiscount, sort],
  );
  const historyIds = useMemo(
    () => visibleSource.slice(0, HISTORY_LIMIT).map((deal) => deal.steamAppId).join(","),
    [visibleSource],
  );

  useEffect(() => {
    if (!ready || !historyIds) return;
    const selected = visibleSource.slice(0, HISTORY_LIMIT);
    let cancelled = false;
    void mapWithLimit(selected, async (deal) => {
      if (user) {
        await recordPrice(deal.steamAppId, region, deal.price, deal.currency ?? regionInfo.currency);
      }
      return [deal.steamAppId, await getPriceHistory(deal.steamAppId, region)] as const;
    }).then((rows) => {
      if (!cancelled) setHistories(Object.fromEntries(rows));
    });
    return () => {
      cancelled = true;
    };
    // historyIds is the stable identity of the exact selected deal set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyIds, ready, region, regionInfo.currency, user]);

  const personalIds = useMemo(() => new Set((personal ?? []).map((deal) => deal.steamAppId)), [personal]);
  const ownedIds = useMemo(() => {
    const ownedGameIds = new Set(
      entries.filter((entry) => (entry.ownedOn ?? []).length > 0).map((entry) => entry.gameId),
    );
    return new Set(
      (personal ?? [])
        .filter((deal) => ownedGameIds.has(deal.game.id))
        .map((deal) => deal.steamAppId),
    );
  }, [entries, personal]);
  const biggest = allDeals.reduce((max, deal) => Math.max(max, deal.price.discountPercent), 0);
  const lowCount = Object.values(histories).filter((points) => priceInsight(points)?.isAllTimeLow).length;
  const loading = !ready || currentResponse === null || (mode === "watchlist" && personal === null);

  return (
    <Container className="py-8 lg:py-12">
      <section className="relative isolate mb-8 overflow-hidden rounded-[2rem] border border-brand/25 bg-[radial-gradient(circle_at_10%_0%,rgba(124,92,255,0.22),transparent_38%),radial-gradient(circle_at_90%_20%,rgba(34,211,238,0.12),transparent_34%),linear-gradient(145deg,rgba(16,16,32,0.95),rgba(6,6,14,0.96))] p-5 shadow-[0_30px_90px_-50px_rgba(124,92,255,0.8)] sm:p-7">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-mint/25 bg-mint/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-mint">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint" /> Live offers
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/[0.04] px-3 py-1 text-[11px] text-muted">
                <ShieldCheck size={13} /> Region verified
              </span>
            </div>
            <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
              Your regional sale radar
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              Every card is rechecked against Steam for {regionInfo.name}. Price history is evidence-based:
              an all-time-low badge only appears after at least three recorded days.
            </p>
          </div>
          <label className="flex min-w-56 flex-col gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
            Store region
            <select
              value={region}
              onChange={(event) => setRegion(event.target.value)}
              disabled={!ready}
              className="min-h-11 rounded-xl border border-line bg-panel px-3 text-sm font-medium normal-case tracking-normal text-text outline-none transition-colors hover:border-line-strong"
            >
              {STEAM_REGIONS.map((option) => (
                <option key={option.cc} value={option.cc}>
                  {option.name} · {option.currency}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-2.5 lg:grid-cols-4" aria-label="Live deal metrics">
          <Metric icon={<ShoppingBag size={16} />} label="Live deals" value={loading ? "—" : String(allDeals.length)} />
          <Metric icon={<BadgePercent size={16} />} label="Best discount" value={biggest ? `−${biggest}%` : "—"} tone="mint" />
          <Metric icon={<BookmarkCheck size={16} />} label="Watchlist matches" value={personal === null ? "—" : String(personal.length)} />
          <Metric icon={<History size={16} />} label="Observed lows" value={String(lowCount)} tone="gold" />
        </div>
      </section>

      <section aria-label="Deal filters" className="glass sticky top-[4.5rem] z-30 mb-8 rounded-2xl p-3 lg:top-20">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="flex rounded-xl border border-line bg-black/20 p-1" role="group" aria-label="Deal collection">
            <ModeButton active={mode === "all"} onClick={() => setMode("all")}>
              All deals <span className="text-faint tabular-nums">{allDeals.length}</span>
            </ModeButton>
            <ModeButton active={mode === "watchlist"} onClick={() => setMode("watchlist")}>
              My watchlist <span className="text-faint tabular-nums">{personal?.length ?? 0}</span>
            </ModeButton>
          </div>
          <label className="relative min-w-0 flex-1">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
            <span className="sr-only">Search deals</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search games or genres"
              className="min-h-11 w-full rounded-xl border border-line bg-black/20 pl-10 pr-4 text-sm outline-none placeholder:text-faint focus:border-brand/60"
            />
          </label>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <label>
              <span className="sr-only">Minimum discount</span>
              <select
                value={minimumDiscount}
                onChange={(event) => setMinimumDiscount(Number(event.target.value))}
                className="min-h-11 w-full rounded-xl border border-line bg-panel px-3 text-sm text-text outline-none sm:w-auto"
              >
                <option value={0}>Any discount</option>
                <option value={25}>25%+ off</option>
                <option value={50}>50%+ off</option>
                <option value={75}>75%+ off</option>
              </select>
            </label>
            <label>
              <span className="sr-only">Sort deals</span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as DealSort)}
                className="min-h-11 w-full rounded-xl border border-line bg-panel px-3 text-sm text-text outline-none sm:w-auto"
              >
                <option value="discount">Biggest saving</option>
                <option value="price">Lowest price</option>
                <option value="name">Game name</option>
              </select>
            </label>
          </div>
        </div>
      </section>

      {loading ? (
        <LoadingGrid />
      ) : mode === "watchlist" && !user ? (
        <EmptyState
          icon={<BookmarkCheck size={24} />}
          title="Make this feed yours"
          body="Sign in and add games to your watchlist. Their live discounts will be checked here automatically."
          action={authEnabled ? { href: "/login?next=%2Fdeals", label: "Sign in" } : undefined}
          secondaryAction={{ href: "/browse", label: "Browse games" }}
        />
      ) : currentResponse?.unavailable ? (
        <EmptyState
          icon={<Clock3 size={24} />}
          title="The live sale feed is taking a breather"
          body="Steam did not answer in time. Your settings and watchlist are safe; retry in a moment."
          tone="unavailable"
          action={{ onClick: () => window.location.reload(), label: "Try again" }}
          secondaryAction={{ href: "/browse", label: "Browse games" }}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Tag size={24} />}
          title={mode === "watchlist" ? "Nothing tracked is discounted today" : "No deals match these filters"}
          body={mode === "watchlist" ? "Your watchlist is checked automatically. Try the full deal feed while you wait." : "Clear the search or lower the minimum discount."}
          action={
            mode === "watchlist"
              ? { onClick: () => setMode("all"), label: "See every deal" }
              : { onClick: () => { setQuery(""); setMinimumDiscount(0); }, label: "Reset filters" }
          }
        />
      ) : (
        <>
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-soft">
                {mode === "watchlist" ? "Personal picks" : `${regionInfo.currency} storefront`}
              </p>
              <h2 className="mt-1 font-display text-2xl font-bold">
                {mode === "watchlist" ? "Deals on games you track" : "Live discounts"}
              </h2>
            </div>
            <p className="hidden text-xs text-faint sm:block">
              {currentResponse?.refreshedAt ? `Checked ${new Date(currentResponse.refreshedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Live data"}
            </p>
          </div>
          <Stagger as="ul" onMount className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" gap={0.035}>
            {visible.map((deal, index) => (
              <StaggerItem as="li" key={`${deal.steamAppId}-${deal.game.id}`}>
                <DealCard
                  deal={deal}
                  history={histories[deal.steamAppId] ?? []}
                  tracked={personalIds.has(deal.steamAppId)}
                  owned={ownedIds.has(deal.steamAppId)}
                  priority={index < 5}
                />
              </StaggerItem>
            ))}
          </Stagger>
        </>
      )}

      <aside className="mt-12 grid gap-3 border-t border-line pt-8 sm:grid-cols-3">
        <TrustItem icon={<ShieldCheck size={18} />} title="Verified at source" body="Every offer is rechecked against the selected regional Steam store." />
        <TrustItem icon={<History size={18} />} title="Honest history" body="No “all-time low” claim until at least three daily observations exist." />
        <TrustItem icon={<Sparkles size={18} />} title="No affiliate ranking" body="Sorting follows your controls, never commission or sponsored placement." />
      </aside>
    </Container>
  );
}

function DealCard({ deal, history, tracked, owned, priority }: { deal: DealListing; history: PricePoint[]; tracked: boolean; owned: boolean; priority: boolean }) {
  const insight = priceInsight(history);
  const points = [...history].reverse().slice(-24);
  const href = deal.canonicalSlug
    ? `/game/${deal.canonicalSlug}`
    : `/search?q=${encodeURIComponent(deal.game.name)}`;
  return (
    <article className="group h-full overflow-hidden rounded-2xl border border-line bg-panel/55 transition-[transform,border-color,box-shadow] duration-300 fine:hover:-translate-y-1 fine:hover:border-brand/35 fine:hover:shadow-[0_20px_60px_-30px_rgba(124,92,255,0.7)]">
      <div className="relative aspect-[2/3] overflow-hidden bg-bg-elev">
        <Link href={href} aria-label={`View ${deal.game.name} in IGDB`} className="absolute inset-0 z-10">
          <GameCover
            name={deal.game.name}
            slug={deal.game.slug}
            image={deal.game.image}
            imageFallback={deal.game.imageFallback}
            priority={priority}
            width={420}
          />
          <span className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent opacity-80" />
        </Link>
        <span className="absolute left-2.5 top-2.5 z-20 rounded-lg bg-mint px-2.5 py-1 text-sm font-black text-[#04230f] shadow-lg tabular-nums">
          −{deal.price.discountPercent}%
        </span>
        <div className="absolute right-2.5 top-2.5 z-20">
          {tracked ? (
            <span title="On your watchlist" className="grid h-9 w-9 place-items-center rounded-full border border-brand/40 bg-brand/35 text-white backdrop-blur-md">
              <BookmarkCheck size={16} />
            </span>
          ) : deal.canonicalSlug ? (
            <WatchButton game={deal.game} />
          ) : null}
        </div>
        <div className="absolute inset-x-3 bottom-3 z-20 flex flex-wrap gap-1.5 pointer-events-none">
          {insight?.isAllTimeLow && (
            <span className="inline-flex items-center gap-1 rounded-full border border-gold/30 bg-black/75 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-gold backdrop-blur">
              <Sparkles size={10} /> Observed low
            </span>
          )}
          {tracked && (
            <span className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-black/75 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-brand-soft backdrop-blur">
              <Check size={10} /> Tracked
            </span>
          )}
          {owned && (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/75 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted backdrop-blur">
              <ShoppingBag size={10} /> Owned
            </span>
          )}
        </div>
      </div>
      <div className="p-3.5">
        <Link href={href} className="line-clamp-2 min-h-10 text-sm font-semibold leading-snug transition-colors hover:text-brand-soft">
          {deal.game.name}
        </Link>
        <div className="mt-3 flex items-end justify-between gap-2">
          <div>
            <p className="text-lg font-black text-mint tabular-nums">{deal.price.current}</p>
            {deal.price.original && <p className="text-xs text-faint line-through tabular-nums">{deal.price.original}</p>}
          </div>
          <a
            href={deal.storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${deal.game.name} on Steam`}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-white/[0.04] text-muted transition-colors hover:border-line-strong hover:text-text"
          >
            <ArrowUpRight size={15} />
          </a>
        </div>
        {points.length >= 2 ? (
          <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
            <Sparkline points={points} />
            <span className="text-[10px] text-faint">{points.length}d observed</span>
          </div>
        ) : (
          <p className="mt-3 border-t border-line pt-3 text-[10px] text-faint">Building price history</p>
        )}
      </div>
    </article>
  );
}

function Sparkline({ points }: { points: PricePoint[] }) {
  const values = points.map((point) => point.amount);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const path = values
    .map((value, index) => `${index === 0 ? "M" : "L"}${(index / Math.max(1, values.length - 1)) * 64},${18 - ((value - min) / range) * 16}`)
    .join(" ");
  return (
    <svg aria-label="Recent price trend" role="img" viewBox="0 0 64 20" className="h-5 w-16 overflow-visible">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-mint" />
    </svg>
  );
}

function Metric({ icon, label, value, tone = "brand" }: { icon: ReactNode; label: string; value: string; tone?: "brand" | "mint" | "gold" }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3.5 backdrop-blur-sm" role="group" aria-label={label}>
      <div className={cn("mb-2", tone === "mint" ? "text-mint" : tone === "gold" ? "text-gold" : "text-brand-soft")}>{icon}</div>
      <p className="font-display text-xl font-black tabular-nums">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted">{label}</p>
    </div>
  );
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={cn("flex min-h-9 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold transition-colors sm:flex-none", active ? "bg-white/10 text-text shadow-sm" : "text-muted hover:text-text")}>
      {children}
    </button>
  );
}

function LoadingGrid() {
  return (
    <div role="status" aria-label="Loading deals" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 10 }, (_, index) => (
        <div key={index} className="overflow-hidden rounded-2xl border border-line bg-panel/40">
          <div className="shimmer-bg aspect-[2/3]" />
          <div className="space-y-3 p-3.5"><div className="shimmer-bg h-4 rounded" /><div className="shimmer-bg h-7 w-2/3 rounded" /></div>
        </div>
      ))}
    </div>
  );
}

function TrustItem({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-3 rounded-2xl p-3 text-sm">
      <span className="mt-0.5 text-brand-soft">{icon}</span>
      <div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-xs leading-relaxed text-muted">{body}</p></div>
    </div>
  );
}
