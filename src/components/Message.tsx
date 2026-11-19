import { cn } from '../lib/cn';
import type { MessageKind } from '../hooks/useGame';

const TONE: Record<MessageKind, string> = {
  ok: 'text-neon',
  bad: 'text-rose-300',
  hint: 'text-amber-300',
  '': 'text-slate-500',
};

interface MessageProps {
  text: string;
  kind: MessageKind;
}

export function Message({ text, kind }: MessageProps) {
  return (
    <p aria-live="polite" className={cn('min-h-[20px] text-[13px] leading-relaxed transition-colors sm:text-sm', TONE[kind])}>
      {text}
    </p>
  );
}
