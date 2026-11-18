import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

interface ChatHistoryTurn {
  role: 'user' | 'model';
  text: string;
}

interface ServiceSummaryContext {
  name: string;
  durationLabel: string;
  customerPriceInr: number;
  active: boolean;
}

interface AssistantRequestBody {
  message?: string;
  history?: ChatHistoryTurn[];
  userRole?: string;
  services?: ServiceSummaryContext[];
}

const SYSTEM_INSTRUCTION = `You are PawCare Smart Help, the official AI assistant for PawCare — a pet-care booking platform launching in Dehradun, Uttarakhand, India.

CORE SERVICES & PLATFORM KNOWLEDGE:
- PawCare offers 4 initial everyday care services: Pet Sitting, Pet Feeding, Dog Walking, and Basic Pet Care.
- Customers can sign in (with Google or email/password), add pet profiles under "My Pets" (with feeding, behavior, and care instructions), submit booking requests, track live booking statuses (Pending, Accepted, Rejected, Confirmed, In Progress, Completed, Cancelled), and message PawCare Support directly.
- Aspiring caregivers can apply via "Become a Caregiver". Applications go through admin verification (Application Submitted, Under Review, Approved, Rejected, Suspended) before caregivers appear as verified or receive bookings.
- Booking prices are set by PawCare admins and displayed transparently before submission. Do NOT invent prices, caregiver availability, or neighborhood promises beyond what is explicitly provided in the live catalog context below.

STRICT SAFETY & COMPLIANCE RULES (NON-NEGOTIABLE):
1. NEVER diagnose animal illnesses, interpret medical symptoms, or recommend/prescribe medications or dosages.
2. If a user describes an animal emergency, injury, poisoning, breathing difficulty, seizures, collapse, or signs of serious illness, immediately advise them to contact a qualified veterinarian or local emergency veterinary clinic right away. PawCare does NOT provide veterinary or emergency medical services.
3. NEVER claim a booking is confirmed, accepted, or assigned unless the user's live booking record in the platform explicitly shows that status.
4. NEVER fabricate caregiver availability, unverified ratings, fake testimonials, or private customer/caregiver details.
5. You cannot approve caregivers, modify bookings, or access private user records. Direct users to "Message PawCare Support" for account-specific changes, cancellations, or human assistance.
6. Keep responses warm, concise, practical, and structured in plain readable paragraphs or short bullet points.`;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface GameValidateBody {
  gameId?: string;
  score?: number;
  durationSec?: number;
  difficulty?: string;
  won?: boolean;
  gamesPlayedSoFar?: number;
  streakDaysSoFar?: number;
  existingAchievements?: string[];
}

const VALID_GAME_IDS = new Set(['paw_runner', 'paw_memory', 'treat_catcher', 'pet_rescue']);

