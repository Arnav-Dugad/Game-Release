"use client";

/**
 * Screenshot gallery with a full-screen lightbox.
 *
 * The thumbnail strip is a native snap rail on touch and a grid on desktop.
 * Inside the lightbox, touch gets drag-to-navigate and drag-down-to-dismiss;
 * desktop gets arrow keys and hover controls. Both get Escape.
 */

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { sizedImage } from "@/lib/games/image";
import { useEscapeKey, useIsMobile, useLockBodyScroll } from "@/hooks";
import { Reveal } from "@/components/motion/Reveal";
import { cn } from "@/lib/utils/cn";

export function ScreenshotGallery({
  screenshots,
  gameName,
}: {
  screenshots: string[];
  gameName: string;
}) {
  const [openAt, setOpenAt] = useState<number | null>(null);
  const isMobile = useIsMobile();
  const shots = screenshots.filter(Boolean);

  const close = useCallback(() => setOpenAt(null), []);
  const step = useCallback(
    (delta: number) =>
      setOpenAt((current) =>
        current === null ? null : (current + delta + shots.length) % shots.length,
      ),
    [shots.length],
  );

  useEscapeKey(close, openAt !== null);
  useLockBodyScroll(openAt !== null);

  useEffect(() => {
    if (openAt === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openAt, step]);

  if (shots.length === 0) return null;

  return (
    <>
      <div
        className={cn(
          "snap-rail gap-3 pb-2",
          // Desktop has the width for a real grid; phones scroll horizontally.
          "fine:grid fine:grid-cols-3 fine:gap-4 fine:overflow-visible",
        )}
      >
        {shots.map((src, i) => (
          <Reveal
            key={src}
            delay={Math.min(i, 5) * 0.05}
            blur={false}
            amount={0.1}
            className="w-[72vw] max-w-[380px] fine:w-auto fine:max-w-none"
          >
            <button
              type="button"
              onClick={() => setOpenAt(i)}
              data-cursor="view"
              data-cursor-label="Expand"
              aria-label={`View screenshot ${i + 1} of ${shots.length}`}
              className="group relative block aspect-video w-full overflow-hidden rounded-xl border border-line bg-panel transition-colors duration-300 fine:hover:border-line-strong"
            >
              <Image
                src={sizedImage(src, 640) ?? src}
                alt={`${gameName} screenshot ${i + 1}`}
                fill
                sizes="(max-width: 640px) 72vw, 33vw"
                className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] fine:group-hover:scale-105"
              />
              <span className="absolute inset-0 bg-black/20 opacity-0 transition-opacity duration-300 fine:group-hover:opacity-100" />
              <span className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-lg bg-black/60 opacity-0 backdrop-blur-sm transition-opacity duration-300 fine:group-hover:opacity-100">
                <Expand size={14} />
              </span>
            </button>
          </Reveal>
        ))}
      </div>

      <AnimatePresence>
        {openAt !== null && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center">
            <motion.div
              className="absolute inset-0 bg-black/93 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={close}
            />

            <motion.div
              key={openAt}
              className="relative z-10 w-full max-w-6xl px-3 sm:px-8"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              drag={isMobile ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.25}
              onDragEnd={(_, info) => {
                if (info.offset.x < -80) step(1);
                else if (info.offset.x > 80) step(-1);
              }}
            >
              <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-panel">
                <Image
                  src={sizedImage(shots[openAt], 1920) ?? shots[openAt]}
                  alt={`${gameName} screenshot ${openAt + 1}`}
                  fill
                  sizes="100vw"
                  priority
                  className="object-contain"
                />
              </div>

              <p className="mt-3 text-center text-xs text-faint tabular-nums">
                {openAt + 1} / {shots.length}
                <span className="ml-2 hidden fine:inline">· Use ← → to navigate</span>
                <span className="ml-2 fine:hidden">· Swipe to navigate</span>
              </p>
            </motion.div>

            <button
              type="button"
              onClick={close}
              aria-label="Close gallery"
              className="absolute right-3 top-3 z-20 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20 sm:right-6 sm:top-6"
            >
              <X size={18} />
            </button>

            {shots.length > 1 && (
              <>
                <LightboxArrow direction="left" onClick={() => step(-1)} />
                <LightboxArrow direction="right" onClick={() => step(1)} />
              </>
            )}
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

function LightboxArrow({
  direction,
  onClick,
}: {
  direction: "left" | "right";
  onClick: () => void;
}) {
  const Icon = direction === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "left" ? "Previous screenshot" : "Next screenshot"}
      className={cn(
        "absolute top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20 fine:grid",
        direction === "left" ? "left-4" : "right-4",
      )}
    >
      <Icon size={20} />
    </button>
  );
}
