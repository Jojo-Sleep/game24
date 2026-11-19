export type Suit = 'm' | 'p' | 's' | 'z';

export interface Tile {
  id: string;
  suit: Suit;
  rank: number;
}

export type MeldType = 'chi' | 'pon' | 'kan';

export interface Meld {
  type: MeldType;
  tiles: Tile[];
  from: number;
}

export interface PlayerState {
  name: string;
  isAi: boolean;
  hand: Tile[];
  melds: Meld[];
  discards: Tile[];
}

export type ClaimKind = 'hu' | 'kan' | 'pon' | 'chi';

export interface ClaimOption {
  kind: ClaimKind;
  tiles?: Tile[];
}

export interface PendingClaim {
  tile: Tile;
  from: number;
  options: Record<number, ClaimOption[]>;
  responses: Record<number, number | 'pass'>;
  deadline: number;
}

export type Phase = 'discard' | 'claim' | 'ended';

export interface MahjongState {
  players: PlayerState[];
  wall: Tile[];
  turn: number;
  dealer: number;
  phase: Phase;
  lastDiscard: { tile: Tile; from: number } | null;
  claim: PendingClaim | null;
  winner: number | null;
  result: string | null;
  log: string[];
}

export interface PlayerView {
  name: string;
  isAi: boolean;
  handCount: number;
  melds: Meld[];
  discards: Tile[];
  isDealer: boolean;
}

export interface GameView {
  seat: number;
  players: PlayerView[];
  hand: Tile[];
  wallCount: number;
  turn: number;
  phase: Phase;
  lastDiscard: { tile: Tile; from: number } | null;
  claim: { deadline: number; options: ClaimOption[] } | null;
  canSelfWin: boolean;
  winner: number | null;
  result: string | null;
  log: string[];
}

export const HONOR_NAMES = ['东', '南', '西', '北', '中', '发', '白'];

const SUIT_SUFFIX: Record<Exclude<Suit, 'z'>, string> = {
  m: '万',
  p: '筒',
  s: '条',
};

export function tileName(tile: Tile): string {
  if (tile.suit === 'z') return HONOR_NAMES[tile.rank - 1];
  return `${tile.rank}${SUIT_SUFFIX[tile.suit]}`;
}

export function tileIndex(tile: Tile): number {
  if (tile.suit === 'z') return 27 + tile.rank - 1;
  const base = tile.suit === 'm' ? 0 : tile.suit === 'p' ? 9 : 18;
  return base + tile.rank - 1;
}

export function sameTile(a: Tile, b: Tile): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

export function sortHand(hand: Tile[]): void {
  hand.sort((a, b) => tileIndex(a) - tileIndex(b));
}

export function createWall(): Tile[] {
  const tiles: Tile[] = [];

  for (const suit of ['m', 'p', 's'] as const) {
    for (let rank = 1; rank <= 9; rank += 1) {
      for (let copy = 0; copy < 4; copy += 1) {
        tiles.push({ id: `${suit}${rank}-${copy}`, suit, rank });
      }
    }
  }

  for (let rank = 1; rank <= 7; rank += 1) {
    for (let copy = 0; copy < 4; copy += 1) {
      tiles.push({ id: `z${rank}-${copy}`, suit: 'z', rank });
    }
  }

  return tiles;
}

