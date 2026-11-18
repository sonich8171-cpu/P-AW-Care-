import type { ServiceItem, WebsiteContent } from '../types/pawcare';

export const HERO_IMAGE_URL = '/src/assets/images/hero_dehradun_petcare_1794982936400.jpg';

export const SERVICE_IMAGES: Record<string, string> = {
  pet_sitting: '/src/assets/images/service_pet_sitting_1794982936923.jpg',
  pet_feeding: '/src/assets/images/service_pet_feeding_1794982937606.jpg',
  dog_walking: '/src/assets/images/service_dog_walking_1794982937196.jpg',
  basic_pet_care: '/src/assets/images/service_basic_care_1794982938166.jpg',
};

export const DEHRADUN_AREAS = [
  'Rajpur Road',
  'Jakhan',
  'Vasant Vihar',
  'Clement Town',
  'Ballupur',
  'GMS Road',
  'Dalanwala',
  'Race Course',
  'Prem Nagar',
  'Sahastradhara Road',
];

export const TIME_SLOTS = [
  '07:00 AM - 08:00 AM',
  '08:30 AM - 09:30 AM',
  '10:00 AM - 12:00 PM',
  '12:30 PM - 02:30 PM',
  '04:00 PM - 05:30 PM',
  '06:00 PM - 07:30 PM',
  '08:00 PM - 09:00 PM',
];

export const AVAILABILITY_DAYS = [
  'Mon Morning',
  'Mon Evening',
  'Tue Morning',
  'Tue Evening',
  'Wed Morning',
  'Wed Evening',
  'Thu Morning',
  'Thu Evening',
  'Fri Morning',
  'Fri Evening',
  'Sat Full Day',
  'Sun Full Day',
];

export const DEFAULT_SERVICES: ServiceItem[] = [
  {
    id: 'pet_sitting',
    slug: 'pet_sitting',
    name: 'Pet Sitting',
    shortDescription: 'Calm, attentive in-home companionship while you work, study, or travel.',
    description:
      'A screened PawCare caregiver stays with your pet in a familiar environment, following their daily comfort routine, playtime, and rest schedule.',
    durationLabel: '4 Hours',
    durationMinutes: 240,
    customerPriceInr: 500,
    active: true,
    imageUrl: SERVICE_IMAGES.pet_sitting,
  },
  {
    id: 'pet_feeding',
    slug: 'pet_feeding',
    name: 'Pet Feeding',
    shortDescription: 'Scheduled meal visits, fresh water refills, and bowl hygiene checks.',
    description:
      'Reliable drop-in visits to serve exact portions according to your feeding notes, refresh drinking water, and ensure your pet is settled.',
    durationLabel: '45 Minutes',
    durationMinutes: 45,
    customerPriceInr: 300,
    active: true,
    imageUrl: SERVICE_IMAGES.pet_feeding,
  },
  {
    id: 'dog_walking',
    slug: 'dog_walking',
    name: 'Dog Walking',
    shortDescription: 'Safe neighbourhood leash walks paced to your dog’s energy and age.',
    description:
      'Individual morning or evening walks across safe residential lanes in Dehradun with fresh water breaks and post-walk paw wipe-downs.',
    durationLabel: '45 Minutes',
    durationMinutes: 45,
    customerPriceInr: 350,
    active: true,
    imageUrl: SERVICE_IMAGES.dog_walking,
  },
  {
    id: 'basic_pet_care',
    slug: 'basic_pet_care',
    name: 'Basic Pet Care',
    shortDescription: 'Coat brushing, litter or bedding tidy-up, and everyday comfort support.',
    description:
      'Non-medical everyday care covering gentle brushing, ear/coat wipe-downs, litter hygiene, and calm supervision for dogs, cats, and small pets.',
    durationLabel: '90 Minutes',
    durationMinutes: 90,
    customerPriceInr: 450,
    active: true,
    imageUrl: SERVICE_IMAGES.basic_pet_care,
  },
];

