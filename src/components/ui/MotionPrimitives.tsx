import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

export const PAWCARE_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function FadeSlideIn({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const prefersReduced = useReducedMotion();
  return (
    <motion.div
      initial={prefersReduced ? false : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.45, delay, ease: PAWCARE_EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function PageReveal({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const prefersReduced = useReducedMotion();
  return (
    <motion.div
      initial={prefersReduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: PAWCARE_EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedCounter({ value }: { value: number }) {
  const prefersReduced = useReducedMotion();
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (prefersReduced || value === 0) {
      setDisplay(value);
      return;
    }
    let frame = 0;
    const totalFrames = 18;
    const start = 0;
    const timer = window.setInterval(() => {
      frame += 1;
      const progress = Math.min(1, frame / totalFrames);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (value - start) * eased));
      if (frame >= totalFrames) window.clearInterval(timer);
    }, 18);
    return () => window.clearInterval(timer);
  }, [value, prefersReduced]);

  return <span className="tabular-nums">{display.toLocaleString('en-IN')}</span>;
}

export function SkeletonRow({ className = 'h-12' }: { className?: string }) {
  return (
    <div
      className={`w-full rounded-xl bg-[#EFECE4] animate-pulse ${className}`}
      aria-hidden="true"
    />
  );
}
