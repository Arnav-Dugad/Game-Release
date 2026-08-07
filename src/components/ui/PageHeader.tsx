import type { ReactNode } from "react";
import { Aurora, GridLines } from "@/components/motion/Aurora";
import { TextReveal } from "@/components/motion/text";
import { Reveal } from "@/components/motion/Reveal";
import { Container } from "./SectionHeading";
import { cn } from "@/lib/utils/cn";

/**
 * Shared masthead for every non-home route. Keeps page entrances consistent so
 * navigating between sections feels like one product rather than a set of
 * separately-designed screens.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "noise relative isolate overflow-hidden border-b border-line pb-8 pt-24 sm:pb-10 lg:pb-14 lg:pt-36",
        className,
      )}
    >
      <Aurora intensity="subtle" className="-z-10" />
      <GridLines className="-z-10 opacity-60" />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-bg to-transparent"
      />

      <Container>
        {eyebrow && (
          <Reveal>
            <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-soft">
              <span aria-hidden className="h-px w-6 bg-gradient-to-r from-brand to-transparent" />
              {eyebrow}
            </p>
          </Reveal>
        )}

        <TextReveal
          as="h1"
          text={title}
          className="font-display text-[clamp(2rem,6.5vw,3.75rem)] font-black leading-[1.02] tracking-[-0.035em]"
        />

        {description && (
          <Reveal delay={0.15}>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted sm:text-base">
              {description}
            </p>
          </Reveal>
        )}

        {children && <Reveal delay={0.22} className="mt-7">{children}</Reveal>}
      </Container>
    </header>
  );
}