export const DEFAULT_WEBSITE_CONTENT: WebsiteContent = {
  sectionKey: 'main',
  heroHeadline: 'Your Pet Deserves Love, Care & Happiness — Every Day.',
  heroSubtext:
    'Find trusted pet-care support when you are busy, working, studying, or travelling. PawCare makes everyday sitting, feeding, walking, and comfort care effortless across Dehradun.',
  announcementText:
    'Now onboarding pet parents and caregivers across Dehradun, Uttarakhand.',
  announcementActive: true,
  dehradunIntro:
    'Launching across Dehradun neighbourhoods—from Rajpur Road, Jakhan, and Dalanwala to Vasant Vihar, Clement Town, and Prem Nagar—PawCare supports college students, working professionals, and families with dependable everyday care.',
  contactEmail: 'care@pawcare.in',
  contactPhone: '+91 135 000 0000',
  contactAddress: 'Rajpur Road, Dehradun, Uttarakhand 248001',
  serviceHours: 'Daily, 7:00 AM – 9:00 PM IST',
  faqItems: [
    {
      question: 'What services does PawCare currently offer?',
      answer:
        'PawCare currently focuses on four everyday non-medical services: Pet Sitting, Pet Feeding, Dog Walking, and Basic Pet Care. We do not offer veterinary diagnosis, emergency medical care, or professional training.',
    },
    {
      question: 'How are PawCare caregivers verified?',
      answer:
        'Every caregiver submits a detailed application with experience, pet types handled, and availability. An administrator manually reviews each application before changing status to Approved.',
    },
    {
      question: 'How does booking confirmation and cancellation work?',
      answer:
        'When you submit a booking request, its status starts as Pending. You can cancel a Pending, Accepted, or Confirmed booking from your dashboard with a reason before service starts. Once a booking is In Progress or Completed, it cannot be cancelled.',
    },
    {
      question: 'Where is PawCare available right now?',
      answer:
        'PawCare is launching exclusively in Dehradun, Uttarakhand to ensure reliable local coordination and quality service oversight.',
    },
    {
      question: 'What happens if my pet has a medical emergency?',
      answer:
        'PawCare provides everyday non-medical support only. In any medical emergency or illness, please contact a qualified veterinarian or local emergency clinic in Dehradun immediately.',
    },
  ],
};

export const BOOKING_STATUS_META: Record<
  string,
  { label: string; toneClass: string; description: string }
> = {
  pending: {
    label: 'Pending',
    toneClass: 'text-amber-800 bg-amber-50 border-amber-200',
    description: 'Awaiting caregiver assignment or acceptance.',
  },
  accepted: {
    label: 'Accepted',
    toneClass: 'text-sky-800 bg-sky-50 border-sky-200',
    description: 'Caregiver accepted; awaiting final admin confirmation.',
  },
  rejected: {
    label: 'Rejected',
    toneClass: 'text-rose-800 bg-rose-50 border-rose-200',
    description: 'Request could not be fulfilled for this slot.',
  },
  confirmed: {
    label: 'Confirmed',
    toneClass: 'text-emerald-900 bg-emerald-50 border-emerald-200',
    description: 'Caregiver confirmed and scheduled.',
  },
  in_progress: {
    label: 'In Progress',
    toneClass: 'text-teal-900 bg-teal-50 border-teal-200',
    description: 'Caregiver is currently caring for your pet.',
  },
  completed: {
    label: 'Completed',
    toneClass: 'text-[#1B4332] bg-[#E8F3EC] border-[#C5DEC9]',
    description: 'Service finished successfully.',
  },
  cancelled: {
    label: 'Cancelled',
    toneClass: 'text-stone-700 bg-stone-100 border-stone-200',
    description: 'Cancelled prior to completion.',
  },
};

export const CAREGIVER_STATUS_META: Record<
  string,
  { label: string; toneClass: string }
> = {
  submitted: {
    label: 'Application Submitted',
    toneClass: 'text-amber-800 bg-amber-50 border-amber-200',
  },
  under_review: {
    label: 'Under Review',
    toneClass: 'text-sky-800 bg-sky-50 border-sky-200',
  },
  approved: {
    label: 'Approved',
    toneClass: 'text-emerald-900 bg-emerald-50 border-emerald-200',
  },
  rejected: {
    label: 'Rejected',
    toneClass: 'text-rose-800 bg-rose-50 border-rose-200',
  },
  suspended: {
    label: 'Suspended',
    toneClass: 'text-stone-700 bg-stone-200 border-stone-300',
  },
};

export const ACHIEVEMENT_DEFS = [
  {
    id: 'first_runner_win',
    title: 'Trail Blazer',
    description: 'Score 120+ points in a single PawCare Pet Runner run.',
    pointsHint: 'PawCare Pet Runner',
  },
  {
    id: 'memory_master',
    title: 'Sharp Snout',
    description: 'Complete a full Paw Memory Match board.',
    pointsHint: 'Paw Memory Match',
  },
  {
    id: 'treat_catcher_champ',
    title: 'Snack Keeper',
    description: 'Score 150+ points in Pet Treat Catcher without losing all lives.',
    pointsHint: 'Pet Treat Catcher',
  },
  {
    id: 'five_games_played',
    title: 'Play Zone Regular',
    description: 'Complete 5 mini-game sessions on PawCare.',
    pointsHint: '5 Sessions',
  },
  {
    id: 'three_day_streak',
    title: '3-Day Play Streak',
    description: 'Play in the PawCare Play Zone on 3 consecutive days.',
    pointsHint: '3-Day Streak',
  },
  {
    id: 'weekly_streak',
    title: '7-Day Paw Champion',
    description: 'Maintain a 7-day daily play streak.',
    pointsHint: '7-Day Streak',
  },
];
