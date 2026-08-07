"use client";

/**
 * Pointer-tracked 3D tilt with a moving specular glare.
 *
 * Desktop-only by design: it is bound to `pointermove`, which touch devices
 * either don't fire meaningfully or fire once on tap. On coarse pointers the
 * component renders a plain wrapper with no listeners and no animation, so
 * phones pay nothing for it.
 */

import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import { useRef, type ReactNode } from "react";
import { useRichMotion } from "@/hooks";
import { cn } from "@/lib/utils/cn";

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  /** Maximum rotation in degrees at the card's edges. */
  intensity?: number;
  /** Perspective distance — lower is a more dramatic effect. */
  perspective?: number;
  scale?: number;
  glare?: boolean;
}

const SPRING = { stiffness: 260, damping: 26, mass: 0.6 } as const;

export function TiltCard({
  children,
  className,
  intensity = 9,
  perspective = 900,
  scale = 1.02,
  glare = true,
}: TiltCardProps) {
  const enabled = useRichMotion();
  const ref = useRef<HTMLDivElement>(null);

  // Raw pointer position, normalised to -0.5…0.5 from the card's centre.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const hovered = useMotionValue(0);

  const rotateX = useSpring(useTransform(py, (v) => -v * intensity * 2), SPRING);
  const rotateY = useSpring(useTransform(px, (v) => v * intensity * 2), SPRING);
  const lift = useSpring(hovered, SPRING);
  const cardScale = useTransform(lift, [0, 1], [1, scale]);
  const glareOpacity = useSpring(hovered, { stiffness: 180, damping: 30 });

  const glareX = useTransform(useSpring(px, SPRING), (v) => `${(v + 0.5) * 100}%`);
  const glareY = useTransform(useSpring(py, SPRING), (v) => `${(v + 0.5) * 100}%`);
  const glareBackground = useMotionTemplate`radial-gradient(400px circle at ${glareX} ${glareY}, rgba(255,255,255,0.18), transparent 62%)`;

  // Hooks above always run; only the rendered tree branches.
  if (!enabled) {
    return <div className={className}>{children}</div>;
  }

  const handleMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    px.set((event.clientX - rect.left) / rect.width - 0.5);
    py.set((event.clientY - rect.top) / rect.height - 0.5);
  };

  const handleLeave = () => {
    hovered.set(0);
    px.set(0);
    py.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onPointerMove={handleMove}
      onPointerEnter={() => hovered.set(1)}
      onPointerLeave={handleLeave}
      style={{ perspective }}
      className={cn("relative", className)}
    >
      <motion.div
        style={{ rotateX, rotateY, scale: cardScale, transformStyle: "preserve-3d" }}
        className="relative h-full w-full rounded-[inherit] will-change-transform"
      >
        {children}
        {glare && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 z-20 rounded-[inherit]"
            style={{ background: glareBackground, opacity: glareOpacity }}
          />
        )}
      </motion.div>
    </motion.div>
  );
}
