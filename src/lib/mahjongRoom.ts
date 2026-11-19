import { useCallback, useEffect, useRef, useState } from 'react';
import Peer, { type DataConnection } from 'peerjs';
import {
  aiTakeTurn,
  buildView,
  createGame,
  declareSelfWin,
  discardTile,
  pendingHumanSeats,
  resolveClaims,
  respondClaim,
  type GameView,
  type MahjongState,
} from './mahjong';

export interface SeatInfo {
  name: string;
  isAi: boolean;
  connected: boolean;
}

export interface RoomInfo {
  code: string;
  host: boolean;
  seats: SeatInfo[];
  started: boolean;
  phase: 'lobby' | 'playing' | 'ended';
}

export type MahjongAction =
  | { kind: 'discard'; tileId: string }
  | { kind: 'hu' }
  | { kind: 'claim'; index: number }
  | { kind: 'pass' };

interface RoomMessage {
  t: 'room';
  room: RoomInfo;
  seat?: number;
}

interface StateMessage {
  t: 'state';
  view: GameView;
}

interface ErrorMessage {
  t: 'error';
  message: string;
}

interface HelloMessage {
  t: 'hello';
  name: string;
}

interface ActionMessage {
  t: 'action';
  action: MahjongAction;
}

type InboundMessage = RoomMessage | StateMessage | ErrorMessage | HelloMessage | ActionMessage;

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const EMPTY_SEAT: SeatInfo = { name: '', isAi: false, connected: false };

function makeCode(): string {
  let code = '';
  for (let i = 0; i < 5; i += 1) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return code;
}

function parseMessage(raw: unknown): InboundMessage | null {
  try {
    const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw as ArrayBuffer);
    return JSON.parse(text) as InboundMessage;
  } catch {
    return null;
  }
}

type SeatConnection = DataConnection & { seat?: number };

