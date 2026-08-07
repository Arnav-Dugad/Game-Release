"use client";

/**
 * Auth context.
 *
 * Wraps the Firebase auth lifecycle so components never import the SDK
 * directly. When Firebase is unconfigured the provider still mounts and simply
 * reports `enabled: false` with a null user — auth-gated screens then render an
 * explanatory state rather than an error.
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
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { authErrorMessage, firebaseEnabled, getFirebaseAuth } from "./config";
import { ensureUserProfile } from "./db";

export class AuthUnavailableError extends Error {
  constructor() {
    super("Authentication isn't configured for this deployment yet.");
    this.name = "AuthUnavailableError";
  }
}

interface AuthContextValue {
  user: User | null;
  /** True until the first auth state resolution. Gate redirects on this. */
  loading: boolean;
  enabled: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  setDisplayName: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Normalises anything Firebase throws into a message safe to show a user. */
function toFriendlyError(err: unknown): Error {
  if (err instanceof AuthUnavailableError) return err;
  if (typeof err === "object" && err !== null && "code" in err) {
    return new Error(authErrorMessage(String((err as { code: unknown }).code)));
  }
  return new Error("Something went wrong. Please try again.");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // Seeded from config rather than always `true`: with Firebase unconfigured
  // there is no session to wait for, so auth-gated screens can decide
  // immediately instead of flashing a loading state that never resolves.
  const [loading, setLoading] = useState(firebaseEnabled);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      // Configured but failed to initialise — don't strand the UI in loading.
      const frame = requestAnimationFrame(() => setLoading(false));
      return () => cancelAnimationFrame(frame);
    }
    return onAuthStateChanged(
      auth,
      (next) => {
        setUser(next);
        setLoading(false);
      },
      (err) => {
        console.error("[auth] state listener failed", err);
        setLoading(false);
      },
    );
  }, []);

  const requireAuth = useCallback(() => {
    const auth = getFirebaseAuth();
    if (!auth) throw new AuthUnavailableError();
    return auth;
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        const auth = requireAuth();
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        // Covers accounts created before the profile collection existed.
        await ensureUserProfile({
          uid: cred.user.uid,
          displayName: cred.user.displayName,
          email: cred.user.email,
          photoURL: cred.user.photoURL,
        });
      } catch (err) {
        throw toFriendlyError(err);
      }
    },
    [requireAuth],
  );

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      try {
        const auth = requireAuth();
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const displayName = name.trim();
        if (displayName) {
          await updateProfile(cred.user, { displayName });
          // The local user object caches the old (empty) name until reloaded.
          await cred.user.reload();
          setUser(auth.currentUser);
        }
        await ensureUserProfile({
          uid: cred.user.uid,
          displayName: displayName || null,
          email: cred.user.email,
          photoURL: cred.user.photoURL,
        });
      } catch (err) {
        throw toFriendlyError(err);
      }
    },
    [requireAuth],
  );

  const signInWithGoogle = useCallback(async () => {
    try {
      const auth = requireAuth();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const cred = await signInWithPopup(auth, provider);
      await ensureUserProfile({
        uid: cred.user.uid,
        displayName: cred.user.displayName,
        email: cred.user.email,
        photoURL: cred.user.photoURL,
      });
    } catch (err) {
      throw toFriendlyError(err);
    }
  }, [requireAuth]);

  const signOut = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    await firebaseSignOut(auth);
  }, []);

  const resetPassword = useCallback(
    async (email: string) => {
      try {
        await sendPasswordResetEmail(requireAuth(), email.trim());
      } catch (err) {
        throw toFriendlyError(err);
      }
    },
    [requireAuth],
  );

  const setDisplayName = useCallback(
    async (name: string) => {
      try {
        const auth = requireAuth();
        if (!auth.currentUser) throw new Error("You need to be signed in.");
        await updateProfile(auth.currentUser, { displayName: name.trim() });
        await auth.currentUser.reload();
        setUser(auth.currentUser);
      } catch (err) {
        throw toFriendlyError(err);
      }
    },
    [requireAuth],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      enabled: firebaseEnabled,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      resetPassword,
      setDisplayName,
    }),
    [user, loading, signIn, signUp, signInWithGoogle, signOut, resetPassword, setDisplayName],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}
