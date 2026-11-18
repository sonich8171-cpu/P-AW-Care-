import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'customer' | 'caregiver' | 'admin';
export type AccountStatus = 'active' | 'suspended';

export type AnimalType = 'Dog' | 'Cat' | 'Bird' | 'Rabbit' | 'Other';
export type PetSize = 'Small' | 'Medium' | 'Large' | 'Extra Large';

export type CaregiverApplicationStatus =
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'suspended';

export type BookingStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type ConversationType = 'support' | 'booking_chat';
export type ConversationStatus = 'open' | 'pending' | 'resolved';
export type NotificationCategory = 'booking' | 'caregiver' | 'support' | 'account';

export const SCHEMA_LIMITS = {
  FULL_NAME_MAX: 120,
  EMAIL_MAX: 254,
  PHONE_MAX: 24,
  CITY_MAX: 80,
  PHOTO_MAX: 200000,
  PET_NAME_MAX: 80,
  BREED_MAX: 80,
  AGE_MAX: 40,
  NOTES_MAX: 1000,
  EXPERIENCE_MAX: 1500,
  INTRO_MAX: 1500,
  AVAILABILITY_MAX: 500,
  SERVICE_NAME_MAX: 100,
  SHORT_DESC_MAX: 240,
  SERVICE_DESC_MAX: 1500,
  ADDRESS_MAX: 300,
  INSTRUCTIONS_MAX: 1500,
  REASON_MAX: 500,
  SUBJECT_MAX: 160,
  MESSAGE_MAX: 2000,
} as const;

export const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  phone?: string;
  city: string;
  photoUrl?: string;
  role: UserRole;
  status: AccountStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PetProfile {
  id: string;
  ownerId: string;
  name: string;
  animalType: AnimalType;
  breed?: string;
  age: string;
  size: PetSize;
  photoUrl?: string;
  behaviorNotes?: string;
  feedingInstructions?: string;
  specialCareInstructions?: string;
  medicationNotes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CaregiverApplication {
  id: string;
  uid: string;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  photoUrl?: string;
  experienceSummary: string;
  petTypesHandled: string[];
  servicesOffered: string[];
  availabilitySummary: string;
  intro: string;
  status: CaregiverApplicationStatus;
  rejectionReason?: string;
  reviewedBy?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CaregiverPublicProfile {
  id: string;
  uid: string;
  displayName: string;
  city: string;
  photoUrl?: string;
  experienceSummary: string;
  petTypesHandled: string[];
  servicesOffered: string[];
  availabilitySlots: string[];
  unavailableDates?: string[];
  isAvailable: boolean;
  intro: string;
  verificationStatus: 'approved' | 'suspended';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ServiceItem {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  durationLabel: string;
  durationMinutes: number;
  customerPriceInr: number;
  active: boolean;
  imageUrl?: string;
  updatedAt?: Timestamp;
}

export interface InternalPricing {
  id: string;
  serviceId: string;
  serviceName: string;
  customerPriceInr: number;
  variableCostInr: number;
  platformCommissionInr: number;
  notes?: string;
  updatedBy: string;
  updatedAt: Timestamp;
}

export interface PricingHistoryItem {
  id: string;
  serviceId: string;
  serviceName: string;
  previousCustomerPriceInr: number;
  newCustomerPriceInr: number;
  newVariableCostInr: number;
  newCommissionInr: number;
  changedBy: string;
  changedAt: Timestamp;
}

export interface Booking {
  id: string;
  customerId: string;
  customerName: string;
  petId: string;
  petName: string;
  petAnimalType: string;
  petCareSummary?: string;
  serviceId: string;
  serviceName: string;
  requestedDate: string;
  requestedTime: string;
  durationMinutes: number;
  serviceLocation: string;
  city: string;
  customerInstructions?: string;
  assignedCaregiverId: string;
  assignedCaregiverName: string;
  priceSnapshotInr: number;
  status: BookingStatus;
  cancellationReason?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  customerId: string;
  customerName: string;
  assignedCaregiverId: string;
  bookingId: string;
  subject: string;
  status: ConversationStatus;
  lastMessagePreview: string;
  lastMessageAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  text: string;
  createdAt: Timestamp;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  body: string;
  category: NotificationCategory;
  relatedId?: string;
  read: boolean;
  createdAt: Timestamp;
}

export interface FaqEntry {
  question: string;
  answer: string;
}

export interface WebsiteContent {
  sectionKey: string;
  heroHeadline?: string;
  heroSubtext?: string;
  announcementText?: string;
  announcementActive?: boolean;
  dehradunIntro?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactAddress?: string;
  serviceHours?: string;
  faqItems?: FaqEntry[];
  updatedAt?: Timestamp;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  targetCollection: string;
  targetId: string;
  summary: string;
  createdAt: Timestamp;
}

export type GameId = 'paw_runner' | 'paw_memory' | 'treat_catcher' | 'pet_rescue';

export interface GameSession {
  id: string;
  uid: string;
  gameId: GameId;
  score: number;
  pointsAwarded: number;
  durationSec: number;
  difficulty?: string;
  won: boolean;
  createdAt: Timestamp;
}

export interface RewardProfile {
  uid: string;
  totalPoints: number;
  gamesPlayed: number;
  bestRunnerScore: number;
  bestMemoryScore: number;
  bestCatcherScore: number;
  bestRescueScore?: number;
  achievements: string[];
  streakDays: number;
  lastPlayedDate: string;
  updatedAt: Timestamp;
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  pointsHint: string;
}

export type AppView =
  | 'home'
  | 'find-care'
  | 'apply-caregiver'
  | 'play-zone'
  | 'rewards'
  | 'customer-portal'
  | 'caregiver-portal'
  | 'admin-portal';
