import { Container } from "@/components/ui/SectionHeading";
import { GameGridSkeleton, Skeleton } from "@/components/ui/Skeleton";

/**
 * Shown while a browse query resolves.
 *
 * Route-level rather than global: paging and filtering both re-run a
 * server-side query, and without a boundary here the reader sees the previous
 * page hold still and then jump — or, on a slow provider, nothing at all.
 */
export default function BrowseLoading() {
  return (
    <Container className="pt-28 lg:pt-36">
      <Skeleton className="h-4 w-24 rounded-full" />
      <Skeleton className="mt-4 h-11 w-72 max-w-full rounded-xl" />

      <div className="mt-8 flex items-center justify-between gap-4">
        <Skeleton className="h-5 w-28 rounded" />
        <Skeleton className="h-11 w-44 rounded-full" />
      </div>

      <div className="mt-8">
        <GameGridSkeleton count={12} />
      </div>
    </Container>
  );
}
