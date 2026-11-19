import { useEffect, useRef } from 'react';
import { Actions } from './components/Actions';
import { Background } from './components/Background';
import { Confetti } from './components/Confetti';
import { ExpressionBar } from './components/ExpressionBar';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { Keypad } from './components/Keypad';
import { Message } from './components/Message';
import { PuzzleCards } from './components/PuzzleCards';
import { useGame } from './hooks/useGame';
import { formatFraction } from './lib/fraction';

export default function App() {
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
    <div className="relative min-h-dvh overflow-hidden text-slate-100">
      <Background />

      <main className="app-shell relative z-10 mx-auto flex min-h-dvh w-full max-w-[620px] flex-col gap-4 sm:gap-5">
        <Header solved={game.solved} streak={game.streak} seconds={game.elapsed} />

        <section className="relative overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.035] p-4 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] backdrop-blur-2xl sm:rounded-[26px] sm:p-6">
          <div className="pointer-events-none absolute inset-x-10 -top-px h-px bg-gradient-to-r from-transparent via-neon/60 to-transparent" />

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
      </main>
    </div>
  );
}
