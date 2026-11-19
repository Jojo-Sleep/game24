import { useCallback, useEffect, useRef, useState } from 'react';
import { GameFrame } from '../components/GameFrame';
import { cn } from '../lib/cn';
import {
  canDeal,
  canDrop,
  createSpiderGame,
  dealStock,
  isRed,
  movableLength,
  moveGroup,
  rankLabel,
  spiderScore,
  type Difficulty,
  type SpiderState,
} from '../lib/spider';

interface SpiderGameProps {
  onExit: () => void;
}

const DIFFICULTY_OPTIONS: Difficulty[] = [1, 2, 4];

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  1: '1 花色',
  2: '2 花色',
  4: '4 花色',
};

type Status = 'ready' | 'playing' | 'won';

function Chip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/30 px-1.5 py-1 leading-none">
      <span className="text-[9px] text-slate-500">{label}</span>
      <span className="font-mono text-[11px] font-semibold text-slate-200">{value}</span>
    </div>
  );
}

export function SpiderGame({ onExit }: SpiderGameProps) {
  const [difficulty, setDifficulty] = useState<Difficulty>(1);
  const [state, setState] = useState<SpiderState>(() => createSpiderGame(1));
  const [status, setStatus] = useState<Status>('ready');
  const [selection, setSelection] = useState<{ col: number; index: number } | null>(null);
  const [message, setMessage] = useState('');
  const [layout, setLayout] = useState({ cardW: 34, cardH: 49, gap: 4, height: 400 });

  const historyRef = useRef<SpiderState[]>([]);
  const boardRef = useRef<HTMLDivElement>(null);
  const messageTimer = useRef<number | undefined>(undefined);

  const flash = useCallback((text: string) => {
    setMessage(text);
    if (messageTimer.current) window.clearTimeout(messageTimer.current);
    messageTimer.current = window.setTimeout(() => setMessage(''), 1500);
  }, []);

  const start = useCallback((next: Difficulty) => {
    setDifficulty(next);
    setState(createSpiderGame(next));
    setStatus('playing');
    setSelection(null);
    setMessage('');
    historyRef.current = [];
  }, []);

  useEffect(
    () => () => {
      if (messageTimer.current) window.clearTimeout(messageTimer.current);
    },
    [],
  );

  // 固定一屏，禁止页面滚动
  useEffect(() => {
    const html = document.documentElement;
    const prevBody = document.body.style.overflow;
    const prevHtml = html.style.overflow;
    document.body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBody;
      html.style.overflow = prevHtml;
    };
  }, []);

  useEffect(() => {
    const el = boardRef.current;
    if (!el) return undefined;

    const measure = () => {
      const width = el.clientWidth;
      const height = el.clientHeight;
      const gap = width < 420 ? 3 : 5;
      const cardW = Math.max(16, (width - gap * 9) / 10);
      setLayout({ cardW, cardH: cardW * 1.45, gap, height });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleColumn = (col: number, index: number) => {
    if (status !== 'playing') return;

    if (selection) {
      if (selection.col === col) {
        if (index >= 0 && index !== selection.index) {
          const card = state.columns[col][index];
          if (card.faceUp && movableLength(state.columns[col], index) !== null) {
            setSelection({ col, index });
          } else {
            setSelection(null);
          }
        } else {
          setSelection(null);
        }
        return;
      }

      if (canDrop(state, selection.col, selection.index, col)) {
        historyRef.current.push(state);
        const next = moveGroup(state, selection.col, selection.index, col);
        setState(next);
        setSelection(null);
        setMessage('');
        if (next.completed === 8) setStatus('won');
        return;
      }

      flash('这里放不下');
    }

    if (index < 0) {
      setSelection(null);
      return;
    }

    const card = state.columns[col][index];
    if (!card.faceUp) {
      setSelection(null);
      return;
    }

    if (movableLength(state.columns[col], index) === null) {
      flash('只能拿起同花色连续下降的牌');
      setSelection(null);
      return;
    }

    setSelection({ col, index });
  };

  const deal = () => {
    if (status !== 'playing') return;
    if (state.stock.length < 10) {
      flash('牌堆已经发完了');
      return;
    }
    if (!canDeal(state)) {
      flash('有空列时不能发牌');
      return;
    }

    historyRef.current.push(state);
    const next = dealStock(state);
    setState(next);
    setSelection(null);
    if (next.completed === 8) setStatus('won');
  };

  const undo = () => {
    const previous = historyRef.current.pop();
    if (!previous) return;
    setState(previous);
    setStatus('playing');
    setSelection(null);
    setMessage('');
  };

  const cardW = layout.cardW;
  const cardH = layout.cardH;
  const gap = layout.gap;
  const dealsLeft = Math.floor(state.stock.length / 10);

  return (
    <GameFrame
      title="蜘蛛纸牌"
      subtitle="Spider Solitaire"
      onExit={onExit}
      right={
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setStatus('ready');
              setSelection(null);
            }}
            className="h-8 select-none rounded-full border border-white/10 bg-white/[0.04] px-2.5 text-[11px] text-slate-300 transition hover:border-white/25 hover:text-white"
          >
            难度
          </button>
          <button
            type="button"
            onClick={() => start(difficulty)}
            className="h-8 select-none rounded-full border border-neon/30 bg-neon/10 px-2.5 text-[11px] text-neon transition hover:bg-neon/20"
          >
            重开
          </button>
        </div>
      }
    >
      <section
        className="relative flex flex-col overflow-hidden rounded-[22px] border border-white/10 bg-[#070d16]/85 p-2 shadow-[0_24px_70px_-40px_rgba(62,224,161,0.35)] backdrop-blur-xl sm:p-3"
        style={{ height: 'calc(100dvh - 130px)', minHeight: 260 }}
      >
        {status === 'playing' && (
          <div className="flex shrink-0 items-center justify-between gap-2 px-0.5 pb-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <Chip label="完成" value={`${state.completed}/8`} />
              <Chip label="步数" value={state.moves} />
              <div className="hidden min-[420px]:block">
                <Chip label="分数" value={spiderScore(state)} />
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={undo}
                disabled={historyRef.current.length === 0}
                className="h-7 select-none rounded-full border border-white/10 bg-white/[0.04] px-2.5 text-[11px] text-slate-300 transition hover:border-white/25 hover:text-white disabled:opacity-40"
              >
                撤销
              </button>
              <button
                type="button"
                onClick={deal}
                disabled={dealsLeft === 0}
                className="h-7 select-none rounded-full border border-neon/30 bg-neon/10 px-2.5 text-[11px] text-neon transition hover:bg-neon/20 disabled:border-white/10 disabled:bg-white/[0.04] disabled:text-slate-500"
              >
                发牌 ×{dealsLeft}
              </button>
            </div>
          </div>
        )}

        <div ref={boardRef} className="relative min-h-0 flex-1">
          {state.columns.map((column, col) => {
            const droppable = Boolean(
              selection && status === 'playing' && canDrop(state, selection.col, selection.index, col),
            );
            const step =
              column.length > 1
                ? Math.max(5, Math.min(cardH * 0.42, (layout.height - cardH) / (column.length - 1)))
                : 0;

            return (
              <div
                key={col}
                onClick={() => handleColumn(col, -1)}
                className={cn(
                  'absolute top-0 h-full rounded-md transition-colors',
                  droppable && 'border border-neon/40 bg-neon/[0.06]',
                )}
                style={{ left: col * (cardW + gap), width: cardW }}
              >
                {column.length === 0 && (
                  <div
                    className={cn(
                      'rounded border border-dashed',
                      droppable ? 'border-neon/70 bg-neon/10' : 'border-white/15',
                    )}
                    style={{ height: cardH }}
                  />
                )}

                {column.map((card, index) => {
                  const selected =
                    selection !== null &&
                    selection.col === col &&
                    index >= selection.index;
                  const isTargetTop = droppable && index === column.length - 1;
                  const red = isRed(card.suit);

                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleColumn(col, index);
                      }}
                      aria-label={`${rankLabel(card.rank)}${card.suit}`}
                      className={cn(
                        'absolute left-0 flex select-none flex-col overflow-hidden rounded-[4px] border text-left shadow-[0_2px_8px_rgba(0,0,0,0.45)] transition-transform sm:rounded-md',
                        card.faceUp
                          ? 'border-black/20 bg-gradient-to-b from-white to-slate-200'
                          : 'spider-back border-white/10 bg-[#122038]',
                        selected && '-translate-y-0.5 outline outline-2 outline-offset-1 outline-neon',
                        isTargetTop && 'outline outline-2 outline-offset-1 outline-neon/80',
                      )}
                      style={{ top: index * step, height: cardH, width: '100%', zIndex: index + 1 }}
                    >
                      {card.faceUp ? (
                        <>
                          <span
                            className={cn(
                              'pl-0.5 pt-0.5 font-semibold leading-none',
                              red ? 'text-rose-600' : 'text-slate-900',
                            )}
                            style={{ fontSize: Math.max(8, cardW * 0.32) }}
                          >
                            {rankLabel(card.rank)}
                          </span>
                          <span
                            className={cn(
                              'flex flex-1 items-center justify-center leading-none',
                              red ? 'text-rose-500' : 'text-slate-700',
                            )}
                            style={{ fontSize: Math.max(10, cardW * 0.5) }}
                          >
                            {card.suit}
                          </span>
                        </>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            );
          })}

          {message && (
            <div
              key={message}
              className="alert-pop pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2 whitespace-nowrap rounded-full border border-rose-400/30 bg-rose-500/20 px-3 py-1 text-[11px] font-semibold text-rose-200"
            >
              {message}
            </div>
          )}

          {status === 'ready' && (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 rounded-xl bg-[#050b14]/90 px-5 text-center backdrop-blur-sm">
              <div>
                <p className="text-lg font-bold">蜘蛛纸牌</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  把 K 到 A 的同花色顺子收走，集齐 8 组即获胜
                </p>
              </div>

              <div className="flex gap-2">
                {DIFFICULTY_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setDifficulty(option)}
                    className={cn(
                      'h-9 select-none rounded-full border px-3.5 text-xs transition',
                      difficulty === option
                        ? 'border-neon/50 bg-neon/15 text-neon'
                        : 'border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/25 hover:text-slate-200',
                    )}
                  >
                    {DIFFICULTY_LABEL[option]}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => start(difficulty)}
                className="h-10 select-none rounded-full bg-neon px-7 text-sm font-semibold text-ink-950 shadow-[0_0_0_6px_rgba(62,224,161,0.12),0_14px_30px_-10px_rgba(62,224,161,0.85)] transition active:scale-95"
              >
                开始游戏
              </button>

              <p className="text-[11px] text-slate-500">1 花色最简单，4 花色最难</p>
            </div>
          )}

          {status === 'won' && (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 rounded-xl bg-[#050b14]/90 px-5 text-center backdrop-blur-sm">
              <p className="text-lg font-bold text-neon">全部收完！</p>
              <p className="text-xs text-slate-400">
                {DIFFICULTY_LABEL[difficulty]} · 步数 {state.moves} · 分数 {spiderScore(state)}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStatus('ready')}
                  className="h-10 select-none rounded-full border border-white/10 bg-white/[0.04] px-5 text-sm text-slate-200 transition hover:border-white/25"
                >
                  换难度
                </button>
                <button
                  type="button"
                  onClick={() => start(difficulty)}
                  className="h-10 select-none rounded-full bg-neon px-6 text-sm font-semibold text-ink-950 transition active:scale-95"
                >
                  再来一局
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="shrink-0 pt-1.5 text-center text-[10px] leading-relaxed text-slate-500">
          点同花色连续牌组选中，再点目标列放下；有空列时不能发牌
        </p>
      </section>
    </GameFrame>
  );
}
