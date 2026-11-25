import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export type GameId =
  | 'doudizhu'
  | 'twenty-four'
  | 'thunder'
  | 'popstar'
  | 'fishing'
  | 'spider'
  | 'mahjong'
  | 'eggy'
  | 'boxing'
  | 'racing'
  | 'bigfish';

interface LobbyProps {
  onSelect: (id: GameId) => void;
}

interface GameCard {
  id: GameId;
  name: string;
  tag: string;
  desc: string;
  icon: ReactNode;
  iconClass: string;
  glowClass: string;
}

const GAMES: GameCard[] = [
  {
    id: 'mahjong',
    name: '四人麻将',
    tag: '联机',
    desc: '建房邀请好友，吃碰杠胡，支持电脑补位',
    icon: <span className="text-xl font-extrabold">中</span>,
    iconClass: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
    glowClass: 'hover:shadow-[0_26px_70px_-40px_rgba(251,113,133,0.9)]',
  },
  {
    id: 'doudizhu',
    name: '斗地主',
    tag: '纸牌',
    desc: '叫地主抢底牌，和两个电脑对手斗智斗勇',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="2.6" y="3.4" width="8.4" height="12.4" rx="1.4" stroke="currentColor" strokeWidth="1.3" />
        <rect x="7.6" y="6.2" width="8.4" height="12.4" rx="1.4" stroke="currentColor" strokeWidth="1.3" />
        <rect x="12.6" y="9" width="8.4" height="11.6" rx="1.4" fill="#0b1220" stroke="currentColor" strokeWidth="1.3" />
        <path
          d="M16.8 11.4c-1.4 0-2.5 1-2.5 2.1 0 1.4 1.7 2.2 2.5 3.1 0.8-.9 2.5-1.7 2.5-3.1 0-1.1-1.1-2.1-2.5-2.1z"
          fill="currentColor"
        />
      </svg>
    ),
    iconClass: 'border-orange-300/30 bg-orange-300/10 text-orange-300',
    glowClass: 'hover:shadow-[0_26px_70px_-40px_rgba(253,186,116,0.9)]',
  },
  {
    id: 'eggy',
    name: '蛋仔闯关',
    tag: '3D',
    desc: '操控蛋仔越过浮空平台，躲开机关冲向终点',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <ellipse cx="12" cy="13" rx="7" ry="9" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="9.6" cy="11.6" r="1" fill="currentColor" />
        <circle cx="14.4" cy="11.6" r="1" fill="currentColor" />
        <path d="M10.2 14.4c1.2.9 2.4.9 3.6 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
    iconClass: 'border-lime-300/30 bg-lime-300/10 text-lime-300',
    glowClass: 'hover:shadow-[0_26px_70px_-40px_rgba(190,242,100,0.9)]',
  },
  {
    id: 'boxing',
    name: '拳王',
    tag: '对战',
    desc: '移动、出拳、格挡，三回合内击倒对手',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M6.4 10.2c0-2.7 2-4.9 4.7-4.9h2.5c2.7 0 4.8 2.2 4.8 4.9v1.9c0 2.7-2.1 4.9-4.8 4.9h-1.1v2.4c0 .9-.7 1.6-1.6 1.6H9.2c-.9 0-1.6-.7-1.6-1.6v-4.1c-.8-.9-1.2-2-1.2-3.1v-2z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path d="M8.6 7.6h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
    iconClass: 'border-amber-300/30 bg-amber-300/10 text-amber-300',
    glowClass: 'hover:shadow-[0_26px_70px_-40px_rgba(245,185,66,0.9)]',
  },
  {
    id: 'racing',
    name: '极速赛车',
    tag: '竞速',
    desc: '无尽公路上躲避车流，氮气加速刷新里程',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M3.8 14.9l1.6-4c.3-.8 1.1-1.3 2-1.3h9.2c.9 0 1.7.5 2 1.3l1.6 4"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <rect x="3" y="14.6" width="18" height="3.6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="7.4" cy="18.4" r="1.5" fill="currentColor" />
        <circle cx="16.6" cy="18.4" r="1.5" fill="currentColor" />
        <path d="M7.6 9.6V7.1h8.8v2.5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    ),
    iconClass: 'border-cyan-300/30 bg-cyan-300/10 text-cyan-300',
    glowClass: 'hover:shadow-[0_26px_70px_-40px_rgba(103,232,249,0.9)]',
  },
  {
    id: 'bigfish',
    name: '大鱼吃小鱼',
    tag: '休闲',
    desc: '吃掉更小的鱼不断长大，躲开比你大的家伙',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M2.5 14.2c1.9-2.3 4.3-3.6 7-3.6 2.6 0 4.7 1.4 5.9 3.3l1.6-1.5v3.6l-1.6-1.5c-1.2 1.9-3.3 3.3-5.9 3.3-2.7 0-5.1-1.3-7-3.6z"
          fill="currentColor"
          opacity="0.9"
        />
        <path
          d="M16 7.4c.9-1.1 2.1-1.8 3.4-1.8 1.3 0 2.3.6 2.9 1.6l.8-.7v1.8l-.8-.7c-.6 1-1.6 1.6-2.9 1.6-1.3 0-2.5-.7-3.4-1.8z"
          fill="currentColor"
          opacity="0.55"
        />
      </svg>
    ),
    iconClass: 'border-emerald-300/30 bg-emerald-300/10 text-emerald-300',
    glowClass: 'hover:shadow-[0_26px_70px_-40px_rgba(52,211,153,0.9)]',
  },
  {
    id: 'twenty-four',
    name: '24 点',
    tag: '益智',
    desc: '四张数字牌，用加减乘除凑出 24',
    icon: <span className="font-mono text-xl font-extrabold">24</span>,
    iconClass: 'border-neon/30 bg-neon/10 text-neon',
    glowClass: 'hover:shadow-[0_26px_70px_-40px_rgba(62,224,161,0.9)]',
  },
  {
    id: 'thunder',
    name: '雷霆战机',
    tag: '射击',
    desc: '拖动飞船，自动开火，撑得越久分越高',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3 L19 20 L12 16.5 L5 20 Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M12 3 L12 16.5" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
      </svg>
    ),
    iconClass: 'border-sky-400/30 bg-sky-400/10 text-sky-300',
    glowClass: 'hover:shadow-[0_26px_70px_-40px_rgba(128,193,255,0.9)]',
  },
  {
    id: 'popstar',
    name: '消灭星星',
    tag: '消除',
    desc: '点击相连的同色星星，一次消得越多分越高',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.7 1.2 6.6L12 17.7l-5.9 3.1 1.2-6.6L2.5 9.5l6.6-.9L12 2.5z" />
      </svg>
    ),
    iconClass: 'border-amber-300/30 bg-amber-300/10 text-amber-300',
    glowClass: 'hover:shadow-[0_26px_70px_-40px_rgba(245,185,66,0.9)]',
  },
  {
    id: 'fishing',
    name: '钓鱼',
    tag: '休闲',
    desc: '抛竿、等鱼咬钩，按住收线别让线绷断',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M2.5 12c2.4-3.6 5.6-5.5 9.2-5.5 3.1 0 5.7 1.4 7.3 3.4L22 8v8l-3-1.9c-1.6 2-4.2 3.4-7.3 3.4-3.6 0-6.8-1.9-9.2-5.5z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <circle cx="16" cy="11" r="1" fill="currentColor" />
      </svg>
    ),
    iconClass: 'border-cyan-300/30 bg-cyan-300/10 text-cyan-300',
    glowClass: 'hover:shadow-[0_26px_70px_-40px_rgba(103,232,249,0.9)]',
  },
  {
    id: 'spider',
    name: '蜘蛛扑克',
    tag: '纸牌',
    desc: '十列牌堆，收走 K 到 A 的同花色顺子，集齐 8 组',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4.5" y="3" width="9" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        <rect x="10.5" y="7.5" width="9" height="13" rx="1.5" fill="#0b1220" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M15 10.6c-1.5 0-2.6 1-2.6 2.2 0 1.5 1.8 2.3 2.6 3.3 0.8-1 2.6-1.8 2.6-3.3 0-1.2-1.1-2.2-2.6-2.2z"
          fill="currentColor"
        />
      </svg>
    ),
    iconClass: 'border-violet-400/30 bg-violet-400/10 text-violet-300',
    glowClass: 'hover:shadow-[0_26px_70px_-40px_rgba(177,140,255,0.9)]',
  },
];

