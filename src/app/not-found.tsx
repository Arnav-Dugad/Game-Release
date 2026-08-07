import { Compass, Home } from "lucide-react";
import { Aurora, GridLines } from "@/components/motion/Aurora";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/motion/Reveal";
import { TextReveal } from "@/components/motion/text";

export default function NotFound() {
  return (
    <div className="noise relative isolate flex min-h-dvh-safe items-center overflow-hidden">
      <Aurora intensity="normal" className="-z-10" />
      <GridLines className="-z-10" />

      <Container className="py-28 text-center">
        <Reveal>
          <p className="font-display text-[clamp(5rem,22vw,12rem)] font-black leading-none tracking-[-0.06em] text-gradient">
            404
          </p>
        </Reveal>

        <TextReveal
          as="h1"
          text="This page didn't make it to launch"
          className="mx-auto mt-4 block max-w-xl font-display text-2xl font-bold leading-tight sm:text-3xl"
        />

        <Reveal delay={0.15}>
          <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-muted">
            The link may be broken, or the game you&rsquo;re after isn&rsquo;t in the
            database under that name.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button href="/" icon={<Home size={16} />}>
              Back home
            </Button>
            <Button href="/browse" variant="secondary" icon={<Compass size={16} />}>
              Browse games
            </Button>
          </div>
        </Reveal>
      </Container>
    </div>
  );
}
