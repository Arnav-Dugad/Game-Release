import { Container } from "@/components/ui/SectionHeading";
import { Skeleton } from "@/components/ui/Skeleton";

/** Mirrors the release timeline's row rhythm so the swap doesn't jump. */
export default function UpcomingLoading() {
  return (
    <Container className="pt-28 lg:pt-36">
      <Skeleton className="h-4 w-32 rounded-full" />
      <Skeleton className="mt-4 h-11 w-80 max-w-full rounded-xl" />

      <div className="mt-8 flex items-center justify-between gap-4">
        <Skeleton className="h-5 w-24 rounded" />
        <Skeleton className="h-11 w-44 rounded-full" />
      </div>

      <Skeleton className="mt-6 h-7 w-48 rounded-lg" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-[104px] w-full rounded-2xl" />
        ))}
      </div>
    </Container>
  );
}
