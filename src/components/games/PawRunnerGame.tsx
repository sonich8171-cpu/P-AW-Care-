import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Trophy, Volume2, VolumeX } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { recordValidatedGameSession } from '../../lib/firestoreService';
import { soundFx } from '../../lib/soundFx';

interface Obstacle {
  x: number;
  w: number;
  h: number;
  kind: 'fence' | 'puddle' | 'planter';
}

interface Collectible {
  x: number;
  y: number;
  r: number;
  kind: 'coin' | 'biscuit';
  collected: boolean;
}

interface PawRunnerGameProps {
  bestScore: number;
  onRequireAuth: () => void;
  onSessionSaved?: (pointsAwarded: number) => void;
}

const CANVAS_W = 760;
const CANVAS_H = 340;
const GROUND_Y = 278;

export function PawRunnerGame({
  bestScore,
  onRequireAuth,
  onSessionSaved,
}: PawRunnerGameProps) {
  const { firebaseUser } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [phase, setPhase] = useState<'ready' | 'playing' | 'paused' | 'gameover'>('ready');
  const [soundOn, setSoundOn] = useState(true);
  const [score, setScore] = useState(0);
  const [localBest, setLocalBest] = useState(() => {
    const stored = Number(localStorage.getItem('pawcare_runner_best') || '0');
    return Math.max(bestScore, Number.isFinite(stored) ? stored : 0);
  });
  const [pointsAwarded, setPointsAwarded] = useState<number | null>(null);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    setLocalBest((prev) => Math.max(prev, bestScore));
  }, [bestScore]);

  const stateRef = useRef({
    phase: 'ready' as 'ready' | 'playing' | 'paused' | 'gameover',
    soundOn: true,
    pupY: GROUND_Y - 46,
    pupVy: 0,
    jumpsUsed: 0,
    runTick: 0,
    scrollX: 0,
    speed: 310,
    score: 0,
    bonusScore: 0,
    elapsedSec: 0,
    obstacles: [] as Obstacle[],
    collectibles: [] as Collectible[],
    spawnTimer: 1.1,
    coinTimer: 0.7,
    touchStartY: 0,
    submitted: false,
  });

  useEffect(() => {
    stateRef.current.soundOn = soundOn;
  }, [soundOn]);

  useEffect(() => {
    stateRef.current.phase = phase;
  }, [phase]);

  const saveScore = useCallback(
    async (finalScore: number, durationSec: number) => {
      const nextBest = Math.max(localBest, finalScore);
      setLocalBest(nextBest);
      localStorage.setItem('pawcare_runner_best', String(nextBest));

      if (!firebaseUser || !firebaseUser.emailVerified) return;
      try {
        const res = await recordValidatedGameSession({
          uid: firebaseUser.uid,
          gameId: 'paw_runner',
          score: finalScore,
          durationSec: Math.max(3, Math.round(durationSec)),
          difficulty: 'standard',
          won: finalScore >= 120,
        });
        setPointsAwarded(res.pointsAwarded);
        onSessionSaved?.(res.pointsAwarded);
      } catch (err: unknown) {
        setSaveError(err instanceof Error ? err.message : 'Unable to save session points.');
      }
    },
    [firebaseUser, localBest, onSessionSaved]
  );

  const resetAndStart = useCallback(() => {
    const s = stateRef.current;
    s.pupY = GROUND_Y - 46;
    s.pupVy = 0;
    s.jumpsUsed = 0;
    s.runTick = 0;
    s.scrollX = 0;
    s.speed = 310;
    s.score = 0;
    s.bonusScore = 0;
    s.elapsedSec = 0;
    s.obstacles = [];
    s.collectibles = [];
    s.spawnTimer = 1.0;
    s.coinTimer = 0.5;
    s.submitted = false;
    setScore(0);
    setPointsAwarded(null);
    setSaveError('');
    setPhase('playing');
    soundFx.click(s.soundOn);
  }, []);

  const triggerJump = useCallback(() => {
    const s = stateRef.current;
    if (s.phase === 'ready') {
      resetAndStart();
      return;
    }
    if (s.phase !== 'playing') return;
    if (s.jumpsUsed < 2) {
      s.pupVy = s.jumpsUsed === 0 ? -575 : -510;
      s.jumpsUsed += 1;
      soundFx.jump(s.soundOn);
    }
  }, [resetAndStart]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        if (stateRef.current.phase === 'playing' || stateRef.current.phase === 'ready') {
          e.preventDefault();
          triggerJump();
        }
      } else if (e.code === 'KeyP' || e.code === 'Escape') {
        if (stateRef.current.phase === 'playing') setPhase('paused');
        else if (stateRef.current.phase === 'paused') setPhase('playing');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [triggerJump]);

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

    const drawPuppy = (x: number, y: number, tick: number, airborne: boolean) => {
      ctx.save();
      ctx.translate(x, y);

      const legSwing = airborne ? 0.35 : Math.sin(tick * 16) * 0.45;
      const earBob = airborne ? -4 : Math.sin(tick * 16) * 2.5;
      const tailWag = Math.sin(tick * 20) * 0.35;

      // Shadow
      const shadowScale = Math.max(0.45, 1 - (GROUND_Y - 46 - y) / 180);
      ctx.fillStyle = 'rgba(26, 34, 29, 0.14)';
      ctx.beginPath();
      ctx.ellipse(24, GROUND_Y - y + 4, 22 * shadowScale, 5 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();

      // Tail
      ctx.save();
      ctx.translate(4, 20);
      ctx.rotate(-0.6 + tailWag);
      ctx.fillStyle = '#D97724';
      ctx.beginPath();
      ctx.roundRect(-12, -4, 14, 7, 4);
      ctx.fill();
      ctx.restore();

      // Back legs
      ctx.fillStyle = '#B45309';
      ctx.save();
      ctx.translate(12, 34);
      ctx.rotate(-legSwing);
      ctx.fillRect(-3, 0, 7, 13);
      ctx.restore();

      ctx.save();
      ctx.translate(34, 34);
      ctx.rotate(legSwing);
      ctx.fillRect(-3, 0, 7, 13);
      ctx.restore();

      // Body
      ctx.fillStyle = '#E89B3C';
      ctx.beginPath();
      ctx.roundRect(4, 16, 38, 22, 11);
      ctx.fill();

      // Emerald PawCare collar
      ctx.fillStyle = '#1B4332';
      ctx.fillRect(32, 17, 7, 12);
      ctx.fillStyle = '#FBBF24';
      ctx.beginPath();
      ctx.arc(38, 29, 3, 0, Math.PI * 2);
      ctx.fill();

      // Front legs
      ctx.fillStyle = '#E89B3C';
      ctx.save();
      ctx.translate(14, 34);
      ctx.rotate(legSwing);
      ctx.fillRect(-3, 0, 7, 13);
      ctx.restore();

      ctx.save();
      ctx.translate(36, 34);
      ctx.rotate(-legSwing);
      ctx.fillRect(-3, 0, 7, 13);
      ctx.restore();

      // Head
      ctx.fillStyle = '#F3AE52';
      ctx.beginPath();
      ctx.arc(41, 14, 13, 0, Math.PI * 2);
      ctx.fill();

      // Snout
      ctx.fillStyle = '#FDE7C4';
      ctx.beginPath();
      ctx.ellipse(51, 16, 7, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Nose
      ctx.fillStyle = '#1A221D';
      ctx.beginPath();
      ctx.arc(56, 14, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Eye
      ctx.fillStyle = '#1A221D';
      ctx.beginPath();
      ctx.arc(44, 10, 2.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(44.8, 9.3, 0.8, 0, Math.PI * 2);
      ctx.fill();

      // Floppy ear
      ctx.fillStyle = '#B45309';
      ctx.beginPath();
      ctx.ellipse(34, 14 + earBob * 0.4, 5, 9, 0.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    const drawScene = () => {
      const s = stateRef.current;
      ctx.save();
      ctx.scale(dpr, dpr);

      // Sky gradient (warm Dehradun morning)
      const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
      sky.addColorStop(0, '#E9F5EE');
      sky.addColorStop(0.6, '#FAF8F4');
      sky.addColorStop(1, '#F5EFE2');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Soft sun
      ctx.fillStyle = '#FDE68A';
      ctx.beginPath();
      ctx.arc(640, 62, 26, 0, Math.PI * 2);
      ctx.fill();

      // Distant hills (parallax layer 1)
      ctx.fillStyle = '#D3E6D9';
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y);
      for (let x = 0; x <= CANVAS_W + 40; x += 40) {
        const y = 212 + Math.sin((x + s.scrollX * 0.15) * 0.012) * 20;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(CANVAS_W, GROUND_Y);
      ctx.closePath();
      ctx.fill();

      // Closer hills & trees (parallax layer 2)
      ctx.fillStyle = '#B7D7C2';
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y);
      for (let x = 0; x <= CANVAS_W + 40; x += 30) {
        const y = 240 + Math.cos((x + s.scrollX * 0.35) * 0.018) * 12;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(CANVAS_W, GROUND_Y);
      ctx.closePath();
      ctx.fill();

      // Clouds
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      for (let i = 0; i < 4; i++) {
        const cx = ((i * 230 - s.scrollX * 0.1) % (CANVAS_W + 120) + CANVAS_W + 120) % (CANVAS_W + 120) - 60;
        const cy = 48 + (i % 2) * 28;
        ctx.beginPath();
        ctx.arc(cx, cy, 16, 0, Math.PI * 2);
        ctx.arc(cx + 18, cy - 5, 20, 0, Math.PI * 2);
        ctx.arc(cx + 38, cy, 15, 0, Math.PI * 2);
        ctx.fill();
      }

      // Grass trail
      ctx.fillStyle = '#2D6A4F';
      ctx.fillRect(0, GROUND_Y, CANVAS_W, 10);
      ctx.fillStyle = '#1B4332';
      ctx.fillRect(0, GROUND_Y + 10, CANVAS_W, CANVAS_H - GROUND_Y - 10);

      // Trail grass blades
      ctx.fillStyle = '#52B788';
      for (let gx = -(s.scrollX % 48); gx < CANVAS_W; gx += 48) {
        ctx.fillRect(gx, GROUND_Y + 3, 18, 3);
      }

      // Collectibles
      for (const c of s.collectibles) {
        if (c.collected) continue;
        if (c.kind === 'coin') {
          ctx.fillStyle = '#F59E0B';
          ctx.beginPath();
          ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#FEF3C7';
          ctx.beginPath();
          ctx.arc(c.x, c.y, c.r * 0.55, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Dog bone biscuit
          ctx.fillStyle = '#D97706';
          ctx.beginPath();
          ctx.roundRect(c.x - 11, c.y - 4, 22, 8, 4);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(c.x - 10, c.y - 4, 4, 0, Math.PI * 2);
          ctx.arc(c.x - 10, c.y + 4, 4, 0, Math.PI * 2);
          ctx.arc(c.x + 10, c.y - 4, 4, 0, Math.PI * 2);
          ctx.arc(c.x + 10, c.y + 4, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Obstacles
      for (const ob of s.obstacles) {
        if (ob.kind === 'fence') {
          ctx.fillStyle = '#8B5A2B';
          ctx.fillRect(ob.x, GROUND_Y - ob.h, ob.w, ob.h);
          ctx.fillStyle = '#A47148';
          ctx.fillRect(ob.x - 3, GROUND_Y - ob.h + 8, ob.w + 6, 6);
          ctx.fillRect(ob.x - 3, GROUND_Y - ob.h + 22, ob.w + 6, 6);
        } else if (ob.kind === 'planter') {
          ctx.fillStyle = '#9A3412';
          ctx.beginPath();
          ctx.roundRect(ob.x, GROUND_Y - 24, ob.w, 24, 4);
          ctx.fill();
          ctx.fillStyle = '#15803D';
          ctx.beginPath();
          ctx.arc(ob.x + ob.w * 0.35, GROUND_Y - 28, 9, 0, Math.PI * 2);
          ctx.arc(ob.x + ob.w * 0.65, GROUND_Y - 28, 9, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Puddle
          ctx.fillStyle = '#38BDF8';
          ctx.beginPath();
          ctx.ellipse(ob.x + ob.w / 2, GROUND_Y + 3, ob.w / 2, 7, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      drawPuppy(86, s.pupY, s.runTick, s.pupY < GROUND_Y - 47);

      ctx.restore();
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      const s = stateRef.current;

      if (s.phase === 'playing') {
        s.elapsedSec += dt;
        s.runTick += dt;
        s.speed = Math.min(590, 310 + s.elapsedSec * 9);
        s.scrollX += s.speed * dt;

        // Physics
        s.pupVy += 1550 * dt;
        s.pupY += s.pupVy * dt;
        if (s.pupY >= GROUND_Y - 46) {
          s.pupY = GROUND_Y - 46;
          s.pupVy = 0;
          s.jumpsUsed = 0;
        }

        // Spawn obstacles
        s.spawnTimer -= dt;
        if (s.spawnTimer <= 0) {
          const kinds: Obstacle['kind'][] = ['fence', 'planter', 'puddle'];
          const kind = kinds[Math.floor(Math.random() * kinds.length)];
          const w = kind === 'puddle' ? 46 : kind === 'planter' ? 38 : 26;
          const h = kind === 'puddle' ? 14 : kind === 'planter' ? 34 : 38;
          s.obstacles.push({ x: CANVAS_W + 30, w, h, kind });
          s.spawnTimer = Math.max(0.85, 1.85 - s.elapsedSec * 0.02 + Math.random() * 0.65);
        }

        // Spawn collectibles
        s.coinTimer -= dt;
        if (s.coinTimer <= 0) {
          const isBiscuit = Math.random() > 0.65;
          s.collectibles.push({
            x: CANVAS_W + 30,
            y: GROUND_Y - (55 + Math.random() * 88),
            r: 11,
            kind: isBiscuit ? 'biscuit' : 'coin',
            collected: false,
          });
          s.coinTimer = 0.9 + Math.random() * 0.9;
        }

        // Move & check collisions
        const pupBox = { x: 96, y: s.pupY + 6, w: 42, h: 38 };

        for (const ob of s.obstacles) {
          ob.x -= s.speed * dt;
          const obY = ob.kind === 'puddle' ? GROUND_Y - 8 : GROUND_Y - ob.h + 4;
          const obH = ob.kind === 'puddle' ? 12 : ob.h - 4;
          if (
            pupBox.x < ob.x + ob.w - 4 &&
            pupBox.x + pupBox.w > ob.x + 4 &&
            pupBox.y < obY + obH &&
            pupBox.y + pupBox.h > obY
          ) {
            soundFx.hit(s.soundOn);
            s.phase = 'gameover';
            setPhase('gameover');
            const finalScore = Math.floor(s.elapsedSec * 12) + s.bonusScore;
            setScore(finalScore);
            if (!s.submitted) {
              s.submitted = true;
              void saveScore(finalScore, s.elapsedSec);
            }
            break;
          }
        }
        s.obstacles = s.obstacles.filter((o) => o.x + o.w > -40);

        for (const c of s.collectibles) {
          c.x -= s.speed * dt;
          if (!c.collected) {
            const dx = pupBox.x + pupBox.w / 2 - c.x;
            const dy = pupBox.y + pupBox.h / 2 - c.y;
            if (dx * dx + dy * dy < 32 * 32) {
              c.collected = true;
              s.bonusScore += c.kind === 'biscuit' ? 25 : 15;
              soundFx.coin(s.soundOn);
            }
          }
        }
        s.collectibles = s.collectibles.filter((c) => !c.collected && c.x > -30);

        const nextScore = Math.floor(s.elapsedSec * 12) + s.bonusScore;
        setScore(nextScore);
      }

      drawScene();
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [saveScore]);

  return (
    <div className="rounded-2xl border border-[#E6E2D8] bg-white p-4 sm:p-6 space-y-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-[#1A221D]">
            PawCare Pet Runner
          </h2>
          <p className="text-xs text-[#526057]">
            Tap, click, swipe up, or press Space / Up Arrow to jump (double-jump enabled!).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-[#FAF8F4] border border-[#E6E2D8] text-xs font-mono tabular-nums">
            Score: <strong className="text-[#1B4332]">{score}</strong>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-[#FAF8F4] border border-[#E6E2D8] text-xs font-mono tabular-nums inline-flex items-center gap-1">
            <Trophy className="w-3.5 h-3.5 text-[#D97706]" />
            Best: <strong>{localBest}</strong>
          </div>
          <button
            type="button"
            onClick={() => setSoundOn((v) => !v)}
            aria-label={soundOn ? 'Mute game sound' : 'Unmute game sound'}
            className="p-2 rounded-xl border border-[#E6E2D8] text-[#445249] hover:bg-[#FAF8F4] cursor-pointer"
          >
            {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          {(phase === 'playing' || phase === 'paused') && (
            <button
              type="button"
              onClick={() => setPhase(phase === 'playing' ? 'paused' : 'playing')}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-[#D4CFC4] text-xs font-semibold text-[#1A221D] cursor-pointer"
            >
              {phase === 'playing' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {phase === 'playing' ? 'Pause' : 'Resume'}
            </button>
          )}
          <button
            type="button"
            onClick={resetAndStart}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-[#1B4332] text-white text-xs font-semibold cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restart
          </button>
        </div>
      </div>

      <div className="relative rounded-2xl overflow-hidden border border-[#D4CFC4] bg-[#E9F5EE] select-none touch-none">
        <canvas
          ref={canvasRef}
          onPointerDown={(e) => {
            stateRef.current.touchStartY = e.clientY;
            triggerJump();
          }}
          onPointerMove={(e) => {
            if (
              stateRef.current.touchStartY &&
              stateRef.current.touchStartY - e.clientY > 28
            ) {
              stateRef.current.touchStartY = 0;
              triggerJump();
            }
          }}
          className="w-full h-auto block cursor-pointer"
          style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
        />

        {phase === 'ready' && (
          <div className="absolute inset-0 bg-[#1B4332]/25 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center">
            <div className="bg-white/95 border border-[#E6E2D8] rounded-2xl p-6 max-w-sm space-y-3 shadow-lg">
              <h3 className="font-display text-lg font-bold text-[#1A221D]">
                Ready for a Dehradun Trail Run?
              </h3>
              <p className="text-xs text-[#526057]">
                Collect golden paw coins (+15) and pet biscuits (+25) while leaping over garden fences, planters, and puddles.
              </p>
              <button
                type="button"
                onClick={resetAndStart}
                className="w-full py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-semibold hover:bg-[#143326] cursor-pointer"
              >
                Start Running
              </button>
            </div>
          </div>
        )}

        {phase === 'paused' && (
          <div className="absolute inset-0 bg-black/35 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 text-center space-y-3 shadow-xl">
              <div className="font-display text-lg font-bold text-[#1A221D]">Game Paused</div>
              <button
                type="button"
                onClick={() => setPhase('playing')}
                className="px-5 py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-semibold cursor-pointer"
              >
                Resume Run
              </button>
            </div>
          </div>
        )}

        {phase === 'gameover' && (
          <div className="absolute inset-0 bg-black/45 flex items-center justify-center p-4">
            <div className="bg-white border border-[#E6E2D8] rounded-2xl p-6 max-w-sm w-full text-center space-y-3 shadow-2xl">
              <div className="text-xs font-semibold text-[#2D6A4F]">Run Complete</div>
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
              {saveError && <p className="text-xs text-rose-700">{saveError}</p>}
              <button
                type="button"
                onClick={resetAndStart}
                className="w-full py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-semibold hover:bg-[#143326] cursor-pointer"
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
