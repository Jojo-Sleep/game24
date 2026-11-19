import { useMemo, type CSSProperties } from 'react';

const COLORS = ['#3ee0a1', '#80c1ff', '#f5b942', '#ffffff'];

export function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 24 }, (_, index) => ({
        id: index,
        tx: (Math.random() - 0.5) * 320,
        ty: -40 - Math.random() * 220,
        rot: (Math.random() - 0.5) * 720,
        color: COLORS[index % COLORS.length],
        delay: Math.random() * 0.08,
      })),
    [],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[26px]" aria-hidden="true">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="confetti-piece"
          style={
            {
              '--tx': `${piece.tx}px`,
              '--ty': `${piece.ty}px`,
              '--rot': `${piece.rot}deg`,
              background: piece.color,
              animationDelay: `${piece.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
