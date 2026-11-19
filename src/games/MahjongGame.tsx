import { useEffect, useState } from 'react';
import { GameFrame } from '../components/GameFrame';
import { cn } from '../lib/cn';
import { HONOR_NAMES, tileName, type ClaimOption, type PlayerView, type Tile } from '../lib/mahjong';
import { useMahjongRoom } from '../lib/mahjongRoom';

interface MahjongGameProps {
  onExit: () => void;
  initialRoom?: string | null;
}

const SEAT_LABELS = ['东', '南', '西', '北'];

const TILE_SIZES = {
  xs: 'h-5 w-3.5 rounded-[3px] text-[8px]',
  sm: 'h-8 w-6 rounded-[4px] text-[10px]',
  md: 'h-11 w-8 rounded-[5px] text-[12px] sm:h-12 sm:w-9 sm:text-[13px]',
  lg: 'h-14 w-10 rounded-md text-[15px]',
};

function tileColor(tile: Tile): string {
  if (tile.suit === 'm') return 'text-rose-600';
  if (tile.suit === 'p') return 'text-sky-600';
  if (tile.suit === 's') return 'text-emerald-600';
  return 'text-violet-700';
}

function TileFace({
  tile,
  size = 'md',
  className,
  highlighted,
  dimmed,
}: {
  tile: Tile;
  size?: keyof typeof TILE_SIZES;
  className?: string;
  highlighted?: boolean;
  dimmed?: boolean;
}) {
  return (
    <span
      className={cn(
        'relative flex shrink-0 select-none flex-col items-center justify-center border border-black/15 bg-gradient-to-b from-white to-slate-200 font-semibold leading-none shadow-[0_1px_3px_rgba(0,0,0,0.4)]',
        TILE_SIZES[size],
        tileColor(tile),
        dimmed && 'opacity-45',
        highlighted && 'outline outline-2 outline-offset-1 outline-neon',
        className,
      )}
    >
      {tile.suit === 'z' ? (
        <span>{HONOR_NAMES[tile.rank - 1]}</span>
      ) : (
        <>
          <span>{tile.rank}</span>
          <span className="text-[0.68em] opacity-75">{tile.suit === 'm' ? '万' : tile.suit === 'p' ? '筒' : '条'}</span>
        </>
      )}
    </span>
  );
}

function TileBack({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block h-4 w-3 shrink-0 rounded-[2px] border border-white/15 bg-[#1b2b47] bg-[repeating-linear-gradient(45deg,rgba(128,193,255,0.14)_0_1px,transparent_1px_4px)]',
        className,
      )}
    />
  );
}

function claimLabel(option: ClaimOption): string {
  if (option.kind === 'hu') return '胡';
  if (option.kind === 'kan') return '杠';
  if (option.kind === 'pon') return '碰';
  const tiles = option.tiles ?? [];
  return `吃 ${tiles.map((tile) => tileName(tile)).join(' ')}`;
}

function OpponentPanel({ player, active }: { player: PlayerView; active: boolean }) {
  return (
    <div
      className={cn(
        'min-w-0 flex-1 rounded-xl border p-1.5 transition-colors',
        active ? 'border-neon/50 bg-neon/[0.07]' : 'border-white/10 bg-white/[0.03]',
      )}
    >
      <div className="flex items-center gap-1">
        <span className="min-w-0 truncate text-[11px] font-semibold text-slate-200">{player.name}</span>
        {player.isDealer && (
          <span className="shrink-0 rounded bg-amber-300/20 px-1 text-[8px] text-amber-200">庄</span>
        )}
        {player.isAi && <span className="shrink-0 rounded bg-sky-400/15 px-1 text-[8px] text-sky-300">AI</span>}
      </div>

      <div className="mt-1 flex items-center gap-1 text-[9px] text-slate-500">
        <TileBack />
        <span>{player.handCount} 张</span>
      </div>

      {player.melds.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-0.5">
          {player.melds.map((meld, meldIndex) =>
            meld.tiles.map((tile) => (
              <TileFace key={`${meld.type}-${meldIndex}-${tile.id}`} tile={tile} size="xs" />
            )),
          )}
        </div>
      )}

      <div className="no-scrollbar mt-1 flex gap-0.5 overflow-x-auto pb-0.5">
        {player.discards.map((tile) => (
          <TileFace key={tile.id} tile={tile} size="xs" className="shrink-0 opacity-85" />
        ))}
      </div>
    </div>
  );
}

