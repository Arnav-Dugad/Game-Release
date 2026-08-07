"use client";

/**
 * Two-part custom cursor: a precise dot that tracks the pointer exactly, and a
 * larger ring that lags behind on a spring. The ring expands over interactive
 * targets and can show a contextual label.
 *
 * Mounted only for fine pointers with motion enabled — it returns null
 * everywhere else, so no listeners are attached on touch devices. The native
 * cursor is hidden via a class on `<html>` rather than global CSS so that if
 * this component ever fails to mount, the real cursor is still there.
 */

import { AnimatePresence, motion, useMotionValue, useSpring } from "motion/react";
import { useEffect, useState } from "react";
import { useRichMotion } from "@/hooks";

type CursorMode = "default" | "link" | "view" | "text";

export function CustomCursor() {
  const enabled = useRichMotion();
  const [mode, setMode] = useState<CursorMode>("default");
  const [label, setLabel] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const ringX = useSpring(x, { stiffness: 320, damping: 30, mass: 0.4 });
  const ringY = useSpring(y, { stiffness: 320, damping: 30, mass: 0.4 });

  useEffect(() => {
    if (!enabled) return;

    document.documentElement.classList.add("has-custom-cursor");

    const onMove = (event: PointerEvent) => {
      x.set(event.clientX);
      y.set(event.clientY);
      if (!visible) setVisible(true);

      const target = event.target as HTMLElement | null;
      const interactive = target?.closest<HTMLElement>(
        "a, button, [role='button'], input, textarea, select, [data-cursor]",
      );

      if (!interactive) {
        setMode("default");
        setLabel(null);
        return;
      }

      const explicit = interactive.dataset.cursor as CursorMode | undefined;
      setLabel(interactive.dataset.cursorLabel ?? null);

      if (explicit) {
        setMode(explicit);
      } else if (interactive.matches("input, textarea")) {
        setMode("text");
      } else {
        setMode("link");
      }
    };

    const onLeave = () => setVisible(false);
    const onEnter = () => setVisible(true);

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    document.addEventListener("pointerenter", onEnter);

    return () => {
      document.documentElement.classList.remove("has-custom-cursor");
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("pointerenter", onEnter);
    };
  }, [enabled, visible, x, y]);

  if (!enabled) return null;

  const ringSize = mode === "view" ? 76 : mode === "link" ? 46 : mode === "text" ? 4 : 30;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[999] hidden fine:block">
      {/* Precise dot — no spring, so it never feels laggy. */}
      <motion.span
        className="absolute left-0 top-0 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white mix-blend-difference"
        style={{ x, y, opacity: visible && mode !== "text" ? 1 : 0 }}
      />
      <motion.span
        className="absolute left-0 top-0 flex items-center justify-center rounded-full border border-white/70 mix-blend-difference"
        style={{
          x: ringX,
          y: ringY,
          translateX: "-50%",
          translateY: "-50%",
          opacity: visible ? 1 : 0,
        }}
        animate={{
          width: ringSize,
          height: mode === "text" ? 26 : ringSize,
          borderRadius: mode === "text" ? 2 : 999,
          backgroundColor:
            mode === "view" ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0)",
        }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
      >
        <AnimatePresence>
          {label && mode === "view" && (
            <motion.span
              key={label}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white"
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.span>
    </div>
  );
}
