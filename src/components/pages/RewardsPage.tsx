import React, { useEffect, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Flame,
  Gamepad2,
  Lock,
  Sparkles,
  Trophy,
} from 'lucide-react';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { ACHIEVEMENT_DEFS } from '../../lib/defaults';
import { db } from '../../lib/firebase';
import type { AppView, GameSession, RewardProfile } from '../../types/pawcare';
import { PageReveal } from '../ui/MotionPrimitives';

interface RewardsPageProps {
  onNavigate: (view: AppView) => void;
  onRequireAuth: () => void;
}

const GAME_NAMES: Record<string, string> = {
  paw_runner: 'PawCare Pet Runner',
  paw_memory: 'Paw Memory Match',
  treat_catcher: 'Pet Treat Catcher',
  pet_rescue: 'PawCare Pet Rescue Adventure',
};

export function RewardsPage({ onNavigate, onRequireAuth }: RewardsPageProps) {
  const { firebaseUser, userProfile } = useAuth();
  const [reward, setReward] = useState<RewardProfile | null>(null);
  const [sessions, setSessions] = useState<GameSession[]>([]);

  useEffect(() => {
    if (!firebaseUser) {
      setReward(null);
      setSessions([]);
      return;
    }

    const unsubR = onSnapshot(
      doc(db, 'rewards', firebaseUser.uid),
      (snap) => setReward(snap.exists() ? (snap.data() as RewardProfile) : null),
      () => setReward(null)
    );

    const sQ = query(
      collection(db, 'gameSessions'),
      where('uid', '==', firebaseUser.uid),
      limit(30)
    );
    const unsubS = onSnapshot(
      sQ,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<GameSession, 'id'>),
        }));
        list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
        setSessions(list);
      },
      () => setSessions([])
    );

    return () => {
      unsubR();
      unsubS();
    };
  }, [firebaseUser]);

  if (!firebaseUser) {
    return (
      <PageReveal className="max-w-2xl mx-auto px-4 py-16 text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-[#F1F6F2] text-[#1B4332] flex items-center justify-center mx-auto">
          <Trophy className="w-7 h-7" />
        </div>
        <h1 className="font-display text-3xl font-bold text-[#1A221D]">
          PawCare Rewards &amp; Achievements
        </h1>
        <p className="text-sm text-[#526057] leading-relaxed">
          Sign in with Google or email to save your PawCare Points, track daily Play Zone streaks, and unlock achievement badges.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={onRequireAuth}
            className="px-5 py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-semibold cursor-pointer"
          >
            Sign In to View Rewards
          </button>
          <button
            type="button"
            onClick={() => onNavigate('play-zone')}
            className="px-5 py-2.5 rounded-xl border border-[#D4CFC4] bg-white text-sm font-semibold text-[#1A221D] cursor-pointer"
          >
            Try Play Zone as Guest
          </button>
        </div>
      </PageReveal>
    );
  }

  const earnedSet = new Set(reward?.achievements || []);

  return (
    <PageReveal className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      {/* Header Summary */}
      <div className="rounded-3xl bg-gradient-to-br from-[#1B4332] to-[#2D6A4F] text-white p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-md">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FDE68A]">
            <Award className="w-4 h-4" />
            PawCare Rewards · {userProfile?.fullName || firebaseUser.displayName || 'Member'}
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold">
            Your Play Zone Points &amp; Badges
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100 max-w-xl">
            Every validated game session adds PawCare Points and moves you closer to milestone badges. Points are strictly non-monetary entertainment rewards.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('play-zone')}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#FBBF24] text-[#1A221D] text-sm font-bold hover:bg-[#F59E0B] transition-colors self-start md:self-center cursor-pointer"
        >
          <Gamepad2 className="w-4 h-4" />
          Play Mini-Games
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[#E6E2D8] bg-white p-5 space-y-1">
          <div className="text-xs text-[#526057]">Total PawCare Points</div>
          <div className="font-mono text-2xl sm:text-3xl font-bold text-[#1B4332] tabular-nums">
            {(reward?.totalPoints ?? 0).toLocaleString('en-IN')}
          </div>
        </div>
        <div className="rounded-2xl border border-[#E6E2D8] bg-white p-5 space-y-1">
          <div className="text-xs text-[#526057]">Games Completed</div>
          <div className="font-mono text-2xl sm:text-3xl font-bold text-[#1A221D] tabular-nums">
            {reward?.gamesPlayed ?? 0}
          </div>
        </div>
        <div className="rounded-2xl border border-[#E6E2D8] bg-white p-5 space-y-1">
          <div className="text-xs text-[#526057] inline-flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-[#E07A2B]" /> Daily Streak
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-bold text-[#E07A2B] tabular-nums">
            {reward?.streakDays ?? 0} days
          </div>
        </div>
        <div className="rounded-2xl border border-[#E6E2D8] bg-white p-5 space-y-1">
          <div className="text-xs text-[#526057]">Badges Unlocked</div>
          <div className="font-mono text-2xl sm:text-3xl font-bold text-[#1A221D] tabular-nums">
            {earnedSet.size} / {ACHIEVEMENT_DEFS.length}
          </div>
        </div>
      </div>

      {/* Personal Bests + Daily Challenge */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 rounded-2xl border border-[#E6E2D8] bg-white p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-[#1A221D]">
            Personal High Scores
          </h2>
          <div className="space-y-3 text-sm">
            {[
              { label: 'PawCare Pet Runner', val: reward?.bestRunnerScore ?? 0 },
              { label: 'Paw Memory Match', val: reward?.bestMemoryScore ?? 0 },
              { label: 'Pet Treat Catcher', val: reward?.bestCatcherScore ?? 0 },
              { label: 'Pet Rescue Adventure', val: reward?.bestRescueScore ?? 0 },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between p-3.5 rounded-xl bg-[#FAF8F4] border border-[#EFECE4]"
              >
                <span className="font-medium text-[#1A221D]">{row.label}</span>
                <span className="font-mono font-bold text-[#1B4332] tabular-nums">
                  {row.val} pts
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-7 rounded-2xl border border-[#E6E2D8] bg-white p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-[#1A221D]">
            Achievements &amp; Badges
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ACHIEVEMENT_DEFS.map((ach) => {
              const unlocked = earnedSet.has(ach.id);
              return (
                <div
                  key={ach.id}
                  className={`p-4 rounded-xl border space-y-1.5 ${
                    unlocked
                      ? 'bg-[#F1F6F2] border-[#B7D7C2]'
                      : 'bg-[#FAF8F4] border-[#E6E2D8] opacity-80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-[#1A221D]">
                      {ach.title}
                    </span>
                    {unlocked ? (
                      <CheckCircle2 className="w-4 h-4 text-[#1B4332] shrink-0" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-[#6B786F] shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-[#526057]">{ach.description}</p>
                  <div className="text-[11px] font-medium text-[#2D6A4F]">
                    {ach.pointsHint}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Validated Sessions */}
      <div className="rounded-2xl border border-[#E6E2D8] bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-[#1A221D]">
            Recent Play Zone Activity
          </h2>
          <Sparkles className="w-4 h-4 text-[#D97706]" />
        </div>
        {sessions.length === 0 ? (
          <p className="text-sm text-[#526057]">
            No completed game sessions yet. Jump into the Play Zone to record your first score!
          </p>
        ) : (
          <div className="divide-y divide-[#EFECE4] text-xs sm:text-sm">
            {sessions.slice(0, 12).map((s) => (
              <div key={s.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-semibold text-[#1A221D]">
                    {GAME_NAMES[s.gameId] || s.gameId}
                  </span>
                  <span className="text-xs text-[#526057] ml-2">
                    Score {s.score} · {s.durationSec}s
                  </span>
                </div>
                <span className="font-mono font-semibold text-[#1B4332] tabular-nums">
                  +{s.pointsAwarded} pts
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageReveal>
  );
}
