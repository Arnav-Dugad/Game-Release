"use client";

import type { ReactNode } from "react";
import { PreferencesProvider } from "@/lib/preferences/PreferencesProvider";
import { AuthProvider } from "@/lib/firebase/AuthProvider";
import { WatchlistProvider } from "@/lib/firebase/WatchlistProvider";
import { ToastProvider } from "@/components/ui/Toast";

/**
 * Client provider stack.
 *
 * Order matters: preferences are device-level and wrap everything; the
 * watchlist listener keys off the signed-in user, so it sits inside auth; and
 * toasts are leaf-level so anything below can surface a message.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <PreferencesProvider>
      <AuthProvider>
        <WatchlistProvider>
          <ToastProvider>{children}</ToastProvider>
        </WatchlistProvider>
      </AuthProvider>
    </PreferencesProvider>
  );
}
