import Image from "next/image";
import { notFound } from "next/navigation";
import { GameGrid } from "@/components/game/GameGrid";
import { Container } from "@/components/ui/SectionHeading";
import { Badge } from "@/components/ui/Badge";
import { ExpandableText } from "@/components/ui/ExpandableText";
import { Reveal } from "@/components/motion/Reveal";
import { cn } from "@/lib/utils/cn";
import type { IgdbEntity } from "@/lib/games/providers/igdb";

/**
 * Shared shell for the studio, character and franchise pages.
 *
 * All three answer the same shape of question — "who or what is this, and what
 * games does it connect to?" — so they share one layout. Only the mark differs:
 * a studio logo needs a light plate and `object-contain`, a character portrait
 * is a photo and should fill its frame.
 */
export function EntityPage({
  entity,
  kind,
  eyebrow,
}: {
  entity: IgdbEntity | null;
  kind: "company" | "character" | "franchise";
  eyebrow: string;
}) {
  if (!entity) notFound();

  const hasMark = Boolean(entity.image);

  return (
    <>
      <header className="noise relative isolate overflow-hidden border-b border-line">
        {/* A franchise has no mark of its own, so its lead game's art becomes
            the backdrop rather than leaving a flat band. */}
        {kind === "franchise" && entity.image && (
          <div className="absolute inset-0 -z-10">
            <Image src={entity.image} alt="" fill sizes="100vw" className="object-cover opacity-25" />
            <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/85 to-bg/60" />
          </div>
        )}

        <Container className="pb-10 pt-28 lg:pb-14 lg:pt-36">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:gap-8">
            {hasMark && kind !== "franchise" && (
              <Reveal
                direction="right"
                className={cn(
                  "relative shrink-0 overflow-hidden rounded-2xl border border-line-strong shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]",
                  kind === "company"
                    ? "grid h-28 w-28 place-items-center bg-white/[0.92] p-4 sm:h-36 sm:w-36"
                    : "aspect-[3/4] w-28 sm:w-40",
                )}
              >
                <Image
                  src={entity.image!}
                  alt={`${entity.name}`}
                  fill={kind !== "company"}
                  width={kind === "company" ? 160 : undefined}
                  height={kind === "company" ? 160 : undefined}
                  sizes="160px"
                  className={kind === "company" ? "object-contain p-1" : "object-cover"}
                />
              </Reveal>
            )}

            <div className="min-w-0 flex-1">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-soft">
                {eyebrow}
              </p>
              <h1 className="font-display text-[clamp(2rem,6vw,3.75rem)] font-black leading-[1.02] tracking-[-0.04em]">
                {entity.name}
              </h1>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {entity.detail && <Badge tone="neutral">{entity.detail}</Badge>}
                <Badge>
                  {entity.games.length} {entity.games.length === 1 ? "game" : "games"}
                </Badge>
              </div>
            </div>
          </div>

          {entity.description && (
            <Reveal delay={0.1} className="mt-8 max-w-3xl">
              <ExpandableText
                text={entity.description}
                paragraphClassName="text-[15px] leading-[1.75] text-muted"
              />
            </Reveal>
          )}
        </Container>
      </header>

      <Container className="py-10 lg:py-14">
        <h2 className="mb-6 text-2xl font-bold sm:text-3xl">
          {kind === "character" ? "Appears in" : "Games"}
        </h2>
        {entity.games.length > 0 ? (
          <GameGrid games={entity.games} priorityCount={5} />
        ) : (
          <p className="rounded-2xl border border-dashed border-line py-16 text-center text-sm text-muted">
            IGDB has no games linked to this entry yet.
          </p>
        )}
      </Container>
    </>
  );
}
