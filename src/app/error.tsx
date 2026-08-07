"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/SectionHeading";

/**
 * Route-level error boundary. Renders whenever a server component throws — most
 * plausibly a network failure the data layer couldn't absorb.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[route error]", error);
  }, [error]);

  return (
    <Container className="flex min-h-[80svh] flex-col items-center justify-center py-24 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-2xl border border-flare/25 bg-flare/10">
        <AlertTriangle size={24} className="text-flare" />
      </span>
      <h1 className="mt-6 font-display text-2xl font-bold sm:text-3xl">Something broke</h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted">
        We couldn&rsquo;t load this page. It&rsquo;s usually temporary — try again, and if it
        keeps happening the game data source may be unreachable.
      </p>
      {error.digest && (
        <p className="mt-3 font-mono text-[11px] text-faint">Reference: {error.digest}</p>
      )}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset} icon={<RotateCcw size={16} />}>
          Try again
        </Button>
        <Button href="/" variant="secondary">
          Back home
        </Button>
      </div>
    </Container>
  );
}