export function useMahjongRoom() {
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [view, setView] = useState<GameView | null>(null);
  const [seat, setSeat] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const peerRef = useRef<Peer | null>(null);
  const connsRef = useRef<Map<number, DataConnection>>(new Map());
  const guestConnRef = useRef<DataConnection | null>(null);
  const roomRef = useRef<RoomInfo | null>(null);
  const stateRef = useRef<MahjongState | null>(null);
  const seatRef = useRef<number | null>(null);
  const hostRef = useRef(false);
  const timersRef = useRef<{ ai?: number; claim?: number }>({});

  const setRoomBoth = useCallback((next: RoomInfo | null) => {
    roomRef.current = next;
    setRoom(next);
  }, []);

  const refreshRoom = useCallback(() => {
    const current = roomRef.current;
    if (!current) return;
    setRoomBoth({ ...current, seats: current.seats.map((item) => ({ ...item })) });
  }, [setRoomBoth]);

  const clearTimers = useCallback(() => {
    if (timersRef.current.ai) window.clearTimeout(timersRef.current.ai);
    if (timersRef.current.claim) window.clearTimeout(timersRef.current.claim);
    timersRef.current = {};
  }, []);

  const send = (conn: DataConnection, message: object) => {
    if (conn.open) conn.send(JSON.stringify(message));
  };

  const broadcastRoom = useCallback(() => {
    const current = roomRef.current;
    if (!current) return;
    connsRef.current.forEach((conn) => send(conn, { t: 'room', room: current }));
  }, []);

  const broadcastState = useCallback((state: MahjongState) => {
    connsRef.current.forEach((conn, targetSeat) => {
      send(conn, { t: 'state', view: buildView(state, targetSeat) });
    });
    setView(buildView(state, seatRef.current ?? 0));
  }, []);

  /** 推进主机逻辑：AI 出牌、等待真人吃碰杠、结算；所有变更后都走这里 */
  const flush = () => {
    clearTimers();
    const state = stateRef.current;
    const current = roomRef.current;
    if (!state || !current) return;

    current.phase = state.phase === 'ended' ? 'ended' : 'playing';
    broadcastState(state);
    broadcastRoom();

    if (state.phase === 'ended') return;

    if (state.phase === 'claim' && state.claim) {
      const pending = pendingHumanSeats(state);
      if (pending.length > 0) {
        const delay = Math.max(0, state.claim.deadline - Date.now());
        timersRef.current.claim = window.setTimeout(() => {
          const active = stateRef.current;
          if (!active?.claim) return;
          for (const targetSeat of pending) {
            if (active.claim.responses[targetSeat] === undefined) active.claim.responses[targetSeat] = 'pass';
          }
          resolveClaims(active);
          flush();
        }, delay);
        return;
      }
      resolveClaims(state);
      flush();
      return;
    }

    if (state.players[state.turn].isAi) {
      timersRef.current.ai = window.setTimeout(() => {
        const active = stateRef.current;
        if (!active) return;
        aiTakeTurn(active);
        flush();
      }, 750);
    }
  };

  const handleAction = (fromSeat: number, action: MahjongAction) => {
    const state = stateRef.current;
    if (!state) return;

    if (action.kind === 'discard') {
      if (discardTile(state, fromSeat, action.tileId)) flush();
      return;
    }

    if (action.kind === 'hu') {
      if (declareSelfWin(state, fromSeat)) flush();
      return;
    }

    if (state.phase !== 'claim') return;
    if (action.kind === 'pass') respondClaim(state, fromSeat, 'pass');
    else respondClaim(state, fromSeat, action.index);
    flush();
  };

  const onGuestClose = (conn: SeatConnection) => {
    const target = conn.seat;
    if (target === undefined) return;
    connsRef.current.delete(target);

    const current = roomRef.current;
    const state = stateRef.current;
    if (!current) return;

    if (!current.started || !state) {
      current.seats[target] = { ...EMPTY_SEAT };
      refreshRoom();
      broadcastRoom();
      return;
    }

    current.seats[target] = { ...current.seats[target], connected: false, isAi: true };
    state.players[target].isAi = true;
    if (state.claim?.options[target] && state.claim.responses[target] === undefined) {
      state.claim.responses[target] = 'pass';
    }
    flush();
  };

  const onGuestMessage = (conn: SeatConnection, raw: unknown) => {
    const message = parseMessage(raw);
    const current = roomRef.current;
    if (!message || !current) return;

    if (message.t === 'hello') {
      if (current.started) {
        send(conn, { t: 'error', message: '对局已经开始，无法加入' });
        conn.close();
        return;
      }

      const target = current.seats.findIndex((item, index) => index > 0 && !item.name && !item.isAi);
      if (target === -1) {
        send(conn, { t: 'error', message: '房间已满' });
        conn.close();
        return;
      }

      current.seats[target] = { name: (message.name || '玩家').slice(0, 8), isAi: false, connected: true };
      conn.seat = target;
      connsRef.current.set(target, conn);
      send(conn, { t: 'room', room: current, seat: target });
      refreshRoom();
      broadcastRoom();
      return;
    }

    if (message.t === 'action' && conn.seat !== undefined) {
      handleAction(conn.seat, message.action);
    }
  };

  const createRoom = useCallback(
    (name: string) => {
      setError(null);
      setConnecting(true);
      setView(null);
      hostRef.current = true;
      seatRef.current = 0;
      setSeat(0);

      const attempt = (tries: number) => {
        const code = makeCode();
        const peer = new Peer(`mj4-${code}`);
        peerRef.current = peer;

        peer.on('open', () => {
          setConnecting(false);
          const seats: SeatInfo[] = [
            { name: name.slice(0, 8), isAi: false, connected: true },
            { ...EMPTY_SEAT },
            { ...EMPTY_SEAT },
            { ...EMPTY_SEAT },
          ];
          setRoomBoth({ code, host: true, seats, started: false, phase: 'lobby' });
        });

        peer.on('connection', (conn) => {
          const typed = conn as SeatConnection;
          typed.on('data', (raw) => onGuestMessage(typed, raw));
          typed.on('close', () => onGuestClose(typed));
          typed.on('error', () => undefined);
        });

        peer.on('error', (err) => {
          if (err.type === 'unavailable-id' && tries > 0) {
            peer.destroy();
            attempt(tries - 1);
            return;
          }
          setConnecting(false);
          setError(`创建房间失败：${err.message}`);
        });
      };

      attempt(3);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const joinRoom = useCallback(
    (codeInput: string, name: string) => {
      const code = codeInput.trim().toUpperCase();
      if (code.length < 4) {
        setError('请输入正确的房间码');
        return;
      }

      setError(null);
      setConnecting(true);
      setView(null);
      hostRef.current = false;
      seatRef.current = null;
      setSeat(null);

      const peer = new Peer();
      peerRef.current = peer;

      peer.on('open', () => {
        const conn = peer.connect(`mj4-${code}`, { reliable: true });
        guestConnRef.current = conn;

        conn.on('open', () => {
          setConnecting(false);
          send(conn, { t: 'hello', name: name.slice(0, 8) || '玩家' });
        });

        conn.on('data', (raw) => {
          const message = parseMessage(raw);
          if (!message) return;

          if (message.t === 'room') {
            setRoomBoth(message.room);
            if (typeof message.seat === 'number') {
              seatRef.current = message.seat;
              setSeat(message.seat);
            }
          } else if (message.t === 'state') {
            setView(message.view);
            const current = roomRef.current;
            if (current) {
              setRoomBoth({
                ...current,
                started: true,
                phase: message.view.phase === 'ended' ? 'ended' : 'playing',
              });
            }
          } else if (message.t === 'error') {
            setError(message.message);
          }
        });

        conn.on('close', () => {
          setError('与房主的连接已断开');
        });

        conn.on('error', () => {
          setError('连接出错，请重新加入');
        });
      });

      peer.on('error', (err) => {
        setConnecting(false);
        if (err.type === 'peer-unavailable') setError('房间不存在或房主已离开');
        else setError(`加入失败：${err.message}`);
      });
    },
    [setRoomBoth],
  );

  const addAi = useCallback(() => {
    const current = roomRef.current;
    if (!current || current.started) return;
    const target = current.seats.findIndex((item, index) => index > 0 && !item.name);
    if (target === -1) return;
    current.seats[target] = { name: `电脑${target}`, isAi: true, connected: false };
    refreshRoom();
    broadcastRoom();
  }, [broadcastRoom, refreshRoom]);

  const startGame = useCallback(() => {
    const current = roomRef.current;
    if (!current) return;
    if (!current.seats.every((item) => item.name)) {
      setError('四个座位需要坐满，可先添加电脑');
      return;
    }

    const state = createGame(
      current.seats.map((item) => item.name),
      current.seats.map((item) => item.isAi),
    );
    stateRef.current = state;
    current.started = true;
    current.phase = 'playing';
    setError(null);
    flush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const restart = useCallback(() => {
    const current = roomRef.current;
    if (!current) return;
    const state = createGame(
      current.seats.map((item) => item.name),
      current.seats.map((item) => item.isAi),
    );
    stateRef.current = state;
    current.started = true;
    current.phase = 'playing';
    flush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const solo = useCallback(() => {
    hostRef.current = true;
    seatRef.current = 0;
    setSeat(0);
    setError(null);
    const names = ['我', '电脑东', '电脑西', '电脑北'];
    const seats: SeatInfo[] = names.map((item, index) => ({
      name: item,
      isAi: index > 0,
      connected: index === 0,
    }));
    setRoomBoth({ code: '单机', host: true, seats, started: true, phase: 'playing' });
    stateRef.current = createGame(
      names,
      seats.map((item) => item.isAi),
    );
    flush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setRoomBoth]);

  const act = useCallback((action: MahjongAction) => {
    if (hostRef.current) {
      const current = seatRef.current;
      if (current !== null) handleAction(current, action);
      return;
    }
    const conn = guestConnRef.current;
    if (conn) send(conn, { t: 'action', action });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leave = useCallback(() => {
    clearTimers();
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    connsRef.current.clear();
    guestConnRef.current = null;
    stateRef.current = null;
    roomRef.current = null;
    seatRef.current = null;
    hostRef.current = false;
    setRoom(null);
    setView(null);
    setSeat(null);
    setError(null);
    setConnecting(false);
  }, [clearTimers]);

  useEffect(
    () => () => {
      clearTimers();
      if (peerRef.current) peerRef.current.destroy();
    },
    [clearTimers],
  );

  return {
    room,
    view,
    seat,
    error,
    connecting,
    createRoom,
    joinRoom,
    addAi,
    startGame,
    restart,
    solo,
    act,
    leave,
  };
}