export function MahjongGame({ onExit, initialRoom }: MahjongGameProps) {
  const net = useMahjongRoom();
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem('mj-name') ?? '';
    } catch {
      return '';
    }
  });
  const [codeInput, setCodeInput] = useState(initialRoom ?? '');
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!net.view?.claim) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [net.view?.claim]);

  const saveName = (value: string) => {
    setName(value);
    try {
      localStorage.setItem('mj-name', value);
    } catch {
      // 忽略存储失败
    }
  };

  const finalName = () => name.trim() || '玩家';

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const exit = () => {
    net.leave();
    onExit();
  };

  // ---------- 房间大厅 ----------
  if (net.room && !net.room.started) {
    const fills = net.room.seats.filter((item) => item.name).length;
    const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${net.room.code}`;

    return (
      <GameFrame
        title="四人麻将"
        subtitle="房间大厅"
        onExit={exit}
        right={
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-400">
            {fills}/4
          </span>
        }
      >
        <section className="flex flex-col gap-4 rounded-[22px] border border-white/10 bg-white/[0.03] p-3.5 backdrop-blur-xl sm:p-4">
          <div className="text-center">
            <p className="text-[11px] text-slate-500">房间码</p>
            <p className="mt-1 font-mono text-2xl font-bold tracking-[0.28em] text-neon">{net.room.code}</p>
            <div className="mt-2 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => copyText(net.room!.code)}
                className="h-7 rounded-full border border-white/10 bg-white/[0.05] px-3 text-[11px] text-slate-300 transition hover:border-white/25"
              >
                {copied ? '已复制' : '复制房间码'}
              </button>
              <button
                type="button"
                onClick={() => copyText(inviteUrl)}
                className="h-7 rounded-full border border-neon/30 bg-neon/10 px-3 text-[11px] text-neon transition hover:bg-neon/20"
              >
                复制邀请链接
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {net.room.seats.map((item, index) => (
              <div
                key={index}
                className={cn(
                  'rounded-xl border p-2.5',
                  item.name ? 'border-white/15 bg-white/[0.05]' : 'border-dashed border-white/10 bg-white/[0.015]',
                )}
              >
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span>{SEAT_LABELS[index]}位</span>
                  {index === 0 && <span className="text-amber-300">房主</span>}
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className={cn('truncate text-sm', item.name ? 'text-slate-100' : 'text-slate-600')}>
                    {item.name || '空位'}
                  </span>
                  {item.isAi && <span className="shrink-0 text-[9px] text-sky-300">电脑</span>}
                  {!item.isAi && item.name && index !== 0 && (
                    <span className="shrink-0 text-[9px] text-emerald-300">在线</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {net.error && <p className="text-center text-[11px] text-rose-300">{net.error}</p>}

          <div className="flex flex-col gap-2">
            {net.room.host ? (
              <>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={net.addAi}
                    disabled={fills >= 4}
                    className="h-10 flex-1 rounded-xl border border-white/10 bg-white/[0.05] text-xs text-slate-200 transition hover:border-white/25 disabled:opacity-40"
                  >
                    添加电脑
                  </button>
                  <button
                    type="button"
                    onClick={net.startGame}
                    disabled={fills < 4}
                    className="h-10 flex-1 rounded-xl bg-neon text-xs font-semibold text-ink-950 transition active:scale-[0.99] disabled:bg-white/10 disabled:text-slate-500"
                  >
                    开始游戏
                  </button>
                </div>
                <p className="text-center text-[10px] text-slate-500">房间码发给好友即可加入，公网可联机</p>
              </>
            ) : (
              <p className="text-center text-[11px] text-slate-500">等待房主开始游戏…</p>
            )}
          </div>
        </section>
      </GameFrame>
    );
  }

  // ---------- 牌桌 ----------
  if (net.room && net.room.started && net.view) {
    const view = net.view;
    const self = view.players[view.seat];
    const canDiscard = view.phase === 'discard' && view.turn === view.seat && !view.claim;
    const remaining = view.claim ? Math.max(0, Math.ceil((view.claim.deadline - now) / 1000)) : 0;

    return (
      <GameFrame
        title="四人麻将"
        subtitle={net.room.code === '单机' ? '单机练习' : `房间 ${net.room.code}`}
        onExit={exit}
        right={
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-slate-400">
            牌墙 {view.wallCount}
          </span>
        }
      >
        <section className="relative flex flex-col gap-2 rounded-[22px] border border-white/10 bg-[#070d16]/85 p-2.5 backdrop-blur-xl sm:p-3">
          <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500">
            <span>
              庄家：{view.players[view.players.findIndex((item) => item.isDealer)]?.name ?? '—'}
            </span>
            <span className={cn(view.phase === 'ended' ? 'text-slate-400' : 'text-neon')}>
              {view.phase === 'ended' ? '本局结束' : `轮到 ${view.players[view.turn].name}`}
            </span>
          </div>

          <div className="flex gap-1.5">
            {view.players.map((player, index) =>
              index === view.seat ? null : (
                <OpponentPanel key={index} player={player} active={view.turn === index && view.phase !== 'ended'} />
              ),
            )}
          </div>

          <div className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500">最后打出</span>
              {view.lastDiscard ? (
                <TileFace tile={view.lastDiscard.tile} size="lg" highlighted={Boolean(view.claim)} />
              ) : (
                <span className="text-[11px] text-slate-600">—</span>
              )}
            </div>
            {view.lastDiscard && (
              <span className="text-[11px] text-slate-400">{view.players[view.lastDiscard.from].name}</span>
            )}
            {view.claim && <span className="text-[11px] font-semibold text-amber-300">{remaining}s</span>}
          </div>

          <div className="min-h-[20px] text-center text-[10px] leading-relaxed text-slate-500">
            {view.log[view.log.length - 1]}
          </div>

          <div className="mt-0.5 flex flex-col gap-1.5">
            {self.melds.length > 0 && (
              <div className="flex flex-wrap items-end justify-center gap-1">
                {self.melds.map((meld, meldIndex) => (
                  <div key={`${meld.type}-${meldIndex}`} className="flex gap-0.5 rounded-md bg-white/[0.04] p-0.5">
                    {meld.tiles.map((tile) => (
                      <TileFace key={tile.id} tile={tile} size="sm" />
                    ))}
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-1">
              {view.hand.map((tile) => (
                <button
                  key={tile.id}
                  type="button"
                  disabled={!canDiscard}
                  onClick={() => net.act({ kind: 'discard', tileId: tile.id })}
                  className={cn(
                    'touch-manipulation rounded-[5px] transition-transform',
                    canDiscard ? 'hover:-translate-y-1 active:scale-95' : 'cursor-default',
                  )}
                  aria-label={tileName(tile)}
                >
                  <TileFace tile={tile} size="md" />
                </button>
              ))}
            </div>

            <div className="no-scrollbar flex items-center justify-center gap-0.5 overflow-x-auto">
              {self.discards.map((tile) => (
                <TileFace key={tile.id} tile={tile} size="xs" dimmed />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {view.claim ? (
              <>
                {view.claim.options.map((option, index) => (
                  <button
                    key={`${option.kind}-${index}`}
                    type="button"
                    onClick={() => net.act({ kind: 'claim', index })}
                    className="h-10 rounded-full bg-amber-300 px-4 text-xs font-bold text-ink-950 transition active:scale-95"
                  >
                    {claimLabel(option)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => net.act({ kind: 'pass' })}
                  className="h-10 rounded-full border border-white/15 bg-white/[0.05] px-4 text-xs text-slate-300 transition hover:border-white/30"
                >
                  过
                </button>
              </>
            ) : view.canSelfWin ? (
              <button
                type="button"
                onClick={() => net.act({ kind: 'hu' })}
                className="h-9 rounded-full bg-neon px-6 text-sm font-bold text-ink-950 shadow-[0_0_0_6px_rgba(62,224,161,0.12)] transition active:scale-95"
              >
                自摸胡
              </button>
            ) : (
              <p className="text-[10px] text-slate-500">
                {view.phase === 'ended'
                  ? ''
                  : canDiscard
                    ? '轮到你出牌，点一张手牌打出'
                    : '等待其他玩家操作…'}
              </p>
            )}
          </div>

          {net.error && (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 rounded-[22px] bg-[#050b14]/92 px-6 text-center backdrop-blur">
              <p className="text-sm text-rose-200">{net.error}</p>
              <button
                type="button"
                onClick={exit}
                className="h-9 rounded-full border border-white/15 bg-white/[0.05] px-5 text-xs text-slate-200 transition hover:border-white/30"
              >
                返回大厅
              </button>
            </div>
          )}

          {view.phase === 'ended' && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 rounded-[22px] bg-[#050b14]/92 px-6 text-center backdrop-blur">
              <p className="text-base font-bold text-neon">{view.result}</p>
              {view.winner !== null && (
                <p className="text-[11px] text-slate-400">赢家：{view.players[view.winner].name}</p>
              )}
              {net.room.host ? (
                <button
                  type="button"
                  onClick={net.restart}
                  className="h-10 rounded-full bg-neon px-6 text-sm font-semibold text-ink-950 transition active:scale-95"
                >
                  再来一局
                </button>
              ) : (
                <p className="text-[11px] text-slate-500">等待房主开始下一局…</p>
              )}
              <button
                type="button"
                onClick={exit}
                className="h-9 rounded-full border border-white/15 bg-white/[0.05] px-5 text-xs text-slate-200 transition hover:border-white/30"
              >
                返回大厅
              </button>
            </div>
          )}
        </section>
      </GameFrame>
    );
  }

  // ---------- 入口 ----------
  return (
    <GameFrame
      title="四人麻将"
      subtitle="公网联机 · 支持电脑补位"
      onExit={exit}
      right={
        <button
          type="button"
          onClick={net.solo}
          className="h-8 rounded-full border border-neon/30 bg-neon/10 px-2.5 text-[11px] text-neon transition hover:bg-neon/20"
        >
          单机练手
        </button>
      }
    >
      <section className="flex flex-col gap-4 rounded-[22px] border border-white/10 bg-white/[0.03] p-3.5 backdrop-blur-xl sm:p-4">
        <div>
          <p className="text-[11px] text-slate-500">昵称</p>
          <input
            value={name}
            onChange={(event) => saveName(event.target.value)}
            maxLength={8}
            placeholder="给自己起个名字"
            className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-base text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-neon/50 sm:h-10 sm:text-sm"
          />
        </div>

        <div className="h-px bg-white/10" />

        <div>
          <p className="text-[11px] text-slate-500">加入好友的房间</p>
          <div className="mt-1.5 flex gap-2">
            <input
              value={codeInput}
              onChange={(event) => setCodeInput(event.target.value.toUpperCase())}
              maxLength={8}
              placeholder="房间码"
              className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-base uppercase tracking-[0.2em] text-slate-100 outline-none transition placeholder:tracking-normal placeholder:text-slate-600 focus:border-neon/50 sm:h-10 sm:text-sm"
            />
            <button
              type="button"
              onClick={() => net.joinRoom(codeInput, finalName())}
              disabled={net.connecting}
              className="h-10 shrink-0 rounded-xl border border-white/10 bg-white/[0.06] px-4 text-xs text-slate-100 transition hover:border-white/25 disabled:opacity-50"
            >
              加入
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => net.createRoom(finalName())}
          disabled={net.connecting}
          className="h-11 w-full rounded-xl bg-neon text-sm font-semibold text-ink-950 shadow-[0_0_0_6px_rgba(62,224,161,0.1)] transition active:scale-[0.99] disabled:bg-white/10 disabled:text-slate-500"
        >
          {net.connecting ? '连接中…' : '创建房间'}
        </button>

        {net.error && <p className="text-center text-[11px] text-rose-300">{net.error}</p>}

        <div className="space-y-1 text-[10px] leading-relaxed text-slate-500">
          <p>· 创建房间后把房间码或邀请链接发给好友，公网即可加入</p>
          <p>· 人数不足可添加电脑，四人坐满即可开局</p>
          <p>· 玩法：吃 / 碰 / 杠 / 胡，简化番型（自摸、七对、清一色）</p>
        </div>
      </section>
    </GameFrame>
  );
}
