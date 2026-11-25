import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { GameFrame } from '../components/GameFrame';
import { cn } from '../lib/cn';
import {
  COMBO_NAMES,
  SEAT_NAMES,
  createGame,
  passTurn,
  playCards,
  resolveBid,
  runAiTurn,
  suggestMove,
  type Card,
  type DdzState,
} from '../lib/doudizhu';

interface DoudizhuGameProps {
  onExit: () => void;
}

function HandCard({
  card,
  selected,
  style,
  onClick,
}: {
  card: Card;
  selected: boolean;
  style: CSSProperties;
  onClick: () => void;
}) {
  const joker = card.rank >= 16;
  const color = card.red ? '#dc2626' : '#0f172a';

  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className={cn(
        'relative h-[62px] w-[42px] shrink-0 select-none rounded-[7px] border bg-gradient-to-b from-white to-slate-200 text-left shadow-[0_2px_8px_rgba(0,0,0,0.45)] transition-transform duration-150',
        selected ? '-translate-y-3 border-neon ring-2 ring-neon/70' : 'border-slate-300/80',
      )}
    >
      <span
        className={cn(
          'absolute left-[3px] top-[2px] font-extrabold leading-none',
          card.label === '10' ? 'text-[10px]' : 'text-[12px]',
        )}
        style={{ color }}
      >
        {card.label}
      </span>
      {joker ? (
        <span className="absolute left-[4px] top-[16px] text-[9px] font-bold leading-none" style={{ color }}>
          王
        </span>
      ) : (
        <span className="absolute left-[4px] top-[15px] text-[9px] leading-none" style={{ color }}>
          {card.suit}
        </span>
      )}
      <span
        className="pointer-events-none absolute inset-0 flex items-center justify-center text-[18px] opacity-[0.14]"
        style={{ color }}
      >
        {joker ? '王' : card.suit}
      </span>
    </button>
  );
}

function MiniCard({ card, style }: { card: Card; style?: CSSProperties }) {
  const joker = card.rank >= 16;
  const color = card.red ? '#dc2626' : '#0f172a';

  return (
    <span
      style={style}
      className="relative h-[36px] w-[26px] shrink-0 rounded-[4px] border border-slate-300/80 bg-gradient-to-b from-white to-slate-200 shadow-[0_1px_4px_rgba(0,0,0,0.4)]"
    >
      <span
        className={cn(
          'absolute left-[2px] top-[1px] font-extrabold leading-none',
          card.label === '10' ? 'text-[7px]' : 'text-[9px]',
        )}
        style={{ color }}
      >
        {card.label}
      </span>
      <span className="absolute left-[2px] top-[11px] text-[7px] leading-none" style={{ color }}>
        {joker ? '王' : card.suit}
      </span>
    </span>
  );
}

function CardBack({ style }: { style?: CSSProperties }) {
  return (
    <span
      style={style}
      className="h-[36px] w-[26px] shrink-0 rounded-[4px] border border-sky-300/30 bg-[repeating-linear-gradient(45deg,#16334f_0_4px,#0d2438_4px_8px)] shadow-[0_1px_4px_rgba(0,0,0,0.4)]"
    />
  );
}

