import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Mail, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { DEHRADUN_AREAS } from '../../lib/defaults';
import { uploadImageAsset } from '../../lib/firebase';

interface AuthModalProps {
  open: boolean;
  initialMode?: 'login' | 'signup';
  onClose: () => void;
}

function formatFirebaseAuthError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code)
      : '';
  const msg = err instanceof Error ? err.message : String(err);

  if (code === 'auth/popup-closed-by-user' || msg.includes('popup-closed')) {
    return 'Google sign-in was cancelled before completion.';
  }
  if (code === 'auth/cancelled-popup-request') {
    return 'Previous sign-in pop-up was replaced. Please try again.';
  }
  if (code === 'auth/popup-blocked') {
    return 'Your browser blocked the sign-in pop-up. Redirecting to Google Sign-In...';
  }
  if (code === 'auth/unauthorized-domain' || msg.includes('unauthorized-domain')) {
    return 'This preview or deployment domain is not listed under Firebase Console → Authentication → Settings → Authorized domains.';
  }
  if (
    code === 'auth/account-exists-with-different-credential' ||
    msg.includes('account-exists-with-different-credential')
  ) {
    return 'An account already exists with this email using Email/Password. Please sign in with your password first (or reset it if needed).';
  }
  if (code === 'auth/network-request-failed' || msg.includes('network-request-failed')) {
    return 'Network error while reaching Google Authentication. Please check your connection and retry.';
  }
  if (code === 'auth/user-disabled' || msg.includes('user-disabled')) {
    return 'This account has been disabled. Please contact PawCare support for assistance.';
  }
  if (code === 'auth/operation-not-allowed' || msg.includes('operation-not-allowed')) {
    return 'This sign-in provider is not enabled yet in Firebase Console → Authentication → Sign-in method.';
  }
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found' ||
    msg.includes('invalid-credential')
  ) {
    return 'Invalid email or password. Please verify your credentials or reset your password.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'An account with this email already exists. Please sign in or click Continue with Google.';
  }
  if (code === 'auth/weak-password') {
    return 'Password should be at least 6 characters long.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many sign-in attempts. Please wait a moment and try again.';
  }
  return msg || 'Authentication failed. Please try again.';
}

