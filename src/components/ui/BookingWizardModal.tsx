import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  PawPrint,
  Plus,
  X,
} from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { BOOKING_STATUS_META, DEHRADUN_AREAS, TIME_SLOTS } from '../../lib/defaults';
import { db } from '../../lib/firebase';
import { createBookingRequest, savePetProfile } from '../../lib/firestoreService';
import type { AnimalType, Booking, PetProfile, PetSize, ServiceItem } from '../../types/pawcare';

interface BookingWizardModalProps {
  open: boolean;
  preselectedServiceSlug?: string;
  onClose: () => void;
  onRequireAuth: () => void;
  onBookingCreated?: (booking: Booking) => void;
}

export function BookingWizardModal({
  open,
  preselectedServiceSlug,
  onClose,
  onRequireAuth,
  onBookingCreated,
}: BookingWizardModalProps) {
  const { firebaseUser, userProfile, services, servicesLoadedFromDb } = useAuth();
  const [step, setStep] = useState(1);
  const [pets, setPets] = useState<PetProfile[]>([]);
  const [selectedServiceSlug, setSelectedServiceSlug] = useState<string>(
    preselectedServiceSlug || services[0]?.slug || 'pet_sitting'
  );
  const [selectedPetId, setSelectedPetId] = useState<string>('');
  const [requestedDate, setRequestedDate] = useState<string>(() => {
    const tomorrow = new Date(Date.now() + 86400000);
    return tomorrow.toISOString().split('T')[0];
  });
  const [requestedTime, setRequestedTime] = useState<string>(TIME_SLOTS[0]);
  const [cityArea, setCityArea] = useState<string>(DEHRADUN_AREAS[0]);
  const [serviceLocation, setServiceLocation] = useState<string>('');
  const [instructions, setInstructions] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submittedBooking, setSubmittedBooking] = useState<Booking | null>(null);

  // Quick-add pet inline form
  const [addingPet, setAddingPet] = useState(false);
  const [newPetName, setNewPetName] = useState('');
  const [newPetType, setNewPetType] = useState<AnimalType>('Dog');
  const [newPetBreed, setNewPetBreed] = useState('');
  const [newPetAge, setNewPetAge] = useState('');
  const [newPetSize, setNewPetSize] = useState<PetSize>('Medium');
  const [newPetFeeding, setNewPetFeeding] = useState('');

  useEffect(() => {
    if (preselectedServiceSlug) {
      setSelectedServiceSlug(preselectedServiceSlug);
    }
  }, [preselectedServiceSlug]);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setSubmittedBooking(null);
    setError('');
  }, [open]);

  useEffect(() => {
    if (!firebaseUser) {
      setPets([]);
      return;
    }
    const q = query(collection(db, 'pets'), where('ownerId', '==', firebaseUser.uid));
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<PetProfile, 'id'>),
      }));
      setPets(list);
      if (list.length > 0 && !selectedPetId) {
        setSelectedPetId(list[0].id);
      }
    });
  }, [firebaseUser, selectedPetId]);

  if (!open) return null;

  const activeServices = services.filter((s) => s.active);
  const selectedService: ServiceItem | undefined =
    activeServices.find((s) => s.slug === selectedServiceSlug) || activeServices[0];
  const selectedPet = pets.find((p) => p.id === selectedPetId);

  const handleQuickCreatePet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    setError('');
    setSubmitting(true);
    try {
      const id = await savePetProfile(firebaseUser.uid, {
        name: newPetName,
        animalType: newPetType,
        breed: newPetBreed,
        age: newPetAge,
        size: newPetSize,
        feedingInstructions: newPetFeeding,
      });
      setSelectedPetId(id);
      setAddingPet(false);
      setNewPetName('');
      setNewPetBreed('');
      setNewPetAge('');
      setNewPetFeeding('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to save pet.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitBooking = async () => {
    if (!firebaseUser) {
      onRequireAuth();
      return;
    }
    if (!firebaseUser.emailVerified) {
      setError('Please verify your email address before submitting a booking.');
      return;
    }
    if (!selectedService || !selectedPet) {
      setError('Please select both a service and a pet profile.');
      return;
    }
    if (!servicesLoadedFromDb) {
      setError(
        'Live service catalog has not been initialized by an administrator yet. Please message PawCare Support or ask an admin to initialize services.'
      );
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const created = await createBookingRequest({
        customerId: firebaseUser.uid,
        customerName: userProfile?.fullName || firebaseUser.displayName || 'Customer',
        pet: selectedPet,
        service: selectedService,
        requestedDate,
        requestedTime,
        serviceLocation: `${serviceLocation.trim()}, ${cityArea}, Dehradun`,
        city: `Dehradun (${cityArea})`,
        customerInstructions: instructions,
      });
      setSubmittedBooking(created);
      setStep(8);
      onBookingCreated?.(created);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not submit booking request.');
    } finally {
      setSubmitting(false);
    }
  };

  const canAdvance = () => {
    if (step === 1) return Boolean(selectedService);
    if (step === 2) return Boolean(selectedPet);
    if (step === 3) return Boolean(requestedDate);
    if (step === 4) return Boolean(requestedTime);
    if (step === 5) return serviceLocation.trim().length >= 4;
    return true;
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-wizard-title"
    >
      <div className="max-w-2xl w-full bg-white border border-[#E6E2D8] rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E6E2D8] flex items-center justify-between gap-4 bg-[#FAF8F4]">
          <div>
            <h2 id="booking-wizard-title" className="text-lg font-bold font-display text-[#1A221D]">
              Book Pet Care in Dehradun
            </h2>
            <p className="text-xs text-[#526057] font-mono tabular-nums">
              {step <= 7 ? `Step ${step} of 7` : 'Status Confirmed from Backend'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close booking wizard"
            className="p-1.5 rounded-lg text-[#526057] hover:bg-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper progress bar */}
        <div className="h-1 bg-[#EFECE4]">
          <div
            className="h-full bg-[#1B4332] transition-all duration-300"
            style={{ width: `${Math.min(100, (step / 8) * 100)}%` }}
          />
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {!firebaseUser ? (
            <div className="py-8 text-center space-y-4">
              <PawPrint className="w-10 h-10 text-[#1B4332] mx-auto" />
              <h3 className="text-lg font-semibold text-[#1A221D]">
                Sign in to create your booking request
              </h3>
              <p className="text-sm text-[#526057] max-w-md mx-auto">
                Sign in with Google or email so we can attach your pet profiles and track real-time caregiver confirmation.
              </p>
              <button
                type="button"
                onClick={onRequireAuth}
                className="px-5 py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-medium hover:bg-[#143326] cursor-pointer"
              >
                Sign In / Create Account
              </button>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Step 1: Select Service */}
              {step === 1 && (
                <div className="space-y-3">
                  <h3 className="text-base font-semibold text-[#1A221D]">
                    1. Choose a Pet-Care Service
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeServices.map((svc) => {
                      const active = svc.slug === selectedService?.slug;
                      return (
                        <button
                          key={svc.slug}
                          type="button"
                          onClick={() => setSelectedServiceSlug(svc.slug)}
                          className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
                            active
                              ? 'border-[#1B4332] bg-[#F1F6F2]'
                              : 'border-[#E6E2D8] bg-white hover:border-[#C5DEC9]'
                          }`}
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="font-semibold text-sm text-[#1A221D]">
                              {svc.name}
                            </span>
                            <span className="font-mono text-sm font-semibold text-[#1B4332] tabular-nums">
                              ₹{svc.customerPriceInr}
                            </span>
                          </div>
                          <p className="text-xs text-[#526057] mt-1 line-clamp-2">
                            {svc.shortDescription}
                          </p>
                          <div className="mt-2 text-[11px] text-[#6B786F]">
                            {svc.durationLabel}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 2: Select Pet */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-semibold text-[#1A221D]">
                      2. Select Your Pet
                    </h3>
                    <button
                      type="button"
                      onClick={() => setAddingPet((v) => !v)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1B4332] hover:underline cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {addingPet ? 'Cancel New Pet' : 'Add Pet Profile'}
                    </button>
                  </div>

                  {addingPet ? (
                    <form
                      onSubmit={handleQuickCreatePet}
                      className="p-4 rounded-xl border border-[#D8D3C8] bg-[#FAF8F4] space-y-3"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          required
                          value={newPetName}
                          onChange={(e) => setNewPetName(e.target.value)}
                          placeholder="Pet Name (e.g. Bruno)"
                          className="px-3 py-2 rounded-lg border border-[#D8D3C8] bg-white text-sm"
                        />
                        <select
                          value={newPetType}
                          onChange={(e) => setNewPetType(e.target.value as AnimalType)}
                          className="px-3 py-2 rounded-lg border border-[#D8D3C8] bg-white text-sm"
                        >
                          <option value="Dog">Dog</option>
                          <option value="Cat">Cat</option>
                          <option value="Bird">Bird</option>
                          <option value="Rabbit">Rabbit</option>
                          <option value="Other">Other</option>
                        </select>
                        <input
                          type="text"
                          required
                          value={newPetAge}
                          onChange={(e) => setNewPetAge(e.target.value)}
                          placeholder="Age (e.g. 2 years)"
                          className="px-3 py-2 rounded-lg border border-[#D8D3C8] bg-white text-sm"
                        />
                        <select
                          value={newPetSize}
                          onChange={(e) => setNewPetSize(e.target.value as PetSize)}
                          className="px-3 py-2 rounded-lg border border-[#D8D3C8] bg-white text-sm"
                        >
                          <option value="Small">Small</option>
                          <option value="Medium">Medium</option>
                          <option value="Large">Large</option>
                          <option value="Extra Large">Extra Large</option>
                        </select>
                      </div>
                      <input
                        type="text"
                        value={newPetBreed}
                        onChange={(e) => setNewPetBreed(e.target.value)}
                        placeholder="Breed (optional)"
                        className="w-full px-3 py-2 rounded-lg border border-[#D8D3C8] bg-white text-sm"
                      />
                      <input
                        type="text"
                        value={newPetFeeding}
                        onChange={(e) => setNewPetFeeding(e.target.value)}
                        placeholder="Feeding instructions (optional)"
                        className="w-full px-3 py-2 rounded-lg border border-[#D8D3C8] bg-white text-sm"
                      />
                      <button
                        type="submit"
                        disabled={submitting}
                        className="px-4 py-2 rounded-xl bg-[#1B4332] text-white text-xs font-medium hover:bg-[#143326] cursor-pointer"
                      >
                        {submitting ? 'Saving...' : 'Save Pet & Select'}
                      </button>
                    </form>
                  ) : pets.length === 0 ? (
                    <div className="p-6 rounded-xl border border-dashed border-[#D4CFC4] text-center space-y-2">
                      <p className="text-sm text-[#526057]">
                        You haven’t added a pet profile yet.
                      </p>
                      <button
                        type="button"
                        onClick={() => setAddingPet(true)}
                        className="px-4 py-2 rounded-xl bg-[#1B4332] text-white text-xs font-medium cursor-pointer"
                      >
                        Create First Pet Profile
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {pets.map((pet) => {
                        const active = pet.id === selectedPetId;
                        return (
                          <button
                            key={pet.id}
                            type="button"
                            onClick={() => setSelectedPetId(pet.id)}
                            className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
                              active
                                ? 'border-[#1B4332] bg-[#F1F6F2]'
                                : 'border-[#E6E2D8] bg-white hover:border-[#C5DEC9]'
                            }`}
                          >
                            <div className="font-semibold text-sm text-[#1A221D]">{pet.name}</div>
                            <div className="text-xs text-[#526057] mt-1">
                              {pet.animalType} {pet.breed ? `· ${pet.breed}` : ''} · {pet.age} ·{' '}
                              {pet.size}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Preferred Date */}
              {step === 3 && (
                <div className="space-y-3">
                  <h3 className="text-base font-semibold text-[#1A221D] flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#1B4332]" />
                    3. Select Preferred Date
                  </h3>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={requestedDate}
                    onChange={(e) => setRequestedDate(e.target.value)}
                    className="w-full sm:w-72 px-4 py-2.5 rounded-xl border border-[#D8D3C8] text-sm font-mono focus:outline-2 focus:outline-[#1B4332]"
                  />
                  <p className="text-xs text-[#526057]">
                    Same-day or advance requests are reviewed promptly during service hours (7:00 AM – 9:00 PM IST).
                  </p>
                </div>
              )}

              {/* Step 4: Preferred Time Slot */}
              {step === 4 && (
                <div className="space-y-3">
                  <h3 className="text-base font-semibold text-[#1A221D] flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#1B4332]" />
                    4. Select Preferred Time Window
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {TIME_SLOTS.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setRequestedTime(slot)}
                        className={`px-4 py-2.5 rounded-xl border text-left text-xs font-mono transition-colors cursor-pointer ${
                          requestedTime === slot
                            ? 'border-[#1B4332] bg-[#F1F6F2] text-[#1B4332] font-semibold'
                            : 'border-[#E6E2D8] text-[#445249] hover:border-[#C5DEC9]'
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-[#526057]">
                    Service duration: {selectedService?.durationLabel}
                  </p>
                </div>
              )}

              {/* Step 5: Location & Instructions */}
              {step === 5 && (
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-[#1A221D] flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#1B4332]" />
                    5. Service Location & Care Notes
                  </h3>
                  <div>
                    <label className="block text-xs font-medium text-[#445249] mb-1">
                      Dehradun Locality
                    </label>
                    <select
                      value={cityArea}
                      onChange={(e) => setCityArea(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D3C8] text-sm bg-white"
                    >
                      {DEHRADUN_AREAS.map((area) => (
                        <option key={area} value={area}>
                          {area}, Dehradun
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#445249] mb-1">
                      Street / House / Hostel / Landmark
                    </label>
                    <input
                      type="text"
                      required
                      value={serviceLocation}
                      onChange={(e) => setServiceLocation(e.target.value)}
                      placeholder="e.g. Lane 4, Near Jakhan Chowk"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D3C8] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#445249] mb-1">
                      Caregiver Instructions (optional)
                    </label>
                    <textarea
                      rows={3}
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      placeholder="Leash location, meal timing, gate instructions, or temperament notes..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D3C8] text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Step 6 & 7: Review & Submit */}
              {(step === 6 || step === 7) && selectedService && selectedPet && (
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-[#1A221D]">
                    6. Review Booking Request & Tariff
                  </h3>
                  <div className="rounded-xl border border-[#E6E2D8] bg-[#FAF8F4] p-4 space-y-2.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#526057]">Service</span>
                      <span className="font-semibold text-[#1A221D]">
                        {selectedService.name} ({selectedService.durationLabel})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#526057]">Pet</span>
                      <span className="font-medium text-[#1A221D]">
                        {selectedPet.name} ({selectedPet.animalType})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#526057]">Date & Time</span>
                      <span className="font-mono text-xs text-[#1A221D] tabular-nums">
                        {requestedDate} · {requestedTime}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-[#526057] shrink-0">Location</span>
                      <span className="text-right text-[#1A221D]">
                        {serviceLocation}, {cityArea}, Dehradun
                      </span>
                    </div>
                    <div className="pt-2.5 border-t border-[#E6E2D8] flex justify-between items-baseline">
                      <span className="font-medium text-[#1A221D]">Displayed Service Price</span>
                      <span className="text-lg font-bold font-mono text-[#1B4332] tabular-nums">
                        ₹{selectedService.customerPriceInr.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl border border-[#E6E2D8] text-xs text-[#526057] leading-relaxed">
                    <strong className="text-[#1A221D]">Cancellation & Verification Policy:</strong>{' '}
                    Your request starts in <strong>Pending</strong> status while our Dehradun team assigns an approved caregiver. You can cancel any Pending, Accepted, or Confirmed booking before service begins.
                  </div>
                </div>
              )}

              {/* Step 8: Genuine Backend Status */}
              {step === 8 && submittedBooking && (
                <div className="py-4 space-y-4">
                  <div className="flex items-center gap-3 text-[#1B4332]">
                    <CheckCircle2 className="w-8 h-8 shrink-0" />
                    <div>
                      <h3 className="text-lg font-bold font-display">
                        Booking Request Recorded
                      </h3>
                      <p className="text-xs text-[#526057] font-mono">
                        Reference ID: {submittedBooking.id}
                      </p>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl border border-[#E6E2D8] bg-[#FAF8F4] space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-[#526057]">Live Backend Status</span>
                      <span
                        className={`px-2.5 py-0.5 rounded-md border text-xs font-medium ${
                          BOOKING_STATUS_META[submittedBooking.status]?.toneClass || ''
                        }`}
                      >
                        {BOOKING_STATUS_META[submittedBooking.status]?.label ||
                          submittedBooking.status}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#526057]">Locked Price Snapshot</span>
                      <span className="font-mono font-semibold text-[#1B4332] tabular-nums">
                        ₹{submittedBooking.priceSnapshotInr.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <p className="text-xs text-[#526057] pt-1">
                      You can monitor live status updates, caregiver assignment, and messages from your Customer Dashboard.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        {firebaseUser && (
          <div className="px-6 py-4 border-t border-[#E6E2D8] bg-[#FAF8F4] flex items-center justify-between gap-3">
            {step < 8 ? (
              <>
                <button
                  type="button"
                  disabled={step === 1}
                  onClick={() => setStep((s) => Math.max(1, s - 1))}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#D4CFC4] text-sm font-medium text-[#1A221D] disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>

                {step < 6 ? (
                  <button
                    type="button"
                    disabled={!canAdvance()}
                    onClick={() => setStep((s) => s + 1)}
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#1B4332] text-white text-sm font-medium hover:bg-[#143326] disabled:opacity-45 cursor-pointer"
                  >
                    Continue
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleSubmitBooking}
                    className="px-5 py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-medium hover:bg-[#143326] disabled:opacity-55 cursor-pointer"
                  >
                    {submitting ? 'Submitting Request...' : 'Submit Booking Request'}
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="ml-auto px-5 py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-medium hover:bg-[#143326] cursor-pointer"
              >
                Done
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
