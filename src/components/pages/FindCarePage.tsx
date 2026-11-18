import React, { useEffect, useState } from 'react';
import { ArrowRight, MapPin, ShieldCheck, UserCheck } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { HERO_IMAGE_URL, SERVICE_IMAGES } from '../../lib/defaults';
import { db } from '../../lib/firebase';
import type { CaregiverPublicProfile } from '../../types/pawcare';
import { PageReveal, SkeletonRow } from '../ui/MotionPrimitives';
import { SafeImage } from '../ui/SafeImage';

interface FindCarePageProps {
  onStartBooking: (serviceSlug?: string) => void;
  onBecomeCaregiver: () => void;
}

export function FindCarePage({ onStartBooking, onBecomeCaregiver }: FindCarePageProps) {
  const { services } = useAuth();
  const [caregivers, setCaregivers] = useState<CaregiverPublicProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [serviceFilter, setServiceFilter] = useState<string>('all');

  useEffect(() => {
    const q = query(
      collection(db, 'caregivers'),
      where('verificationStatus', '==', 'approved')
    );
    return onSnapshot(
      q,
      (snap) => {
        setCaregivers(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<CaregiverPublicProfile, 'id'>),
          }))
        );
        setLoading(false);
      },
      () => {
        setCaregivers([]);
        setLoading(false);
      }
    );
  }, []);

  const activeServices = services.filter((s) => s.active);
  const filteredCaregivers = caregivers.filter((cg) => {
    if (serviceFilter === 'all') return true;
    return cg.servicesOffered.includes(serviceFilter);
  });

  return (
    <PageReveal className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E6E2D8] pb-8">
        <div className="space-y-2 max-w-2xl">
          <div className="text-xs font-medium text-[#2D6A4F]">Find Pet Care · Dehradun</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#1A221D] tracking-tight">
            Choose a Service or Browse Approved Caregivers
          </h1>
          <p className="text-sm sm:text-base text-[#526057]">
            Submit a booking request anytime—our Dehradun coordination team matches your pet with an approved, available caregiver before confirming.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onStartBooking()}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#1B4332] text-white text-sm font-semibold hover:bg-[#143326] whitespace-nowrap shrink-0 cursor-pointer self-start"
        >
          Start Booking Request
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Services Strip */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold text-[#1A221D]">Available Services</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {activeServices.map((svc) => (
            <div
              key={svc.slug}
              className="rounded-2xl border border-[#E6E2D8] bg-white overflow-hidden flex flex-col"
            >
              <SafeImage
                src={svc.imageUrl || SERVICE_IMAGES[svc.slug] || HERO_IMAGE_URL}
                alt={svc.name}
                aspectClass="aspect-[4/3]"
                fallbackLabel={svc.name}
              />
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-semibold text-base text-[#1A221D]">{svc.name}</h3>
                    <span className="font-mono text-sm font-semibold text-[#1B4332] tabular-nums">
                      ₹{svc.customerPriceInr.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="text-xs text-[#6B786F] mt-0.5">{svc.durationLabel}</div>
                  <p className="text-xs text-[#526057] mt-2 leading-relaxed">{svc.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onStartBooking(svc.slug)}
                  className="w-full py-2 rounded-xl bg-[#F1F6F2] text-[#1B4332] text-xs font-semibold hover:bg-[#1B4332] hover:text-white transition-colors cursor-pointer"
                >
                  Request {svc.name}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Approved Caregivers Directory */}
      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-[#1A221D]">
              Admin-Verified Caregivers
            </h2>
            <p className="text-xs text-[#526057]">
              Only caregivers who have completed admin verification appear here.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#EFECE4]">
            <button
              type="button"
              onClick={() => setServiceFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                serviceFilter === 'all'
                  ? 'bg-white text-[#1A221D] shadow-xs'
                  : 'text-[#526057] hover:text-[#1A221D]'
              }`}
            >
              All Services
            </button>
            {activeServices.map((s) => (
              <button
                key={s.slug}
                type="button"
                onClick={() => setServiceFilter(s.name)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  serviceFilter === s.name
                    ? 'bg-white text-[#1A221D] shadow-xs'
                    : 'text-[#526057] hover:text-[#1A221D]'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <SkeletonRow className="h-44" />
            <SkeletonRow className="h-44" />
            <SkeletonRow className="h-44" />
          </div>
        ) : filteredCaregivers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D4CFC4] bg-white p-8 text-center space-y-3">
            <UserCheck className="w-8 h-8 text-[#2D6A4F] mx-auto" />
            <h3 className="font-semibold text-base text-[#1A221D]">
              No approved caregivers matched this filter yet
            </h3>
            <p className="text-sm text-[#526057] max-w-lg mx-auto">
              You can still submit a booking request and our Dehradun team will coordinate caregiver assignment, or apply to become a verified PawCare caregiver.
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => onStartBooking()}
                className="px-4 py-2 rounded-xl bg-[#1B4332] text-white text-xs font-semibold cursor-pointer"
              >
                Submit Booking Request
              </button>
              <button
                type="button"
                onClick={onBecomeCaregiver}
                className="px-4 py-2 rounded-xl border border-[#D4CFC4] text-[#1A221D] text-xs font-semibold cursor-pointer"
              >
                Apply as Caregiver
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredCaregivers.map((cg) => (
              <div
                key={cg.uid}
                className="rounded-2xl border border-[#E6E2D8] bg-white p-5 space-y-3"
              >
                <div className="flex items-start gap-3.5">
                  <SafeImage
                    src={cg.photoUrl}
                    alt={cg.displayName}
                    aspectClass="w-14 h-14 rounded-xl shrink-0"
                    fallbackLabel=""
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-semibold text-base text-[#1A221D] truncate">
                        {cg.displayName}
                      </h3>
                      <ShieldCheck
                        className="w-4 h-4 text-[#1B4332] shrink-0"
                        aria-label="Admin Approved Caregiver"
                      />
                    </div>
                    <div className="text-xs text-[#526057] flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{cg.city}</span>
                      <span aria-hidden="true">·</span>
                      <span>{cg.isAvailable ? 'Available' : 'Currently Unavailable'}</span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-[#445249] leading-relaxed line-clamp-3">
                  {cg.intro}
                </p>
                <div className="text-xs text-[#526057] pt-2 border-t border-[#EFECE4] space-y-1">
                  <div>
                    <strong className="text-[#1A221D]">Services:</strong>{' '}
                    {cg.servicesOffered.join(' · ')}
                  </div>
                  <div>
                    <strong className="text-[#1A221D]">Pets handled:</strong>{' '}
                    {cg.petTypesHandled.join(' · ')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </PageReveal>
  );
}
