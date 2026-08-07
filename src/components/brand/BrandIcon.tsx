import { brandIcon } from "./brand-icons";
import { cn } from "@/lib/utils/cn";

/**
 * Renders a brand mark from the generated icon set.
 *
 * Defaults to `currentColor` so marks inherit the surrounding text colour and
 * sit quietly in dense rows. Pass `tinted` where the logo is the point — store
 * buttons, platform pickers — and it switches to the official brand colour.
 */
export function BrandIcon({
  name,
  size = 16,
  className,
  tinted = false,
  title,
}: {
  name: string;
  size?: number;
  className?: string;
  tinted?: boolean;
  /** Overrides the built-in label; pass null to mark the icon decorative. */
  title?: string | null;
}) {
  const icon = brandIcon(name);
  if (!icon) return null;

  const label = title === undefined ? icon.label : title;

  return (
    <svg
      role={label ? "img" : undefined}
      aria-label={label ?? undefined}
      aria-hidden={label ? undefined : true}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={tinted ? icon.colour : "currentColor"}
      className={cn("shrink-0", className)}
    >
      {label && <title>{label}</title>}
      <path d={icon.path} />
    </svg>
  );
}

export { brandIcon, BRAND_ICONS } from "./brand-icons";
export type { BrandIcon as BrandIconData, BrandKey } from "./brand-icons";
