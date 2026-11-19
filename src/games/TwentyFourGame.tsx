import { useEffect, useRef } from 'react';
import { Actions } from '../components/Actions';
import { Confetti } from '../components/Confetti';
import { ExpressionBar } from '../components/ExpressionBar';
import { Footer } from '../components/Footer';
import { GameFrame } from '../components/GameFrame';
import { Keypad } from '../components/Keypad';
import { Message } from '../components/Message';
import { PuzzleCards } from '../components/PuzzleCards';
import { useGame } from '../hooks/useGame';
import { cn } from '../lib/cn';
import { formatFraction } from '../lib/fraction';

interface TwentyFourGameProps {
  onExit: () => void;
}

function Chip({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <span className="flex items-baseline gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1">
      <span className="text-[10px] text-slate-500">{label}</span>
      <span
        className={cn(
          'font-mono text-sm font-semibold tabular-nums',
          accent ? 'text-neon' : 'text-slate-100',
        )}
      >
        {value}
      </span>
    </span>
  );
}

function formatClock(seconds: number): string {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const rest = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${rest}`;
}

export function TwentyFourGame({ onExit }: TwentyFourGameProps) {
  const game = useGame();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) {
      inputRef.current?.focus();
    }
  }, [game.puzzleId]);

  const keepFocus = (input: HTMLInputElement) => {
    // 触屏设备不主动弹起软键盘，避免遮挡键盘区
    if (window.matchMedia('(pointer: fine)').matches) input.focus();
  };

  const insertToken = (token: string) => {
    if (game.locked) return;

    const input = inputRef.current;
    const current = game.expression;

    if (!input) {
      game.setExpression(current + token);
      return;
    }

    const start = input.selectionStart ?? current.length;
    const end = input.selectionEnd ?? current.length;
    game.setExpression(current.slice(0, start) + token + current.slice(end));

    window.requestAnimationFrame(() => {
      keepFocus(input);
      const caret = start + token.length;
      input.setSelectionRange(caret, caret);
    });
  };

  const backspace = () => {
    if (game.locked) return;

    const input = inputRef.current;
    const current = game.expression;

    if (!input) {
      game.setExpression(current.slice(0, -1));
      return;
    }

    const start = input.selectionStart ?? current.length;
    const end = input.selectionEnd ?? current.length;

    if (start !== end) {
      game.setExpression(current.slice(0, start) + current.slice(end));
      window.requestAnimationFrame(() => {
        keepFocus(input);
        input.setSelectionRange(start, start);
      });
    } else if (start > 0) {
      game.setExpression(current.slice(0, start - 1) + current.slice(start));
      window.requestAnimationFrame(() => {
        keepFocus(input);
        input.setSelectionRange(start - 1, start - 1);
      });
    } else {
      keepFocus(input);
    }
  };

  const clearExpression = () => {
    if (game.locked) return;
    game.setExpression('');
    const input = inputRef.current;
    if (input) keepFocus(input);
  };

  const previewText = game.preview ? formatFraction(game.preview) : null;
  const hit = game.preview !== null && game.preview.n === 24 && game.preview.d === 1;

  return (
    <GameFrame title="24 点" subtitle="四个数字各用一次，凑出 24" onExit={onExit}>
      <section className="relative overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.035] p-4 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] backdrop-blur-2xl sm:rounded-[26px] sm:p-6">
        <div className="pointer-events-none absolute inset-x-10 -top-px h-px bg-gradient-to-r from-transparent via-neon/60 to-transparent" />

        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <Chip label="已解" value={String(game.solved)} />
          <Chip label="连击" value={String(game.streak)} accent={game.streak > 0} />
          <span className="ml-auto">
            <Chip label="用时" value={formatClock(game.elapsed)} />
          </span>
        </div>

        <div className="flex flex-col gap-3.5 sm:gap-4">
          <PuzzleCards
            numbers={game.numbers}
            used={game.usedNumbers}
            winning={game.winning}
            disabled={game.locked}
            onPick={(value) => insertToken(String(value))}
          />

          <ExpressionBar
            inputRef={inputRef}
            value={game.expression}
            preview={previewText}
            hit={hit}
            disabled={game.locked}
            onChange={game.setExpression}
            onEnter={game.submit}
          />

          <Keypad
            disabled={game.locked}
            onToken={insertToken}
            onBackspace={backspace}
            onClear={clearExpression}
          />

          <Actions
            disabled={game.locked}
            onHint={game.showHint}
            onAnswer={game.revealAnswer}
            onSubmit={game.submit}
          />

          <Message text={game.message.text} kind={game.message.kind} />
        </div>

        {game.winning && <Confetti />}
      </section>

      <Footer onNew={game.newPuzzle} />
    </GameFrame>
  );
}
