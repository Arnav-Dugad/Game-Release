/**
 * Requests a provider's image at a size appropriate to how it will render.
 *
 * Providers hand back a URL at whatever size suited the query that produced it.
 * A cover fetched for a 220px card is the wrong asset for a 1920px hero, and
 * vice versa. IGDB encodes size as a path segment, so it can be re-targeted
 * cheaply; other providers serve one fixed asset and are returned untouched.
 *
 * `next/image` still optimises whatever comes back — this only ensures the
 * *source* is large enough to be worth optimising, and small enough not to
 * waste the origin's bandwidth.
 */

const IGDB_HOST = "images.igdb.com";
/** Matches the `/t_<size>/` segment in an IGDB media URL. */
const IGDB_SIZE_SEGMENT = /\/t_[a-z0-9_]+\//i;

function igdbSizeFor(width: number): string {
  if (width <= 300) return "cover_big";
  if (width <= 600) return "cover_big_2x";
  if (width <= 1280) return "720p";
  return "1080p";
}

export function sizedImage(url: string | null | undefined, width?: number): string | null {
  if (!url) return null;
  if (!width) return url;

  if (url.includes(IGDB_HOST) && IGDB_SIZE_SEGMENT.test(url)) {
    return url.replace(IGDB_SIZE_SEGMENT, `/t_${igdbSizeFor(width)}/`);
  }

  return url;
}