export function AuthModal({ open, initialMode = 'login', onClose }: AuthModalProps) {
  const {
    firebaseUser,
    needsOnboarding,
    profileError,
    signInWithGoogle,
    signUpWithEmail,
    signInWithEmail,
    sendPasswordReset,
    resendVerificationEmail,
    retryProfileSetup,
    completeOnboarding,
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [city, setCity] = useState('Dehradun');
  const [phone, setPhone] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setError('');
      setNotice('');
    }
  }, [open, initialMode]);

  const showProfileRetry = Boolean(firebaseUser && firebaseUser.emailVerified && profileError);

  if (!open && !needsOnboarding && !showProfileRetry) return null;

  const handleGoogle = async () => {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const flow = await signInWithGoogle();
      if (flow === 'popup') {
        onClose();
      }
    } catch (err: unknown) {
      console.error('Google authentication error:', err);
      setError(formatFirebaseAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);

    try {
      if (mode === 'reset') {
        await sendPasswordReset(email.trim());
        setNotice('Password reset link sent. Please check your inbox.');
      } else if (mode === 'signup') {
        if (!fullName.trim()) throw new Error('Please enter your full name.');
        await signUpWithEmail({
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          city: city.trim() || 'Dehradun',
          phone: phone.trim(),
        });
        setNotice(
          'Account created! A verification link has been sent to your email. Please verify your email to unlock your Customer Dashboard.'
        );
      } else {
        await signInWithEmail(email.trim(), password);
        onClose();
      }
    } catch (err: unknown) {
      console.error('Email authentication error:', err);
      setError(formatFirebaseAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await completeOnboarding({
        fullName: fullName.trim() || firebaseUser?.displayName || 'Pet Parent',
        city: city.trim() || 'Dehradun',
        phone: phone.trim(),
        photoUrl: photoUrl || firebaseUser?.photoURL || '',
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !firebaseUser) return;
    setBusy(true);
    setError('');
    try {
      const url = await uploadImageAsset(file, `users/${firebaseUser.uid}/avatar_${Date.now()}`);
      setPhotoUrl(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to upload photo.');
    } finally {
      setBusy(false);
    }
  };

  // Profile initialization failure retry banner
  if (showProfileRetry) {
    return (
      <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-[#E6E2D8] rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2.5 text-amber-800">
              <AlertTriangle className="w-5 h-5" />
              <h2 className="text-lg font-semibold font-display">
                Complete Customer Profile Setup
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded-lg text-[#526057] hover:bg-[#FAF8F4] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-[#445249] leading-relaxed">
            Your Google/Firebase sign-in succeeded, but we could not finish saving your PawCare customer profile yet. Please retry to open your dashboard.
          </p>
          {profileError && (
            <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
              {profileError}
            </p>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await retryProfileSetup();
                onClose();
              } finally {
                setBusy(false);
              }
            }}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-semibold hover:bg-[#143326] disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
            {busy ? 'Retrying Setup...' : 'Retry Profile Setup'}
          </button>
        </div>
      </div>
    );
  }

  // Unverified email user banner inside modal
  if (firebaseUser && !firebaseUser.emailVerified) {
    return (
      <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-[#E6E2D8] rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2.5 text-[#1B4332]">
              <Mail className="w-5 h-5" />
              <h2 className="text-lg font-semibold font-display">Verify Your Email</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded-lg text-[#526057] hover:bg-[#FAF8F4] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-[#445249] leading-relaxed">
            We sent a verification link to <span className="font-semibold">{firebaseUser.email}</span>.
            Please verify your email address, then click below to enter your Customer Dashboard.
          </p>
          {notice && (
            <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              {notice}
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await resendVerificationEmail();
                setNotice('Verification email sent again.');
                setBusy(false);
              }}
              className="px-4 py-2 rounded-xl bg-[#1B4332] text-white text-sm font-medium hover:bg-[#143326] cursor-pointer"
            >
              Resend Verification Email
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl border border-[#D4CFC4] text-sm font-medium text-[#1A221D] hover:bg-[#FAF8F4] cursor-pointer"
            >
              I Have Verified
            </button>
          </div>
        </div>
      </div>
    );
  }

  // First-login profile completion (only if city is missing)
  if (firebaseUser && needsOnboarding) {
    return (
      <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-[#E6E2D8] rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center gap-2 text-[#1B4332]">
            <ShieldCheck className="w-5 h-5" />
            <h2 className="text-lg font-semibold font-display">Complete Your PawCare Profile</h2>
          </div>
          <p className="text-sm text-[#526057]">
            Just a few details so caregivers and support know who they are assisting.
          </p>
          {error && (
            <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
              {error}
            </p>
          )}
          <form onSubmit={handleOnboardingSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-[#445249] mb-1">Full Name</label>
              <input
                type="text"
                required
                value={fullName || firebaseUser.displayName || ''}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D3C8] text-sm focus:outline-2 focus:outline-[#1B4332]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#445249] mb-1">Email</label>
              <input
                type="email"
                disabled
                value={firebaseUser.email || ''}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E2D8] bg-[#FAF8F4] text-sm text-[#6B786F]"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#445249] mb-1">City</label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  list="dehradun-areas-list"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D3C8] text-sm focus:outline-2 focus:outline-[#1B4332]"
                />
                <datalist id="dehradun-areas-list">
                  <option value="Dehradun" />
                  {DEHRADUN_AREAS.map((area) => (
                    <option key={area} value={`Dehradun (${area})`} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#445249] mb-1">
                  Phone (optional)
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D3C8] text-sm focus:outline-2 focus:outline-[#1B4332]"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#445249] mb-1">
                Profile Photo (optional)
              </label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoUpload}
                className="block w-full text-xs text-[#526057] file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-[#D8D3C8] file:bg-[#FAF8F4] file:text-xs file:font-medium hover:file:bg-[#F1F6F2]"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-medium hover:bg-[#143326] disabled:opacity-60 cursor-pointer"
            >
              {busy ? 'Saving Profile...' : 'Save & Continue'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="max-w-md w-full bg-white border border-[#E6E2D8] rounded-2xl p-6 space-y-5 shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="auth-modal-title" className="text-xl font-bold font-display text-[#1A221D]">
              {mode === 'signup'
                ? 'Create Your PawCare Account'
                : mode === 'reset'
                ? 'Reset Password'
                : 'Sign In to PawCare'}
            </h2>
            <p className="text-xs text-[#526057] mt-1">
              Instant self-registration for pet parents across Dehradun.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close authentication modal"
            className="p-1.5 rounded-lg text-[#526057] hover:bg-[#FAF8F4] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Google Auth (Open Self-Registration & Returning Customer Login) */}
        <button
          type="button"
          disabled={busy}
          onClick={handleGoogle}
          className="w-full py-2.5 px-4 rounded-xl border border-[#D4CFC4] bg-white hover:bg-[#FAF8F4] text-sm font-semibold text-[#1A221D] flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-60"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
            />
          </svg>
          {busy ? 'Connecting to Google...' : 'Continue with Google'}
        </button>

        <div className="relative flex items-center py-1">
          <div className="flex-grow border-t border-[#E6E2D8]" />
          <span className="shrink-0 px-3 text-xs text-[#6B786F]">or with email</span>
          <div className="flex-grow border-t border-[#E6E2D8]" />
        </div>

        {error && (
          <div className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-xl p-3 leading-relaxed">
            {error}
          </div>
        )}
        {notice && (
          <div className="text-xs text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2 leading-relaxed">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{notice}</span>
          </div>
        )}

        <form onSubmit={handleEmailSubmit} className="space-y-3">
          {mode === 'signup' && (
            <>
              <div>
                <label className="block text-xs font-medium text-[#445249] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ananya Sharma"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D3C8] text-sm focus:outline-2 focus:outline-[#1B4332]"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#445249] mb-1">City</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Dehradun"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D3C8] text-sm focus:outline-2 focus:outline-[#1B4332]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#445249] mb-1">
                    Phone (optional)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D3C8] text-sm focus:outline-2 focus:outline-[#1B4332]"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-[#445249] mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D3C8] text-sm focus:outline-2 focus:outline-[#1B4332]"
            />
          </div>

          {mode !== 'reset' && (
            <div>
              <label className="block text-xs font-medium text-[#445249] mb-1">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D3C8] text-sm focus:outline-2 focus:outline-[#1B4332]"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-medium hover:bg-[#143326] transition-colors disabled:opacity-60 cursor-pointer"
          >
            {busy
              ? 'Please wait...'
              : mode === 'signup'
              ? 'Create Account'
              : mode === 'reset'
              ? 'Send Reset Link'
              : 'Sign In with Email'}
          </button>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E6E2D8] text-xs text-[#526057]">
          {mode === 'login' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError('');
                  setNotice('');
                }}
                className="text-[#1B4332] font-medium hover:underline cursor-pointer"
              >
                New here? Create account
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('reset');
                  setError('');
                  setNotice('');
                }}
                className="hover:underline cursor-pointer"
              >
                Forgot password?
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
                setNotice('');
              }}
              className="text-[#1B4332] font-medium hover:underline cursor-pointer"
            >
              Back to Sign In
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
