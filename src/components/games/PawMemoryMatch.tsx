import React, { useCallback, useEffect, useState } from 'react';
import {
  Award,
  Bone,
  Cat,
  Dog,
  Heart,
  Pause,
  PawPrint,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { recordValidatedGameSession } from '../../lib/firestoreService';
import { soundFx } from '../../lib/soundFx';

type Difficulty = 'easy' | 'medium' | 'hard';

interface MemoryCard {
  uid: string;
  pairId: string;
  label: string;
  color: string;
  flipped: boolean;
  matched: boolean;
}

const CARD_DECK = [
  { pairId: 'puppy', label: 'Sunny Pup', color: '#D97706' },
  { pairId: 'kitten', label: 'Cozy Cat', color: '#1B4332' },
  { pairId: 'paw', label: 'Golden Paw', color: '#B45309' },
  { pairId: 'bone', label: 'Pet Biscuit', color: '#0F766E' },
  { pairId: 'heart', label: 'Pet Love', color: '#BE123C' },
  { pairId: 'sparkle', label: 'Play Star', color: '#4338CA' },
  { pairId: 'trophy', label: 'Good Boy', color: '#15803D' },
  { pairId: 'walk', label: 'Trail Walk', color: '#0369A1' },
];

function renderCardIcon(pairId: string, color: string) {
  const props = { className: 'w-7 h-7 sm:w-8 sm:h-8', style: { color } };
  switch (pairId) {
    case 'puppy':
      return <Dog {...props} />;
    case 'kitten':
      return <Cat {...props} />;
    case 'paw':
      return <PawPrint {...props} />;
    case 'bone':
      return <Bone {...props} />;
    case 'heart':
      return <Heart {...props} />;
    case 'sparkle':
      return <Sparkles {...props} />;
    case 'trophy':
      return <Award {...props} />;
    default:
      return <PawPrint {...props} />;
  }
}

function buildShuffledDeck(difficulty: Difficulty): MemoryCard[] {
  const pairCount = difficulty === 'easy' ? 3 : difficulty === 'medium' ? 6 : 8;
  const chosen = CARD_DECK.slice(0, pairCount);
  const doubled = [...chosen, ...chosen].map((item, idx) => ({
    uid: `${item.pairId}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
    pairId: item.pairId,
    label: item.label,
    color: item.color,
    flipped: false,
    matched: false,
  }));
  for (let i = doubled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [doubled[i], doubled[j]] = [doubled[j], doubled[i]];
  }
  return doubled;
}

interface PawMemoryMatchProps {
  bestScore: number;
  onRequireAuth: () => void;
  onSessionSaved?: (pointsAwarded: number) => void;
}

export function PawMemoryMatch({
  bestScore,
  onRequireAuth,
  onSessionSaved,
}: PawMemoryMatchProps) {
  const { firebaseUser } = useAuth();
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [cards, setCards] = useState<MemoryCard[]>(() => buildShuffledDeck('medium'));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [paused, setPaused] = useState(false);
  const [won, setWon] = useState(false);
  const [locked, setLocked] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [finalScore, setFinalScore] = useState(0);
  const [pointsAwarded, setPointsAwarded] = useState<number | null>(null);
  const [localBest, setLocalBest] = useState(() => {
    const stored = Number(localStorage.getItem('pawcare_memory_best') || '0');
    return Math.max(bestScore, Number.isFinite(stored) ? stored : 0);
  });

  useEffect(() => {
    setLocalBest((prev) => Math.max(prev, bestScore));
  }, [bestScore]);

  useEffect(() => {
    if (paused || won) return;
    const id = window.setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [paused, won]);

  const startNewGame = useCallback(
    (nextDiff: Difficulty = difficulty) => {
      setDifficulty(nextDiff);
      setCards(buildShuffledDeck(nextDiff));
      setSelectedIds([]);
      setMoves(0);
      setElapsedSec(0);
      setPaused(false);
      setWon(false);
      setLocked(false);
      setFinalScore(0);
      setPointsAwarded(null);
      soundFx.click(soundOn);
    },
    [difficulty, soundOn]
  );

  const handleVictory = useCallback(
    async (totalMoves: number, totalTimeSec: number, diff: Difficulty) => {
      soundFx.victory(soundOn);
      const base = diff === 'hard' ? 700 : diff === 'medium' ? 500 : 300;
      const computedScore = Math.max(80, base - totalMoves * 12 - totalTimeSec * 2);
      setFinalScore(computedScore);
      const nextBest = Math.max(localBest, computedScore);
      setLocalBest(nextBest);
      localStorage.setItem('pawcare_memory_best', String(nextBest));

      if (!firebaseUser || !firebaseUser.emailVerified) return;
      try {
        const res = await recordValidatedGameSession({
          uid: firebaseUser.uid,
          gameId: 'paw_memory',
          score: computedScore,
          durationSec: Math.max(3, totalTimeSec),
          difficulty: diff,
          won: true,
        });
        setPointsAwarded(res.pointsAwarded);
        onSessionSaved?.(res.pointsAwarded);
      } catch {
        // Non-blocking save notice
      }
    },
    [firebaseUser, localBest, onSessionSaved, soundOn]
  );

  const handleCardClick = (card: MemoryCard) => {
    if (paused || locked || won || card.flipped || card.matched) return;
    soundFx.flip(soundOn);

    const updatedCards = cards.map((c) =>
      c.uid === card.uid ? { ...c, flipped: true } : c
    );
    setCards(updatedCards);
    const nextSelected = [...selectedIds, card.uid];
    setSelectedIds(nextSelected);

    if (nextSelected.length === 2) {
      const nextMoves = moves + 1;
      setMoves(nextMoves);
      setLocked(true);

      const [firstId, secondId] = nextSelected;
      const firstCard = updatedCards.find((c) => c.uid === firstId);
      const secondCard = updatedCards.find((c) => c.uid === secondId);

      if (firstCard && secondCard && firstCard.pairId === secondCard.pairId) {
        soundFx.match(soundOn);
        const matchedDeck = updatedCards.map((c) =>
          c.uid === firstId || c.uid === secondId ? { ...c, matched: true } : c
        );
        setCards(matchedDeck);
        setSelectedIds([]);
        setLocked(false);

        if (matchedDeck.every((c) => c.matched)) {
          setWon(true);
          void handleVictory(nextMoves, Math.max(3, elapsedSec), difficulty);
        }
      } else {
        window.setTimeout(() => {
          setCards((prev) =>
            prev.map((c) =>
              c.uid === firstId || c.uid === secondId ? { ...c, flipped: false } : c
            )
          );
          setSelectedIds([]);
          setLocked(false);
        }, 700);
      }
    }
  };

  const gridColsClass =
    difficulty === 'easy'
      ? 'grid-cols-3 max-w-md mx-auto'
      : difficulty === 'medium'
      ? 'grid-cols-3 sm:grid-cols-4 max-w-xl mx-auto'
      : 'grid-cols-4 max-w-2xl mx-auto';

  return (
    <div className="rounded-2xl border border-[#E6E2D8] bg-white p-4 sm:p-6 space-y-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-[#1A221D]">
            Paw Memory Match
          </h2>
          <p className="text-xs text-[#526057]">
            Flip cards to match adorable pet pairs in the fewest moves and fastest time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-[#D8D3C8] bg-[#FAF8F4] p-1 text-xs">
            {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => startNewGame(d)}
                className={`px-2.5 py-1 rounded-lg capitalize font-medium cursor-pointer ${
                  difficulty === d
                    ? 'bg-[#1B4332] text-white'
                    : 'text-[#445249] hover:text-[#1A221D]'
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setSoundOn((v) => !v)}
            aria-label={soundOn ? 'Mute sound' : 'Unmute sound'}
            className="p-2 rounded-xl border border-[#E6E2D8] text-[#445249] cursor-pointer"
          >
            {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {!won && (
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-[#D4CFC4] text-xs font-semibold cursor-pointer"
            >
              {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              {paused ? 'Resume' : 'Pause'}
            </button>
          )}

          <button
            type="button"
            onClick={() => startNewGame(difficulty)}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-[#1B4332] text-white text-xs font-semibold cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restart
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-mono tabular-nums">
        <span className="px-3 py-1.5 rounded-xl bg-[#FAF8F4] border border-[#E6E2D8]">
          Moves: <strong>{moves}</strong>
        </span>
        <span className="px-3 py-1.5 rounded-xl bg-[#FAF8F4] border border-[#E6E2D8]">
          Time: <strong>{elapsedSec}s</strong>
        </span>
        <span className="px-3 py-1.5 rounded-xl bg-[#FAF8F4] border border-[#E6E2D8]">
          Best Score: <strong className="text-[#1B4332]">{localBest}</strong>
        </span>
      </div>

      <div className="relative">
        <div className={`grid gap-3 ${gridColsClass}`}>
          {cards.map((card) => {
            const revealed = card.flipped || card.matched;
            return (
              <button
                key={card.uid}
                type="button"
                onClick={() => handleCardClick(card)}
                disabled={paused || revealed}
                aria-label={revealed ? card.label : 'Hidden pet card'}
                className="relative aspect-[4/4.3] rounded-2xl perspective-[800px] cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1B4332]"
              >
                <div
                  className="w-full h-full transition-transform duration-300 [transform-style:preserve-3d]"
                  style={{ transform: revealed ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
                >
                  {/* Card Back */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#1B4332] to-[#2D6A4F] border-2 border-[#1B4332] flex flex-col items-center justify-center gap-1 text-emerald-100 [backface-visibility:hidden] shadow-sm">
                    <PawPrint className="w-6 h-6 text-[#FBBF24]" />
                    <span className="text-[10px] font-semibold tracking-wider uppercase">
                      PawCare
                    </span>
                  </div>

                  {/* Card Front */}
                  <div
                    className={`absolute inset-0 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 p-2 [backface-visibility:hidden] [transform:rotateY(180deg)] ${
                      card.matched
                        ? 'bg-[#E8F3EC] border-[#2D6A4F] shadow-inner'
                        : 'bg-[#FAF8F4] border-[#D8D3C8]'
                    }`}
                  >
                    {renderCardIcon(card.pairId, card.color)}
                    <span className="text-[11px] font-semibold text-[#1A221D]">
                      {card.label}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {paused && !won && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-xs rounded-2xl flex items-center justify-center">
            <button
              type="button"
              onClick={() => setPaused(false)}
              className="px-5 py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-semibold cursor-pointer"
            >
              Resume Memory Board
            </button>
          </div>
        )}
      </div>

      {won && (
        <div className="rounded-2xl bg-[#F1F6F2] border border-[#C5DEC9] p-5 text-center space-y-3">
          <div className="font-display text-xl font-bold text-[#1B4332]">
            Board Cleared! Score: <span className="font-mono tabular-nums">{finalScore}</span>
          </div>
          <p className="text-xs text-[#445249]">
            Completed {difficulty} mode in {moves} moves and {elapsedSec} seconds.
          </p>
          {pointsAwarded !== null && (
            <div className="text-xs font-semibold text-emerald-900">
              +{pointsAwarded} PawCare Points awarded to your Rewards account!
            </div>
          )}
          {!firebaseUser && (
            <button
              type="button"
              onClick={onRequireAuth}
              className="text-xs font-semibold text-[#1B4332] hover:underline cursor-pointer"
            >
              Sign in to save points &amp; unlock badges →
            </button>
          )}
          <div>
            <button
              type="button"
              onClick={() => startNewGame(difficulty)}
              className="px-5 py-2 rounded-xl bg-[#1B4332] text-white text-xs font-semibold cursor-pointer"
            >
              Play Another Round
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