export function DoudizhuGame({ onExit }: DoudizhuGameProps) {
  const [state, setState] = useState<DdzState>(() => createGame());
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const handRowRef = useRef<HTMLDivElement>(null);
  const [handWidth, setHandWidth] = useState(0);

  const flash = (message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1600);
  };

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  useEffect(() => {
    const element = handRowRef.current;
    if (!element) return undefined;
    const update = () => setHandWidth(element.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (state.phase !== 'playing' || state.turn === 0) return undefined;
    const timer = window.setTimeout(() => {
      setState((current) => runAiTurn(current));
    }, 800);
    return () => window.clearTimeout(timer);
  }, [state.phase, state.turn, state.hands]);

  useEffect(() => {
    if (state.turn !== 0 || state.phase !== 'playing') setSelected(new Set());
  }, [state.turn, state.phase]);

  const hand = state.hands[0];
  const yourTurn = state.phase === 'playing' && state.turn === 0;
  const canPass = yourTurn && state.lastPlay !== null;

  const cardWidth = 42;
  const step =
    hand.length > 1 && handWidth > 0
      ? Math.max(13, Math.min(cardWidth, (handWidth - cardWidth) / (hand.length - 1)))
      : cardWidth;
  const overlap = cardWidth - step;

  const restart = () => {
    setState(createGame());
    setSelected(new Set());
    setToast(null);
  };

  const toggleCard = (id: string) => {
    if (!yourTurn) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBid = (call: boolean) => {
    setState((current) => resolveBid(current, call));
  };

  const handlePlay = () => {
    const cards = hand.filter((card) => selected.has(card.id));
    if (cards.length === 0) return;
    const result = playCards(state, 0, cards);
    if (result.error) {
      flash(result.error);
      return;
    }
    setState(result.state);
    setSelected(new Set());
  };

  const handlePass = () => {
    const result = passTurn(state, 0);
    if (result.error) {
      flash(result.error);
      return;
    }
    setState(result.state);
    setSelected(new Set());
  };

  const handleHint = () => {
    if (!yourTurn) return;
    const move = suggestMove(hand, state.lastPlay?.combo ?? null);
    if (!move) {
      flash(state.lastPlay ? '没有能压过的牌' : '没有可出的牌');
      return;
    }
    setSelected(new Set(move.cards.map((card) => card.id)));
  };

  const playerWon =
    state.phase === 'done' &&
    state.winner !== null &&
    (state.winner === 'landlord') === (state.landlord === 0);

  const landlordName = state.landlord === 0 ? '你' : state.landlord > 0 ? SEAT_NAMES[state.landlord] : '';

  return (
    <GameFrame
      title="斗地主"
      subtitle="经典三人玩法 · 单机对战 AI"
      onExit={onExit}
      right={
        <button
          type="button"
          onClick={restart}
          className="h-8 select-none rounded-full border border-neon/30 bg-neon/10 px-2.5 text-[11px] text-neon transition hover:bg-neon/20"
        >
          重开
        </button>
      }
    >
      <section className="relative flex min-h-[470px] flex-col gap-2.5 overflow-hidden rounded-[22px] border border-white/10 bg-[radial-gradient(circle_at_50%_-10%,rgba(62,224,161,0.13),transparent_55%),linear-gradient(180deg,#0a1a2b,#061019)] p-3 shadow-[0_24px_70px_-40px_rgba(62,224,161,0.4)]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400">底牌</span>
            <div className="flex items-center">
              {state.bottom.map((card, index) => {
                const style: CSSProperties = { marginLeft: index === 0 ? 0 : -16, zIndex: index + 1 };
                return state.landlord === -1 ? (
                  <CardBack key={card.id} style={style} />
                ) : (
                  <MiniCard key={card.id} card={card} style={style} />
                );
              })}
            </div>
          </div>
          <div className="min-w-0 text-right">
            <p className="truncate text-[10px] text-slate-400">
              {state.landlord >= 0 ? `地主：${landlordName}` : '叫地主后获得底牌'}
            </p>
            <p className="truncate text-[10px] font-semibold text-neon">
              {state.phase === 'bid'
                ? '请选择是否叫地主'
                : state.phase === 'done'
                  ? state.message
                  : yourTurn
                    ? '轮到你出牌'
                    : `${SEAT_NAMES[state.turn]}思考中…`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[2, 1].map((seat) => {
            const isLandlord = state.landlord === seat;
            const active = state.phase === 'playing' && state.turn === seat;
            return (
              <div
                key={seat}
                className={cn(
                  'flex items-center gap-2 rounded-2xl border px-2.5 py-2 transition-colors',
                  active ? 'border-neon/50 bg-neon/[0.07]' : 'border-white/10 bg-white/[0.03]',
                )}
              >
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold',
                    isLandlord
                      ? 'border-amber-300/40 bg-amber-300/15 text-amber-200'
                      : 'border-white/15 bg-white/10 text-slate-200',
                  )}
                >
                  {seat === 1 ? '右' : '左'}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="truncate text-[11px] text-slate-200">{SEAT_NAMES[seat]}</span>
                    {isLandlord && (
                      <span className="shrink-0 rounded-full bg-amber-300/20 px-1 text-[9px] leading-4 text-amber-200">
                        地主
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <span>{state.hands[seat].length} 张</span>
                    {state.lastAction[seat] === 'pass' && <span className="text-slate-500">不出</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex min-h-[72px] flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/5 bg-black/25 px-2 py-2">
          {state.lastPlay ? (
            <>
              <span className="text-[10px] text-slate-400">
                {SEAT_NAMES[state.lastPlay.player]} · {COMBO_NAMES[state.lastPlay.combo.type]}
              </span>
              <div className="no-scrollbar flex max-w-full items-center overflow-x-auto">
                {state.lastPlay.cards.map((card, index) => (
                  <MiniCard
                    key={card.id}
                    card={card}
                    style={{ marginLeft: index === 0 ? 0 : -10, zIndex: index + 1 }}
                  />
                ))}
              </div>
            </>
          ) : (
            <span className="text-[11px] text-slate-500">
              {state.phase === 'bid' ? '你的手牌已就绪，叫地主可获得 3 张底牌' : '新一轮，自由出牌'}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between px-0.5">
          <span className="text-[10px] text-slate-400">
            你的手牌 · {hand.length} 张
            {state.landlord === 0 && <span className="ml-1 text-amber-200">地主</span>}
          </span>
          <span className="text-[10px] text-slate-500">
            {yourTurn ? '点击手牌选择' : state.phase === 'playing' ? '等待对手出牌' : ''}
          </span>
        </div>

        <div
          ref={handRowRef}
          className="no-scrollbar -mx-0.5 flex min-h-[88px] items-end overflow-x-auto px-0.5 pb-1 pt-4"
        >
          {hand.map((card, index) => {
            const isSelected = selected.has(card.id);
            return (
              <HandCard
                key={card.id}
                card={card}
                selected={isSelected}
                onClick={() => toggleCard(card.id)}
                style={{ marginLeft: index === 0 ? 0 : -overlap, zIndex: index + 1 }}
              />
            );
          })}
        </div>

        {state.phase === 'bid' ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleBid(false)}
              className="h-11 select-none rounded-full border border-white/15 bg-white/[0.06] text-sm font-semibold text-slate-200 transition active:scale-[0.98]"
            >
              不叫
            </button>
            <button
              type="button"
              onClick={() => handleBid(true)}
              className="h-11 select-none rounded-full bg-amber-300 text-sm font-bold text-ink-950 shadow-[0_0_0_6px_rgba(245,185,66,0.15)] transition active:scale-[0.98]"
            >
              叫地主
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={handlePass}
              disabled={!canPass}
              className="h-11 select-none rounded-full border border-white/15 bg-white/[0.06] text-sm font-semibold text-slate-200 transition disabled:opacity-35 active:enabled:scale-[0.98]"
            >
              不出
            </button>
            <button
              type="button"
              onClick={handleHint}
              disabled={!yourTurn}
              className="h-11 select-none rounded-full border border-white/15 bg-white/[0.06] text-sm font-semibold text-slate-200 transition disabled:opacity-35 active:enabled:scale-[0.98]"
            >
              提示
            </button>
            <button
              type="button"
              onClick={handlePlay}
              disabled={!yourTurn || selected.size === 0}
              className="h-11 select-none rounded-full bg-neon text-sm font-bold text-ink-950 shadow-[0_0_0_6px_rgba(62,224,161,0.14)] transition disabled:opacity-35 active:enabled:scale-[0.98]"
            >
              出牌
            </button>
          </div>
        )}

        {toast && (
          <div className="pointer-events-none absolute bottom-24 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full border border-rose-400/30 bg-rose-500/25 px-3 py-1 text-[11px] font-semibold text-rose-100 backdrop-blur">
            {toast}
          </div>
        )}

        {state.phase === 'done' && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-[#050b14]/85 px-6 text-center backdrop-blur-sm">
            <p className="text-2xl font-extrabold text-white">
              {playerWon ? '你赢了！' : '你输了'}
            </p>
            <p className="text-xs text-slate-300">
              {state.winner === 'landlord' ? '地主胜利' : '农民胜利'} · 地主是
              {landlordName}
            </p>
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={onExit}
                className="h-10 rounded-full border border-white/15 bg-white/[0.06] px-5 text-xs text-slate-200 transition hover:border-white/30"
              >
                返回大厅
              </button>
              <button
                type="button"
                onClick={restart}
                className="h-10 rounded-full bg-neon px-6 text-xs font-bold text-ink-950 transition active:scale-95"
              >
                再来一局
              </button>
            </div>
          </div>
        )}
      </section>
    </GameFrame>
  );
}
