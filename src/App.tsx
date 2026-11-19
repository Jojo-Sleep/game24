import { useEffect, useState } from 'react';
import { Background } from './components/Background';
import { Lobby, type GameId } from './components/Lobby';
import { PopStarGame } from './games/PopStarGame';
import { ThunderGame } from './games/ThunderGame';
import { TwentyFourGame } from './games/TwentyFourGame';

export default function App() {
  const [game, setGame] = useState<GameId | null>(null);

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
      </main>
    </div>
  );
}