function shuffle<T>(list: T[]): T[] {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export function countsOf(tiles: Tile[]): number[] {
  const counts = new Array<number>(34).fill(0);
  for (const tile of tiles) counts[tileIndex(tile)] += 1;
  return counts;
}

function decompose(counts: number[], sets: number): boolean {
  if (sets === 0) return counts.every((count) => count === 0);

  const i = counts.findIndex((count) => count > 0);
  if (i === -1) return false;

  if (counts[i] >= 3) {
    counts[i] -= 3;
    if (decompose(counts, sets - 1)) {
      counts[i] += 3;
      return true;
    }
    counts[i] += 3;
  }

  if (i < 27 && i % 9 <= 6 && counts[i + 1] > 0 && counts[i + 2] > 0) {
    counts[i] -= 1;
    counts[i + 1] -= 1;
    counts[i + 2] -= 1;
    if (decompose(counts, sets - 1)) {
      counts[i] += 1;
      counts[i + 1] += 1;
      counts[i + 2] += 1;
      return true;
    }
    counts[i] += 1;
    counts[i + 1] += 1;
    counts[i + 2] += 1;
  }

  return false;
}

/** 传入含胡牌的整副手牌（14 张等价），meldCount 为已副露组数 */
export function canWin(hand: Tile[], meldCount: number): boolean {
  if (hand.length + meldCount * 3 !== 14) return false;

  const counts = countsOf(hand);

  if (meldCount === 0 && hand.length === 14) {
    let pairs = 0;
    let allPairs = true;
    for (const count of counts) {
      if (count % 2 !== 0) {
        allPairs = false;
        break;
      }
      pairs += count / 2;
    }
    if (allPairs && pairs === 7) return true;
  }

  const sets = 4 - meldCount;
  for (let i = 0; i < 34; i += 1) {
    if (counts[i] >= 2) {
      counts[i] -= 2;
      if (decompose(counts, sets)) {
        counts[i] += 2;
        return true;
      }
      counts[i] += 2;
    }
  }

  return false;
}

export interface WinScore {
  fan: number;
  labels: string[];
}

export function scoreWin(state: MahjongState, seat: number, selfDraw: boolean): WinScore {
  const player = state.players[seat];
  const allTiles = [...player.hand, ...player.melds.flatMap((meld) => meld.tiles)];
  const labels: string[] = ['平胡'];
  let fan = 1;

  if (selfDraw) {
    fan += 1;
    labels.push('自摸');
  }

  if (player.melds.length === 0 && player.hand.length === 14) {
    const counts = countsOf(player.hand);
    if (counts.every((count) => count % 2 === 0)) {
      fan += 2;
      labels.push('七对');
    }
  }

  const suits = new Set(allTiles.map((tile) => tile.suit));
  if (suits.size === 1 && !suits.has('z')) {
    fan += 4;
    labels.push('清一色');
  }

  return { fan, labels };
}

export function createGame(names: string[], ais: boolean[]): MahjongState {
  const wall = shuffle(createWall());
  const players: PlayerState[] = names.map((name, index) => ({
    name,
    isAi: ais[index],
    hand: [],
    melds: [],
    discards: [],
  }));

  for (let round = 0; round < 13; round += 1) {
    for (const player of players) {
      const tile = wall.pop();
      if (tile) player.hand.push(tile);
    }
  }

  for (const player of players) sortHand(player.hand);

  const state: MahjongState = {
    players,
    wall,
    turn: 0,
    dealer: 0,
    phase: 'discard',
    lastDiscard: null,
    claim: null,
    winner: null,
    result: null,
    log: ['开局，东家先手'],
  };

  const first = wall.pop();
  if (first) {
    players[0].hand.push(first);
    sortHand(players[0].hand);
  }

  return state;
}

function chiOptions(hand: Tile[], tile: Tile): ClaimOption[] {
  if (tile.suit === 'z') return [];

  const options: ClaimOption[] = [];
  const find = (rank: number) => hand.find((t) => t.suit === tile.suit && t.rank === rank);
  const combos: Array<[number, number]> = [
    [tile.rank - 2, tile.rank - 1],
    [tile.rank - 1, tile.rank + 1],
    [tile.rank + 1, tile.rank + 2],
  ];

  for (const [a, b] of combos) {
    if (a < 1 || b > 9) continue;
    const first = find(a);
    const second = find(b);
    if (first && second) options.push({ kind: 'chi', tiles: [first, second] });
  }

  return options;
}

export function claimOptionsFor(state: MahjongState, seat: number, tile: Tile, from: number): ClaimOption[] {
  const player = state.players[seat];
  const options: ClaimOption[] = [];

  if (canWin([...player.hand, tile], player.melds.length)) options.push({ kind: 'hu' });

  const same = player.hand.filter((t) => sameTile(t, tile));
  if (same.length >= 3) options.push({ kind: 'kan', tiles: same.slice(0, 3) });
  if (same.length >= 2) options.push({ kind: 'pon', tiles: same.slice(0, 2) });

  if (seat === (from + 1) % 4) options.push(...chiOptions(player.hand, tile));

  return options;
}

function drawNext(state: MahjongState): void {
  state.claim = null;
  state.turn = (state.turn + 1) % 4;
  drawCurrent(state);
}

export function drawCurrent(state: MahjongState): void {
  if (state.phase === 'ended') return;

  const tile = state.wall.pop();
  if (!tile) {
    state.phase = 'ended';
    state.winner = null;
    state.result = '牌墙摸完，流局';
    return;
  }

  state.players[state.turn].hand.push(tile);
  sortHand(state.players[state.turn].hand);
  state.phase = 'discard';
}

export function discardTile(state: MahjongState, seat: number, tileId: string): boolean {
  if (state.phase !== 'discard' || state.turn !== seat) return false;

  const player = state.players[seat];
  const index = player.hand.findIndex((tile) => tile.id === tileId);
  if (index === -1) return false;

  const [tile] = player.hand.splice(index, 1);
  player.discards.push(tile);
  state.lastDiscard = { tile, from: seat };
  state.log.push(`${player.name} 打出 ${tileName(tile)}`);

  const options: Record<number, ClaimOption[]> = {};
  for (let other = 0; other < 4; other += 1) {
    if (other === seat) continue;
    const opts = claimOptionsFor(state, other, tile, seat);
    if (opts.length > 0) options[other] = opts;
  }

  if (Object.keys(options).length === 0) {
    drawNext(state);
    return true;
  }

  state.claim = {
    tile,
    from: seat,
    options,
    responses: {},
    deadline: Date.now() + 8000,
  };
  state.phase = 'claim';

  for (const key of Object.keys(options)) {
    const other = Number(key);
    if (state.players[other].isAi) {
      state.claim.responses[other] = aiClaimChoice(options[other]);
    }
  }

  return true;
}

function aiClaimChoice(options: ClaimOption[]): number | 'pass' {
  const hu = options.findIndex((option) => option.kind === 'hu');
  if (hu >= 0) return hu;

  const kan = options.findIndex((option) => option.kind === 'kan');
  if (kan >= 0) return kan;

  const pon = options.findIndex((option) => option.kind === 'pon');
  if (pon >= 0) return Math.random() < 0.55 ? pon : 'pass';

  const chi = options.findIndex((option) => option.kind === 'chi');
  if (chi >= 0) return Math.random() < 0.2 ? chi : 'pass';

  return 'pass';
}

export function pendingHumanSeats(state: MahjongState): number[] {
  if (!state.claim) return [];
  return Object.keys(state.claim.options)
    .map(Number)
    .filter((seat) => !state.players[seat].isAi && state.claim!.responses[seat] === undefined);
}

export function respondClaim(state: MahjongState, seat: number, choice: number | 'pass'): boolean {
  if (!state.claim || !state.claim.options[seat]) return false;
  if (choice !== 'pass' && !state.claim.options[seat][choice]) return false;
  if (state.claim.responses[seat] !== undefined) return false;
  state.claim.responses[seat] = choice;
  return true;
}

const CLAIM_PRIORITY: Record<ClaimKind, number> = { hu: 3, kan: 2, pon: 1, chi: 0 };

export function resolveClaims(state: MahjongState): void {
  const claim = state.claim;
  if (!claim) return;
  state.claim = null;

  let best: { seat: number; option: ClaimOption } | null = null;

  for (const [key, response] of Object.entries(claim.responses)) {
    if (response === 'pass') continue;
    const seat = Number(key);
    const option = claim.options[seat]?.[response];
    if (!option) continue;

    const order = (seat - claim.from + 4) % 4;
    if (!best) {
      best = { seat, option };
      continue;
    }

    const bestOrder = (best.seat - claim.from + 4) % 4;
    if (
      CLAIM_PRIORITY[option.kind] > CLAIM_PRIORITY[best.option.kind] ||
      (CLAIM_PRIORITY[option.kind] === CLAIM_PRIORITY[best.option.kind] && order < bestOrder)
    ) {
      best = { seat, option };
    }
  }

  if (!best) {
    state.turn = claim.from;
    drawNext(state);
    return;
  }

  const player = state.players[best.seat];
  const discarder = state.players[claim.from];
  const lastDiscard = discarder.discards[discarder.discards.length - 1];
  if (lastDiscard && lastDiscard.id === claim.tile.id) discarder.discards.pop();

  if (best.option.kind === 'hu') {
    player.hand.push(claim.tile);
    sortHand(player.hand);
    state.winner = best.seat;
    state.phase = 'ended';
    const score = scoreWin(state, best.seat, false);
    state.result = `${player.name} 胡牌！${score.fan} 番（${score.labels.join('、')}）`;
    state.log.push(state.result);
    return;
  }

  const takeTiles = (ids: string[]): Tile[] => {
    const taken: Tile[] = [];
    for (const id of ids) {
      const index = player.hand.findIndex((tile) => tile.id === id);
      if (index >= 0) taken.push(...player.hand.splice(index, 1));
    }
    return taken;
  };

  const taken = takeTiles((best.option.tiles ?? []).map((tile) => tile.id));
  const meldTiles = [...taken, claim.tile];
  meldTiles.sort((a, b) => tileIndex(a) - tileIndex(b));

  if (best.option.kind === 'pon') {
    player.melds.push({ type: 'pon', tiles: meldTiles, from: claim.from });
    state.log.push(`${player.name} 碰 ${tileName(claim.tile)}`);
    state.turn = best.seat;
    state.phase = 'discard';
    return;
  }

  if (best.option.kind === 'chi') {
    player.melds.push({ type: 'chi', tiles: meldTiles, from: claim.from });
    state.log.push(`${player.name} 吃 ${tileName(claim.tile)}`);
    state.turn = best.seat;
    state.phase = 'discard';
    return;
  }

  player.melds.push({ type: 'kan', tiles: meldTiles, from: claim.from });
  state.log.push(`${player.name} 杠 ${tileName(claim.tile)}`);
  state.turn = best.seat;
  state.phase = 'discard';

  const replacement = state.wall.pop();
  if (!replacement) {
    state.phase = 'ended';
    state.winner = null;
    state.result = '牌墙摸完，流局';
    return;
  }
  player.hand.push(replacement);
  sortHand(player.hand);
}

export function declareSelfWin(state: MahjongState, seat: number): boolean {
  if (state.phase !== 'discard' || state.turn !== seat) return false;

  const player = state.players[seat];
  if (!canWin(player.hand, player.melds.length)) return false;

  const score = scoreWin(state, seat, true);
  state.winner = seat;
  state.phase = 'ended';
  state.result = `${player.name} 自摸！${score.fan} 番（${score.labels.join('、')}）`;
  state.log.push(state.result);
  return true;
}

export function aiDiscardTile(state: MahjongState, seat: number): Tile | null {
  const hand = state.players[seat].hand;
  if (hand.length === 0) return null;

  const counts = countsOf(hand);
  let best = hand[0];
  let bestScore = Number.POSITIVE_INFINITY;

  for (const tile of hand) {
    const index = tileIndex(tile);
    let score = counts[index] * 3;

    if (tile.suit !== 'z') {
      if (index % 9 > 0) score += counts[index - 1] * 1.5;
      if (index % 9 < 8) score += counts[index + 1] * 1.5;
      if (index % 9 > 1) score += counts[index - 2] * 0.6;
      if (index % 9 < 7) score += counts[index + 2] * 0.6;
    }

    if (score < bestScore) {
      bestScore = score;
      best = tile;
    }
  }

  return best;
}

export function aiTakeTurn(state: MahjongState): void {
  if (state.phase !== 'discard') return;

  const seat = state.turn;
  const player = state.players[seat];

  if (canWin(player.hand, player.melds.length) && declareSelfWin(state, seat)) return;

  const tile = aiDiscardTile(state, seat);
  if (tile) discardTile(state, seat, tile.id);
}

export function buildView(state: MahjongState, seat: number): GameView {
  const claimOptions = state.claim?.options[seat] ?? [];

  return {
    seat,
    players: state.players.map((player, index) => ({
      name: player.name,
      isAi: player.isAi,
      handCount: player.hand.length,
      melds: player.melds,
      discards: player.discards,
      isDealer: index === state.dealer,
    })),
    hand: state.players[seat].hand,
    wallCount: state.wall.length,
    turn: state.turn,
    phase: state.phase,
    lastDiscard: state.lastDiscard,
    claim: state.claim && claimOptions.length > 0 ? { deadline: state.claim.deadline, options: claimOptions } : null,
    canSelfWin:
      state.phase === 'discard' && state.turn === seat && canWin(state.players[seat].hand, state.players[seat].melds.length),
    winner: state.winner,
    result: state.result,
    log: state.log.slice(-6),
  };
}
