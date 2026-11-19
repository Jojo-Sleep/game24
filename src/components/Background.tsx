import { useEffect } from 'react';

export function Background() {
  useEffect(() => {
    let frame = 0;

    const handleMove = (event: MouseEvent) => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        document.documentElement.style.setProperty('--mx', `${event.clientX}px`);
        document.documentElement.style.setProperty('--my', `${event.clientY}px`);
      });
    };

    window.addEventListener('mousemove', handleMove);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
      <div className="aurora absolute -left-40 -top-48 h-[520px] w-[520px] rounded-full bg-neon/15 blur-[120px]" />
      <div className="aurora-slow absolute -right-32 top-16 h-[420px] w-[420px] rounded-full bg-sky-400/10 blur-[110px]" />
      <div className="aurora-slow absolute -bottom-52 left-1/3 h-[380px] w-[380px] rounded-full bg-indigo-500/10 blur-[120px]" />
      <div className="grid-overlay absolute inset-0" />
      <div className="cursor-glow absolute inset-0" />
    </div>
  );
}
