import type { RefObject } from 'react';
import { cn } from '../lib/cn';

interface ExpressionBarProps {
  inputRef: RefObject<HTMLInputElement>;
  value: string;
  preview: string | null;
  hit: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
  onEnter: () => void;
}

export function ExpressionBar({
  inputRef,
  value,
  preview,
  hit,
  disabled,
  onChange,
  onEnter,
}: ExpressionBarProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-2xl border border-white/10 bg-black/40 px-3 py-2 transition sm:px-3.5 sm:py-2.5',
        'focus-within:border-neon/45 focus-within:ring-2 focus-within:ring-neon/15',
        disabled && 'opacity-70',
      )}
    >
      <input
        ref={inputRef}
        value={value}
        readOnly={disabled}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onEnter();
          }
        }}
        placeholder="点数字和运算符，或直接输入"
        aria-label="算式"
        spellCheck={false}
        autoComplete="off"
        enterKeyHint="done"
        className="w-full min-w-0 bg-transparent font-mono text-base tracking-wide text-slate-100 caret-neon outline-none placeholder:font-sans placeholder:text-[13px] placeholder:tracking-normal placeholder:text-slate-500 sm:text-lg sm:placeholder:text-sm"
      />
      <div
        className={cn(
          'shrink-0 rounded-full border px-2 py-0.5 font-mono text-xs font-semibold tabular-nums transition-colors sm:px-2.5 sm:py-1 sm:text-sm',
          hit ? 'border-neon bg-neon text-ink-950' : 'border-white/10 text-slate-400',
        )}
      >
        {preview === null ? '= ?' : `= ${preview}`}
      </div>
    </div>
  );
}
