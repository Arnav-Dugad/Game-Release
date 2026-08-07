import { Gamepad, Gamepad2, Globe, Joystick, Laptop, Monitor, Smartphone, Terminal } from "lucide-react";
import type { ComponentType } from "react";
import { platformKeys, type PlatformKey } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/**
 * Platform availability.
 *
 * Deliberately uses neutral device iconography rather than reproductions of
 * manufacturer logos — accurate brand marks would be redrawn from memory and
 * carry trademark constraints. Every icon is labelled, so the platform is never
 * conveyed by the glyph alone.
 */

const ICONS: Record<PlatformKey, ComponentType<{ size?: number; className?: string }>> = {
  pc: Monitor,
  playstation: Gamepad2,
  xbox: Gamepad,
  nintendo: Joystick,
  mac: Laptop,
  linux: Terminal,
  mobile: Smartphone,
  web: Globe,
};

const LABELS: Record<PlatformKey, string> = {
  pc: "PC",
  playstation: "PlayStation",
  xbox: "Xbox",
  nintendo: "Nintendo",
  mac: "macOS",
  linux: "Linux",
  mobile: "Mobile",
  web: "Browser",
};

export function PlatformIcons({
  platforms,
  max = 4,
  size = 13,
  className,
}: {
  platforms: { slug: string }[];
  max?: number;
  size?: number;
  className?: string;
}) {
  const keys = platformKeys(platforms);
  if (keys.length === 0) return null;

  const shown = keys.slice(0, max);
  const overflow = keys.length - shown.length;

  return (
    <ul className={cn("flex items-center gap-1.5", className)}>
      {shown.map((key) => {
        const Icon = ICONS[key];
        return (
          <li key={key} className="text-faint" title={LABELS[key]}>
            <Icon size={size} />
            <span className="sr-only">{LABELS[key]}</span>
          </li>
        );
      })}
      {overflow > 0 && (
        <li className="text-[10px] font-medium text-faint tabular-nums">+{overflow}</li>
      )}
    </ul>
  );
}

/** Labelled variant for the detail page, where there's room to name platforms. */
export function PlatformList({ platforms }: { platforms: { slug: string; name: string }[] }) {
  const keys = platformKeys(platforms);
  return (
    <ul className="flex flex-wrap gap-2">
      {keys.map((key) => {
        const Icon = ICONS[key];
        return (
          <li
            key={key}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.04] px-3 py-1.5 text-xs text-muted"
          >
            <Icon size={14} />
            {LABELS[key]}
          </li>
        );
      })}
    </ul>
  );
}
