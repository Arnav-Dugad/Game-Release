"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/lib/firebase/AuthProvider";
import { WatchlistProvider } from "@/lib/firebase/WatchlistProvider";
import { ToastProvider } from "@/components/ui/Toast";

/**
 * Client provider stack.
 *
 * Order matters: the watchlist listener keys off the signed-in user, so it must
 * sit inside auth. Toasts are leaf-level and wrap the tree last so anything
 * below — including provider-driven errors — can surface a message.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <WatchlistProvider>
        <ToastProvider>{children}</ToastProvider>
      </WatchlistProvider>
    </AuthProvider>
  );
}
