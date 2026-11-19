import { useEffect, useState } from 'react';
import { Background } from './components/Background';
import { Lobby, type GameId } from './components/Lobby';
import { BigFishGame } from './games/BigFishGame';
import { BoxingGame } from './games/BoxingGame';
import { EggyGame } from './games/EggyGame';
import { FishingGame } from './games/FishingGame';
import { MahjongGame } from './games/MahjongGame';
import { PopStarGame } from './games/PopStarGame';
import { RacingGame } from './games/RacingGame';
import { SpiderGame } from './games/SpiderGame';
import { ThunderGame } from './games/ThunderGame';
import { TwentyFourGame } from './games/TwentyFourGame';

export default function App() {
  const [initialRoom] = useState(() => new URLSearchParams(window.location.search).get('room'));
  const [game, setGame] = useState<GameId | null>(() => (initialRoom ? 'mahjong' : null));

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [game]);

  return (
    <div className="relative min-h-dvh overflow-hidden text-slate-100">
      <Background />

      <main className="app-shell relative z-10 mx-auto flex min-h-dvh w-full max-w-[620px] flex-col gap-4 sm:gap-5">
        {game === null && <Lobby onSelect={setGame} />}
        {game === 'twenty-four' && <TwentyFourGame onExit={() => setGame(null)} />}
        {game === 'thunder' && <ThunderGame onExit={() => setGame(null)} />}
        {game === 'popstar' && <PopStarGame onExit={() => setGame(null)} />}
        {game === 'eggy' && <EggyGame onExit={() => setGame(null)} />}
        {game === 'boxing' && <BoxingGame onExit={() => setGame(null)} />}
        {game === 'racing' && <RacingGame onExit={() => setGame(null)} />}
        {game === 'bigfish' && <BigFishGame onExit={() => setGame(null)} />}
        {game === 'fishing' && <FishingGame onExit={() => setGame(null)} />}
        {game === 'spider' && <SpiderGame onExit={() => setGame(null)} />}
        {game === 'mahjong' && (
          <MahjongGame
            initialRoom={initialRoom}
            onExit={() => {
              window.history.replaceState({}, '', window.location.pathname);
              setGame(null);
            }}
          />
        )}
      </main>
    </div>
  );
}
