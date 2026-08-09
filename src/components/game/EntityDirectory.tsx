"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Building2, Layers, Search, X } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Stagger, StaggerItem } from "@/components/motion/Reveal";
import { hueFromString } from "@/lib/utils/format";
import type { LogoRef, Ref } from "@/lib/games/types";

type DirectoryItem = Ref & { logo?: string | null };

export function EntityDirectory({
  items,
  kind,
}: {
  items: (Ref | LogoRef)[];
  kind: "studio" | "franchise";
}) {
  const [query, setQuery] = useState("");
  const normalised = query.trim().toLocaleLowerCase();
  const filtered = useMemo(
    () =>
      normalised
        ? items.filter((item) => item.name.toLocaleLowerCase().includes(normalised))
        : items,
    [items, normalised],
  );
  const isStudio = kind === "studio";

  return (
    <div className="space-y-6">
      <div className="glass flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <label className="relative block min-w-0 flex-1 sm:max-w-xl">
          <Search
            aria-hidden
            size={17}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint"
          />
          <span className="sr-only">Search {isStudio ? "studios" : "series"}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${isStudio ? "studios" : "series"}…`}
            className="h-12 w-full rounded-xl border border-line bg-bg/55 py-2 pl-11 pr-11 text-sm text-text outline-none transition-colors placeholder:text-faint hover:border-line-strong focus:border-brand"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-faint transition-colors hover:bg-white/[0.06] hover:text-text"
            >
              <X size={15} />
            </button>
          )}
        </label>
        <p aria-live="polite" className="px-2 text-xs text-muted sm:text-sm">
          <span className="font-semibold text-text tabular-nums">{filtered.length}</span>{" "}
          {filtered.length === 1 ? (isStudio ? "studio" : "series") : isStudio ? "studios" : "series"}
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={isStudio ? <Building2 size={24} /> : <Layers size={24} />}
          title={`No ${isStudio ? "studios" : "series"} found`}
          body={`Nothing here matches “${query.trim()}”. Try a shorter name or different spelling.`}
          action={{ onClick: () => setQuery(""), label: "Clear search" }}
        />
      ) : (
        <Stagger
          className={
            isStudio
              ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
              : "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
          }
          gap={0.025}
          onMount
        >
          {filtered.map((item, index) => (
            <StaggerItem key={item.id}>
              {isStudio ? (
                <StudioCard studio={item as DirectoryItem} priority={index < 12} />
              ) : (
                <FranchiseCard franchise={item} index={index} />
              )}
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}

function StudioCard({ studio, priority }: { studio: DirectoryItem; priority: boolean }) {
  return (
    <Link
      href={`/studio/${studio.slug}`}
      className="group flex h-full min-h-36 flex-col items-center gap-3 rounded-2xl border border-line bg-panel/40 p-4 text-center transition-all duration-300 fine:hover:-translate-y-1 fine:hover:border-line-strong fine:hover:bg-panel/70 fine:hover:shadow-[0_22px_55px_-30px_rgba(124,92,255,0.7)]"
    >
      {studio.logo ? (
        <span className="relative grid h-16 w-full place-items-center overflow-hidden rounded-xl bg-white/[0.94] p-2 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
          <Image
            src={studio.logo}
            alt=""
            fill
            priority={priority}
            sizes="(max-width: 640px) 42vw, 180px"
            className="object-contain p-2.5 transition-transform duration-500 fine:group-hover:scale-105"
          />
        </span>
      ) : (
        <span className="grid h-16 w-full place-items-center rounded-xl bg-white/[0.04] font-display text-xl font-black text-muted">
          {studio.name.charAt(0)}
        </span>
      )}
      <span className="line-clamp-2 text-[13px] font-semibold leading-snug transition-colors group-hover:text-brand-soft">
        {studio.name}
      </span>
    </Link>
  );
}

function FranchiseCard({ franchise, index }: { franchise: Ref; index: number }) {
  const hue = hueFromString(franchise.slug);

  return (
    <Link
      href={`/franchise/${franchise.slug}`}
      className="group relative flex h-32 items-end overflow-hidden rounded-2xl border border-line p-4 transition-all duration-500 fine:hover:-translate-y-1 fine:hover:border-line-strong fine:hover:shadow-[0_25px_60px_-32px_rgba(124,92,255,0.8)]"
      style={{
        background: `linear-gradient(140deg, hsl(${hue} 58% 21%), hsl(${(hue + 45) % 360} 52% 8%))`,
      }}
    >
      <span
        aria-hidden
        className="absolute inset-0 opacity-60 transition-opacity duration-500 fine:group-hover:opacity-100"
        style={{
          background: `radial-gradient(90% 90% at 20% 0%, hsl(${hue} 90% 64% / 0.42), transparent 68%)`,
        }}
      />
      <span aria-hidden className="absolute -right-2 -top-6 font-display text-8xl font-black text-white/[0.055]">
        {franchise.name.charAt(0)}
      </span>
      <span className="relative">
        <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
          Series {String(index + 1).padStart(2, "0")}
        </span>
        <span className="line-clamp-2 font-display text-[15px] font-bold leading-tight text-white transition-colors group-hover:text-white">
          {franchise.name}
        </span>
      </span>
    </Link>
  );
}
