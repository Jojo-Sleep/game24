export type Suit = '♠' | '♥' | '♣' | '♦' | 'joker';

export interface Card {
  id: string;
  rank: number;
  label: string;
  suit: Suit;
  red: boolean;
}

export type ComboType =
  | 'single'
  | 'pair'
  | 'triple'
  | 'tripleSingle'
  | 'triplePair'
  | 'straight'
  | 'pairStraight'
  | 'plane'
  | 'planeSingle'
  | 'planePair'
  | 'fourTwo'
  | 'fourTwoPair'
  | 'bomb'
  | 'rocket';

export interface Combo {
  type: ComboType;
  rank: number;
  length: number;
  cards: Card[];
}

export interface Played {
  player: number;
  cards: Card[];
  combo: Combo;
}

export type Winner = 'landlord' | 'farmer';

export interface DdzState {
  hands: Card[][];
  bottom: Card[];
  landlord: number;
  turn: number;
  phase: 'bid' | 'playing' | 'done';
  lastPlay: Played | null;
  passCount: number;
  lastAction: ('play' | 'pass' | null)[];
  winner: Winner | null;
  message: string;
}

export const COMBO_NAMES: Record<ComboType, string> = {
  single: '单张',
  pair: '对子',
  triple: '三张',
  tripleSingle: '三带一',
  triplePair: '三带二',
  straight: '顺子',
  pairStraight: '连对',
  plane: '飞机',
  planeSingle: '飞机带单',
  planePair: '飞机带对',
  fourTwo: '四带二',
  fourTwoPair: '四带两对',
  bomb: '炸弹',
  rocket: '王炸',
};

export const SEAT_NAMES = ['你', '右侧电脑', '左侧电脑'];

const RANK_LABELS: Record<number, string> = {
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
  15: '2',
  16: '小',
  17: '大',
};

const SUITS: { suit: Suit; red: boolean }[] = [
  { suit: '♠', red: false },
  { suit: '♥', red: true },
  { suit: '♣', red: false },
  { suit: '♦', red: true },
];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (let rank = 3; rank <= 15; rank += 1) {
    for (const suit of SUITS) {
      deck.push({
        id: `${rank}-${suit.suit}`,
        rank,
        label: RANK_LABELS[rank],
        suit: suit.suit,
        red: suit.red,
      });
    }
  }
  deck.push({ id: 'joker-small', rank: 16, label: '小', suit: 'joker', red: false });
  deck.push({ id: 'joker-big', rank: 17, label: '大', suit: 'joker', red: true });
  return deck;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function sortCards(cards: Card[]): Card[] {
  // 手牌从大到小排列，左侧最大
  return [...cards].sort((a, b) => b.rank - a.rank || a.suit.localeCompare(b.suit));
}

function isRun(ranks: number[]): boolean {
  for (let i = 1; i < ranks.length; i += 1) {
    if (ranks[i] !== ranks[i - 1] + 1) return false;
  }
  return true;
}

export function analyze(cards: Card[]): Combo | null {
  const n = cards.length;
  if (n === 0) return null;

  const counts = new Map<number, number>();
  for (const card of cards) counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);

  const entries = [...counts.entries()].sort((a, b) => a[0] - b[0]);
  const ranks = entries.map(([rank]) => rank);
  const sizes = entries.map(([, count]) => count);
  const top = ranks[ranks.length - 1];
  const make = (type: ComboType, rank: number): Combo => ({ type, rank, length: n, cards });

  if (n === 2 && counts.has(16) && counts.has(17)) return make('rocket', 100);
  if (n === 4 && entries.length === 1) return make('bomb', ranks[0]);

  if (n === 1) return make('single', ranks[0]);
  if (n === 2 && sizes[0] === 2) return make('pair', ranks[0]);
  if (n === 3 && sizes[0] === 3) return make('triple', ranks[0]);

  if (n === 4) {
    const triple = entries.find(([, count]) => count === 3);
    if (triple) return make('tripleSingle', triple[0]);
  }

  if (n === 5) {
    const triple = entries.find(([, count]) => count === 3);
    const pair = entries.find(([, count]) => count === 2);
    if (triple && pair) return make('triplePair', triple[0]);
  }

  if (n >= 5 && sizes.every((size) => size === 1) && top <= 14 && isRun(ranks)) {
    return make('straight', ranks[0]);
  }

  if (n >= 6 && n % 2 === 0 && sizes.every((size) => size === 2) && top <= 14 && isRun(ranks)) {
    return make('pairStraight', ranks[0]);
  }

  if (n >= 6 && n % 3 === 0 && sizes.every((size) => size === 3) && top <= 14 && isRun(ranks)) {
    return make('plane', ranks[0]);
  }

  if (n === 6) {
    const quad = entries.find(([, count]) => count === 4);
    if (quad) return make('fourTwo', quad[0]);
  }

  if (n >= 8 && n % 4 === 0) {
    const k = n / 4;
    for (let i = 0; i + k <= ranks.length; i += 1) {
      const window = ranks.slice(i, i + k);
      if (window[window.length - 1] > 14) break;
      if (isRun(window) && window.every((rank) => (counts.get(rank) ?? 0) >= 3)) {
        return make('planeSingle', window[0]);
      }
    }
  }

  if (n >= 10 && n % 5 === 0) {
    const k = n / 5;
    for (let i = 0; i + k <= ranks.length; i += 1) {
      const window = ranks.slice(i, i + k);
      if (window[window.length - 1] > 14) break;
      if (!isRun(window)) continue;
      if (!window.every((rank) => (counts.get(rank) ?? 0) >= 3)) continue;

      const rest = new Map(counts);
      for (const rank of window) rest.set(rank, (rest.get(rank) ?? 0) - 3);
      const restSizes = [...rest.values()].filter((size) => size > 0);
      if (restSizes.length === k && restSizes.every((size) => size === 2)) {
        return make('planePair', window[0]);
      }
    }
  }

  if (n === 8) {
    const quad = entries.find(([, count]) => count === 4);
    if (quad) {
      const rest = entries.filter(([rank]) => rank !== quad[0]).map(([, count]) => count);
      if (rest.length === 2 && rest.every((size) => size === 2)) return make('fourTwoPair', quad[0]);
    }
  }

  return null;
}

