/**
 * Steam price history, and what it makes possible.
 *
 * Steam publishes only the price *right now*. "Is this a good deal?" needs the
 * prices before it, and nobody publishes those for free — so they have to be
 * recorded as they're observed.
 *
 * Snapshots live in Firestore under `prices/{appId}_{region}/points/{date}`,
 * one document per app, region and day. Keying by date makes the write
 * idempotent: the daily job can run twice, or a page view can record the same
 * observation, and neither creates a duplicate or corrupts the series.
 *
 * Deliberately a *public* collection rather than per-user. A price is a fact
 * about the world, identical for every reader in a region, so storing it per
 * user would multiply the same data by the user count and still leave a new
 * account with no history at all.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/config";
import type { Price } from "./types";

/** One observation of a price, on one day, in one region. */
export interface PricePoint {
  /** ISO `YYYY-MM-DD`, and the document id — one point per day. */
  date: string;
  /** Minor units (cents/paise) so comparisons are integer maths. */
  amount: number;
  /** Undiscounted price in the same units, when the title is on sale. */
  original: number | null;
  discountPercent: number;
  isFree: boolean;
  /** Formatted string as Steam rendered it, kept for display fidelity. */
  formatted: string;
  currency: string;
}

export interface PriceInsight {
  /** Lowest observed price, in minor units. */
  low: number;
  lowDate: string;
  /** Highest observed, which is usually list price. */
  high: number;
  /** How many days we actually have. A judgement on 2 points is not a judgement. */
  points: number;
  /** True when today matches the lowest we have ever seen. */
  isAllTimeLow: boolean;
  /** Percent below the highest observed price. */
  belowPeakPercent: number;
}

const seriesId = (appId: number, region: string) => `${appId}_${region.toLowerCase()}`;

/** Steam formats prices with a currency symbol; the digits are what we compare. */
export function parseAmount(formatted: string | null | undefined): number | null {
  if (!formatted) return null;
  // Handles "$59.99", "₹3,999", "49,99€" — strip everything but digits and
  // separators, then treat the *last* separator as the decimal point.
  const cleaned = formatted.replace(/[^\d.,]/g, "");
  if (!cleaned) return null;

  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  const decimalAt = Math.max(lastDot, lastComma);

  // A separator followed by exactly two digits is a decimal point; anything
  // else (thousands grouping, or none at all) means whole units.
  const hasDecimals = decimalAt !== -1 && cleaned.length - decimalAt - 1 === 2;
  const whole = hasDecimals ? cleaned.slice(0, decimalAt) : cleaned;
  const fraction = hasDecimals ? cleaned.slice(decimalAt + 1) : "00";

  const digits = whole.replace(/[.,]/g, "");
  if (!digits) return null;
  return Number(digits) * 100 + Number(fraction);
}

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Records today's price, if it isn't already recorded.
 *
 * Best-effort by design: a failed write must never affect the page that
 * triggered it. Reads the day's document first so a repeat view costs one small
 * read rather than a pointless write.
 */
export async function recordPrice(
  appId: number,
  region: string,
  price: Price,
  currency = "",
): Promise<void> {
  const db = getDb();
  if (!db) return;

  const amount = price.isFree ? 0 : parseAmount(price.current);
  if (amount === null) return;

  const date = todayIso();
  const ref = doc(db, "prices", seriesId(appId, region), "points", date);

  try {
    const existing = await getDoc(ref);
    if (existing.exists()) return;

    const point: PricePoint = {
      date,
      amount,
      original: price.original ? parseAmount(price.original) : null,
      discountPercent: price.discountPercent,
      isFree: price.isFree,
      formatted: price.current,
      currency,
    };
    await setDoc(ref, point);
  } catch {
    /* history is an enhancement; never surface a failure to record it */
  }
}

/** The recorded series, newest first. */
export async function getPriceHistory(
  appId: number,
  region: string,
  days = 180,
): Promise<PricePoint[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const snap = await getDocs(
      query(
        collection(db, "prices", seriesId(appId, region), "points"),
        orderBy("date", "desc"),
        fsLimit(days),
      ),
    );
    return snap.docs.map((d) => d.data() as PricePoint);
  } catch {
    return [];
  }
}

/**
 * Turns a series into the two things worth saying about a price.
 *
 * Returns null below three points: "all-time low" computed from two
 * observations is technically true and completely misleading, and the honest
 * move is to say nothing until the series means something.
 */
export function priceInsight(points: PricePoint[]): PriceInsight | null {
  const usable = points.filter((point) => !point.isFree);
  if (usable.length < 3) return null;

  let low = usable[0];
  let high = usable[0];
  for (const point of usable) {
    if (point.amount < low.amount) low = point;
    if (point.amount > high.amount) high = point;
  }

  // Points come back newest-first, so index 0 is today's observation.
  const current = usable[0];

  return {
    low: low.amount,
    lowDate: low.date,
    high: high.amount,
    points: usable.length,
    isAllTimeLow: current.amount <= low.amount,
    belowPeakPercent:
      high.amount > 0 ? Math.round(((high.amount - current.amount) / high.amount) * 100) : 0,
  };
}
