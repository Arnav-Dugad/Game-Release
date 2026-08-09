"use client";

/**
 * Local, device-scoped preferences.
 *
 * Deliberately stored in `localStorage` rather than Firestore: these are display
 * choices, not account data. Someone browsing signed-out should still be able to
 * set their currency, and a preference that follows the device is the right
 * model for something like "reduce motion on this laptop".
 *
 * The Steam region is also read on the server (to price correctly during SSR),
 * so it is mirrored into a cookie — `localStorage` is invisible to the server,
 * and a cookie is the only thing both sides can see on the first paint.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_STEAM_REGION,
  isValidRegion,
  steamRegion,
  type SteamRegion,
} from "@/lib/games/stores-catalog";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { getUserPreferences, saveUserPreferences } from "@/lib/firebase/db";

export const REGION_COOKIE = "ludex_region";
const REGION_KEY = "ludex:region";
const MOTION_KEY = "ludex:reduce-motion";
const POSTER_KEY = "ludex:poster-sizes";
const NOTIFICATION_DEALS_KEY = "ludex:notifications:deals";
const NOTIFICATION_RELEASES_KEY = "ludex:notifications:releases";
const PLANNER_HOURS_KEY = "ludex:planner:weekly-hours";

interface PreferencesValue {
  /** Steam country code, e.g. "in". Drives the currency prices are shown in. */
  region: string;
  regionInfo: SteamRegion;
  setRegion: (cc: string) => void;
  /** User-level motion opt-out, on top of the OS setting. */
  reduceMotion: boolean;
  setReduceMotion: (value: boolean) => void;
  /**
   * Poster density per collection page, mirrored to the account so it follows
   * the reader to a new device like every other preference.
   */
  posterSizes: Record<string, string>;
  setPosterSize: (key: string, size: string) => void;
  notificationDeals: boolean;
  setNotificationDeals: (value: boolean) => void;
  notificationReleases: boolean;
  setNotificationReleases: (value: boolean) => void;
  /** Weekly time budget for the personal release planner. */
  plannerWeeklyHours: number;
  setPlannerWeeklyHours: (value: number) => void;
  /** False until localStorage has been read, so nothing renders a wrong value. */
  ready: boolean;
}

const PreferencesContext = createContext<PreferencesValue | null>(null);

function writeRegionCookie(cc: string) {
  // A year is long enough to feel permanent; `SameSite=Lax` keeps it off
  // cross-site requests while still applying to normal navigation.
  document.cookie = `${REGION_COOKIE}=${cc}; path=/; max-age=31536000; SameSite=Lax`;
}

