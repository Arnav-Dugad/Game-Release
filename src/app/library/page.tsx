import type { Metadata } from "next";
import { LibraryView } from "@/components/library/LibraryView";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/SectionHeading";

export const metadata: Metadata = {
  title: "Your library",
  description: "Every game you own, across every storefront, with filters and sorting.",
  // A personal page has nothing to offer a crawler.
  robots: { index: false, follow: false },
};

export default function LibraryPage() {
  return (
    <>
      <PageHeader
        eyebrow="Your collection"
        title="Games you own"
        description="Everything you've marked as owned, across every storefront — filter by store or status, and sort it however you think about your collection."
      />
      <Container className="py-8 lg:py-12">
        <LibraryView />
      </Container>
    </>
  );
}
