"use client";

import type { ReactNode } from "react";
import { PreferencesProvider } from "@/lib/preferences/PreferencesProvider";
import { AuthProvider } from "@/lib/firebase/AuthProvider";
import { WatchlistProvider } from "@/lib/firebase/WatchlistProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { NotificationsProvider } from "@/lib/notifications/NotificationsProvider";

/**
 * Client provider stack.
 *
 * Order matters. Auth is outermost because both of the providers below it read
 * the signed-in user: the watchlist keys its listener off the uid, and
 * preferences sync to the account so settings follow the reader to a new
 * device. Toasts are leaf-level so anything below can surface a message.
 *
 * Preferences still work fully signed-out — the account is a mirror of the
 * device copy, not a prerequisite for it.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <PreferencesProvider>
        <WatchlistProvider>
          <NotificationsProvider>
            <ToastProvider>{children}</ToastProvider>
          </NotificationsProvider>
        </WatchlistProvider>
      </PreferencesProvider>
    </AuthProvider>
  );
}
