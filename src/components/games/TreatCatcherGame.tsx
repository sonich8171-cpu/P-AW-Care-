import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Heart, Pause, Play, RotateCcw, Trophy, Volume2, VolumeX } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { recordValidatedGameSession } from '../../lib/firestoreService';
import { soundFx } from '../../lib/soundFx';

interface FallingItem {
  x: number;
  y: number;
  vy: number;
  kind: 'biscuit' | 'toy' | 'star' | 'boot' | 'pinecone' | 'rock';
  isHazard: boolean;
  pts: number;
}

interface TreatCatcherGameProps {
  bestScore: number;
  onRequireAuth: () => void;
  onSessionSaved?: (pointsAwarded: number) => void;
}

const CANVAS_W = 720;
const CANVAS_H = 380;
const CATCHER_W = 88;
const CATCHER_Y = 318;

export function TreatCatcherGame({
  bestScore,
  onRequireAuth,
  onSessionSaved,
}: TreatCatcherGameProps) {
  const { firebaseUser } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [phase, setPhase] = useState<'ready' | 'playing' | 'paused' | 'gameover'>('ready');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [soundOn, setSoundOn] = useState(true);
  const [pointsAwarded, setPointsAwarded] = useState<number | null>(null);
  const [localBest, setLocalBest] = useState(() => {
    const stored = Number(localStorage.getItem('pawcare_catcher_best') || '0');
    return Math.max(bestScore, Number.isFinite(stored) ? stored : 0);
  });

  useEffect(() => {
    setLocalBest((prev) => Math.max(prev, bestScore));
  }, [bestScore]);

  const stateRef = useRef({
    phase: 'ready' as 'ready' | 'playing' | 'paused' | 'gameover',
    soundOn: true,
    basketX: CANVAS_W / 2 - CATCHER_W / 2,
    moveDir: 0,
    score: 0,
    lives: 3,
    elapsedSec: 0,
    spawnTimer: 0.6,
    items: [] as FallingItem[],
    submitted: false,
  });

  useEffect(() => {
    stateRef.current.phase = phase;
  }, [phase]);

  useEffect(() => {
    stateRef.current.soundOn = soundOn;
  }, [soundOn]);

  const finalizeSession = useCallback(
    async (finalScore: number, durationSec: number, wonRound: boolean) => {
      const nextBest = Math.max(localBest, finalScore);
      setLocalBest(nextBest);
      localStorage.setItem('pawcare_catcher_best', String(nextBest));

      if (!firebaseUser || !firebaseUser.emailVerified) return;
      try {
        const res = await recordValidatedGameSession({
          uid: firebaseUser.uid,
          gameId: 'treat_catcher',
          score: finalScore,
          durationSec: Math.max(3, Math.round(durationSec)),
          difficulty: 'standard',
          won: wonRound,
        });
        setPointsAwarded(res.pointsAwarded);
        onSessionSaved?.(res.pointsAwarded);
      } catch {
        // Non-blocking notice
      }
    },
    [firebaseUser, localBest, onSessionSaved]
  );

  const startGame = useCallback(() => {
    const s = stateRef.current;
    s.basketX = CANVAS_W / 2 - CATCHER_W / 2;
    s.moveDir = 0;
    s.score = 0;
    s.lives = 3;
    s.elapsedSec = 0;
    s.spawnTimer = 0.5;
    s.items = [];
    s.submitted = false;
    setScore(0);
    setLives(3);
    setPointsAwarded(null);
    setPhase('playing');
    soundFx.click(s.soundOn);
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') stateRef.current.moveDir = -1;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') stateRef.current.moveDir = 1;
    };
    const up = (e: KeyboardEvent) => {
      if (
        e.code === 'ArrowLeft' ||
        e.code === 'KeyA' ||
        e.code === 'ArrowRight' ||
        e.code === 'KeyD'
      ) {
        stateRef.current.moveDir = 0;
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;

    let animId = 0;
    let lastTime = performance.now();

    const drawItem = (it: FallingItem) => {
      ctx.save();
      ctx.translate(it.x, it.y);
      if (it.kind === 'biscuit') {
        ctx.fillStyle = '#D97706';
        ctx.beginPath();
        ctx.roundRect(-13, -5, 26, 10, 5);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-11, -5, 4.5, 0, Math.PI * 2);
        ctx.arc(-11, 5, 4.5, 0, Math.PI * 2);
        ctx.arc(11, -5, 4.5, 0, Math.PI * 2);
        ctx.arc(11, 5, 4.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (it.kind === 'toy') {
        ctx.fillStyle = '#10B981';
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI);
        ctx.stroke();
      } else if (it.kind === 'star') {
        ctx.fillStyle = '#FBBF24';
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1B4332';
        ctx.beginPath();
        ctx.arc(0, 2, 5, 0, Math.PI * 2);
        ctx.arc(-5, -5, 2.5, 0, Math.PI * 2);
        ctx.arc(0, -7, 2.5, 0, Math.PI * 2);
        ctx.arc(5, -5, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (it.kind === 'boot') {
        // Muddy boot hazard
        ctx.fillStyle = '#57534E';
        ctx.beginPath();
        ctx.roundRect(-8, -12, 12, 18, 3);
        ctx.roundRect(-8, 2, 20, 9, 4);
        ctx.fill();
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(10, -10, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (it.kind === 'pinecone') {
        ctx.fillStyle = '#78350F';
        ctx.beginPath();
        ctx.ellipse(0, 0, 10, 14, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Garden pebble rock
        ctx.fillStyle = '#64748B';
        ctx.beginPath();
        ctx.ellipse(0, 0, 13, 10, 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    const drawBasket = (x: number) => {
      ctx.save();
      ctx.translate(x, CATCHER_Y);
      // Basket body
      ctx.fillStyle = '#B45309';
      ctx.beginPath();
      ctx.roundRect(0, 6, CATCHER_W, 28, 8);
      ctx.fill();
      // Basket rim
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.roundRect(-4, 0, CATCHER_W + 8, 10, 5);
      ctx.fill();
      // Paw emblem
      ctx.fillStyle = '#FFFBEB';
      ctx.beginPath();
      ctx.arc(CATCHER_W / 2, 22, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      const s = stateRef.current;

      if (s.phase === 'playing') {
        s.elapsedSec += dt;
        s.basketX = Math.max(
          8,
          Math.min(CANVAS_W - CATCHER_W - 8, s.basketX + s.moveDir * 440 * dt)
        );

        s.spawnTimer -= dt;
        if (s.spawnTimer <= 0) {
          const roll = Math.random();
          let item: FallingItem;
          const speedBoost = 155 + Math.min(180, s.elapsedSec * 4.5);
          if (roll < 0.42) {
            item = {
              x: 24 + Math.random() * (CANVAS_W - 48),
              y: -20,
              vy: speedBoost,
              kind: 'biscuit',
              isHazard: false,
              pts: 15,
            };
          } else if (roll < 0.62) {
            item = {
              x: 24 + Math.random() * (CANVAS_W - 48),
              y: -20,
              vy: speedBoost + 25,
              kind: 'toy',
              isHazard: false,
              pts: 25,
            };
          } else if (roll < 0.74) {
            item = {
              x: 24 + Math.random() * (CANVAS_W - 48),
              y: -20,
              vy: speedBoost + 45,
              kind: 'star',
              isHazard: false,
              pts: 40,
            };
          } else {
            const hazards: FallingItem['kind'][] = ['boot', 'pinecone', 'rock'];
            const kind = hazards[Math.floor(Math.random() * hazards.length)];
            item = {
              x: 24 + Math.random() * (CANVAS_W - 48),
              y: -20,
              vy: speedBoost + 35,
              kind,
              isHazard: true,
              pts: 0,
            };
          }
          s.items.push(item);
          s.spawnTimer = Math.max(0.32, 0.88 - s.elapsedSec * 0.01);
        }

        const remaining: FallingItem[] = [];
        for (const it of s.items) {
          it.y += it.vy * dt;
          const caught =
            it.y >= CATCHER_Y - 6 &&
            it.y <= CATCHER_Y + 34 &&
            it.x >= s.basketX - 8 &&
            it.x <= s.basketX + CATCHER_W + 8;

          if (caught) {
            if (it.isHazard) {
              soundFx.hit(s.soundOn);
              s.lives -= 1;
              setLives(s.lives);
              if (s.lives <= 0) {
                s.phase = 'gameover';
                setPhase('gameover');
                if (!s.submitted) {
                  s.submitted = true;
                  void finalizeSession(s.score, s.elapsedSec, s.score >= 150);
                }
              }
            } else {
              soundFx.coin(s.soundOn);
              s.score += it.pts;
              setScore(s.score);
            }
          } else if (it.y < CANVAS_H + 30) {
            remaining.push(it);
          }
        }
        s.items = remaining;
      }

      // Render
      ctx.save();
      ctx.scale(dpr, dpr);
      const bg = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      bg.addColorStop(0, '#F0F7F2');
      bg.addColorStop(1, '#FAF8F4');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      ctx.fillStyle = '#2D6A4F';
      ctx.fillRect(0, CANVAS_H - 28, CANVAS_W, 28);

      for (const it of s.items) {
        drawItem(it);
      }
      drawBasket(s.basketX);
      ctx.restore();

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [finalizeSession]);

  const moveBasketToPointer = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas || stateRef.current.phase !== 'playing') return;
    const rect = canvas.getBoundingClientRect();
    const normX = ((clientX - rect.left) / rect.width) * CANVAS_W;
    stateRef.current.basketX = Math.max(
      8,
      Math.min(CANVAS_W - CATCHER_W - 8, normX - CATCHER_W / 2)
    );
  };

  return (
    <div className="rounded-2xl border border-[#E6E2D8] bg-white p-4 sm:p-6 space-y-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-[#1A221D]">
            Pet Treat Catcher
          </h2>
          <p className="text-xs text-[#526057]">
            Catch safe biscuits, toys &amp; golden paw stars. Dodge muddy boots, pinecones &amp; pebbles!
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-[#FAF8F4] border border-[#E6E2D8] text-xs font-mono tabular-nums">
            Score: <strong className="text-[#1B4332]">{score}</strong>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-[#FAF8F4] border border-[#E6E2D8] text-xs font-mono tabular-nums inline-flex items-center gap-1">
            {[0, 1, 2].map((idx) => (
              <Heart
                key={idx}
                className={`w-3.5 h-3.5 ${
                  idx < lives ? 'text-rose-600 fill-rose-600' : 'text-[#D8D3C8]'
                }`}
              />
            ))}
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-[#FAF8F4] border border-[#E6E2D8] text-xs font-mono tabular-nums inline-flex items-center gap-1">
            <Trophy className="w-3.5 h-3.5 text-[#D97706]" />
            Best: <strong>{localBest}</strong>
          </div>
          <button
            type="button"
            onClick={() => setSoundOn((v) => !v)}
            aria-label={soundOn ? 'Mute sound' : 'Unmute sound'}
            className="p-2 rounded-xl border border-[#E6E2D8] text-[#445249] cursor-pointer"
          >
            {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          {(phase === 'playing' || phase === 'paused') && (
            <button
              type="button"
              onClick={() => setPhase(phase === 'playing' ? 'paused' : 'playing')}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-[#D4CFC4] text-xs font-semibold cursor-pointer"
            >
              {phase === 'playing' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {phase === 'playing' ? 'Pause' : 'Resume'}
            </button>
          )}
          <button
            type="button"
            onClick={startGame}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-[#1B4332] text-white text-xs font-semibold cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restart
          </button>
        </div>
      </div>

      <div className="relative rounded-2xl overflow-hidden border border-[#D4CFC4] bg-[#F0F7F2] select-none touch-none">
        <canvas
          ref={canvasRef}
          onPointerDown={(e) => moveBasketToPointer(e.clientX)}
          onPointerMove={(e) => moveBasketToPointer(e.clientX)}
          className="w-full h-auto block cursor-ew-resize"
          style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
        />

        {phase === 'ready' && (
          <div className="absolute inset-0 bg-[#1B4332]/25 backdrop-blur-[2px] flex items-center justify-center p-6">
            <div className="bg-white/95 border border-[#E6E2D8] rounded-2xl p-6 max-w-sm text-center space-y-3 shadow-lg">
              <h3 className="font-display text-lg font-bold text-[#1A221D]">
                Slide the Treat Basket
              </h3>
              <p className="text-xs text-[#526057]">
                Move with your mouse, finger drag, or Left/Right arrow keys. You have 3 hearts—avoid muddy boots, pinecones, and rocks!
              </p>
              <button
                type="button"
                onClick={startGame}
                className="w-full py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-semibold cursor-pointer"
              >
                Start Catching
              </button>
            </div>
          </div>
        )}

        {phase === 'paused' && (
          <div className="absolute inset-0 bg-black/35 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 text-center space-y-3 shadow-xl">
              <div className="font-display text-lg font-bold text-[#1A221D]">Paused</div>
              <button
                type="button"
                onClick={() => setPhase('playing')}
                className="px-5 py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-semibold cursor-pointer"
              >
                Resume Game
              </button>
            </div>
          </div>
        )}

        {phase === 'gameover' && (
          <div className="absolute inset-0 bg-black/45 flex items-center justify-center p-4">
            <div className="bg-white border border-[#E6E2D8] rounded-2xl p-6 max-w-sm w-full text-center space-y-3 shadow-2xl">
              <div className="text-xs font-semibold text-[#2D6A4F]">Basket Full!</div>
              <div className="font-display text-2xl font-bold text-[#1A221D] font-mono tabular-nums">
                {score} pts
              </div>
              {pointsAwarded !== null && (
                <div className="text-xs font-medium text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-xl py-2 px-3">
                  +{pointsAwarded} PawCare Points saved to your Rewards profile!
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
              <button
                type="button"
                onClick={startGame}
                className="w-full py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-semibold cursor-pointer"
              >
                Play Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
