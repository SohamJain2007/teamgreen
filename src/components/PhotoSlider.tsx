'use client';
import Image from 'next/image';
import { useEffect, useState } from 'react';

export type Slide = { src: string; alt: string; credit: string; page: string };

/** Auto-sliding photo background; the timer restarts whenever a dot is picked so the next slide always gets a full interval. */
export default function PhotoSlider({ slides, interval = 1500 }: { slides: Slide[]; interval?: number }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    const id = setTimeout(() => setI((n) => (n + 1) % slides.length), interval);
    return () => clearTimeout(id);
  }, [i, slides.length, interval]);

  const cur = slides[i];
  return (
    <div className="absolute inset-0">
      <div className="flex h-full transition-transform duration-500 ease-in-out" style={{ transform: `translateX(-${i * 100}%)` }}>
        {slides.map((s, n) => (
          <div key={s.src} className="relative h-full w-full shrink-0" aria-hidden={n !== i}>
            <Image src={s.src} alt={n === i ? s.alt : ''} fill sizes="(min-width: 1024px) 1024px, 100vw" className="object-cover" />
          </div>
        ))}
      </div>
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
