export type Suit = '♠' | '♥' | '♦' | '♣';

export interface Card {
  id: string;
  rank: number;
  suit: Suit;
  faceUp: boolean;
}

export type Difficulty = 1 | 2 | 4;

export interface SpiderState {
  columns: Card[][];
  stock: Card[];
  completed: number;
  moves: number;
}

export const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];

export function rankLabel(rank: number): string {
  if (rank === 1) return 'A';
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  return String(rank);
}

export function isRed(suit: Suit): boolean {
  return suit === '♥' || suit === '♦';
}

/** 生成一副 104 张的蜘蛛纸牌：难度决定花色数量，每种花色凑满 8 组 A-K */
export function createSpiderGame(difficulty: Difficulty): SpiderState {
  const suits = SUITS.slice(0, difficulty);
  const copies = 8 / suits.length;
  const deck: Card[] = [];

  for (const suit of suits) {
    for (let copy = 0; copy < copies; copy += 1) {
      for (let rank = 1; rank <= 13; rank += 1) {
        deck.push({ id: `${suit}-${copy}-${rank}`, rank, suit, faceUp: false });
      }
    }
  }

  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  const columns: Card[][] = Array.from({ length: 10 }, () => []);
  let cursor = 0;

  // 前四列 6 张，后六列 5 张
  for (let round = 0; round < 6; round += 1) {
    for (let col = 0; col < 10; col += 1) {
      if (round === 5 && col >= 4) continue;
      columns[col].push(deck[cursor]);
      cursor += 1;
    }
  }

  for (const column of columns) {
    const top = column[column.length - 1];
    if (top) top.faceUp = true;
  }

  return { columns, stock: deck.slice(cursor), completed: 0, moves: 0 };
}

/** 从 index 开始能否整段拿起：全部翻开、同花色、逐级递减 */
export function movableLength(column: Card[], index: number): number | null {
  if (index < 0 || index >= column.length) return null;
  if (!column[index].faceUp) return null;

  for (let i = index; i < column.length; i += 1) {
    const card = column[i];
    if (!card.faceUp) return null;
    if (i > index) {
      const prev = column[i - 1];
      if (card.rank !== prev.rank - 1 || card.suit !== prev.suit) return null;
    }
  }

  return column.length - index;
}

export function canDrop(state: SpiderState, from: number, index: number, to: number): boolean {
  if (from === to) return false;
  if (movableLength(state.columns[from], index) === null) return false;

  const target = state.columns[to];
  if (target.length === 0) return true;

  const last = target[target.length - 1];
  if (!last.faceUp) return false;

  return last.rank === state.columns[from][index].rank + 1;
}

export function canDeal(state: SpiderState): boolean {
  return state.stock.length >= 10 && state.columns.every((column) => column.length > 0);
}

/** 检查列尾是否形成 K→A 的同花色顺子，形成则移除 */
function collectRuns(column: Card[]): boolean {
  if (column.length < 13) return false;

  const start = column.length - 13;
  const suit = column[start].suit;

  for (let i = 0; i < 13; i += 1) {
    const card = column[start + i];
    if (!card.faceUp || card.suit !== suit || card.rank !== 13 - i) return false;
  }

  column.splice(start, 13);

  const top = column[column.length - 1];
  if (top && !top.faceUp) top.faceUp = true;

  return true;
}

export function moveGroup(state: SpiderState, from: number, index: number, to: number): SpiderState {
  const columns = state.columns.map((column) => column.map((card) => ({ ...card })));
  const group = columns[from].splice(index);
  columns[to].push(...group);

  const sourceTop = columns[from][columns[from].length - 1];
  if (sourceTop && !sourceTop.faceUp) sourceTop.faceUp = true;

  const completed = state.completed + (collectRuns(columns[to]) ? 1 : 0);

  return { columns, stock: state.stock.slice(), completed, moves: state.moves + 1 };
}

export function dealStock(state: SpiderState): SpiderState {
  const columns = state.columns.map((column) => column.map((card) => ({ ...card })));
  const stock = state.stock.map((card) => ({ ...card }));

  for (let col = 0; col < 10; col += 1) {
    const card = stock.pop();
    if (!card) break;
    card.faceUp = true;
    columns[col].push(card);
  }

  let completed = state.completed;
  for (const column of columns) {
    if (collectRuns(column)) completed += 1;
  }

  return { columns, stock, completed, moves: state.moves + 1 };
}

export function spiderScore(state: SpiderState): number {
  return Math.max(0, 500 - state.moves + state.completed * 100);
}