export function canBeat(candidate: Combo, target: Combo): boolean {
  if (candidate.type === 'rocket') return target.type !== 'rocket';
  if (target.type === 'rocket') return false;
  if (candidate.type === 'bomb' && target.type !== 'bomb') return true;
  if (target.type === 'bomb' && candidate.type !== 'bomb') return false;
  if (candidate.type !== target.type) return false;
  if (candidate.length !== target.length) return false;
  return candidate.rank > target.rank;
}

function groupCards(cards: Card[]): Map<number, Card[]> {
  const groups = new Map<number, Card[]>();
  for (const card of cards) {
    const group = groups.get(card.rank);
    if (group) group.push(card);
    else groups.set(card.rank, [card]);
  }
  return groups;
}

function pickKickers(
  groups: Map<number, Card[]>,
  exclude: Set<number>,
  count: number,
  per: number,
): Card[] | null {
  const ordered = [...groups.keys()]
    .filter((rank) => !exclude.has(rank))
    .sort((a, b) => a - b);
  // 优先使用非炸弹、非王的小牌做带牌
  const sorted = [...ordered.filter((rank) => rank < 16), ...ordered.filter((rank) => rank >= 16)];

  const picked: Card[] = [];
  let used = 0;

  for (const rank of sorted) {
    const group = groups.get(rank);
    if (!group || group.length < per || group.length === 4) continue;
    picked.push(...group.slice(0, per));
    used += 1;
    if (used === count) return picked;
  }

  for (const rank of sorted) {
    if (picked.some((card) => card.rank === rank)) continue;
    const group = groups.get(rank);
    if (!group || group.length < per) continue;
    picked.push(...group.slice(0, per));
    used += 1;
    if (used === count) return picked;
  }

  return null;
}

