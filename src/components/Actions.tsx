interface ActionsProps {
  disabled: boolean;
  onHint: () => void;
  onAnswer: () => void;
  onSubmit: () => void;
}

export function Actions({ disabled, onHint, onAnswer, onSubmit }: ActionsProps) {
  return (
    <div className="grid grid-cols-[1fr_1fr_1.6fr] gap-1.5 sm:gap-2">
      <button
        type="button"
        onClick={onHint}
        disabled={disabled}
        className="h-11 select-none rounded-lg border border-white/10 text-[13px] text-slate-400 transition hover:border-white/25 hover:text-white disabled:cursor-default disabled:opacity-40 sm:h-12 sm:rounded-xl sm:text-sm"
      >
        提示
      </button>
      <button
        type="button"
        onClick={onAnswer}
        disabled={disabled}
        className="h-11 select-none rounded-lg border border-white/10 text-[13px] text-slate-400 transition hover:border-white/25 hover:text-white disabled:cursor-default disabled:opacity-40 sm:h-12 sm:rounded-xl sm:text-sm"
      >
        看答案
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled}
        className="h-11 select-none rounded-lg bg-neon text-[13px] font-semibold text-ink-950 shadow-[0_12px_36px_-12px_rgba(62,224,161,0.8)] transition hover:bg-[#54e9b0] active:scale-[0.98] disabled:cursor-default disabled:opacity-50 disabled:shadow-none sm:h-12 sm:rounded-xl sm:text-sm"
      >
        提交
      </button>
    </div>
  );
}
