import type { Metadata } from "next";
import { CalendarClock } from "lucide-react";
import { ReleaseTimeline } from "@/components/game/ReleaseTimeline";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/SectionHeading";
import { DataSourceNotice } from "@/components/ui/DataSourceNotice";
import { Badge } from "@/components/ui/Badge";
import { getUpcoming } from "@/lib/games/source";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Upcoming game releases",
  description:
    "A month-by-month calendar of upcoming video game releases with countdowns, platforms and critic scores.",
};

export default async function UpcomingPage() {
  const { data, source } = await getUpcoming(60);

  const dated = data.results.filter((g) => !g.tba && g.released).length;

  return (
    <>
      <PageHeader
        eyebrow="Release calendar"
        title="What's coming next"
        description="Every announced release ahead, grouped by month and counting down to launch."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand" icon={<CalendarClock size={12} />}>
            {data.count} titles tracked
          </Badge>
          {dated > 0 && <Badge tone="neon">{dated} with confirmed dates</Badge>}
        </div>
      </PageHeader>

      <Container className="py-10 lg:py-14">
        {source === "sample" && (
          <div className="mb-8">
            <DataSourceNotice source={source} />
          </div>
        )}

        <ReleaseTimeline games={data.results} />
      </Container>
    </>
  );
}
