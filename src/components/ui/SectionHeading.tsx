import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Reveal } from "@/components/motion/Reveal";
import { cn } from "@/lib/utils/cn";

interface SectionHeadingProps {
  eyebrow?: string;
  title: ReactNode;
  description?: string;
  href?: string;
  linkLabel?: string;
  className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  href,
  linkLabel = "See all",
  className,
}: SectionHeadingProps) {
  return (
    <Reveal className={cn("flex items-end justify-between gap-6", className)} amount={0.4}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-soft">
            <span aria-hidden className="h-px w-6 bg-gradient-to-r from-brand to-transparent" />
            {eyebrow}
          </p>
        )}
        <h2 className="text-2xl font-bold sm:text-3xl lg:text-[2.1rem]">{title}</h2>
        {description && (
          <p className="mt-2 max-w-xl text-sm text-muted sm:text-[15px]">{description}</p>
        )}
      </div>

      {href && (
        <Link
          href={href}
          className={cn(
            "group hidden shrink-0 items-center gap-2 rounded-full border border-line px-4 py-2.5 text-sm font-medium text-muted",
            "transition-colors duration-300 hover:border-line-strong hover:text-text sm:inline-flex",
          )}
        >
          {linkLabel}
          <ArrowRight
            size={15}
            className="transition-transform duration-300 group-hover:translate-x-0.5"
          />
        </Link>
      )}
    </Reveal>
  );
}

/** Full-bleed section wrapper with the page's standard gutters. */
export function Section({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("py-9 sm:py-12 lg:py-16", className)}>
      {children}
    </section>
  );
}

export function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[1400px] px-4 lg:px-6 xl:px-10", className)}>
      {children}
    </div>
  );
}
