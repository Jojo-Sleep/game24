import { cn } from '../lib/cn';

interface PuzzleCardsProps {
  numbers: number[];
  used: Record<number, number>;
  winning: boolean;
  disabled: boolean;
  onPick: (value: number) => void;
}

export function PuzzleCards({ numbers, used, winning, disabled, onPick }: PuzzleCardsProps) {
  const budget = { ...used };
  const usedFlags = numbers.map((value) => {
    if ((budget[value] ?? 0) > 0) {
      budget[value] -= 1;
      return true;
    }
    return false;
  });

  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-3">
      {numbers.map((value, index) => {
        const isUsed = usedFlags[index];

        return (
          <button
            key={`${value}-${index}`}
            type="button"
            disabled={disabled}
            onClick={() => onPick(value)}
            className={cn(
              'group relative flex aspect-[1/1.06] select-none items-center justify-center rounded-xl border font-mono text-3xl font-bold transition-all duration-150 sm:rounded-2xl sm:text-4xl',
              'border-white/10 bg-gradient-to-b from-white/[0.10] via-white/[0.04] to-white/[0.015] text-slate-100',
              'hover:-translate-y-1 hover:border-neon/50 hover:text-white hover:shadow-[0_18px_40px_-16px_rgba(62,224,161,0.55)]',
              'active:translate-y-0 active:scale-[0.97]',
              isUsed && 'border-dashed opacity-30 hover:translate-y-0 hover:shadow-none',
              winning && 'border-neon/70 text-neon shadow-[0_0_38px_-10px_rgba(62,224,161,0.75)]',
              disabled && 'cursor-default',
            )}
          >
            <span className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            {value}
          </button>
        );
      })}
    </div>
  );
}
