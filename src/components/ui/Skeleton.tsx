import { cn } from "@/lib/utils/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer-bg rounded-lg", className)} aria-hidden />;
}

/** Placeholder matching `GameCard`'s exact geometry, so grids don't reflow. */
export function GameCardSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="aspect-[3/4] w-full rounded-2xl" />
      <Skeleton className="h-4 w-4/5 rounded" />
      <Skeleton className="h-3 w-2/5 rounded" />
    </div>
  );
}

export function GameGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 lg:gap-6">
      {Array.from({ length: count }, (_, i) => (
        <GameCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function GameRailSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="w-[46vw] shrink-0 sm:w-56 lg:w-64">
          <GameCardSkeleton />
        </div>
      ))}
    </div>
  );
}
