import React, { useState } from 'react';
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  Clock,
  HeartHandshake,
  Mail,
  MapPin,
  PawPrint,
  Phone,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { DEHRADUN_AREAS, HERO_IMAGE_URL, SERVICE_IMAGES } from '../../lib/defaults';
import type { AppView } from '../../types/pawcare';
import { FadeSlideIn, PageReveal } from '../ui/MotionPrimitives';
import { SafeImage } from '../ui/SafeImage';

interface HomePageProps {
  onNavigate: (view: AppView, sectionId?: string) => void;
  onStartBooking: (serviceSlug?: string) => void;
}

export function HomePage({ onNavigate, onStartBooking }: HomePageProps) {
  const { services, servicesLoadedFromDb, websiteContent } = useAuth();
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  const activeServices = services.filter((s) => s.active);
  const faqItems = websiteContent.faqItems || [];

  return (
    <PageReveal>
      {/* 1. Cinematic Hero Showcase */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-12 lg:pt-8 lg:pb-16 space-y-6">
        <div className="relative rounded-3xl overflow-hidden border border-[#1B4332]/20 bg-[#1B4332] shadow-xl min-h-[430px] lg:min-h-[500px] flex items-center">
          {/* Full Background Pet Photography */}
          <img
            src={HERO_IMAGE_URL}
            alt="Illustrative pet-care walk in Dehradun with a golden retriever"
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
          {/* Deep Forest-Green Gradient Overlay */}
          <div
            className="absolute inset-0 bg-gradient-to-r from-[#0F2A1F]/95 via-[#1B4332]/84 to-[#1B4332]/35"
            aria-hidden="true"
          />

          {/* Subtle Decorative Paw Watermarks */}
          <PawPrint
            className="hidden md:block absolute top-8 right-10 w-16 h-16 text-[#FDE68A]/15 rotate-12 pointer-events-none"
            aria-hidden="true"
          />
          <PawPrint
            className="hidden md:block absolute bottom-10 right-24 w-10 h-10 text-emerald-200/20 -rotate-12 pointer-events-none"
            aria-hidden="true"
          />

          <div className="relative z-10 p-6 sm:p-10 lg:p-14 max-w-2xl space-y-5 text-white">
            <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-[#FDE68A]">
              <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Dehradun, Uttarakhand · Trusted Everyday Pet Care</span>
            </div>

            <h1 className="font-display text-3xl sm:text-5xl lg:text-[3.35rem] font-bold tracking-tight leading-[1.08] [text-wrap:balance]">
              {websiteContent.heroHeadline ||
                'Your Pet Deserves Love, Care & Happiness — Every Day.'}
            </h1>

            <p className="text-sm sm:text-base lg:text-lg text-emerald-50/90 leading-relaxed max-w-xl">
              {websiteContent.heroSubtext ||
                'Find trusted pet-care support when you are busy, working, studying, or travelling. PawCare makes everyday sitting, feeding, walking, and comfort care effortless across Dehradun.'}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => onStartBooking()}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#FBBF24] text-[#1A221D] text-sm font-bold hover:bg-[#F59E0B] transition-all hover:-translate-y-0.5 shadow-md cursor-pointer"
              >
                <span>Book Pet Care</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('play-zone')}
                className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl bg-white/15 backdrop-blur-xs border border-white/25 text-white text-sm font-semibold hover:bg-white/25 transition-colors cursor-pointer"
              >
                Explore Play Zone
              </button>
              <button
                type="button"
                onClick={() => onNavigate('apply-caregiver')}
                className="inline-flex items-center gap-2 px-4 py-3.5 rounded-xl text-emerald-100 text-sm font-semibold hover:text-white underline underline-offset-4 cursor-pointer"
              >
                Become a Caregiver
              </button>
            </div>

            <div className="pt-4 border-t border-white/15 grid grid-cols-3 gap-4 text-[11px] sm:text-xs text-emerald-100">
              <div>
                <div className="font-semibold text-white">4 Focused Services</div>
                <div className="opacity-85">Sitting, feeding, walking &amp; care</div>
              </div>
              <div>
                <div className="font-semibold text-white">Admin-Screened</div>
                <div className="opacity-85">Manual review before approval</div>
              </div>
              <div>
                <div className="font-semibold text-white">Live Tracking</div>
                <div className="opacity-85">Pending to Completed updates</div>
              </div>
            </div>
          </div>

          <span className="hidden sm:block absolute bottom-3 right-5 z-10 text-[10px] text-emerald-100/75">
            Illustrative pet-care photography · PawCare Dehradun
          </span>
        </div>

        {/* Quick 5-Item Highlight Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {activeServices.slice(0, 4).map((svc) => (
            <button
              key={svc.slug}
              type="button"
              onClick={() => onStartBooking(svc.slug)}
              className="text-left p-4 rounded-2xl bg-white border border-[#E6E2D8] hover:border-[#2D6A4F]/60 hover:shadow-sm transition-all cursor-pointer space-y-1"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-display font-bold text-sm text-[#1A221D]">
                  {svc.name}
                </span>
                <span className="font-mono text-xs font-bold text-[#1B4332] tabular-nums">
                  ₹{svc.customerPriceInr}
                </span>
              </div>
              <div className="text-[11px] text-[#526057] truncate">{svc.durationLabel}</div>
            </button>
          ))}
          <button
            type="button"
            onClick={() => onNavigate('play-zone')}
            className="col-span-2 sm:col-span-1 text-left p-4 rounded-2xl bg-gradient-to-br from-[#F1F6F2] to-[#E8F3EC] border border-[#B7D7C2] hover:border-[#1B4332] transition-all cursor-pointer space-y-1"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-display font-bold text-sm text-[#1B4332]">
                Play Zone &amp; Rewards
              </span>
              <PawPrint className="w-4 h-4 text-[#D97706]" />
            </div>
            <div className="text-[11px] text-[#2D6A4F]">3 Mini-Games &amp; Badges</div>
          </button>
        </div>
      </section>

      {/* 2. Our Pet-Care Services */}
      <section id="services" className="bg-white border-y border-[#E6E2D8] py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-10">
          <FadeSlideIn>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="space-y-2 max-w-2xl">
                <div className="text-xs font-medium text-[#2D6A4F]">Our Pet-Care Services</div>
                <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#1A221D] tracking-tight">
                  Dependable Everyday Support, Without Hidden Surprises
                </h2>
                <p className="text-sm sm:text-base text-[#526057]">
                  Non-medical pet care designed around your pet’s home routine.{' '}
                  {!servicesLoadedFromDb &&
                    'Displayed tariffs reflect initial admin-configurable launch settings.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('find-care')}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1B4332] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                Explore Care Directory
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </FadeSlideIn>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {activeServices.map((svc, idx) => (
              <FadeSlideIn key={svc.slug} delay={idx * 0.05}>
                <article className="group h-full flex flex-col rounded-2xl border border-[#E6E2D8] bg-[#FAF8F4] overflow-hidden hover:border-[#2D6A4F]/50 transition-colors">
                  <SafeImage
                    src={svc.imageUrl || SERVICE_IMAGES[svc.slug] || HERO_IMAGE_URL}
                    alt={`${svc.name} illustrative scene`}
                    aspectClass="aspect-[4/3]"
                    zoomOnHover
                    fallbackLabel={svc.name}
                  />
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="font-display text-lg font-bold text-[#1A221D]">
                          {svc.name}
                        </h3>
                        <span className="font-mono text-sm font-semibold text-[#1B4332] tabular-nums">
                          ₹{svc.customerPriceInr.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="text-xs text-[#6B786F]">
                        {svc.durationLabel} · Non-medical home care
                      </div>
                      <p className="text-sm text-[#445249] leading-relaxed">
                        {svc.shortDescription}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onStartBooking(svc.slug)}
                      className="w-full py-2.5 rounded-xl bg-white border border-[#D4CFC4] text-sm font-semibold text-[#1B4332] hover:bg-[#1B4332] hover:text-white hover:border-[#1B4332] transition-colors cursor-pointer"
                    >
                      Book {svc.name}
                    </button>
                  </div>
                </article>
              </FadeSlideIn>
            ))}
          </div>

          <p className="text-xs text-[#6B786F]">
            Scope note: PawCare provides pet sitting, feeding, dog walking, and basic non-medical care only. For veterinary diagnosis, illness treatment, or emergencies, please contact a qualified veterinarian.
          </p>
        </div>
      </section>

      {/* 3. Why Choose PawCare & 4. How PawCare Works */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20 space-y-16">
        <FadeSlideIn>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5 space-y-3">
              <div className="text-xs font-medium text-[#2D6A4F]">Why Choose PawCare</div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#1A221D] tracking-tight">
                Built for Trust, Affordability, and Local Accountability
              </h2>
              <p className="text-sm sm:text-base text-[#526057] leading-relaxed">
                Pet parents shouldn’t have to rely on last-minute favors or unverified social media posts when classes, shifts, or trips come up.
              </p>
            </div>
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="p-5 rounded-2xl bg-white border border-[#E6E2D8] space-y-2">
                <ShieldCheck className="w-5 h-5 text-[#1B4332]" />
                <h3 className="font-semibold text-base text-[#1A221D]">
                  Screened Before Approval
                </h3>
                <p className="text-sm text-[#526057] leading-relaxed">
                  Caregivers never appear as approved until an administrator reviews their background, pet experience, and availability.
                </p>
              </div>
              <div className="p-5 rounded-2xl bg-white border border-[#E6E2D8] space-y-2">
                <CalendarCheck className="w-5 h-5 text-[#1B4332]" />
                <h3 className="font-semibold text-base text-[#1A221D]">
                  Clear Booking Lifecycle
                </h3>
                <p className="text-sm text-[#526057] leading-relaxed">
                  Every booking moves through verifiable backend states—Pending, Accepted, Confirmed, In Progress, and Completed.
                </p>
              </div>
              <div className="p-5 rounded-2xl bg-white border border-[#E6E2D8] space-y-2">
                <PawPrint className="w-5 h-5 text-[#1B4332]" />
                <h3 className="font-semibold text-base text-[#1A221D]">
                  Detailed Pet Care Notes
                </h3>
                <p className="text-sm text-[#526057] leading-relaxed">
                  Save feeding amounts, temperament notes, and care instructions once in My Pets and reuse them on every booking.
                </p>
              </div>
              <div className="p-5 rounded-2xl bg-white border border-[#E6E2D8] space-y-2">
                <HeartHandshake className="w-5 h-5 text-[#1B4332]" />
                <h3 className="font-semibold text-base text-[#1A221D]">
                  Direct Support &amp; Coordination
                </h3>
                <p className="text-sm text-[#526057] leading-relaxed">
                  Message PawCare Support directly from your dashboard or floating support inbox whenever plans change.
                </p>
              </div>
            </div>
          </div>
        </FadeSlideIn>

        {/* 4. How PawCare Works */}
        <FadeSlideIn>
          <div className="rounded-2xl bg-[#F1F6F2] border border-[#D7E6DC] p-6 sm:p-10 space-y-8">
            <div className="space-y-2 max-w-2xl">
              <div className="text-xs font-medium text-[#2D6A4F]">How PawCare Works</div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#1A221D]">
                Four Clear Steps From Request to Completion
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  num: '01.',
                  title: 'Create Profile & Add Pets',
                  body: 'Sign in with Google or email and save your pet’s breed, age, feeding routine, and behavior notes.',
                },
                {
                  num: '02.',
                  title: 'Choose Service & Time',
                  body: 'Pick Sitting, Feeding, Walking, or Basic Care, choose your Dehradun address, and review the locked tariff.',
                },
                {
                  num: '03.',
                  title: 'Caregiver Assignment',
                  body: 'An admin checks availability and assigns an approved caregiver. You see live status changes in your portal.',
                },
                {
                  num: '04.',
                  title: 'Care & Completion',
                  body: 'Coordinate with your assigned caregiver inside your booking thread until care is marked Completed.',
                },
              ].map((item) => (
                <div key={item.num} className="space-y-2">
                  <div className="font-mono text-sm font-semibold text-[#1B4332]">{item.num}</div>
                  <h3 className="font-semibold text-base text-[#1A221D]">{item.title}</h3>
                  <p className="text-sm text-[#445249] leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </FadeSlideIn>
      </section>

      {/* 5. Caregiver Trust & Verification + 6. Customer Benefits */}
      <section className="bg-white border-y border-[#E6E2D8] py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10">
          <FadeSlideIn className="lg:col-span-6 space-y-5">
            <div className="text-xs font-medium text-[#2D6A4F]">Caregiver Trust &amp; Verification</div>
            <h2 className="font-display text-3xl font-bold text-[#1A221D] tracking-tight">
              No Unverified Caregivers Ever Appear as Approved
            </h2>
            <p className="text-sm sm:text-base text-[#526057] leading-relaxed">
              Every caregiver applicant goes through an administrator-controlled verification workflow before they can accept bookings or appear in the Find Care directory.
            </p>
            <ul className="space-y-3 text-sm text-[#1A221D]">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#1B4332] shrink-0 mt-0.5" />
                <span>
                  <strong>Application Submitted &amp; Under Review:</strong> Applicants submit pet-handling experience, service scope, and local Dehradun availability.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#1B4332] shrink-0 mt-0.5" />
                <span>
                  <strong>Admin-Only Approval Gate:</strong> Only verified administrators can approve, reject (with feedback), or suspend caregiver profiles.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#1B4332] shrink-0 mt-0.5" />
                <span>
                  <strong>Strict Privacy Boundaries:</strong> Caregivers only see pet instructions for bookings explicitly assigned to them.
                </span>
              </li>
            </ul>
          </FadeSlideIn>

          <FadeSlideIn delay={0.08} className="lg:col-span-6 space-y-5">
            <div className="text-xs font-medium text-[#2D6A4F]">Who PawCare Serves</div>
            <h2 className="font-display text-3xl font-bold text-[#1A221D] tracking-tight">
              Designed for Busy Pet Parents Across Dehradun
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  title: 'College Students',
                  desc: 'Support during classes, exams, or short semester travel back home.',
                },
                {
                  title: 'Working Professionals',
                  desc: 'Mid-day dog walks and timely meal visits during long office hours.',
                },
                {
                  title: 'Frequent Travellers',
                  desc: 'Scheduled sitting and feeding updates while you are out of station.',
                },
                {
                  title: 'Families Needing Relief',
                  desc: 'Extra hands for coat brushing, litter tidy-up, and everyday pet routines.',
                },
              ].map((who) => (
                <div
                  key={who.title}
                  className="p-4 rounded-xl bg-[#FAF8F4] border border-[#E6E2D8] space-y-1.5"
                >
                  <h3 className="font-semibold text-sm text-[#1A221D]">{who.title}</h3>
                  <p className="text-xs sm:text-sm text-[#526057] leading-relaxed">{who.desc}</p>
                </div>
              ))}
            </div>
          </FadeSlideIn>
        </div>
      </section>

      {/* 7. Dehradun-Focused Service Introduction & 8. Honest Customer Feedback */}
      <section id="about-dehradun" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20 space-y-14">
        <FadeSlideIn>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4">
              <div className="text-xs font-medium text-[#2D6A4F]">Local Launch Market</div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#1A221D] tracking-tight">
                Focused First on Dehradun, Uttarakhand
              </h2>
              <p className="text-sm sm:text-base text-[#445249] leading-relaxed">
                {websiteContent.dehradunIntro}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#526057] pt-1">
                {DEHRADUN_AREAS.map((area) => (
                  <span key={area} className="inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-[#2D6A4F]" />
                    {area}
                  </span>
                ))}
              </div>
            </div>
            <div className="lg:col-span-5 rounded-2xl bg-white border border-[#E6E2D8] p-6 space-y-3">
              <div className="text-xs font-medium text-[#2D6A4F]">Customer Feedback</div>
              <h3 className="font-display text-xl font-bold text-[#1A221D]">
                Early Launch Transparency
              </h3>
              <p className="text-sm text-[#526057] leading-relaxed">
                PawCare is currently onboarding its founding Dehradun pet parents and caregivers. We do not publish fabricated reviews or placeholder ratings—verified customer feedback will appear here once initial bookings are completed.
              </p>
              <button
                type="button"
                onClick={() => onStartBooking()}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1B4332] hover:underline cursor-pointer"
              >
                Book your first care session
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </FadeSlideIn>

        {/* 9. Become a Caregiver CTA */}
        <FadeSlideIn>
          <div className="rounded-2xl bg-[#1B4332] text-white p-8 sm:p-12 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2.5 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 text-xs text-emerald-200 font-medium">
                <UserCheck className="w-4 h-4" />
                Caregiver Onboarding · Dehradun
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
                Experienced With Dogs, Cats, or Small Pets? Join PawCare.
              </h2>
              <p className="text-sm sm:text-base text-emerald-100 leading-relaxed">
                Submit your caregiver application with your schedule and experience. Once verified by an admin, manage your availability and assigned bookings from your Caregiver Portal.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('apply-caregiver')}
              className="px-6 py-3.5 rounded-xl bg-white text-[#1B4332] text-sm font-semibold hover:bg-[#F1F6F2] transition-colors whitespace-nowrap shrink-0 cursor-pointer self-start lg:self-center"
            >
              Apply as a Caregiver
            </button>
          </div>
        </FadeSlideIn>
      </section>

      {/* 10. FAQ */}
      <section className="bg-white border-y border-[#E6E2D8] py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="space-y-2">
            <div className="text-xs font-medium text-[#2D6A4F]">Frequently Asked Questions</div>
            <h2 className="font-display text-3xl font-bold text-[#1A221D]">
              Clear Answers Before You Book
            </h2>
          </div>

          <div className="divide-y divide-[#E6E2D8] border-y border-[#E6E2D8]">
            {faqItems.map((item, idx) => {
              const isOpen = openFaqIdx === idx;
              return (
                <div key={idx} className="py-4">
                  <button
                    type="button"
                    onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between gap-4 text-left font-semibold text-base text-[#1A221D] py-1 cursor-pointer"
                  >
                    <span>{item.question}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-[#526057] shrink-0 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <p className="mt-2.5 text-sm text-[#445249] leading-relaxed pr-6">
                      {item.answer}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 11. Contact Section */}
      <section id="contact" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="rounded-2xl border border-[#E6E2D8] bg-white p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-3">
            <div className="text-xs font-medium text-[#2D6A4F]">Contact PawCare</div>
            <h2 className="font-display text-3xl font-bold text-[#1A221D]">
              Need Help Choosing a Service or Managing a Booking?
            </h2>
            <p className="text-sm sm:text-base text-[#526057] leading-relaxed">
              Use the <strong>Message PawCare Support</strong> button at the bottom-right to open a tracked conversation with our team, or reach us during Dehradun service hours.
            </p>
          </div>
          <div className="lg:col-span-5 space-y-3 text-sm text-[#1A221D]">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-[#1B4332] shrink-0" />
              <span>{websiteContent.contactEmail}</span>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-[#1B4332] shrink-0" />
              <span className="font-mono tabular-nums">{websiteContent.contactPhone}</span>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-[#1B4332] shrink-0" />
              <span>{websiteContent.contactAddress}</span>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-[#1B4332] shrink-0" />
              <span>{websiteContent.serviceHours}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 12. Quiet Professional Footer */}
      <footer className="border-t border-[#E6E2D8] bg-[#FAF8F4] py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#526057]">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 font-display font-bold text-sm text-[#1B4332]">
              <PawPrint className="w-4 h-4" />
              PawCare
            </div>
            <div>Trusted Care for Your Beloved Pets · Dehradun, Uttarakhand</div>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <button
              type="button"
              onClick={() => onNavigate('find-care')}
              className="hover:text-[#1B4332] cursor-pointer"
            >
              Find Care
            </button>
            <button
              type="button"
              onClick={() => onNavigate('apply-caregiver')}
              className="hover:text-[#1B4332] cursor-pointer"
            >
              Become a Caregiver
            </button>
            <button
              type="button"
              onClick={() => onNavigate('home', 'contact')}
              className="hover:text-[#1B4332] cursor-pointer"
            >
              Contact
            </button>
            <span>© {new Date().getFullYear()} PawCare</span>
          </div>
        </div>
      </footer>
    </PageReveal>
  );
}