export function Lobby({ onSelect }: LobbyProps) {
  return (
    <div className="flex flex-col gap-5 pt-1 sm:pt-3">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neon" />
          <span className="text-[10px] tracking-[0.26em] text-slate-500">ARCADE</span>
        </div>
        <h1 className="text-[28px] font-extrabold leading-tight sm:text-3xl">
          小游戏
          <span className="bg-gradient-to-r from-neon to-sky-300 bg-clip-text text-transparent">合集</span>
        </h1>
        <p className="text-xs text-slate-500">十一款游戏，随时开一局</p>
      </header>

      <div className="flex flex-col gap-3">
        {GAMES.map((game) => (
          <button
            key={game.id}
            type="button"
            onClick={() => onSelect(game.id)}
            className={cn(
              'group relative flex w-full select-none items-center gap-3.5 overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.035] p-3.5 text-left transition-all duration-200',
              'hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06] active:scale-[0.99] sm:gap-4 sm:p-4',
              game.glowClass,
            )}
          >
            <span
              className={cn(
                'flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl border sm:h-14 sm:w-14',
                game.iconClass,
              )}
            >
              {game.icon}
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-[15px] font-semibold text-slate-100 sm:text-base">{game.name}</span>
                <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-400">
                  {game.tag}
                </span>
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">{game.desc}</span>
            </span>

            <span className="shrink-0 text-slate-600 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-slate-200">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M9 5 L16 12 L9 19"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>
        ))}
      </div>

      <p className="text-center text-[11px] text-slate-600">全部在本地运行，进度自动保存在浏览器</p>
    </div>
  );
}
