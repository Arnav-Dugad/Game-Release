import type { Metadata } from "next";
import { AuthGate } from "@/components/auth/AuthGate";
import { NotificationsView } from "@/components/notifications/NotificationsView";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Your personal watchlist release reminders and delivery history.",
  robots: { index: false, follow: false },
};

export default function NotificationsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Your game radar"
        title="Notification center"
        description="Release days, approaching launches, and recent arrivals across the games you track."
      />
      <AuthGate>
        <NotificationsView />
      </AuthGate>
    </>
  );
}
