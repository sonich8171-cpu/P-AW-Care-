import React, { useEffect, useState } from 'react';
import { Award, Flame, Gamepad2, PawPrint, Sparkles, Trophy } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import type { AppView, GameId, RewardProfile } from '../../types/pawcare';
import { PageReveal } from '../ui/MotionPrimitives';
import { PawMemoryMatch } from '../games/PawMemoryMatch';
import { PawRunnerGame } from '../games/PawRunnerGame';
import { PetRescueGame } from '../games/PetRescueGame';
import { TreatCatcherGame } from '../games/TreatCatcherGame';

interface PlayZonePageProps {
  onNavigate: (view: AppView) => void;
  onRequireAuth: () => void;
}

export function PlayZonePage({ onNavigate, onRequireAuth }: PlayZonePageProps) {
  const { firebaseUser } = useAuth();
  const [activeGame, setActiveGame] = useState<GameId>('paw_runner');
  const [rewardProfile, setRewardProfile] = useState<RewardProfile | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    if (!firebaseUser) {
      setRewardProfile(null);
      return;
    }
    return onSnapshot(
      doc(db, 'rewards', firebaseUser.uid),
      (snap) => {
        setRewardProfile(snap.exists() ? (snap.data() as RewardProfile) : null);
      },
      () => setRewardProfile(null)
    );
  }, [firebaseUser]);

  const handleSaved = (pts: number) => {
    setToastMsg(`+${pts} PawCare Points added to your Rewards profile!`);
    window.setTimeout(() => setToastMsg(''), 4500);
  };

  const games: {
    id: GameId;
    title: string;
    subtitle: string;
    best: number;
    badge: string;
  }[] = [
    {
      id: 'paw_runner',
      title: 'PawCare Pet Runner',
      subtitle: 'Jump over fences & puddles while grabbing golden paw coins.',
      best: rewardProfile?.bestRunnerScore ?? 0,
      badge: 'Endless Runner',
    },
    {
      id: 'paw_memory',
      title: 'Paw Memory Match',
      subtitle: 'Flip illustrated pet cards across Easy, Medium & Hard boards.',
      best: rewardProfile?.bestMemoryScore ?? 0,
      badge: 'Memory Puzzle',
    },
    {
      id: 'treat_catcher',
      title: 'Pet Treat Catcher',
      subtitle: 'Slide your basket to catch biscuits & toys while dodging garden hazards.',
      best: rewardProfile?.bestCatcherScore ?? 0,
      badge: 'Arcade Catcher',
    },
    {
      id: 'pet_rescue',
      title: 'Pet Rescue Adventure',
      subtitle: 'Explore Dehradun gardens, rescue lost pets, and guide them home safely.',
      best: rewardProfile?.bestRescueScore ?? 0,
      badge: 'Garden Rescue',
    },
  ];

  return (
    <PageReveal className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-br from-[#1B4332] via-[#21523D] to-[#2D6A4F] text-white p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-md">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FDE68A]">
            <Gamepad2 className="w-4 h-4" />
            PawCare Play Zone · Interactive Mini-Games
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
            Play Pet Mini-Games, Earn Points &amp; Unlock Badges
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100 leading-relaxed">
            Take a fun break with four responsive pet-themed games. Signed-in users earn server-validated PawCare Points and achievement badges saved to their profile.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="rounded-2xl bg-white/12 border border-white/20 px-4 py-3 text-xs space-y-0.5">
            <div className="text-emerald-100">Your PawCare Points</div>
            <div className="font-mono text-xl font-bold text-[#FDE68A] tabular-nums">
              {(rewardProfile?.totalPoints ?? 0).toLocaleString('en-IN')}
            </div>
          </div>
          <div className="rounded-2xl bg-white/12 border border-white/20 px-4 py-3 text-xs space-y-0.5">
            <div className="text-emerald-100 inline-flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-[#FBBF24]" /> Streak
            </div>
            <div className="font-mono text-xl font-bold text-white tabular-nums">
              {rewardProfile?.streakDays ?? 0}d
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('rewards')}
            className="inline-flex items-center gap-1.5 px-4 py-3 rounded-2xl bg-[#FBBF24] text-[#1A221D] text-xs font-bold hover:bg-[#F59E0B] transition-colors cursor-pointer"
          >
            <Award className="w-4 h-4" />
            View Rewards
          </button>
        </div>
      </div>

      {toastMsg && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs font-semibold text-emerald-900 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#1B4332]" />
          {toastMsg}
        </div>
      )}

      {/* Game Selector Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {games.map((g) => {
          const active = activeGame === g.id;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => setActiveGame(g.id)}
              className={`text-left rounded-2xl p-4 sm:p-5 border transition-all cursor-pointer space-y-2 ${
                active
                  ? 'bg-[#F1F6F2] border-[#1B4332] shadow-sm ring-1 ring-[#1B4332]/20'
                  : 'bg-white border-[#E6E2D8] hover:border-[#2D6A4F]/50'
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-[#2D6A4F]">{g.badge}</span>
                {firebaseUser && (
                  <span className="font-mono tabular-nums text-[#526057] inline-flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-[#D97706]" /> {g.best}
                  </span>
                )}
              </div>
              <div className="font-display text-lg font-bold text-[#1A221D] flex items-center gap-2">
                <PawPrint className="w-4 h-4 text-[#1B4332]" />
                {g.title}
              </div>
              <p className="text-xs text-[#526057] leading-relaxed">{g.subtitle}</p>
            </button>
          );
        })}
      </div>

      {/* Active Game Stage */}
      {activeGame === 'paw_runner' && (
        <PawRunnerGame
          bestScore={rewardProfile?.bestRunnerScore ?? 0}
          onRequireAuth={onRequireAuth}
          onSessionSaved={handleSaved}
        />
      )}
      {activeGame === 'paw_memory' && (
        <PawMemoryMatch
          bestScore={rewardProfile?.bestMemoryScore ?? 0}
          onRequireAuth={onRequireAuth}
          onSessionSaved={handleSaved}
        />
      )}
      {activeGame === 'treat_catcher' && (
        <TreatCatcherGame
          bestScore={rewardProfile?.bestCatcherScore ?? 0}
          onRequireAuth={onRequireAuth}
          onSessionSaved={handleSaved}
        />
      )}
      {activeGame === 'pet_rescue' && (
        <PetRescueGame
          bestScore={rewardProfile?.bestRescueScore ?? 0}
          onRequireAuth={onRequireAuth}
          onSessionSaved={handleSaved}
        />
      )}

      <p className="text-[11px] text-[#6B786F] text-center">
        Play Zone Note: PawCare Points and achievement badges are non-monetary entertainment rewards and do not represent cash value or automatic booking discounts.
      </p>
    </PageReveal>
  );
}
