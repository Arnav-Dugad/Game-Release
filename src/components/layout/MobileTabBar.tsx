"use client";

/**
 * Touch-only bottom navigation.
 *
 * This is the counterpart to the desktop header's inline nav — not a
 * responsive restyling of it. Phones get thumb-reachable tabs at the bottom of
 * the screen with 44px+ targets and safe-area padding; the bar is never
 * rendered for fine pointers.
 */

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, CalendarClock, Compass, Home, Search, Tag } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const TABS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/upcoming", label: "Upcoming", icon: CalendarClock },
  { href: "__search", label: "Search", icon: Search },
  { href: "/browse", label: "Browse", icon: Compass },
  { href: "/deals", label: "Deals", icon: Tag },
  { href: "/watchlist", label: "Saved", icon: Bookmark },
] as const;

export function MobileTabBar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : href !== "__search" && pathname.startsWith(href);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-[150] border-t border-line bg-bg/85 backdrop-blur-2xl backdrop-saturate-150 safe-b fine:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.href);
          const content = (
            <>
              {active && (
                <motion.span
                  layoutId="tab-active"
                  className="absolute inset-x-3 top-0 h-[2px] rounded-full bg-brand"
                  transition={{ type: "spring", stiffness: 460, damping: 36 }}
                />
              )}
              <Icon
                size={21}
                className={cn(
                  "transition-colors duration-200",
                  active ? "text-brand-soft" : "text-faint",
                )}
              />
              <span
                className={cn(
                  "text-[10px] font-medium transition-colors duration-200",
                  active ? "text-text" : "text-faint",
                )}
              >
                {tab.label}
              </span>
            </>
          );

          const className =
            "relative flex h-16 w-full flex-col items-center justify-center gap-1 active:scale-95 transition-transform";

          return (
            <li key={tab.href} className="flex-1">
              {tab.href === "__search" ? (
                <button
                  type="button"
                  onClick={onOpenSearch}
                  aria-label="Search the complete database"
                  className={className}
                >
                  {content}
                </button>
              ) : (
                <Link href={tab.href} className={className} aria-current={active ? "page" : undefined}>
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
