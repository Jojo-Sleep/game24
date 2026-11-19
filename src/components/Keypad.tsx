interface KeypadProps {
  disabled: boolean;
  onToken: (token: string) => void;
  onBackspace: () => void;
  onClear: () => void;
}

const TOKENS = [
  { label: '+', token: '+' },
  { label: '−', token: '-' },
  { label: '×', token: '*' },
  { label: '÷', token: '/' },
  { label: '(', token: '(' },
  { label: ')', token: ')' },
];

const baseKey =
  'h-11 select-none rounded-lg border border-white/10 bg-white/[0.04] text-slate-200 transition sm:h-12 sm:rounded-xl ' +
  'hover:border-neon/40 hover:bg-neon/10 hover:text-white active:scale-[0.97] ' +
  'disabled:cursor-default disabled:opacity-40 disabled:hover:border-white/10 disabled:hover:bg-white/[0.04] disabled:hover:text-slate-200';

export function Keypad({ disabled, onToken, onBackspace, onClear }: KeypadProps) {
  return (
    <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
      {TOKENS.map(({ label, token }) => (
        <button
          key={token}
          type="button"
          disabled={disabled}
          onClick={() => onToken(token)}
          className={`${baseKey} font-mono text-lg sm:text-xl`}
        >
          {label}
        </button>
      ))}

      <button type="button" disabled={disabled} onClick={onBackspace} className={`${baseKey} font-mono text-base sm:text-lg`}>
        ⌫
      </button>
      <button type="button" disabled={disabled} onClick={onClear} className={`${baseKey} text-xs sm:text-sm`}>
        清空
      </button>
    </div>
  );
}
