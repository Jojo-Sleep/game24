import type { ReactNode } from 'react';

interface GameFrameProps {
  title: string;
  subtitle?: string;
  onExit: () => void;
  right?: ReactNode;
  children: ReactNode;
}

export function GameFrame({ title, subtitle, onExit, right, children }: GameFrameProps) {
  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onExit}
          aria-label="返回大厅"
          className="flex h-9 shrink-0 select-none items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 text-xs text-slate-300 transition hover:border-neon/40 hover:text-neon"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M15 5 L8 12 L15 19"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          大厅
        </button>

        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold leading-tight">{title}</h1>
          {subtitle && <p className="truncate text-[11px] text-slate-500">{subtitle}</p>}
        </div>

        {right && <div className="ml-auto shrink-0">{right}</div>}
      </header>

      {children}
    </div>
  );
}
