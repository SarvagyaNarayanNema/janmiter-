import React, { useEffect, useRef, useState } from 'react';

/**
 * SplitText — Animates headline words with staggered entrance while keeping text
 * immediately accessible in the DOM (zero-latency content availability).
 */
export const SplitText: React.FC<{
  text: string;
  className?: string;
  highlightWords?: string[];
}> = ({ text, className = '', highlightWords = [] }) => {
  const words = text.split(' ');
  return (
    <span className={`inline ${className}`} style={{ textWrap: 'balance' }}>
      {words.map((word, idx) => {
        const cleanWord = word.replace(/[^a-zA-Z0-9]/g, '');
        const isHighlighted = highlightWords.some(
          (hw) => hw.toLowerCase() === cleanWord.toLowerCase()
        );
        return (
          <React.Fragment key={`${word}-${idx}`}>
            <span
              className={`inline-block transition-transform duration-300 ${
                isHighlighted ? 'text-red-500' : ''
              }`}
            >
              {word}
            </span>
            {idx < words.length - 1 ? ' ' : ''}
          </React.Fragment>
        );
      })}
    </span>
  );
};

/**
 * DecryptedText — Subtle tactical character reveal for emergency codes and numbers.
 */
export const DecryptedText: React.FC<{
  text: string;
  className?: string;
}> = ({ text, className = '' }) => {
  const [displayed, setDisplayed] = useState(text);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setDisplayed(text);
      return;
    }

    const chars = '0123456789#+-';
    let step = 0;
    const maxSteps = 6;
    const interval = window.setInterval(() => {
      step += 1;
      if (step >= maxSteps) {
        setDisplayed(text);
        window.clearInterval(interval);
        return;
      }
      setDisplayed(
        text
          .split('')
          .map((ch, idx) => {
            if (ch === ' ' || idx < Math.floor((step / maxSteps) * text.length)) {
              return ch;
            }
            return chars[(idx + step) % chars.length];
          })
          .join('')
      );
    }, 30);

    return () => window.clearInterval(interval);
  }, [text]);

  return (
    <span className={className} aria-label={text}>
      {displayed}
    </span>
  );
};

/**
 * SpotlightCard — React Bits style interactive card with cursor-tracking radial spotlight
 * and optional subtle 3D tilt.
 */
export const SpotlightCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
  enableTilt?: boolean;
}> = ({
  children,
  className = '',
  spotlightColor = 'rgba(239, 68, 68, 0.14)',
  enableTilt = false,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0, opacity: 0 });
  const [tiltStyle, setTiltStyle] = useState<React.CSSProperties>({});

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setPos({ x, y, opacity: 1 });

    if (enableTilt) {
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const rotateX = ((y - cy) / cy) * -2.5;
      const rotateY = ((x - cx) / cx) * 2.5;
      setTiltStyle({
        transform: `perspective(900px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`,
      });
    }
  };

  const handleMouseLeave = () => {
    setPos((prev) => ({ ...prev, opacity: 0 }));
    if (enableTilt) {
      setTiltStyle({
        transform: 'perspective(900px) rotateX(0deg) rotateY(0deg)',
      });
    }
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={tiltStyle}
      className={`relative overflow-hidden rounded-xl bg-[#11131C] border border-white/[0.08] transition-all duration-200 ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-200"
        style={{
          opacity: pos.opacity,
          background: `radial-gradient(480px circle at ${pos.x}px ${pos.y}px, ${spotlightColor}, transparent 45%)`,
        }}
      />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
};

/**
 * CountUp — Smooth tabular number counter for verified directory statistics.
 */
export const CountUp: React.FC<{
  end: number;
  suffix?: string;
  className?: string;
}> = ({ end, suffix = '', className = '' }) => {
  const [value, setValue] = useState(end);
  const hasAnimated = useRef(false);
  const elRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    setValue(end);
    if (hasAnimated.current) return;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setValue(end);
      return;
    }

    hasAnimated.current = true;
    const duration = 700;
    const startTime = performance.now();
    const startVal = Math.max(1, Math.floor(end * 0.4));

    let raf = 0;
    const step = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(startVal + (end - startVal) * eased));
      if (progress < 1) {
        raf = requestAnimationFrame(step);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [end]);

  return (
    <span ref={elRef} className={`font-mono-tabular ${className}`}>
      {value}
      {suffix}
    </span>
  );
};

/**
 * Magnet — Subtle magnetic pull wrapper for primary interactive buttons.
 */
export const Magnet: React.FC<{
  children: React.ReactNode;
  className?: string;
  strength?: number;
}> = ({ children, className = '', strength = 0.18 }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    setOffset({ x: dx * strength, y: dy * strength });
  };

  const onLeave = () => setOffset({ x: 0, y: 0 });

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{
        transform: `translate3d(${offset.x.toFixed(1)}px, ${offset.y.toFixed(1)}px, 0)`,
      }}
      className={`inline-block transition-transform duration-150 ease-out ${className}`}
    >
      {children}
    </div>
  );
};

/**
 * AuroraBackground — Subtle emergency crimson & amber atmospheric light field.
 */
export const AuroraBackground: React.FC = () => {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <div
        className="absolute -top-48 left-1/4 h-[480px] w-[680px] rounded-full opacity-20 blur-3xl"
        style={{
          background:
            'radial-gradient(circle, rgba(239,68,68,0.42) 0%, rgba(245,158,11,0.12) 55%, transparent 75%)',
        }}
      />
      <div
        className="absolute top-1/3 -right-32 h-[420px] w-[520px] rounded-full opacity-15 blur-3xl"
        style={{
          background:
            'radial-gradient(circle, rgba(245,158,11,0.3) 0%, rgba(239,68,68,0.1) 60%, transparent 80%)',
        }}
      />
    </div>
  );
};
