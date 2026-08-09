import type { Metadata } from "next";
import { DealsView } from "@/components/deals/DealsView";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Deals",
  description:
    "Live Steam discounts in your region, with watchlist matches and honest price-history signals.",
};

export default function DealsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Live storefront intelligence"
        title="Deals worth your time"
        description="Verified Steam discounts in your selected region, ranked clearly and matched against the games you already track."
      />
      <DealsView />
    </>
  );
}
