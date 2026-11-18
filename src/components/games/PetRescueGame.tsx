import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Pause,
  Play,
  RotateCcw,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { recordValidatedGameSession } from '../../lib/firestoreService';
import { soundFx } from '../../lib/soundFx';

interface PetRescueGameProps {
  bestScore: number;
  onRequireAuth: () => void;
  onSessionSaved?: (pointsAwarded: number) => void;
}

interface GardenObstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'hedge' | 'pond' | 'fence';
}

interface PawToken {
  x: number;
  y: number;
  collected: boolean;
}

interface LostPet {
  id: number;
  x: number;
  y: number;
  kind: 'cat' | 'pup' | 'bunny';
  color: string;
  following: boolean;
  rescued: boolean;
}

interface LevelDef {
  id: number;
  name: string;
  timeSec: number;
  start: { x: number; y: number };
  house: { x: number; y: number; w: number; h: number };
  obstacles: GardenObstacle[];
  tokens: { x: number; y: number }[];
  pets: { x: number; y: number; kind: LostPet['kind']; color: string }[];
}

const CANVAS_W = 760;
const CANVAS_H = 420;
const TOP_SKY_H = 66;
const PLAYER_R = 16;

const LEVELS: LevelDef[] = [
  {
    id: 1,
    name: 'Rajpur Garden',
    timeSec: 45,
    start: { x: 96, y: 344 },
    house: { x: 42, y: 84, w: 86, h: 74 },
    obstacles: [
      { x: 210, y: 120, w: 38, h: 170, kind: 'hedge' },
      { x: 350, y: 210, w: 120, h: 66, kind: 'pond' },
      { x: 525, y: 95, w: 38, h: 155, kind: 'fence' },
      { x: 350, y: 95, w: 96, h: 36, kind: 'hedge' },
    ],
    tokens: [
      { x: 155, y: 165 },
      { x: 295, y: 155 },
      { x: 300, y: 335 },
      { x: 465, y: 150 },
      { x: 640, y: 260 },
    ],
    pets: [
      { x: 475, y: 355, kind: 'cat', color: '#F59E0B' },
      { x: 665, y: 130, kind: 'pup', color: '#D97706' },
    ],
  },
  {
    id: 2,
    name: 'Jakhan Park Trail',
    timeSec: 55,
    start: { x: 90, y: 350 },
    house: { x: 42, y: 84, w: 86, h: 74 },
    obstacles: [
      { x: 185, y: 92, w: 34, h: 195, kind: 'fence' },
      { x: 185, y: 332, w: 150, h: 36, kind: 'hedge' },
      { x: 335, y: 165, w: 118, h: 78, kind: 'pond' },
      { x: 495, y: 85, w: 34, h: 170, kind: 'hedge' },
      { x: 575, y: 265, w: 115, h: 38, kind: 'fence' },
    ],
    tokens: [
      { x: 145, y: 230 },
      { x: 270, y: 125 },
      { x: 275, y: 285 },
      { x: 420, y: 115 },
      { x: 455, y: 345 },
      { x: 615, y: 145 },
      { x: 685, y: 355 },
    ],
    pets: [
      { x: 270, y: 205, kind: 'bunny', color: '#E2E8F0' },
      { x: 650, y: 115, kind: 'cat', color: '#EA580C' },
      { x: 645, y: 355, kind: 'pup', color: '#B45309' },
    ],
  },
  {
    id: 3,
    name: 'Sahastradhara Meadow',
    timeSec: 65,
    start: { x: 88, y: 356 },
    house: { x: 42, y: 84, w: 86, h: 74 },
    obstacles: [
      { x: 175, y: 90, w: 32, h: 210, kind: 'hedge' },
      { x: 268, y: 190, w: 32, h: 190, kind: 'fence' },
      { x: 365, y: 95, w: 112, h: 72, kind: 'pond' },
      { x: 365, y: 245, w: 135, h: 36, kind: 'hedge' },
      { x: 550, y: 140, w: 34, h: 200, kind: 'fence' },
      { x: 635, y: 205, w: 84, h: 48, kind: 'pond' },
    ],
    tokens: [
      { x: 138, y: 245 },
      { x: 225, y: 135 },
      { x: 225, y: 360 },
      { x: 325, y: 135 },
      { x: 325, y: 320 },
      { x: 465, y: 205 },
      { x: 505, y: 360 },
      { x: 630, y: 125 },
      { x: 675, y: 355 },
    ],
    pets: [
      { x: 225, y: 240, kind: 'cat', color: '#F59E0B' },
      { x: 430, y: 350, kind: 'bunny', color: '#F1F5F9' },
      { x: 675, y: 120, kind: 'pup', color: '#D97706' },
      { x: 685, y: 315, kind: 'cat', color: '#9A3412' },
    ],
  },
];

