# PawCare — Trusted Pet Care Platform

**Trusted Care for Your Beloved Pets** · Initial Launch Market: **Dehradun, Uttarakhand, India**

PawCare is a full-stack pet-care booking and community platform powered by **React + TypeScript + Vite + Tailwind CSS**, an **Express API server**, and **Firebase (Firestore, Authentication, Storage)**, featuring:

- **Customer Portal**: Pet profiles ("My Pets"), 8-step booking wizard, live status tracking (`Pending` → `Accepted` → `Confirmed` → `In Progress` → `Completed` / `Cancelled`), booking chat, notifications, and 10 interactive quick-access dashboard cards.
- **Caregiver Portal**: Multi-stage admin-gated verification (`Submitted` → `Under Review` → `Approved` / `Rejected` / `Suspended`), weekly availability slots + specific unavailable dates, and assigned booking coordination.
- **Admin Control Center**: Live KPI metrics with date-range filters (`All Time`, `7d`, `30d`), 7-day daily booking trend chart, service demand & cancellation analytics, booking assignment with conflict + blocked-date protection, service & private pricing/commission editor, customer management, support inbox, CSV export, website CMS, and audit trail.
- **PawCare Play Zone & Rewards**: Three playable mini-games (*PawCare Pet Runner*, *Paw Memory Match*, *Pet Treat Catcher*) with server-validated points (`POST /api/games/validate-session`) and Firestore-persisted achievements and daily streaks.
- **Floating Support Stack**: Independent *Ask PawCare AI* (`POST /api/ai/assistant` via server-side `@google/genai`) and *Message Admin* support inbox.

---

## Local Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Environment variables**
   Copy `.env.example` to `.env` and fill in any optional overrides:
   ```env
   GEMINI_API_KEY="your_gemini_api_key"
   APP_URL="http://localhost:3000"
   ```
   Firebase web config is loaded from `firebase-applet-config.json` (and can optionally be overridden via `VITE_FIREBASE_*` variables).

3. **Run in development (port 3000)**
   ```bash
   npm run dev
   ```

4. **Typecheck & production build**
   ```bash
   npm run lint
   npm run build
   npm start
   ```

---

## Firebase Console Checklist

1. **Authentication**: Enable **Google** and **Email/Password** providers in Firebase Console → Authentication → Sign-in method.
2. **Authorized Domains**: Add `localhost` and your production Vercel domain (`your-app.vercel.app`) under Authentication → Settings → Authorized domains.
3. **Security Rules**: Lint and deploy `firestore.rules`:
   ```bash
   npx eslint firestore.rules
   firebase deploy --only firestore:rules
   ```

---

## GitHub & Vercel Deployment

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial PawCare platform release"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```

2. **Deploy on Vercel**
   - Import the GitHub repository in the Vercel dashboard.
   - `vercel.json` configures Vite (`npm run build`, output `dist`, SPA rewrites).
   - Add `GEMINI_API_KEY` (and any `VITE_FIREBASE_*` overrides if deploying outside the bundled config) in Vercel Project Settings → Environment Variables.
   - Add the deployed `*.vercel.app` domain to **Firebase Console → Authentication → Settings → Authorized domains** so Google Login works in production.
