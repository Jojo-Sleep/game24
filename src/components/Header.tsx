import { cn } from '../lib/cn';

interface HeaderProps {
  solved: number;
  streak: number;
  seconds: number;
}

function formatClock(seconds: number): string {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const rest = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${rest}`;
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-[58px] rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1 text-center backdrop-blur sm:min-w-[66px] sm:px-3 sm:py-1.5">
      <div className="text-[9px] tracking-[0.18em] text-slate-500 sm:text-[10px]">{label}</div>
      <div
        className={cn(
          'font-mono text-sm font-semibold tabular-nums transition-colors sm:text-base',
          accent ? 'text-neon' : 'text-slate-100',
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function Header({ solved, streak, seconds }: HeaderProps) {
  return (
    <header className="flex items-end justify-between gap-2 sm:gap-3">
      <div>
        <div className="flex items-baseline gap-1">
          <span className="bg-gradient-to-b from-white via-white to-slate-500 bg-clip-text font-mono text-[30px] font-extrabold leading-none tracking-tight text-transparent sm:text-[34px]">
            24
          </span>
          <span className="text-sm font-semibold text-neon">点</span>
        </div>
        <p className="mt-1 hidden text-[11px] tracking-[0.22em] text-slate-500 min-[380px]:block">MAKE IT 24</p>
      </div>

      <div className="flex gap-1.5 sm:gap-2">
        <Stat label="已解" value={String(solved)} />
        <Stat label="连击" value={String(streak)} accent={streak > 0} />
        <Stat label="用时" value={formatClock(seconds)} />
      </div>
    </header>
  );
}
