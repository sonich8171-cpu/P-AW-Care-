import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { CAREGIVER_STATUS_META, DEHRADUN_AREAS } from '../../lib/defaults';
import { uploadImageAsset } from '../../lib/firebase';
import { submitCaregiverApplication } from '../../lib/firestoreService';
import type { AppView } from '../../types/pawcare';
import { PageReveal } from '../ui/MotionPrimitives';

interface CaregiverApplyPageProps {
  onRequireAuth: () => void;
  onNavigate: (view: AppView) => void;
}

const PET_TYPE_OPTIONS = ['Dogs', 'Cats', 'Small Pets / Rabbits', 'Birds'];
const SERVICE_OPTIONS = ['Pet Sitting', 'Pet Feeding', 'Dog Walking', 'Basic Pet Care'];

export function CaregiverApplyPage({
  onRequireAuth,
  onNavigate,
}: CaregiverApplyPageProps) {
  const { firebaseUser, userProfile, caregiverApplication } = useAuth();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Dehradun');
  const [photoUrl, setPhotoUrl] = useState('');
  const [experienceSummary, setExperienceSummary] = useState('');
  const [petTypesHandled, setPetTypesHandled] = useState<string[]>(['Dogs', 'Cats']);
  const [servicesOffered, setServicesOffered] = useState<string[]>([
    'Pet Sitting',
    'Dog Walking',
  ]);
  const [availabilitySummary, setAvailabilitySummary] = useState('');
  const [intro, setIntro] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    if (caregiverApplication) {
      setFullName(caregiverApplication.fullName);
      setPhone(caregiverApplication.phone);
      setCity(caregiverApplication.city);
      setPhotoUrl(caregiverApplication.photoUrl || '');
      setExperienceSummary(caregiverApplication.experienceSummary);
      setPetTypesHandled(caregiverApplication.petTypesHandled);
      setServicesOffered(caregiverApplication.servicesOffered);
      setAvailabilitySummary(caregiverApplication.availabilitySummary);
      setIntro(caregiverApplication.intro);
    } else if (userProfile) {
      setFullName(userProfile.fullName);
      setPhone(userProfile.phone || '');
      setCity(userProfile.city || 'Dehradun');
      setPhotoUrl(userProfile.photoUrl || '');
    }
  }, [caregiverApplication, userProfile]);

  const toggleItem = (list: string[], item: string, setter: (v: string[]) => void) => {
    if (list.includes(item)) {
      if (list.length > 1) setter(list.filter((i) => i !== item));
    } else {
      setter([...list, item]);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !firebaseUser) return;
    setBusy(true);
    setError('');
    try {
      const url = await uploadImageAsset(
        file,
        `caregivers/${firebaseUser.uid}/profile_${Date.now()}`
      );
      setPhotoUrl(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to process image.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) {
      onRequireAuth();
      return;
    }
    if (!firebaseUser.emailVerified) {
      setError('Please verify your email address before submitting a caregiver application.');
      return;
    }
    setError('');
    setSavedMessage('');
    setBusy(true);

    try {
      await submitCaregiverApplication(
        {
          uid: firebaseUser.uid,
          fullName,
          email: firebaseUser.email || '',
          phone,
          city,
          photoUrl,
          experienceSummary,
          petTypesHandled,
          servicesOffered,
          availabilitySummary,
          intro,
        },
        Boolean(caregiverApplication)
      );
      setSavedMessage(
        'Your caregiver application has been submitted for admin review. You will be notified once an administrator reviews your profile.'
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit application.');
    } finally {
      setBusy(false);
    }
  };

  const canEdit =
    !caregiverApplication ||
    caregiverApplication.status === 'submitted' ||
    caregiverApplication.status === 'rejected';

  return (
    <PageReveal className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8">
      <div className="space-y-2">
        <div className="text-xs font-medium text-[#2D6A4F]">Caregiver Registration · Dehradun</div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#1A221D] tracking-tight">
          Apply to Become a PawCare Caregiver
        </h1>
        <p className="text-sm sm:text-base text-[#526057] leading-relaxed">
          Share your pet-care experience, availability, and the services you offer. Every application is manually reviewed by an administrator before activation.
        </p>
      </div>

      {!firebaseUser ? (
        <div className="rounded-2xl border border-[#E6E2D8] bg-white p-8 text-center space-y-4">
          <ShieldCheck className="w-9 h-9 text-[#1B4332] mx-auto" />
          <h2 className="text-lg font-semibold text-[#1A221D]">
            Sign in with Google or Email to Apply
          </h2>
          <p className="text-sm text-[#526057] max-w-md mx-auto">
            We link your caregiver application to your verified account so you can track review updates and manage bookings.
          </p>
          <button
            type="button"
            onClick={onRequireAuth}
            className="px-5 py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-semibold hover:bg-[#143326] cursor-pointer"
          >
            Sign In / Create Account
          </button>
        </div>
      ) : (
        <>
          {caregiverApplication && (
            <div className="rounded-2xl border border-[#E6E2D8] bg-white p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#1A221D]">
                  <Clock className="w-4 h-4 text-[#1B4332]" />
                  Current Verification Status
                </div>
                <span
                  className={`px-3 py-1 rounded-lg border text-xs font-semibold ${
                    CAREGIVER_STATUS_META[caregiverApplication.status]?.toneClass || ''
                  }`}
                >
                  {CAREGIVER_STATUS_META[caregiverApplication.status]?.label ||
                    caregiverApplication.status}
                </span>
              </div>
              {caregiverApplication.status === 'approved' && (
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
                  <span>Your caregiver profile is approved and active.</span>
                  <button
                    type="button"
                    onClick={() => onNavigate('caregiver-portal')}
                    className="px-3.5 py-1.5 rounded-lg bg-[#1B4332] text-white text-xs font-semibold cursor-pointer"
                  >
                    Open Caregiver Portal
                  </button>
                </div>
              )}
              {caregiverApplication.status === 'rejected' &&
                caregiverApplication.rejectionReason && (
                  <div className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-xl p-3.5">
                    <strong>Admin Feedback:</strong> {caregiverApplication.rejectionReason}. You can update your application below and resubmit.
                  </div>
                )}
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {savedMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{savedMessage}</span>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-[#E6E2D8] bg-white p-6 sm:p-8 space-y-5"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#445249] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  disabled={!canEdit}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D3C8] text-sm disabled:bg-[#FAF8F4]"
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
              <div>
                <label className="block text-xs font-medium text-[#445249] mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  required
                  disabled={!canEdit}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D3C8] text-sm disabled:bg-[#FAF8F4]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#445249] mb-1">
                  City / Dehradun Locality
                </label>
                <input
                  type="text"
                  required
                  disabled={!canEdit}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  list="cg-areas"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D3C8] text-sm disabled:bg-[#FAF8F4]"
                />
                <datalist id="cg-areas">
                  <option value="Dehradun" />
                  {DEHRADUN_AREAS.map((a) => (
                    <option key={a} value={`Dehradun (${a})`} />
                  ))}
                </datalist>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#445249] mb-1">
                Profile Image (optional)
              </label>
              <input
                type="file"
                disabled={!canEdit}
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoUpload}
                className="block w-full text-xs text-[#526057] file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-[#D8D3C8] file:bg-[#FAF8F4] file:text-xs file:font-medium"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-[#445249]">
                Types of Pets Handled
              </label>
              <div className="flex flex-wrap gap-2">
                {PET_TYPE_OPTIONS.map((pt) => {
                  const selected = petTypesHandled.includes(pt);
                  return (
                    <button
                      key={pt}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => toggleItem(petTypesHandled, pt, setPetTypesHandled)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                        selected
                          ? 'bg-[#1B4332] text-white border-[#1B4332]'
                          : 'bg-[#FAF8F4] text-[#445249] border-[#D8D3C8]'
                      }`}
                    >
                      {pt}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-[#445249]">Services Offered</label>
              <div className="flex flex-wrap gap-2">
                {SERVICE_OPTIONS.map((svc) => {
                  const selected = servicesOffered.includes(svc);
                  return (
                    <button
                      key={svc}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => toggleItem(servicesOffered, svc, setServicesOffered)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                        selected
                          ? 'bg-[#1B4332] text-white border-[#1B4332]'
                          : 'bg-[#FAF8F4] text-[#445249] border-[#D8D3C8]'
                      }`}
                    >
                      {svc}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#445249] mb-1">
                Pet-Care Experience
              </label>
              <textarea
                rows={3}
                required
                minLength={10}
                disabled={!canEdit}
                value={experienceSummary}
                onChange={(e) => setExperienceSummary(e.target.value)}
                placeholder="Describe years of experience caring for dogs, cats, feeding routines, leash handling, etc."
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D3C8] text-sm disabled:bg-[#FAF8F4]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#445249] mb-1">Availability</label>
              <input
                type="text"
                required
                disabled={!canEdit}
                value={availabilitySummary}
                onChange={(e) => setAvailabilitySummary(e.target.value)}
                placeholder="e.g. Weekdays 7–10 AM & 5–8 PM, Full-day Weekends"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D3C8] text-sm disabled:bg-[#FAF8F4]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#445249] mb-1">
                Short Introduction
              </label>
              <textarea
                rows={3}
                required
                minLength={10}
                disabled={!canEdit}
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
                placeholder="Introduce yourself to pet parents in Dehradun..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D3C8] text-sm disabled:bg-[#FAF8F4]"
              />
            </div>

            {canEdit && (
              <button
                type="submit"
                disabled={busy}
                className="px-6 py-3 rounded-xl bg-[#1B4332] text-white text-sm font-semibold hover:bg-[#143326] disabled:opacity-55 cursor-pointer"
              >
                {busy
                  ? 'Submitting...'
                  : caregiverApplication
                  ? 'Update & Resubmit Application'
                  : 'Submit Application for Review'}
              </button>
            )}
          </form>
        </>
      )}
    </PageReveal>
  );
}