function evaluateGameSession(body: GameValidateBody) {
  const gameId = typeof body.gameId === 'string' ? body.gameId : '';
  if (!VALID_GAME_IDS.has(gameId)) {
    return { ok: false as const, error: 'Unsupported game identifier.' };
  }

  const rawScore = Number(body.score);
  const rawDuration = Number(body.durationSec);
  const won = Boolean(body.won);
  const difficulty =
    typeof body.difficulty === 'string' ? body.difficulty.slice(0, 32) : 'standard';

  if (!Number.isFinite(rawScore) || rawScore < 0 || rawScore > 50000) {
    return { ok: false as const, error: 'Invalid score value.' };
  }
  if (!Number.isFinite(rawDuration) || rawDuration < 3 || rawDuration > 3600) {
    return { ok: false as const, error: 'Session duration out of valid range.' };
  }

  const score = Math.round(rawScore);
  const durationSec = Math.round(rawDuration);

  // Plausibility guard against impossible burst scores
  const maxReasonableScore =
    gameId === 'paw_memory' ? 3000 : Math.max(500, durationSec * 55);
  if (score > maxReasonableScore) {
    return { ok: false as const, error: 'Score exceeded plausible play rate.' };
  }

  let pointsAwarded = 10;
  if (gameId === 'paw_runner') {
    pointsAwarded = Math.min(150, Math.max(10, Math.round(score / 8) + (won ? 20 : 0)));
  } else if (gameId === 'paw_memory') {
    const diffBonus = difficulty === 'hard' ? 35 : difficulty === 'medium' ? 20 : 10;
    pointsAwarded = won
      ? Math.min(150, Math.max(20, Math.round(score / 12) + diffBonus))
      : 10;
  } else if (gameId === 'treat_catcher') {
    pointsAwarded = Math.min(150, Math.max(10, Math.round(score / 6) + (won ? 15 : 0)));
  } else if (gameId === 'pet_rescue') {
    pointsAwarded = Math.min(150, Math.max(15, Math.round(score / 8) + (won ? 25 : 0)));
  }

  const prevAch = Array.isArray(body.existingAchievements)
    ? body.existingAchievements.filter((a) => typeof a === 'string')
    : [];
  const nextAch = new Set(prevAch);
  const gamesPlayedAfter = Math.max(0, Math.round(Number(body.gamesPlayedSoFar) || 0)) + 1;
  const streakAfter = Math.max(1, Math.round(Number(body.streakDaysSoFar) || 1));

  if (gameId === 'paw_runner' && score >= 120) nextAch.add('first_runner_win');
  if (gameId === 'paw_memory' && won) nextAch.add('memory_master');
  if (gameId === 'treat_catcher' && score >= 150) nextAch.add('treat_catcher_champ');
  if (gameId === 'pet_rescue' && (won || score >= 150)) nextAch.add('rescue_hero');
  if (gamesPlayedAfter >= 5) nextAch.add('five_games_played');
  if (streakAfter >= 3) nextAch.add('three_day_streak');
  if (streakAfter >= 7) nextAch.add('weekly_streak');

  return {
    ok: true as const,
    gameId,
    score,
    durationSec,
    difficulty,
    won,
    pointsAwarded,
    achievements: Array.from(nextAch).slice(0, 20),
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    const aiConfigured = Boolean(
      process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
    );
    res.json({ ok: true, aiConfigured });
  });

  app.post('/api/games/validate-session', (req, res) => {
    const result = evaluateGameSession((req.body ?? {}) as GameValidateBody);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result);
  });

  app.post('/api/ai/assistant', async (req, res) => {
    const body = (req.body ?? {}) as AssistantRequestBody;
    const message = typeof body.message === 'string' ? body.message.trim() : '';

    if (!message || message.length > 1500) {
      res.status(400).json({
        error: 'Please enter a question between 1 and 1500 characters.',
      });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        code: 'AI_NOT_CONFIGURED',
        error:
          'PawCare AI is not configured yet because GEMINI_API_KEY is missing. Please configure GEMINI_API_KEY in Settings > Secrets or use Message PawCare Support to reach our team directly.',
      });
      return;
    }

    const activeServices = Array.isArray(body.services)
      ? body.services
          .filter((s) => s && typeof s.name === 'string' && s.active)
          .slice(0, 12)
          .map(
            (s) =>
              `- ${s.name} (${s.durationLabel}): ₹${Number(s.customerPriceInr).toLocaleString('en-IN')}`
          )
          .join('\n')
      : '';

    const contextNote = activeServices
      ? `\n\nLIVE ACTIVE SERVICE CATALOG (use only these confirmed offerings and prices):\n${activeServices}`
      : '\n\nLIVE ACTIVE SERVICE CATALOG: Refer users to the Services & Booking flow on the platform for current live tariffs.';

    const roleNote =
      typeof body.userRole === 'string' && body.userRole
        ? `\nCURRENT USER VIEW ROLE: ${body.userRole}`
        : '';

    const historyTurns = Array.isArray(body.history)
      ? body.history
          .slice(-8)
          .filter(
            (turn) =>
              turn &&
              (turn.role === 'user' || turn.role === 'model') &&
              typeof turn.text === 'string' &&
              turn.text.trim().length > 0
          )
          .map((turn) => ({
            role: turn.role,
            parts: [{ text: turn.text.slice(0, 1500) }],
          }))
      : [];

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: [
          ...historyTurns,
          {
            role: 'user',
            parts: [{ text: message }],
          },
        ],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION + contextNote + roleNote,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        },
      });

      const reply = response.text?.trim();
      if (!reply) {
        res.status(502).json({
          error: 'PawCare AI could not generate a response. Please try again or message PawCare Support.',
        });
        return;
      }

      res.json({ reply });
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : String(err);
      console.error('Gemini Assistant Error:', errMessage);
      res.status(500).json({
        error:
          'Unable to reach PawCare AI right now. Please try again shortly or use Message PawCare Support.',
      });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PawCare server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start PawCare server:', err);
  process.exit(1);
});
