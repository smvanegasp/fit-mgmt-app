import { useEffect, useRef, useState } from "react";

export interface Tutorial {
  /** File name in public/tutorials (recorded by `npm run record-tutorials`). */
  id: string;
  title: string;
  text: string;
}

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** One clip in a phone frame; plays only while mostly on screen. */
function Clip({
  tutorial,
  index,
  onVisible,
}: {
  tutorial: Tutorial;
  index: number;
  onVisible: (index: number) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const card = useRef<HTMLLIElement>(null);
  const reducedMotion = prefersReducedMotion();

  useEffect(() => {
    const el = card.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onVisible(index);
          if (!reducedMotion) video.current?.play().catch(() => {});
        } else {
          video.current?.pause();
        }
      },
      { threshold: 0.6 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [index, onVisible, reducedMotion]);

  return (
    <li ref={card} className="w-64 shrink-0 snap-center text-center lg:w-auto">
      {/* Sized from the screen height so the welcome page fits without scrolling (fixed on computers). */}
      <div className="mx-auto w-[clamp(6rem,calc((100dvh-37.5rem)*0.462),12rem)] lg:w-52 overflow-hidden rounded-[1.5rem] border-[5px] border-neutral-900 bg-neutral-900 shadow-lg">
        <video
          ref={video}
          src={`/tutorials/${tutorial.id}.mp4`}
          poster={`/tutorials/${tutorial.id}.jpg`}
          aria-label={`${tutorial.title} demo`}
          muted
          loop
          playsInline
          // All three clips together are ~0.5 MB; loading them up front avoids stalls on swipe.
          preload="auto"
          controls={reducedMotion}
          className="block aspect-[390/844] w-full bg-white"
        />
      </div>
      <p className="mt-2 font-semibold">{tutorial.title}</p>
      <p className="text-sm text-stone-600">{tutorial.text}</p>
    </li>
  );
}

/** Horizontally swipeable strip of short looping feature clips; side by side on computers. */
export function TutorialStrip({ tutorials }: { tutorials: Tutorial[] }) {
  const [active, setActive] = useState(0);
  const strip = useRef<HTMLUListElement>(null);

  function goTo(index: number) {
    const card = strip.current?.children[index] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }

  return (
    <div>
      <ul
        ref={strip}
        aria-label="How it works"
        className="-mx-6 flex snap-x snap-mandatory gap-2 overflow-x-auto px-[calc(50%-8rem)] pb-2 [scrollbar-width:none] lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-6 lg:overflow-visible lg:px-0"
      >
        {tutorials.map((t, i) => (
          <Clip key={t.id} tutorial={t} index={i} onVisible={setActive} />
        ))}
      </ul>
      <div className="mt-2 flex justify-center gap-2 lg:hidden">
        {tutorials.map((t, i) => (
          <button
            key={t.id}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Show ${t.title}`}
            aria-current={i === active}
            className={`h-2 rounded-full transition-all ${i === active ? "w-6 bg-blue-600" : "w-2 bg-stone-300"}`}
          />
        ))}
      </div>
    </div>
  );
}