export function enumerateMoves(hand: Card[]): Combo[] {
  const groups = groupCards(hand);
  const ranks = [...groups.keys()].sort((a, b) => a - b);
  const moves: Combo[] = [];
  const seen = new Set<string>();

  const push = (cards: Card[]) => {
    const key = cards
      .map((card) => card.id)
      .sort()
      .join(',');
    if (seen.has(key)) return;
    const combo = analyze(cards);
    if (!combo) return;
    seen.add(key);
    moves.push(combo);
  };

  for (const rank of ranks) {
    const group = groups.get(rank);
    if (!group) continue;
    push([group[0]]);
    if (group.length >= 2) push(group.slice(0, 2));
    if (group.length >= 3) {
      push(group.slice(0, 3));
      const single = pickKickers(groups, new Set([rank]), 1, 1);
      if (single) push([...group.slice(0, 3), ...single]);
      const pair = pickKickers(groups, new Set([rank]), 1, 2);
      if (pair) push([...group.slice(0, 3), ...pair]);
    }
    if (group.length >= 4) {
      push(group.slice(0, 4));
      const two = pickKickers(groups, new Set([rank]), 2, 1);
      if (two) push([...group.slice(0, 4), ...two]);
      const twoPairs = pickKickers(groups, new Set([rank]), 2, 2);
      if (twoPairs) push([...group.slice(0, 4), ...twoPairs]);
    }
  }

  if (groups.has(16) && groups.has(17)) {
    push([(groups.get(16) as Card[])[0], (groups.get(17) as Card[])[0]]);
  }

  // 顺子：从每一段连续单张中取所有长度 >= 5 的组合
  const straightRanks = ranks.filter((rank) => rank <= 14);
  for (let start = 0; start < straightRanks.length; start += 1) {
    let end = start;
    while (end + 1 < straightRanks.length && straightRanks[end + 1] === straightRanks[end] + 1) {
      end += 1;
    }
    for (let length = 5; length <= end - start + 1; length += 1) {
      for (let from = start; from + length - 1 <= end; from += 1) {
        const cards: Card[] = [];
        for (let i = 0; i < length; i += 1) {
          const group = groups.get(straightRanks[from + i]);
          if (group) cards.push(group[0]);
        }
        push(cards);
      }
    }
    start = end;
  }

  // 连对
  const pairRanks = ranks.filter((rank) => rank <= 14 && (groups.get(rank)?.length ?? 0) >= 2);
  for (let start = 0; start < pairRanks.length; start += 1) {
    let end = start;
    while (end + 1 < pairRanks.length && pairRanks[end + 1] === pairRanks[end] + 1) end += 1;
    for (let length = 3; length <= end - start + 1; length += 1) {
      for (let from = start; from + length - 1 <= end; from += 1) {
        const cards: Card[] = [];
        for (let i = 0; i < length; i += 1) {
          const group = groups.get(pairRanks[from + i]);
          if (group) cards.push(...group.slice(0, 2));
        }
        push(cards);
      }
    }
    start = end;
  }

  // 飞机及其带牌
  const tripleRanks = ranks.filter((rank) => rank <= 14 && (groups.get(rank)?.length ?? 0) >= 3);
  for (let start = 0; start < tripleRanks.length; start += 1) {
    let end = start;
    while (end + 1 < tripleRanks.length && tripleRanks[end + 1] === tripleRanks[end] + 1) end += 1;
    for (let length = 2; length <= end - start + 1; length += 1) {
      for (let from = start; from + length - 1 <= end; from += 1) {
        const chain = tripleRanks.slice(from, from + length);
        const base: Card[] = [];
        for (const rank of chain) {
          const group = groups.get(rank);
          if (group) base.push(...group.slice(0, 3));
        }
        push(base);
        const exclude = new Set(chain);
        const singles = pickKickers(groups, exclude, length, 1);
        if (singles) push([...base, ...singles]);
        const pairs = pickKickers(groups, exclude, length, 2);
        if (pairs) push([...base, ...pairs]);
      }
    }
    start = end;
  }

  return moves;
}

function leadScore(combo: Combo): number {
  return combo.rank * 0.9 - combo.cards.length * 1.7;
}

function pickLead(moves: Combo[]): Combo | null {
  if (moves.length === 0) return null;
  const safe = moves.filter((move) => move.type !== 'bomb' && move.type !== 'rocket');
  const pool = safe.length > 0 ? safe : moves;
  return pool.reduce((best, move) => (leadScore(move) < leadScore(best) ? move : best));
}

function sameTeam(a: number, b: number, landlord: number): boolean {
  return (a === landlord) === (b === landlord);
}

function seatTeam(seat: number, landlord: number): 'landlord' | 'farmer' {
  return seat === landlord ? 'landlord' : 'farmer';
}

export function handStrength(hand: Card[]): number {
  const counts = new Map<number, number>();
  for (const card of hand) counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
  let score = 0;
  for (const [rank, count] of counts) {
    if (rank === 17) score += 4;
    if (rank === 16) score += 3;
    if (rank === 15) score += count * 1.5;
    if (rank === 14) score += count * 0.8;
    if (count === 4) score += 3;
  }
  return score;
}

export function chooseAiMove(state: DdzState, seat: number): Combo | null {
  const hand = state.hands[seat];
  const moves = enumerateMoves(hand);
  const last = state.lastPlay;

  const whole = analyze(hand);
  if (whole && (!last || canBeat(whole, last.combo))) return whole;

  if (last && last.player !== seat) {
    // 队友出的牌不去压
    if (sameTeam(last.player, seat, state.landlord)) return null;

    const candidates = moves.filter((move) => canBeat(move, last.combo));
    if (candidates.length === 0) return null;

    const normal = candidates.filter((move) => move.type !== 'bomb' && move.type !== 'rocket');
    if (normal.length > 0) {
      return normal.sort((a, b) => a.rank - b.rank || a.cards.length - b.cards.length)[0];
    }

    const opponents = [0, 1, 2].filter(
      (other) => other !== seat && seatTeam(other, state.landlord) !== seatTeam(seat, state.landlord),
    );
    const danger = opponents.some((other) => state.hands[other].length <= 2);
    if (danger || last.combo.type === 'bomb' || last.combo.type === 'rocket') {
      return candidates.sort((a, b) => a.rank - b.rank)[0];
    }
    return null;
  }

  return pickLead(moves);
}

