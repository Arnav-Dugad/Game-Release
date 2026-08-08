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

export const REGION_COOKIE = "ludex_region";
const REGION_KEY = "ludex:region";
const MOTION_KEY = "ludex:reduce-motion";

interface PreferencesValue {
  /** Steam country code, e.g. "in". Drives the currency prices are shown in. */
  region: string;
  regionInfo: SteamRegion;
  setRegion: (cc: string) => void;
  /** User-level motion opt-out, on top of the OS setting. */
  reduceMotion: boolean;
  setReduceMotion: (value: boolean) => void;
  /** False until localStorage has been read, so nothing renders a wrong value. */
  ready: boolean;
}

const PreferencesContext = createContext<PreferencesValue | null>(null);

function writeRegionCookie(cc: string) {
  // A year is long enough to feel permanent; `SameSite=Lax` keeps it off
  // cross-site requests while still applying to normal navigation.
  document.cookie = `${REGION_COOKIE}=${cc}; path=/; max-age=31536000; SameSite=Lax`;
}

export function PreferencesProvider({
  /** Region resolved from the cookie during SSR, so the first paint is correct. */
  initialRegion = DEFAULT_STEAM_REGION,
  children,
}: {
  initialRegion?: string;
  children: ReactNode;
}) {
  const [region, setRegionState] = useState(initialRegion);
  const [reduceMotion, setReduceMotionState] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Deferred a frame so nothing is written during the effect itself. The
    // cookie already supplied the correct region during SSR, so this is only a
    // backstop for when the cookie was cleared but localStorage survived.
    const frame = requestAnimationFrame(() => {
      try {
        const storedRegion = window.localStorage.getItem(REGION_KEY);
        if (storedRegion && isValidRegion(storedRegion)) {
          setRegionState(storedRegion);
          // Re-assert the cookie so the server agrees with the device on the
          // next navigation.
          writeRegionCookie(storedRegion);
        }
        setReduceMotionState(window.localStorage.getItem(MOTION_KEY) === "true");
      } catch {
        /* private mode or storage disabled — defaults are fine */
      }
      setReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    // Lets CSS opt out of motion without every component subscribing.
    document.documentElement.dataset.reduceMotion = reduceMotion ? "true" : "false";
  }, [reduceMotion]);

  const setRegion = useCallback((cc: string) => {
    if (!isValidRegion(cc)) return;
    setRegionState(cc);
    try {
      window.localStorage.setItem(REGION_KEY, cc);
    } catch {
      /* in-memory state still updates */
    }
    writeRegionCookie(cc);
  }, []);

  const setReduceMotion = useCallback((value: boolean) => {
    setReduceMotionState(value);
    try {
      window.localStorage.setItem(MOTION_KEY, String(value));
    } catch {
      /* in-memory state still updates */
    }
  }, []);

  const value = useMemo<PreferencesValue>(
    () => ({
      region,
      regionInfo: steamRegion(region),
      setRegion,
      reduceMotion,
      setReduceMotion,
      ready,
    }),
    [region, setRegion, reduceMotion, setReduceMotion, ready],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used inside <PreferencesProvider>.");
  return ctx;
}