/** The region the server would see, read from the browser's own cookie jar. */
function readRegionCookie(): string | null {
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${REGION_COOKIE}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  // Always starts at the default so server and client markup agree. The real
  // value lands on mount, below.
  const [region, setRegionState] = useState<string>(DEFAULT_STEAM_REGION);
  const [reduceMotion, setReduceMotionState] = useState(false);
  const [posterSizes, setPosterSizesState] = useState<Record<string, string>>({});
  const [notificationDeals, setNotificationDealsState] = useState(true);
  const [notificationReleases, setNotificationReleasesState] = useState(true);
  const [plannerWeeklyHours, setPlannerWeeklyHoursState] = useState(12);
  const [ready, setReady] = useState(false);
  /**
   * True once the device copy has been read. Account preferences are only
   * applied after this, so a slow Firestore read can never overwrite a choice
   * the reader just made on this device.
   */
  const [deviceLoaded, setDeviceLoaded] = useState(false);

  useEffect(() => {
    // Deferred a frame so nothing is written during the effect itself.
    //
    // localStorage is the source of truth for this device; the cookie is the
    // mirror the server reads. Preferring localStorage and then re-asserting
    // the cookie converges the two, and reading the cookie as a fallback covers
    // a browser that kept cookies but cleared site storage.
    const frame = requestAnimationFrame(() => {
      try {
        const stored = window.localStorage.getItem(REGION_KEY);
        const resolved = stored && isValidRegion(stored) ? stored : readRegionCookie();

        if (resolved && isValidRegion(resolved)) {
          setRegionState(resolved);
          writeRegionCookie(resolved);
        }
        setReduceMotionState(window.localStorage.getItem(MOTION_KEY) === "true");

        const storedSizes = window.localStorage.getItem(POSTER_KEY);
        if (storedSizes) {
          const parsed: unknown = JSON.parse(storedSizes);
          // Guard the shape: a hand-edited or stale value must not poison state.
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            setPosterSizesState(parsed as Record<string, string>);
          }
        }
        setNotificationDealsState(window.localStorage.getItem(NOTIFICATION_DEALS_KEY) !== "false");
        setNotificationReleasesState(window.localStorage.getItem(NOTIFICATION_RELEASES_KEY) !== "false");
        const storedPlannerHours = Number(window.localStorage.getItem(PLANNER_HOURS_KEY));
        if (Number.isFinite(storedPlannerHours) && storedPlannerHours >= 1 && storedPlannerHours <= 40) {
          setPlannerWeeklyHoursState(Math.round(storedPlannerHours));
        }
      } catch {
        /* private mode or storage disabled — defaults are fine */
      }
      setReady(true);
      setDeviceLoaded(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  /**
   * Pull account preferences once signed in.
   *
   * Deliberately runs *after* the device read and only fills values the device
   * didn't already have. Signing in on a new browser inherits your settings;
   * signing in on a device you've already configured leaves it alone.
   */
  useEffect(() => {
    if (!user || !deviceLoaded) return;
    let cancelled = false;

    getUserPreferences(user.uid)
      .then((prefs) => {
        if (cancelled || !prefs) return;
        try {
          const hasLocalRegion = Boolean(window.localStorage.getItem(REGION_KEY));
          if (!hasLocalRegion && prefs.region && isValidRegion(prefs.region)) {
            setRegionState(prefs.region);
            writeRegionCookie(prefs.region);
          }
          const hasLocalMotion = window.localStorage.getItem(MOTION_KEY) !== null;
          if (!hasLocalMotion && typeof prefs.reduceMotion === "boolean") {
            setReduceMotionState(prefs.reduceMotion);
          }

          const hasLocalSizes = window.localStorage.getItem(POSTER_KEY) !== null;
          if (!hasLocalSizes && prefs.posterSizes) {
            setPosterSizesState(prefs.posterSizes);
          }
          const hasLocalDealAlerts = window.localStorage.getItem(NOTIFICATION_DEALS_KEY) !== null;
          if (!hasLocalDealAlerts && typeof prefs.notificationDeals === "boolean") {
            setNotificationDealsState(prefs.notificationDeals);
          }
          const hasLocalReleaseAlerts = window.localStorage.getItem(NOTIFICATION_RELEASES_KEY) !== null;
          if (!hasLocalReleaseAlerts && typeof prefs.notificationReleases === "boolean") {
            setNotificationReleasesState(prefs.notificationReleases);
          }
          const hasLocalPlannerHours = window.localStorage.getItem(PLANNER_HOURS_KEY) !== null;
          if (
            !hasLocalPlannerHours &&
            typeof prefs.plannerWeeklyHours === "number" &&
            prefs.plannerWeeklyHours >= 1 &&
            prefs.plannerWeeklyHours <= 40
          ) {
            setPlannerWeeklyHoursState(Math.round(prefs.plannerWeeklyHours));
          }
        } catch {
          /* storage unavailable — account values simply aren't applied */
        }
      })
      .catch(() => {
        /* preferences are best-effort; the device copy already works */
      });

    return () => {
      cancelled = true;
    };
  }, [user, deviceLoaded]);

  useEffect(() => {
    // Lets CSS opt out of motion without every component subscribing.
    document.documentElement.dataset.reduceMotion = reduceMotion ? "true" : "false";
  }, [reduceMotion]);

  const setRegion = useCallback(
    (cc: string) => {
      if (!isValidRegion(cc)) return;
      setRegionState(cc);
      try {
        window.localStorage.setItem(REGION_KEY, cc);
      } catch {
        /* in-memory state still updates */
      }
      writeRegionCookie(cc);
      // Fire-and-forget: the device copy is already authoritative for this
      // session, so a failed sync must never block or surface an error.
      if (user) void saveUserPreferences(user.uid, { region: cc }).catch(() => {});
    },
    [user],
  );

  const setReduceMotion = useCallback(
    (value: boolean) => {
      setReduceMotionState(value);
      try {
        window.localStorage.setItem(MOTION_KEY, String(value));
      } catch {
        /* in-memory state still updates */
      }
      if (user) void saveUserPreferences(user.uid, { reduceMotion: value }).catch(() => {});
    },
    [user],
  );

  const setPosterSize = useCallback(
    (key: string, size: string) => {
      setPosterSizesState((prev) => {
        const next = { ...prev, [key]: size };
        try {
          window.localStorage.setItem(POSTER_KEY, JSON.stringify(next));
        } catch {
          /* in-memory state still updates */
        }
        // Merged server-side, so writing one page's choice can't clear another's.
        if (user) void saveUserPreferences(user.uid, { posterSizes: next }).catch(() => {});
        return next;
      });
    },
    [user],
  );

  const setNotificationDeals = useCallback(
    (value: boolean) => {
      setNotificationDealsState(value);
      try {
        window.localStorage.setItem(NOTIFICATION_DEALS_KEY, String(value));
      } catch {
        /* in-memory state still updates */
      }
      if (user) void saveUserPreferences(user.uid, { notificationDeals: value }).catch(() => {});
    },
    [user],
  );

  const setNotificationReleases = useCallback(
    (value: boolean) => {
      setNotificationReleasesState(value);
      try {
        window.localStorage.setItem(NOTIFICATION_RELEASES_KEY, String(value));
      } catch {
        /* in-memory state still updates */
      }
      if (user) void saveUserPreferences(user.uid, { notificationReleases: value }).catch(() => {});
    },
    [user],
  );

  const setPlannerWeeklyHours = useCallback(
    (value: number) => {
      const next = Math.min(40, Math.max(1, Math.round(value)));
      setPlannerWeeklyHoursState(next);
      try {
        window.localStorage.setItem(PLANNER_HOURS_KEY, String(next));
      } catch {
        /* in-memory state still updates */
      }
      if (user) void saveUserPreferences(user.uid, { plannerWeeklyHours: next }).catch(() => {});
    },
    [user],
  );

  const value = useMemo<PreferencesValue>(
    () => ({
      region,
      regionInfo: steamRegion(region),
      setRegion,
      reduceMotion,
      setReduceMotion,
      posterSizes,
      setPosterSize,
      notificationDeals,
      setNotificationDeals,
      notificationReleases,
      setNotificationReleases,
      plannerWeeklyHours,
      setPlannerWeeklyHours,
      ready,
    }),
    [
      region,
      setRegion,
      reduceMotion,
      setReduceMotion,
      posterSizes,
      setPosterSize,
      notificationDeals,
      setNotificationDeals,
      notificationReleases,
      setNotificationReleases,
      plannerWeeklyHours,
      setPlannerWeeklyHours,
      ready,
    ],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used inside <PreferencesProvider>.");
  return ctx;
}