export function suggestMove(hand: Card[], last: Combo | null): Combo | null {
  const whole = analyze(hand);
  if (whole && (!last || canBeat(whole, last))) return whole;

  const moves = enumerateMoves(hand);
  if (!last) return pickLead(moves);

  const candidates = moves.filter((move) => canBeat(move, last));
  if (candidates.length === 0) return null;
  const normal = candidates.filter((move) => move.type !== 'bomb' && move.type !== 'rocket');
  const pool = normal.length > 0 ? normal : candidates;
  return pool.sort((a, b) => a.rank - b.rank || a.cards.length - b.cards.length)[0];
}

export function createGame(): DdzState {
  const deck = shuffle(createDeck());
  const hands = [deck.slice(0, 17), deck.slice(17, 34), deck.slice(34, 51)].map(sortCards);
  return {
    hands,
    bottom: sortCards(deck.slice(51)),
    landlord: -1,
    turn: 0,
    phase: 'bid',
    lastPlay: null,
    passCount: 0,
    lastAction: [null, null, null],
    winner: null,
    message: '叫地主，抢下底牌',
  };
}

export function resolveBid(state: DdzState, call: boolean): DdzState {
  if (state.phase !== 'bid') return state;

  let landlord = 0;
  if (!call) {
    const score1 = handStrength(state.hands[1]);
    const score2 = handStrength(state.hands[2]);
    landlord = score1 >= score2 ? 1 : 2;
  }

  const hands = state.hands.map((hand) => [...hand]);
  hands[landlord] = sortCards([...hands[landlord], ...state.bottom]);

  return {
    ...state,
    hands,
    landlord,
    phase: 'playing',
    turn: landlord,
    lastPlay: null,
    passCount: 0,
    lastAction: [null, null, null],
    message: `${SEAT_NAMES[landlord]}成为地主`,
  };
}

export function playCards(
  state: DdzState,
  player: number,
  cards: Card[],
): { state: DdzState; error?: string } {
  if (state.phase !== 'playing') return { state, error: '牌局还没开始' };
  if (state.turn !== player) return { state, error: '还没轮到你' };

  const combo = analyze(cards);
  if (!combo) return { state, error: '牌型不合法' };

  const handIds = new Set(state.hands[player].map((card) => card.id));
  if (cards.some((card) => !handIds.has(card.id))) return { state, error: '这些牌不在手里' };

  if (state.lastPlay && state.lastPlay.player !== player && !canBeat(combo, state.lastPlay.combo)) {
    return { state, error: '压不过上家' };
  }

  const used = new Set(cards.map((card) => card.id));
  const hands = state.hands.map((hand, seat) =>
    seat === player ? hand.filter((card) => !used.has(card.id)) : hand,
  );

  const lastAction = [...state.lastAction] as ('play' | 'pass' | null)[];
  lastAction[player] = 'play';

  if (hands[player].length === 0) {
    const winner: Winner = player === state.landlord ? 'landlord' : 'farmer';
    return {
      state: {
        ...state,
        hands,
        lastAction,
        lastPlay: { player, cards, combo },
        phase: 'done',
        winner,
        message: winner === 'landlord' ? '地主胜利' : '农民胜利',
      },
    };
  }

  return {
    state: {
      ...state,
      hands,
      lastAction,
      lastPlay: { player, cards, combo },
      passCount: 0,
      turn: (player + 1) % 3,
      message: `${SEAT_NAMES[player]}出牌`,
    },
  };
}

export function passTurn(state: DdzState, player: number): { state: DdzState; error?: string } {
  if (state.phase !== 'playing') return { state, error: '牌局还没开始' };
  if (state.turn !== player) return { state, error: '还没轮到你' };
  if (!state.lastPlay) return { state, error: '轮到你先出牌' };

  const lastAction = [...state.lastAction] as ('play' | 'pass' | null)[];
  lastAction[player] = 'pass';

  const passCount = state.passCount + 1;
  if (passCount >= 2) {
    return {
      state: {
        ...state,
        lastAction: [null, null, null],
        lastPlay: null,
        passCount: 0,
        turn: state.lastPlay.player,
        message: `${SEAT_NAMES[state.lastPlay.player]}重新出牌`,
      },
    };
  }

  return {
    state: {
      ...state,
      lastAction,
      passCount,
      turn: (player + 1) % 3,
      message: `${SEAT_NAMES[player]}不出`,
    },
  };
}

export function runAiTurn(state: DdzState): DdzState {
  if (state.phase !== 'playing' || state.turn === 0) return state;
  const seat = state.turn;
  const move = chooseAiMove(state, seat);
  if (!move) return passTurn(state, seat).state;
  return playCards(state, seat, move.cards).state;
}
