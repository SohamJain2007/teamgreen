'use client';
import Image from 'next/image';
import { useEffect, useState } from 'react';

export type Slide = { src: string; alt: string; credit: string; page: string };

/** Cross-fading photo background; auto-advances, pauses on hover/focus and when the user prefers reduced motion. */
export default function PhotoSlider({ slides, interval = 5000 }: { slides: Slide[]; interval?: number }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || slides.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => setI((n) => (n + 1) % slides.length), interval);
    return () => clearInterval(id);
  }, [paused, slides.length, interval]);

  const cur = slides[i];
  return (
    <div className="absolute inset-0" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      {slides.map((s, n) => (
        <Image
          key={s.src}
          src={s.src}
          alt={n === i ? s.alt : ''}
          aria-hidden={n !== i}
          fill
          sizes="(min-width: 1024px) 1024px, 100vw"
          className={`object-cover transition-opacity duration-1000 ${n === i ? 'opacity-100' : 'opacity-0'}`}
        />
      ))}
      <div className="absolute bottom-3 left-1/2 z-[2] flex -translate-x-1/2 gap-1.5 md:left-10 md:translate-x-0">
        {slides.map((s, n) => (
          <button
            key={s.src}
            type="button"
            onClick={() => setI(n)}
            aria-label={s.alt}
            aria-current={n === i}
            className={`h-1.5 rounded-full transition-all ${n === i ? 'w-6 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'}`}
          />
        ))}
      </div>
      <a
        href={cur.page}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-2 right-2 z-[2] max-w-[60%] truncate rounded bg-black/35 px-1.5 py-0.5 text-[10px] text-white/85 hover:text-white"
      >
        {cur.credit}
      </a>
    </div>
  );
}
