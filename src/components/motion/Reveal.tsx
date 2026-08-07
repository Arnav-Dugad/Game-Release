"use client";

/**
 * Scroll-triggered entrance. The workhorse of the site's motion language.
 *
 * The signature detail is the blur-to-sharp transition paired with the
 * translate — it reads as the content resolving into focus rather than merely
 * sliding, which is what separates it from a stock fade-in.
 */

import { motion, useReducedMotion, type Variants } from "motion/react";
import type { ReactNode } from "react";

export type RevealDirection = "up" | "down" | "left" | "right" | "none";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Anchor target, e.g. for `#settings` deep links. */
  id?: string;
  delay?: number;
  duration?: number;
  direction?: RevealDirection;
  distance?: number;
  /** Adds the focus-pull. Disable for large images, where blur is expensive. */
  blur?: boolean;
  once?: boolean;
  /** Fraction of the element that must be visible before it fires. */
  amount?: number;
  as?: "div" | "section" | "li" | "article" | "header" | "span";
}

function offset(direction: RevealDirection, distance: number) {
  switch (direction) {
    case "up":
      return { y: distance };
    case "down":
      return { y: -distance };
    case "left":
      return { x: distance };
    case "right":
      return { x: -distance };
    default:
      return {};
  }
}

export function Reveal({
  children,
  className,
  id,
  delay = 0,
  duration = 0.7,
  direction = "up",
  distance = 26,
  blur = true,
  once = true,
  amount = 0.25,
  as = "div",
}: RevealProps) {
  const reduced = useReducedMotion();
  const Component = motion[as];

  // Reduced motion still gets a fade so content doesn't pop in abruptly, but
  // nothing moves and nothing blurs.
  const variants: Variants = reduced
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.25, delay } },
      }
    : {
        hidden: {
          opacity: 0,
          ...offset(direction, distance),
          filter: blur ? "blur(10px)" : "blur(0px)",
        },
        visible: {
          opacity: 1,
          x: 0,
          y: 0,
          filter: "blur(0px)",
          transition: {
            duration,
            delay,
            ease: [0.16, 1, 0.3, 1],
          },
        },
      };

  return (
    <Component
      id={id}
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount }}
    >
      {children}
    </Component>
  );
}

/* -------------------------------------------------------------------------- */

interface StaggerProps {
  children: ReactNode;
  className?: string;
  /** Gap between children, in seconds. */
  gap?: number;
  delay?: number;
  once?: boolean;
  amount?: number;
  as?: "div" | "ul" | "section";
}

/**
 * Parent for `StaggerItem`. Orchestration lives on the container so items stay
 * plain and can be composed anywhere inside it.
 */
export function Stagger({
  children,
  className,
  gap = 0.07,
  delay = 0,
  once = true,
  amount = 0.15,
  as = "div",
}: StaggerProps) {
  const reduced = useReducedMotion();
  const Component = motion[as];

  return (
    <Component
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount }}
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: reduced ? 0 : gap,
            delayChildren: delay,
          },
        },
      }}
    >
      {children}
    </Component>
  );
}

export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 24, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  },
};

const staggerItemReduced: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25 } },
};

export function StaggerItem({
  children,
  className,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "li" | "article";
}) {
  const reduced = useReducedMotion();
  const Component = motion[as];
  return (
    <Component className={className} variants={reduced ? staggerItemReduced : staggerItemVariants}>
      {children}
    </Component>
  );
}