function circleHitsRect(cx: number, cy: number, r: number, rect: GardenObstacle) {
  const nearestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const nearestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy < r * r;
}

export function PetRescueGame({
  bestScore,
  onRequireAuth,
  onSessionSaved,
}: PetRescueGameProps) {
  const { firebaseUser } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [phase, setPhase] = useState<'ready' | 'playing' | 'paused' | 'levelclear' | 'gameover'>(
    'ready'
  );
  const [selectedLevelIdx, setSelectedLevelIdx] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(LEVELS[0].timeSec);
  const [rescuedCount, setRescuedCount] = useState(0);
  const [totalPetsInLevel, setTotalPetsInLevel] = useState(LEVELS[0].pets.length);
  const [outcomeWon, setOutcomeWon] = useState(false);
  const [localBest, setLocalBest] = useState(() => {
    const stored = Number(localStorage.getItem('pawcare_rescue_best') || '0');
    return Math.max(bestScore, Number.isFinite(stored) ? stored : 0);
  });
  const [pointsAwarded, setPointsAwarded] = useState<number | null>(null);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    setLocalBest((prev) => Math.max(prev, bestScore));
  }, [bestScore]);

  const inputRef = useRef({
    up: false,
    down: false,
    left: false,
    right: false,
  });

  const stateRef = useRef({
    phase: 'ready' as 'ready' | 'playing' | 'paused' | 'levelclear' | 'gameover',
    soundOn: true,
    levelIdx: 0,
    playerX: LEVELS[0].start.x,
    playerY: LEVELS[0].start.y,
    facing: 1,
    trail: [] as { x: number; y: number }[],
    tokens: [] as PawToken[],
    pets: [] as LostPet[],
    score: 0,
    timeLeft: LEVELS[0].timeSec,
    totalElapsedSec: 0,
    tick: 0,
    submitted: false,
  });

  useEffect(() => {
    stateRef.current.soundOn = soundOn;
  }, [soundOn]);

  useEffect(() => {
    stateRef.current.phase = phase;
  }, [phase]);

  const submitSession = useCallback(
    async (finalScore: number, durationSec: number, won: boolean, levelNumber: number) => {
      const nextBest = Math.max(localBest, finalScore);
      setLocalBest(nextBest);
      localStorage.setItem('pawcare_rescue_best', String(nextBest));

      if (!firebaseUser || !firebaseUser.emailVerified) return;
      try {
        const res = await recordValidatedGameSession({
          uid: firebaseUser.uid,
          gameId: 'pet_rescue',
          score: finalScore,
          durationSec: Math.max(3, Math.round(durationSec)),
          difficulty: `level_${levelNumber}`,
          won,
        });
        setPointsAwarded(res.pointsAwarded);
        onSessionSaved?.(res.pointsAwarded);
      } catch (err: unknown) {
        setSaveError(err instanceof Error ? err.message : 'Unable to save session points.');
      }
    },
    [firebaseUser, localBest, onSessionSaved]
  );

  const loadLevel = useCallback((idx: number, preserveScore: boolean) => {
    const level = LEVELS[idx] || LEVELS[0];
    const s = stateRef.current;
    s.levelIdx = idx;
    s.playerX = level.start.x;
    s.playerY = level.start.y;
    s.facing = 1;
    s.trail = Array.from({ length: 48 }, () => ({ x: level.start.x, y: level.start.y }));
    s.tokens = level.tokens.map((t) => ({ x: t.x, y: t.y, collected: false }));
    s.pets = level.pets.map((p, i) => ({
      id: i,
      x: p.x,
      y: p.y,
      kind: p.kind,
      color: p.color,
      following: false,
      rescued: false,
    }));
    if (!preserveScore) {
      s.score = 0;
      s.totalElapsedSec = 0;
      s.submitted = false;
      setScore(0);
      setPointsAwarded(null);
      setSaveError('');
    }
    s.timeLeft = level.timeSec;
    setSelectedLevelIdx(idx);
    setTimeLeft(level.timeSec);
    setRescuedCount(0);
    setTotalPetsInLevel(level.pets.length);
    setOutcomeWon(false);
    setPhase('playing');
    soundFx.click(s.soundOn);
  }, []);

  const startFresh = useCallback(
    (levelIdx = selectedLevelIdx) => {
      loadLevel(levelIdx, false);
    },
    [loadLevel, selectedLevelIdx]
  );

  // Keyboard movement + pause
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(
          code
        )
      ) {
        if (stateRef.current.phase === 'playing') {
          e.preventDefault();
        }
      }
      if (code === 'ArrowUp' || code === 'KeyW') inputRef.current.up = true;
      if (code === 'ArrowDown' || code === 'KeyS') inputRef.current.down = true;
      if (code === 'ArrowLeft' || code === 'KeyA') inputRef.current.left = true;
      if (code === 'ArrowRight' || code === 'KeyD') inputRef.current.right = true;
      if (code === 'KeyP' || code === 'Escape') {
        if (stateRef.current.phase === 'playing') setPhase('paused');
        else if (stateRef.current.phase === 'paused') setPhase('playing');
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === 'ArrowUp' || code === 'KeyW') inputRef.current.up = false;
      if (code === 'ArrowDown' || code === 'KeyS') inputRef.current.down = false;
      if (code === 'ArrowLeft' || code === 'KeyA') inputRef.current.left = false;
      if (code === 'ArrowRight' || code === 'KeyD') inputRef.current.right = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
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

    const drawGardenAnimal = (
      x: number,
      y: number,
      kind: 'player' | LostPet['kind'],
      color: string,
      tick: number,
      showHelp: boolean,
      facing = 1
    ) => {
      ctx.save();
      ctx.translate(x, y);
      const bob = Math.sin(tick * 6 + x * 0.05) * 1.8;

      // Ground shadow
      ctx.fillStyle = 'rgba(26, 34, 29, 0.16)';
      ctx.beginPath();
      ctx.ellipse(0, 14, 13, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.translate(0, bob);
      if (facing < 0) ctx.scale(-1, 1);

      if (kind === 'player') {
        // Rescuer pup with emerald bandana
        ctx.fillStyle = '#E89B3C';
        ctx.beginPath();
        ctx.arc(0, 2, 13, 0, Math.PI * 2);
        ctx.fill();
        // Ears
        ctx.fillStyle = '#9A3412';
        ctx.beginPath();
        ctx.ellipse(-10, -2, 4, 8, 0.25, 0, Math.PI * 2);
        ctx.ellipse(10, -2, 4, 8, -0.25, 0, Math.PI * 2);
        ctx.fill();
        // Collar
        ctx.fillStyle = '#1B4332';
        ctx.fillRect(-9, 10, 18, 4);
        // Snout & eyes
        ctx.fillStyle = '#FDE7C4';
        ctx.beginPath();
        ctx.ellipse(2, 5, 6, 4.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1A221D';
        ctx.beginPath();
        ctx.arc(4, 3.5, 2, 0, Math.PI * 2);
        ctx.arc(-3.5, -2.5, 1.9, 0, Math.PI * 2);
        ctx.arc(4.5, -2.5, 1.9, 0, Math.PI * 2);
        ctx.fill();
      } else if (kind === 'cat') {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 2, 10.5, 0, Math.PI * 2);
        ctx.fill();
        // Pointed cat ears
        ctx.beginPath();
        ctx.moveTo(-9, -4);
        ctx.lineTo(-11, -14);
        ctx.lineTo(-2, -7);
        ctx.moveTo(9, -4);
        ctx.lineTo(11, -14);
        ctx.lineTo(2, -7);
        ctx.fill();
        ctx.fillStyle = '#1A221D';
        ctx.beginPath();
        ctx.arc(-3.5, 0, 1.6, 0, Math.PI * 2);
        ctx.arc(3.5, 0, 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FB7185';
        ctx.beginPath();
        ctx.arc(0, 3, 1.6, 0, Math.PI * 2);
        ctx.fill();
      } else if (kind === 'bunny') {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(-4, -12, 3, 8, -0.1, 0, Math.PI * 2);
        ctx.ellipse(4, -12, 3, 8, 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 2, 10.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#F9A8D4';
        ctx.beginPath();
        ctx.ellipse(-4, -12, 1.4, 5, -0.1, 0, Math.PI * 2);
        ctx.ellipse(4, -12, 1.4, 5, 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1A221D';
        ctx.beginPath();
        ctx.arc(-3.5, 0, 1.6, 0, Math.PI * 2);
        ctx.arc(3.5, 0, 1.6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 2, 10.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#78350F';
        ctx.beginPath();
        ctx.ellipse(-9, 1, 3.2, 6.5, 0.2, 0, Math.PI * 2);
        ctx.ellipse(9, 1, 3.2, 6.5, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1A221D';
        ctx.beginPath();
        ctx.arc(-3.2, 0, 1.6, 0, Math.PI * 2);
        ctx.arc(3.2, 0, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }

      if (facing < 0) ctx.scale(-1, 1);

      if (showHelp) {
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.roundRect(-18, -32, 36, 15, 6);
        ctx.fill();
        ctx.strokeStyle = '#1B4332';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#1B4332';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('HELP!', 0, -21);
      }

      ctx.restore();
    };

    const drawScene = () => {
      const s = stateRef.current;
      const level = LEVELS[s.levelIdx] || LEVELS[0];
      ctx.save();
      ctx.scale(dpr, dpr);

      // Top sky horizon strip with drifting clouds & sun
      const sky = ctx.createLinearGradient(0, 0, 0, TOP_SKY_H);
      sky.addColorStop(0, '#DCEFE3');
      sky.addColorStop(1, '#F1F8F3');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, CANVAS_W, TOP_SKY_H);

      ctx.fillStyle = '#FDE68A';
      ctx.beginPath();
      ctx.arc(680, 32, 18, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (let i = 0; i < 4; i++) {
        const cx = ((i * 210 + s.tick * 12) % (CANVAS_W + 90)) - 45;
        const cy = 24 + (i % 2) * 14;
        ctx.beginPath();
        ctx.arc(cx, cy, 11, 0, Math.PI * 2);
        ctx.arc(cx + 13, cy - 4, 14, 0, Math.PI * 2);
        ctx.arc(cx + 27, cy, 10, 0, Math.PI * 2);
        ctx.fill();
      }

      // Lush Dehradun garden turf
      ctx.fillStyle = '#CFE6D4';
      ctx.fillRect(0, TOP_SKY_H, CANVAS_W, CANVAS_H - TOP_SKY_H);

      // Subtle garden path stripes and flowers
      ctx.fillStyle = '#C0DCC7';
      for (let row = 0; row < 5; row++) {
        ctx.fillRect(0, TOP_SKY_H + row * 72, CANVAS_W, 34);
      }

      const flowerCoords = [
        [140, 115],
        [310, 385],
        [490, 295],
        [710, 115],
        [595, 380],
        [155, 375],
      ];
      for (const [fx, fy] of flowerCoords) {
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(fx, fy, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FBBF24';
        ctx.beginPath();
        ctx.arc(fx, fy, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // PawCare Rescue House Safe Zone
      const h = level.house;
      const pulse = 0.25 + Math.sin(s.tick * 4) * 0.1;
      ctx.fillStyle = `rgba(27, 67, 50, ${pulse})`;
      ctx.beginPath();
      ctx.roundRect(h.x - 6, h.y - 6, h.w + 12, h.h + 12, 16);
      ctx.fill();

      // House base & roof
      ctx.fillStyle = '#FAF8F4';
      ctx.beginPath();
      ctx.roundRect(h.x + 8, h.y + 24, h.w - 16, h.h - 26, 8);
      ctx.fill();
      ctx.fillStyle = '#1B4332';
      ctx.beginPath();
      ctx.moveTo(h.x + 2, h.y + 28);
      ctx.lineTo(h.x + h.w / 2, h.y + 2);
      ctx.lineTo(h.x + h.w - 2, h.y + 28);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#E07A2B';
      ctx.beginPath();
      ctx.roundRect(h.x + h.w / 2 - 10, h.y + 40, 20, 30, 4);
      ctx.fill();
      ctx.fillStyle = '#1B4332';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('RESCUE', h.x + h.w / 2, h.y + 84);

      // Obstacles
      for (const ob of level.obstacles) {
        if (ob.kind === 'hedge') {
          ctx.fillStyle = '#1B4332';
          ctx.beginPath();
          ctx.roundRect(ob.x, ob.y, ob.w, ob.h, 12);
          ctx.fill();
          ctx.fillStyle = '#2D6A4F';
          ctx.beginPath();
          ctx.roundRect(ob.x + 4, ob.y + 4, ob.w - 8, ob.h - 10, 8);
          ctx.fill();
        } else if (ob.kind === 'pond') {
          ctx.fillStyle = '#7DD3FC';
          ctx.beginPath();
          ctx.roundRect(ob.x, ob.y, ob.w, ob.h, 24);
          ctx.fill();
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          ctx.fillStyle = '#8B5A2B';
          ctx.beginPath();
          ctx.roundRect(ob.x, ob.y, ob.w, ob.h, 6);
          ctx.fill();
          ctx.fillStyle = '#B07D4F';
          ctx.fillRect(ob.x + 3, ob.y + 6, ob.w - 6, 5);
          ctx.fillRect(ob.x + 3, ob.y + ob.h - 11, ob.w - 6, 5);
        }
      }

      // Golden paw collectibles
      for (const t of s.tokens) {
        if (t.collected) continue;
        const glow = Math.sin(s.tick * 5 + t.x) * 1.5;
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(t.x, t.y + glow, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FEF3C7';
        ctx.beginPath();
        ctx.arc(t.x, t.y + glow, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Lost & following pets
      for (const p of s.pets) {
        if (p.rescued) continue;
        drawGardenAnimal(p.x, p.y, p.kind, p.color, s.tick, !p.following, 1);
      }

      // Player rescuer pup
      drawGardenAnimal(s.playerX, s.playerY, 'player', '#E89B3C', s.tick, false, s.facing);

      ctx.restore();
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      const s = stateRef.current;
      s.tick += dt;

      if (s.phase === 'playing') {
        const level = LEVELS[s.levelIdx] || LEVELS[0];
        s.totalElapsedSec += dt;
        s.timeLeft = Math.max(0, s.timeLeft - dt);
        setTimeLeft(Math.ceil(s.timeLeft));

        // Player movement vector
        let vx = 0;
        let vy = 0;
        if (inputRef.current.left) vx -= 1;
        if (inputRef.current.right) vx += 1;
        if (inputRef.current.up) vy -= 1;
        if (inputRef.current.down) vy += 1;

        if (vx !== 0 || vy !== 0) {
          const len = Math.hypot(vx, vy);
          const speed = 205;
          const dx = (vx / len) * speed * dt;
          const dy = (vy / len) * speed * dt;
          if (vx < 0) s.facing = -1;
          else if (vx > 0) s.facing = 1;

          // Axis-separated movement with obstacle + wall clamping
          const tryX = Math.max(
            PLAYER_R + 8,
            Math.min(CANVAS_W - PLAYER_R - 8, s.playerX + dx)
          );
          if (!level.obstacles.some((ob) => circleHitsRect(tryX, s.playerY, PLAYER_R, ob))) {
            s.playerX = tryX;
          }

          const tryY = Math.max(
            TOP_SKY_H + PLAYER_R + 6,
            Math.min(CANVAS_H - PLAYER_R - 8, s.playerY + dy)
          );
          if (!level.obstacles.some((ob) => circleHitsRect(s.playerX, tryY, PLAYER_R, ob))) {
            s.playerY = tryY;
          }

          s.trail.unshift({ x: s.playerX, y: s.playerY });
          if (s.trail.length > 60) s.trail.pop();
        }

        // Collect paw tokens
        for (const t of s.tokens) {
          if (!t.collected && Math.hypot(s.playerX - t.x, s.playerY - t.y) < PLAYER_R + 11) {
            t.collected = true;
            s.score += 15;
            setScore(s.score);
            soundFx.coin(s.soundOn);
          }
        }

        // Pick up lost pets + update follower positions + check Rescue House delivery
        let followSlot = 0;
        let rescuedInLevel = 0;
        for (const p of s.pets) {
          if (p.rescued) {
            rescuedInLevel += 1;
            continue;
          }
          if (!p.following && Math.hypot(s.playerX - p.x, s.playerY - p.y) < PLAYER_R + 15) {
            p.following = true;
            s.score += 20;
            setScore(s.score);
            soundFx.coin(s.soundOn);
          }
          if (p.following) {
            followSlot += 1;
            const trailIdx = Math.min(s.trail.length - 1, followSlot * 12);
            const target = s.trail[trailIdx] || { x: s.playerX, y: s.playerY };
            p.x += (target.x - p.x) * Math.min(1, dt * 10);
            p.y += (target.y - p.y) * Math.min(1, dt * 10);

            const h = level.house;
            if (
              s.playerX > h.x - 10 &&
              s.playerX < h.x + h.w + 10 &&
              s.playerY > h.y - 10 &&
              s.playerY < h.y + h.h + 10
            ) {
              p.rescued = true;
              p.following = false;
              rescuedInLevel += 1;
              s.score += 50;
              setScore(s.score);
              setRescuedCount(rescuedInLevel);
              soundFx.victory(s.soundOn);
            }
          }
        }

        // Level completed!
        if (rescuedInLevel === s.pets.length) {
          const timeBonus = Math.ceil(s.timeLeft) * 3;
          s.score += timeBonus;
          setScore(s.score);

          if (s.levelIdx < LEVELS.length - 1) {
            s.phase = 'levelclear';
            setPhase('levelclear');
          } else {
            s.phase = 'gameover';
            setOutcomeWon(true);
            setPhase('gameover');
            if (!s.submitted) {
              s.submitted = true;
              void submitSession(s.score, s.totalElapsedSec, true, level.id);
            }
          }
        } else if (s.timeLeft <= 0) {
          soundFx.hit(s.soundOn);
          s.phase = 'gameover';
          setOutcomeWon(false);
          setPhase('gameover');
          if (!s.submitted) {
            s.submitted = true;
            void submitSession(s.score, s.totalElapsedSec, false, level.id);
          }
        }
      }

      drawScene();
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [submitSession]);

  const setDir = (dir: keyof typeof inputRef.current, active: boolean) => {
    inputRef.current[dir] = active;
  };

  const currentLevel = LEVELS[selectedLevelIdx] || LEVELS[0];

  return (
    <div className="rounded-2xl border border-[#E6E2D8] bg-white p-4 sm:p-6 space-y-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-[#1A221D]">
            PawCare Pet Rescue Adventure
          </h2>
          <p className="text-xs text-[#526057]">
            Explore the Dehradun garden, find lost pets, and guide them safely to the PawCare Rescue House before time runs out!
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-[#FAF8F4] border border-[#E6E2D8] text-xs font-mono tabular-nums">
            Level: <strong className="text-[#1B4332]">{currentLevel.id}/3</strong>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-[#FAF8F4] border border-[#E6E2D8] text-xs font-mono tabular-nums">
            Rescued:{' '}
            <strong className="text-[#1B4332]">
              {rescuedCount}/{totalPetsInLevel}
            </strong>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-[#FAF8F4] border border-[#E6E2D8] text-xs font-mono tabular-nums">
            Time: <strong className={timeLeft <= 10 ? 'text-rose-700' : 'text-[#1B4332]'}>{timeLeft}s</strong>
          </div>
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
            onClick={() => startFresh(0)}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-[#1B4332] text-white text-xs font-semibold cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restart
          </button>
        </div>
      </div>

      {/* Game Stage */}
      <div className="relative rounded-2xl overflow-hidden border border-[#D4CFC4] bg-[#CFE6D4] select-none touch-none">
        <canvas
          ref={canvasRef}
          className="w-full h-auto block"
          style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
        />

        {phase === 'ready' && (
          <div className="absolute inset-0 bg-[#1B4332]/30 backdrop-blur-[2px] flex items-center justify-center p-4">
            <div className="bg-white/95 border border-[#E6E2D8] rounded-2xl p-5 sm:p-6 max-w-md w-full space-y-4 text-center shadow-xl">
              <h3 className="font-display text-lg font-bold text-[#1A221D]">
                Choose a Garden Level
              </h3>
              <p className="text-xs text-[#526057] leading-relaxed">
                Move with Arrow Keys / WASD (or the mobile D-pad below). Touch lost pets marked HELP! and bring them back to the PawCare Rescue House.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {LEVELS.map((lvl, idx) => (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => setSelectedLevelIdx(idx)}
                    className={`p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                      selectedLevelIdx === idx
                        ? 'bg-[#1B4332] text-white border-[#1B4332]'
                        : 'bg-[#FAF8F4] text-[#445249] border-[#D8D3C8] hover:bg-[#F1F6F2]'
                    }`}
                  >
                    <div>Level {lvl.id}</div>
                    <div className="text-[10px] font-normal opacity-85 truncate">{lvl.name}</div>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => startFresh(selectedLevelIdx)}
                className="w-full py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-semibold hover:bg-[#143326] cursor-pointer"
              >
                Start Rescue Mission
              </button>
            </div>
          </div>
        )}

        {phase === 'paused' && (
          <div className="absolute inset-0 bg-black/35 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 text-center space-y-3 shadow-xl">
              <div className="font-display text-lg font-bold text-[#1A221D]">Mission Paused</div>
              <button
                type="button"
                onClick={() => setPhase('playing')}
                className="px-5 py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-semibold cursor-pointer"
              >
                Resume Mission
              </button>
            </div>
          </div>
        )}

        {phase === 'levelclear' && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white border border-[#E6E2D8] rounded-2xl p-6 max-w-sm w-full text-center space-y-3 shadow-2xl">
              <div className="text-xs font-semibold text-[#2D6A4F]">
                {currentLevel.name} Cleared!
              </div>
              <div className="font-display text-2xl font-bold text-[#1A221D] font-mono tabular-nums">
                Score: {score}
              </div>
              <p className="text-xs text-[#526057]">
                All lost pets reached the Rescue House safely! Continue to Level {currentLevel.id + 1} for more rescue points.
              </p>
              <button
                type="button"
                onClick={() => loadLevel(selectedLevelIdx + 1, true)}
                className="w-full py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-semibold hover:bg-[#143326] cursor-pointer"
              >
                Next Garden Level →
              </button>
            </div>
          </div>
        )}

        {phase === 'gameover' && (
          <div className="absolute inset-0 bg-black/45 flex items-center justify-center p-4">
            <div className="bg-white border border-[#E6E2D8] rounded-2xl p-6 max-w-sm w-full text-center space-y-3 shadow-2xl">
              <div className="text-xs font-semibold text-[#2D6A4F]">
                {outcomeWon ? 'All Gardens Rescued!' : 'Time Up'}
              </div>
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
                onClick={() => startFresh(0)}
                className="w-full py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-semibold hover:bg-[#143326] cursor-pointer"
              >
                Play Again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Responsive Touch D-Pad + Desktop Hint */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
        <p className="text-xs text-[#526057]">
          Desktop: Arrow Keys or WASD to move · P to pause. Mobile: Hold directional buttons to steer.
        </p>

        <div className="grid grid-cols-3 gap-1.5 select-none touch-none" aria-label="Touch direction pad">
          <div />
          <button
            type="button"
            aria-label="Move up"
            onPointerDown={() => setDir('up', true)}
            onPointerUp={() => setDir('up', false)}
            onPointerLeave={() => setDir('up', false)}
            onPointerCancel={() => setDir('up', false)}
            className="w-11 h-11 rounded-xl border border-[#D4CFC4] bg-[#FAF8F4] active:bg-[#1B4332] active:text-white flex items-center justify-center cursor-pointer"
          >
            <ArrowUp className="w-5 h-5" />
          </button>
          <div />
          <button
            type="button"
            aria-label="Move left"
            onPointerDown={() => setDir('left', true)}
            onPointerUp={() => setDir('left', false)}
            onPointerLeave={() => setDir('left', false)}
            onPointerCancel={() => setDir('left', false)}
            className="w-11 h-11 rounded-xl border border-[#D4CFC4] bg-[#FAF8F4] active:bg-[#1B4332] active:text-white flex items-center justify-center cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            aria-label="Move down"
            onPointerDown={() => setDir('down', true)}
            onPointerUp={() => setDir('down', false)}
            onPointerLeave={() => setDir('down', false)}
            onPointerCancel={() => setDir('down', false)}
            className="w-11 h-11 rounded-xl border border-[#D4CFC4] bg-[#FAF8F4] active:bg-[#1B4332] active:text-white flex items-center justify-center cursor-pointer"
          >
            <ArrowDown className="w-5 h-5" />
          </button>
          <button
            type="button"
            aria-label="Move right"
            onPointerDown={() => setDir('right', true)}
            onPointerUp={() => setDir('right', false)}
            onPointerLeave={() => setDir('right', false)}
            onPointerCancel={() => setDir('right', false)}
            className="w-11 h-11 rounded-xl border border-[#D4CFC4] bg-[#FAF8F4] active:bg-[#1B4332] active:text-white flex items-center justify-center cursor-pointer"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
