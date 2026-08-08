import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { SettingsView } from "@/components/settings/SettingsView";

export const metadata: Metadata = {
  title: "Settings",
  description: "Currency, motion and account preferences for LUDEX.",
  robots: { index: false, follow: false },
};

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        description="How prices are shown, how much the interface moves, and what's connected."
      />
      <SettingsView />
    </>
  );
}
