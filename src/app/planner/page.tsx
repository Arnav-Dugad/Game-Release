import type { Metadata } from "next";
import { AuthGate } from "@/components/auth/AuthGate";
import { PlannerView } from "@/components/planner/PlannerView";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Your release planner",
  description: "A personal game-release runway with schedule collisions, backlog load, and calendar export.",
  robots: { index: false, follow: false },
};

export default function PlannerPage() {
  return (
    <>
      <PageHeader
        eyebrow="Your time, protected"
        title="Release planner"
        description="Turn the games you track into a calm, realistic runway—with collision warnings, a weekly play budget, and every exact release ready for your calendar."
      />
      <AuthGate>
        <PlannerView />
      </AuthGate>
    </>
  );
}
