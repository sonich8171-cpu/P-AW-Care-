import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  DEFAULT_SERVICES,
  DEFAULT_WEBSITE_CONTENT,
} from './defaults';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  ID_PATTERN,
  SCHEMA_LIMITS,
  type AccountStatus,
  type AnimalType,
  type Booking,
  type BookingStatus,
  type CaregiverApplication,
  type CaregiverApplicationStatus,
  type CaregiverPublicProfile,
  type ConversationStatus,
  type ConversationType,
  type GameId,
  type NotificationCategory,
  type PetProfile,
  type PetSize,
  type RewardProfile,
  type ServiceItem,
  type UserRole,
  type WebsiteContent,
} from '../types/pawcare';

function clampText(value: string | undefined | null, max: number): string {
  return (value ?? '').trim().slice(0, max);
}

function makeDocId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  const id = `${prefix}_${ts}_${rand}`;
  return id.replace(/[^a-zA-Z0-9_-]/g, '');
}

export async function recordAuditLog(params: {
  actorId: string;
  actorEmail: string;
  action: string;
  targetCollection: string;
  targetId: string;
  summary: string;
}): Promise<void> {
  const id = makeDocId('log');
  const path = `auditLogs/${id}`;
  try {
    await setDoc(doc(db, 'auditLogs', id), {
      actorId: clampText(params.actorId, 128),
      actorEmail: clampText(params.actorEmail, SCHEMA_LIMITS.EMAIL_MAX),
      action: clampText(params.action, 80),
      targetCollection: clampText(params.targetCollection, 64),
      targetId: clampText(params.targetId, 128),
      summary: clampText(params.summary, 500),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function createNotification(params: {
  userId: string;
  title: string;
  body: string;
  category: NotificationCategory;
  relatedId?: string;
}): Promise<void> {
  if (!ID_PATTERN.test(params.userId)) return;
  const id = makeDocId('notif');
  const path = `notifications/${id}`;
  try {
    const payload: Record<string, unknown> = {
      userId: params.userId,
      title: clampText(params.title, 140),
      body: clampText(params.body, 500),
      category: params.category,
      read: false,
      createdAt: serverTimestamp(),
    };
    if (params.relatedId) {
      payload.relatedId = clampText(params.relatedId, 128);
    }
    await setDoc(doc(db, 'notifications', id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const path = `notifications/${notificationId}`;
  try {
    await updateDoc(doc(db, 'notifications', notificationId), { read: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function seedInitialCatalogIfAdmin(adminUid: string): Promise<void> {
  try {
    const existingServices = await getDocs(collection(db, 'services'));
    const batch = writeBatch(db);
    let hasWrites = false;

    if (existingServices.empty) {
      for (const svc of DEFAULT_SERVICES) {
        batch.set(doc(db, 'services', svc.slug), {
          slug: svc.slug,
          name: svc.name,
          shortDescription: svc.shortDescription,
          description: svc.description,
          durationLabel: svc.durationLabel,
          durationMinutes: svc.durationMinutes,
          customerPriceInr: svc.customerPriceInr,
          active: svc.active,
          imageUrl: svc.imageUrl || '',
          updatedAt: serverTimestamp(),
        });

        batch.set(doc(db, 'pricing', svc.slug), {
          serviceId: svc.slug,
          serviceName: svc.name,
          customerPriceInr: svc.customerPriceInr,
          variableCostInr: svc.slug === 'pet_sitting' ? 300 : Math.round(svc.customerPriceInr * 0.6),
          platformCommissionInr:
            svc.slug === 'pet_sitting' ? 200 : Math.round(svc.customerPriceInr * 0.4),
          notes: 'Initial venture plan baseline — admin-configurable before live scale.',
          updatedBy: adminUid,
          updatedAt: serverTimestamp(),
        });
      }
      hasWrites = true;
    }

    const contentSnap = await getDoc(doc(db, 'websiteContent', 'main'));
    if (!contentSnap.exists()) {
      batch.set(doc(db, 'websiteContent', 'main'), {
        ...DEFAULT_WEBSITE_CONTENT,
        updatedAt: serverTimestamp(),
      });
      hasWrites = true;
    }

    if (hasWrites) {
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'services');
  }
}

// ---------- PETS ----------

export interface PetInput {
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
}

export async function savePetProfile(
  ownerId: string,
  input: PetInput,
  existingPetId?: string
): Promise<string> {
  const petId = existingPetId || makeDocId('pet');
  const path = `pets/${petId}`;
  const cleanPayload: Record<string, unknown> = {
    ownerId,
    name: clampText(input.name, SCHEMA_LIMITS.PET_NAME_MAX),
    animalType: input.animalType,
    age: clampText(input.age, SCHEMA_LIMITS.AGE_MAX),
    size: input.size,
    updatedAt: serverTimestamp(),
  };

  if (input.breed?.trim()) cleanPayload.breed = clampText(input.breed, SCHEMA_LIMITS.BREED_MAX);
  if (input.photoUrl?.trim()) cleanPayload.photoUrl = clampText(input.photoUrl, SCHEMA_LIMITS.PHOTO_MAX);
  if (input.behaviorNotes?.trim())
    cleanPayload.behaviorNotes = clampText(input.behaviorNotes, SCHEMA_LIMITS.NOTES_MAX);
  if (input.feedingInstructions?.trim())
    cleanPayload.feedingInstructions = clampText(
      input.feedingInstructions,
      SCHEMA_LIMITS.NOTES_MAX
    );
  if (input.specialCareInstructions?.trim())
    cleanPayload.specialCareInstructions = clampText(
      input.specialCareInstructions,
      SCHEMA_LIMITS.NOTES_MAX
    );
  if (input.medicationNotes?.trim())
    cleanPayload.medicationNotes = clampText(input.medicationNotes, SCHEMA_LIMITS.NOTES_MAX);

  try {
    if (existingPetId) {
      const updatePayload = { ...cleanPayload };
      delete updatePayload.ownerId;
      await updateDoc(doc(db, 'pets', petId), updatePayload);
    } else {
      cleanPayload.createdAt = serverTimestamp();
      await setDoc(doc(db, 'pets', petId), cleanPayload);
    }
    return petId;
  } catch (error) {
    handleFirestoreError(
      error,
      existingPetId ? OperationType.UPDATE : OperationType.CREATE,
      path
    );
  }
}

export async function deletePetProfile(petId: string): Promise<void> {
  const path = `pets/${petId}`;
  try {
    await deleteDoc(doc(db, 'pets', petId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ---------- BOOKINGS ----------

export interface CreateBookingInput {
  customerId: string;
  customerName: string;
  pet: PetProfile;
  service: ServiceItem;
  requestedDate: string;
  requestedTime: string;
  serviceLocation: string;
  city: string;
  customerInstructions?: string;
}

export async function createBookingRequest(input: CreateBookingInput): Promise<Booking> {
  const bookingId = makeDocId('bk');
  const path = `bookings/${bookingId}`;

  // Check for existing active booking conflict for the same pet, date, and slot
  try {
    const conflictQuery = query(
      collection(db, 'bookings'),
      where('customerId', '==', input.customerId),
      limit(100)
    );
    const conflictSnap = await getDocs(conflictQuery);
    const hasConflict = conflictSnap.docs.some((d) => {
      const data = d.data();
      return (
        data.petId === input.pet.id &&
        data.requestedDate === input.requestedDate &&
        data.requestedTime === input.requestedTime &&
        !['cancelled', 'rejected'].includes(String(data.status))
      );
    });
    if (hasConflict) {
      throw new Error(
        `${input.pet.name} already has an active booking for ${input.requestedDate} (${input.requestedTime}).`
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('already has an active booking')) {
      throw err;
    }
    handleFirestoreError(err, OperationType.LIST, 'bookings');
  }

  const careParts = [
    input.pet.feedingInstructions ? `Feeding: ${input.pet.feedingInstructions}` : '',
    input.pet.behaviorNotes ? `Behavior: ${input.pet.behaviorNotes}` : '',
    input.pet.specialCareInstructions ? `Care: ${input.pet.specialCareInstructions}` : '',
    input.pet.medicationNotes ? `Medication note: ${input.pet.medicationNotes}` : '',
  ]
    .filter(Boolean)
    .join(' | ');

  try {
    await runTransaction(db, async (tx) => {
      const serviceRef = doc(db, 'services', input.service.slug);
      const serviceSnap = await tx.get(serviceRef);
      if (!serviceSnap.exists() || serviceSnap.data().active !== true) {
        throw new Error('Selected service is currently unavailable. Please choose an active service.');
      }
      const liveService = serviceSnap.data();
      const petRef = doc(db, 'pets', input.pet.id);
      const petSnap = await tx.get(petRef);
      if (!petSnap.exists() || petSnap.data().ownerId !== input.customerId) {
        throw new Error('Selected pet profile could not be verified.');
      }

      const bookingRef = doc(db, 'bookings', bookingId);
      tx.set(bookingRef, {
        customerId: input.customerId,
        customerName: clampText(input.customerName, SCHEMA_LIMITS.FULL_NAME_MAX),
        petId: input.pet.id,
        petName: clampText(input.pet.name, SCHEMA_LIMITS.PET_NAME_MAX),
        petAnimalType: input.pet.animalType,
        petCareSummary: clampText(careParts || 'Standard everyday care', 1200),
        serviceId: input.service.slug,
        serviceName: clampText(liveService.name as string, SCHEMA_LIMITS.SERVICE_NAME_MAX),
        requestedDate: clampText(input.requestedDate, 20),
        requestedTime: clampText(input.requestedTime, 40),
        durationMinutes: Number(liveService.durationMinutes),
        serviceLocation: clampText(input.serviceLocation, SCHEMA_LIMITS.ADDRESS_MAX),
        city: clampText(input.city, SCHEMA_LIMITS.CITY_MAX),
        customerInstructions: clampText(
          input.customerInstructions,
          SCHEMA_LIMITS.INSTRUCTIONS_MAX
        ),
        assignedCaregiverId: '',
        assignedCaregiverName: '',
        priceSnapshotInr: Number(liveService.customerPriceInr),
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    await createNotification({
      userId: input.customerId,
      title: 'Booking Request Submitted',
      body: `Your ${input.service.name} request for ${input.pet.name} on ${input.requestedDate} (${input.requestedTime}) is Pending review.`,
      category: 'booking',
      relatedId: bookingId,
    });

    await recordAuditLog({
      actorId: input.customerId,
      actorEmail: input.customerName,
      action: 'BOOKING_CREATED',
      targetCollection: 'bookings',
      targetId: bookingId,
      summary: `Submitted ${input.service.name} booking for ${input.pet.name} on ${input.requestedDate}.`,
    });

    const createdSnap = await getDoc(doc(db, 'bookings', bookingId));
    return { id: bookingId, ...(createdSnap.data() as Omit<Booking, 'id'>) };
  } catch (error) {
    if (error instanceof Error && !error.message.toLowerCase().includes('permission')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function cancelBookingByCustomer(
  booking: Booking,
  customerId: string,
  reason: string
): Promise<void> {
  const path = `bookings/${booking.id}`;
  try {
    await updateDoc(doc(db, 'bookings', booking.id), {
      status: 'cancelled',
      cancellationReason: clampText(reason || 'Cancelled by customer', SCHEMA_LIMITS.REASON_MAX),
      updatedAt: serverTimestamp(),
    });

    await createNotification({
      userId: customerId,
      title: 'Booking Cancelled',
      body: `Booking #${booking.id.slice(-6).toUpperCase()} for ${booking.petName} has been cancelled.`,
      category: 'booking',
      relatedId: booking.id,
    });

    if (booking.assignedCaregiverId) {
      await createNotification({
        userId: booking.assignedCaregiverId,
        title: 'Assigned Booking Cancelled',
        body: `The ${booking.serviceName} booking for ${booking.petName} on ${booking.requestedDate} was cancelled by the customer.`,
        category: 'booking',
        relatedId: booking.id,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function caregiverUpdateBookingStatus(
  booking: Booking,
  nextStatus: 'accepted' | 'rejected' | 'in_progress' | 'completed'
): Promise<void> {
  const path = `bookings/${booking.id}`;
  try {
    await updateDoc(doc(db, 'bookings', booking.id), {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });

    const labels: Record<string, string> = {
      accepted: 'Caregiver Accepted Request',
      rejected: 'Caregiver Declined Request',
      in_progress: 'Service In Progress',
      completed: 'Service Completed',
    };

    await createNotification({
      userId: booking.customerId,
      title: labels[nextStatus] || 'Booking Updated',
      body: `${booking.serviceName} for ${booking.petName} (${booking.requestedDate}) is now ${nextStatus.replace('_', ' ')}.`,
      category: 'booking',
      relatedId: booking.id,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminAssignCaregiverToBooking(params: {
  booking: Booking;
  caregiver: CaregiverPublicProfile;
  nextStatus: 'pending' | 'confirmed';
  adminUid: string;
  adminEmail: string;
}): Promise<void> {
  const { booking, caregiver, nextStatus, adminUid, adminEmail } = params;
  const path = `bookings/${booking.id}`;

  if (caregiver.verificationStatus !== 'approved' || !caregiver.isAvailable) {
    throw new Error('Selected caregiver is not currently approved and available.');
  }

  if (caregiver.unavailableDates?.includes(booking.requestedDate)) {
    throw new Error(
      `${caregiver.displayName} marked ${booking.requestedDate} as unavailable.`
    );
  }

  // Server/Rule-backed conflict check before confirming assignment
  try {
    const cgBookingsSnap = await getDocs(
      query(
        collection(db, 'bookings'),
        where('assignedCaregiverId', '==', caregiver.uid),
        limit(100)
      )
    );
    const hasOverlap = cgBookingsSnap.docs.some((d) => {
      if (d.id === booking.id) return false;
      const b = d.data();
      return (
        b.requestedDate === booking.requestedDate &&
        b.requestedTime === booking.requestedTime &&
        ['pending', 'accepted', 'confirmed', 'in_progress'].includes(String(b.status))
      );
    });
    if (hasOverlap) {
      throw new Error(
        `${caregiver.displayName} already has an active assignment on ${booking.requestedDate} at ${booking.requestedTime}.`
      );
    }

    await runTransaction(db, async (tx) => {
      const cgSnap = await tx.get(doc(db, 'caregivers', caregiver.uid));
      if (!cgSnap.exists() || cgSnap.data().verificationStatus !== 'approved') {
        throw new Error('Caregiver verification status could not be confirmed.');
      }
      if (!cgSnap.data().isAvailable) {
        throw new Error('Caregiver recently marked themselves unavailable.');
      }
      const blockedDates = Array.isArray(cgSnap.data().unavailableDates)
        ? (cgSnap.data().unavailableDates as string[])
        : [];
      if (blockedDates.includes(booking.requestedDate)) {
        throw new Error(`Caregiver recently blocked ${booking.requestedDate}.`);
      }
      tx.update(doc(db, 'bookings', booking.id), {
        assignedCaregiverId: caregiver.uid,
        assignedCaregiverName: caregiver.displayName,
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
    });

    await createNotification({
      userId: booking.customerId,
      title: nextStatus === 'confirmed' ? 'Booking Confirmed' : 'Caregiver Assigned',
      body: `${caregiver.displayName} has been assigned to ${booking.serviceName} for ${booking.petName} on ${booking.requestedDate}.`,
      category: 'booking',
      relatedId: booking.id,
    });

    await createNotification({
      userId: caregiver.uid,
      title: 'New Booking Assignment',
      body: `You have been assigned to ${booking.serviceName} for ${booking.petName} on ${booking.requestedDate} (${booking.requestedTime}).`,
      category: 'booking',
      relatedId: booking.id,
    });

    await recordAuditLog({
      actorId: adminUid,
      actorEmail: adminEmail,
      action: 'BOOKING_CAREGIVER_ASSIGNED',
      targetCollection: 'bookings',
      targetId: booking.id,
      summary: `Assigned ${caregiver.displayName} with status ${nextStatus}.`,
    });
  } catch (error) {
    if (error instanceof Error && !error.message.toLowerCase().includes('permission')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminUpdateBookingStatus(params: {
  booking: Booking;
  status: BookingStatus;
  reason?: string;
  adminUid: string;
  adminEmail: string;
}): Promise<void> {
  const { booking, status, reason, adminUid, adminEmail } = params;
  const path = `bookings/${booking.id}`;
  try {
    const payload: Record<string, unknown> = {
      status,
      updatedAt: serverTimestamp(),
    };
    if (reason?.trim()) {
      payload.cancellationReason = clampText(reason, SCHEMA_LIMITS.REASON_MAX);
    }
    await updateDoc(doc(db, 'bookings', booking.id), payload);

    await createNotification({
      userId: booking.customerId,
      title: `Booking ${status.replace('_', ' ')}`,
      body: `Your ${booking.serviceName} request for ${booking.petName} is now ${status.replace('_', ' ')}.`,
      category: 'booking',
      relatedId: booking.id,
    });

    await recordAuditLog({
      actorId: adminUid,
      actorEmail: adminEmail,
      action: 'BOOKING_STATUS_UPDATED',
      targetCollection: 'bookings',
      targetId: booking.id,
      summary: `Updated booking status from ${booking.status} to ${status}.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ---------- CAREGIVER APPLICATIONS & PROFILES ----------

export interface CaregiverApplicationInput {
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
}

export async function submitCaregiverApplication(
  input: CaregiverApplicationInput,
  isResubmit: boolean
): Promise<void> {
  const path = `caregiverApplications/${input.uid}`;
  const payload: Record<string, unknown> = {
    uid: input.uid,
    fullName: clampText(input.fullName, SCHEMA_LIMITS.FULL_NAME_MAX),
    email: clampText(input.email, SCHEMA_LIMITS.EMAIL_MAX),
    phone: clampText(input.phone, SCHEMA_LIMITS.PHONE_MAX),
    city: clampText(input.city, SCHEMA_LIMITS.CITY_MAX),
    experienceSummary: clampText(input.experienceSummary, SCHEMA_LIMITS.EXPERIENCE_MAX),
    petTypesHandled: input.petTypesHandled.slice(0, 10),
    servicesOffered: input.servicesOffered.slice(0, 10),
    availabilitySummary: clampText(input.availabilitySummary, SCHEMA_LIMITS.AVAILABILITY_MAX),
    intro: clampText(input.intro, SCHEMA_LIMITS.INTRO_MAX),
    status: 'submitted',
    updatedAt: serverTimestamp(),
  };

  if (input.photoUrl?.trim()) {
    payload.photoUrl = clampText(input.photoUrl, SCHEMA_LIMITS.PHOTO_MAX);
  }

  try {
    if (isResubmit) {
      const updateFields = { ...payload };
      delete updateFields.uid;
      delete updateFields.email;
      await updateDoc(doc(db, 'caregiverApplications', input.uid), updateFields);
    } else {
      payload.createdAt = serverTimestamp();
      await setDoc(doc(db, 'caregiverApplications', input.uid), payload);
    }

    await createNotification({
      userId: input.uid,
      title: 'Caregiver Application Received',
      body: 'Thank you for applying to PawCare. Our Dehradun admin team will review your profile.',
      category: 'caregiver',
      relatedId: input.uid,
    });
  } catch (error) {
    handleFirestoreError(
      error,
      isResubmit ? OperationType.UPDATE : OperationType.CREATE,
      path
    );
  }
}

export async function adminReviewCaregiverApplication(params: {
  application: CaregiverApplication;
  decision: CaregiverApplicationStatus;
  rejectionReason?: string;
  adminUid: string;
  adminEmail: string;
}): Promise<void> {
  const { application, decision, rejectionReason, adminUid, adminEmail } = params;
  const appRef = doc(db, 'caregiverApplications', application.uid);
  const cgRef = doc(db, 'caregivers', application.uid);
  const userRef = doc(db, 'users', application.uid);

  try {
    const batch = writeBatch(db);
    const appUpdate: Record<string, unknown> = {
      status: decision,
      reviewedBy: adminUid,
      updatedAt: serverTimestamp(),
    };
    if (decision === 'rejected' && rejectionReason?.trim()) {
      appUpdate.rejectionReason = clampText(rejectionReason, 600);
    }
    batch.update(appRef, appUpdate);

    const cgSnap = await getDoc(cgRef);
    const userSnap = await getDoc(userRef);

    if (decision === 'approved') {
      const cgData: Record<string, unknown> = {
        uid: application.uid,
        displayName: application.fullName,
        city: application.city,
        photoUrl: application.photoUrl || '',
        experienceSummary: application.experienceSummary,
        petTypesHandled: application.petTypesHandled,
        servicesOffered: application.servicesOffered,
        availabilitySlots: cgSnap.exists()
          ? cgSnap.data().availabilitySlots || ['Mon Morning', 'Tue Morning', 'Sat Full Day']
          : ['Mon Morning', 'Tue Morning', 'Sat Full Day'],
        isAvailable: true,
        intro: application.intro,
        verificationStatus: 'approved',
        updatedAt: serverTimestamp(),
      };
      if (!cgSnap.exists()) {
        cgData.createdAt = serverTimestamp();
        batch.set(cgRef, cgData);
      } else {
        batch.update(cgRef, cgData);
      }

      if (userSnap.exists() && userSnap.data().role !== 'admin') {
        batch.update(userRef, {
          role: 'caregiver',
          updatedAt: serverTimestamp(),
        });
      }
    } else if (decision === 'suspended' && cgSnap.exists()) {
      batch.update(cgRef, {
        verificationStatus: 'suspended',
        isAvailable: false,
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();

    const notifTitle =
      decision === 'approved'
        ? 'Caregiver Application Approved'
        : decision === 'rejected'
        ? 'Caregiver Application Update'
        : decision === 'suspended'
        ? 'Caregiver Account Suspended'
        : 'Application Under Review';

    const notifBody =
      decision === 'approved'
        ? 'Congratulations! Your PawCare caregiver profile is now approved and active.'
        : decision === 'rejected'
        ? `Your caregiver application was not approved: ${rejectionReason || 'Please update your details and resubmit.'}`
        : `Your caregiver application status is now ${decision.replace('_', ' ')}.`;

    await createNotification({
      userId: application.uid,
      title: notifTitle,
      body: notifBody,
      category: 'caregiver',
      relatedId: application.uid,
    });

    await recordAuditLog({
      actorId: adminUid,
      actorEmail: adminEmail,
      action: `CAREGIVER_${decision.toUpperCase()}`,
      targetCollection: 'caregiverApplications',
      targetId: application.uid,
      summary: `Set caregiver application for ${application.fullName} to ${decision}.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `caregiverApplications/${application.uid}`);
  }
}

export async function updateCaregiverAvailability(
  caregiverUid: string,
  slots: string[],
  isAvailable: boolean,
  intro: string,
  unavailableDates: string[] = []
): Promise<void> {
  const path = `caregivers/${caregiverUid}`;
  try {
    await updateDoc(doc(db, 'caregivers', caregiverUid), {
      availabilitySlots: slots.slice(0, 21),
      unavailableDates: unavailableDates.slice(0, 30),
      isAvailable,
      intro: clampText(intro, SCHEMA_LIMITS.INTRO_MAX),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ---------- ADMIN USERS, SERVICES, PRICING, WEBSITE CONTENT ----------

export async function adminUpdateUserAccount(params: {
  targetUid: string;
  role: UserRole;
  status: AccountStatus;
  adminUid: string;
  adminEmail: string;
}): Promise<void> {
  const { targetUid, role, status, adminUid, adminEmail } = params;
  const path = `users/${targetUid}`;
  try {
    await updateDoc(doc(db, 'users', targetUid), {
      role,
      status,
      updatedAt: serverTimestamp(),
    });
    await recordAuditLog({
      actorId: adminUid,
      actorEmail: adminEmail,
      action: 'USER_ACCOUNT_UPDATED',
      targetCollection: 'users',
      targetId: targetUid,
      summary: `Updated user role=${role}, status=${status}.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminSaveServiceAndPricing(params: {
  service: ServiceItem;
  previousPriceInr: number;
  variableCostInr: number;
  platformCommissionInr: number;
  pricingNotes?: string;
  adminUid: string;
  adminEmail: string;
}): Promise<void> {
  const {
    service,
    previousPriceInr,
    variableCostInr,
    platformCommissionInr,
    pricingNotes,
    adminUid,
    adminEmail,
  } = params;
  const slug = service.slug.toLowerCase().replace(/[^a-z0-9_-]/g, '_');

  try {
    const batch = writeBatch(db);
    batch.set(
      doc(db, 'services', slug),
      {
        slug,
        name: clampText(service.name, SCHEMA_LIMITS.SERVICE_NAME_MAX),
        shortDescription: clampText(service.shortDescription, SCHEMA_LIMITS.SHORT_DESC_MAX),
        description: clampText(service.description, SCHEMA_LIMITS.SERVICE_DESC_MAX),
        durationLabel: clampText(service.durationLabel, 60),
        durationMinutes: Math.max(10, Math.min(1440, Math.round(service.durationMinutes))),
        customerPriceInr: Math.max(0, Number(service.customerPriceInr)),
        active: Boolean(service.active),
        imageUrl: clampText(service.imageUrl, 500),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    batch.set(
      doc(db, 'pricing', slug),
      {
        serviceId: slug,
        serviceName: clampText(service.name, SCHEMA_LIMITS.SERVICE_NAME_MAX),
        customerPriceInr: Math.max(0, Number(service.customerPriceInr)),
        variableCostInr: Math.max(0, Number(variableCostInr)),
        platformCommissionInr: Number(platformCommissionInr),
        notes: clampText(pricingNotes, 500),
        updatedBy: adminUid,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    const historyId = makeDocId('ph');
    batch.set(doc(db, 'pricingHistory', historyId), {
      serviceId: slug,
      serviceName: clampText(service.name, SCHEMA_LIMITS.SERVICE_NAME_MAX),
      previousCustomerPriceInr: Number(previousPriceInr),
      newCustomerPriceInr: Number(service.customerPriceInr),
      newVariableCostInr: Number(variableCostInr),
      newCommissionInr: Number(platformCommissionInr),
      changedBy: adminEmail,
      changedAt: serverTimestamp(),
    });

    await batch.commit();

    await recordAuditLog({
      actorId: adminUid,
      actorEmail: adminEmail,
      action: 'SERVICE_PRICING_UPDATED',
      targetCollection: 'services',
      targetId: slug,
      summary: `Saved ${service.name} at ₹${service.customerPriceInr} (active=${service.active}).`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `services/${slug}`);
  }
}

export async function adminSaveWebsiteContent(
  content: WebsiteContent,
  adminUid: string,
  adminEmail: string
): Promise<void> {
  const path = 'websiteContent/main';
  try {
    await setDoc(doc(db, 'websiteContent', 'main'), {
      sectionKey: 'main',
      heroHeadline: clampText(content.heroHeadline, 200),
      heroSubtext: clampText(content.heroSubtext, 600),
      announcementText: clampText(content.announcementText, 300),
      announcementActive: Boolean(content.announcementActive),
      dehradunIntro: clampText(content.dehradunIntro, 800),
      contactEmail: clampText(content.contactEmail, 254),
      contactPhone: clampText(content.contactPhone, 40),
      contactAddress: clampText(content.contactAddress, 240),
      serviceHours: clampText(content.serviceHours, 120),
      faqItems: (content.faqItems || []).slice(0, 20),
      updatedAt: serverTimestamp(),
    });

    await recordAuditLog({
      actorId: adminUid,
      actorEmail: adminEmail,
      action: 'WEBSITE_CONTENT_UPDATED',
      targetCollection: 'websiteContent',
      targetId: 'main',
      summary: 'Updated homepage copy, FAQ, or contact details.',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ---------- CONVERSATIONS & SUPPORT ----------

export async function createOrOpenConversation(params: {
  type: ConversationType;
  customerId: string;
  customerName: string;
  assignedCaregiverId?: string;
  bookingId?: string;
  subject: string;
  initialMessage: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
}): Promise<string> {
  const convId =
    params.type === 'booking_chat' && params.bookingId
      ? `chat_${params.bookingId}`
      : makeDocId('conv');
  const convRef = doc(db, 'conversations', convId);

  try {
    const existingSnap = await getDoc(convRef);
    const msgId = makeDocId('msg');
    const preview = clampText(params.initialMessage, 200);

    const batch = writeBatch(db);
    if (!existingSnap.exists()) {
      batch.set(convRef, {
        type: params.type,
        customerId: params.customerId,
        customerName: clampText(params.customerName, SCHEMA_LIMITS.FULL_NAME_MAX),
        assignedCaregiverId: params.assignedCaregiverId || '',
        bookingId: params.bookingId || '',
        subject: clampText(params.subject, SCHEMA_LIMITS.SUBJECT_MAX),
        status: 'open',
        lastMessagePreview: preview,
        lastMessageAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.update(convRef, {
        lastMessagePreview: preview,
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    batch.set(doc(db, 'conversations', convId, 'messages', msgId), {
      senderId: params.senderId,
      senderName: clampText(params.senderName, SCHEMA_LIMITS.FULL_NAME_MAX),
      senderRole: params.senderRole,
      text: clampText(params.initialMessage, SCHEMA_LIMITS.MESSAGE_MAX),
      createdAt: serverTimestamp(),
    });

    await batch.commit();
    return convId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `conversations/${convId}`);
  }
}

export async function sendConversationMessage(params: {
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  text: string;
  recipientUserId?: string;
}): Promise<void> {
  const msgId = makeDocId('msg');
  const cleanText = clampText(params.text, SCHEMA_LIMITS.MESSAGE_MAX);
  if (!cleanText) return;

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'conversations', params.conversationId, 'messages', msgId), {
      senderId: params.senderId,
      senderName: clampText(params.senderName, SCHEMA_LIMITS.FULL_NAME_MAX),
      senderRole: params.senderRole,
      text: cleanText,
      createdAt: serverTimestamp(),
    });
    batch.update(doc(db, 'conversations', params.conversationId), {
      lastMessagePreview: cleanText.slice(0, 200),
      lastMessageAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    if (params.senderRole === 'admin' && params.recipientUserId) {
      await createNotification({
        userId: params.recipientUserId,
        title: 'New Support Reply',
        body: `PawCare Support replied: "${cleanText.slice(0, 90)}${cleanText.length > 90 ? '...' : ''}"`,
        category: 'support',
        relatedId: params.conversationId,
      });
    }
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `conversations/${params.conversationId}/messages`
    );
  }
}

export async function adminUpdateConversationStatus(
  conversationId: string,
  status: ConversationStatus
): Promise<void> {
  try {
    await updateDoc(doc(db, 'conversations', conversationId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `conversations/${conversationId}`);
  }
}

export async function fetchCaregiverBookingsCount(caregiverUid: string): Promise<number> {
  try {
    const snap = await getDocs(
      query(
        collection(db, 'bookings'),
        where('assignedCaregiverId', '==', caregiverUid),
        limit(50)
      )
    );
    return snap.size;
  } catch {
    return 0;
  }
}

function getTodayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function getYesterdayIso(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split('T')[0];
}

export async function recordValidatedGameSession(params: {
  uid: string;
  gameId: GameId;
  score: number;
  durationSec: number;
  difficulty: string;
  won: boolean;
}): Promise<{
  pointsAwarded: number;
  totalPoints: number;
  achievements: string[];
  streakDays: number;
}> {
  const rewardRef = doc(db, 'rewards', params.uid);
  const existingSnap = await getDoc(rewardRef);
  const existing = existingSnap.exists()
    ? (existingSnap.data() as RewardProfile)
    : null;

  const today = getTodayIso();
  const yesterday = getYesterdayIso();
  let nextStreak = existing?.streakDays ?? 0;
  if (!existing || !existing.lastPlayedDate) {
    nextStreak = 1;
  } else if (existing.lastPlayedDate === today) {
    nextStreak = Math.max(1, existing.streakDays);
  } else if (existing.lastPlayedDate === yesterday) {
    nextStreak = existing.streakDays + 1;
  } else {
    nextStreak = 1;
  }

  const resp = await fetch('/api/games/validate-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gameId: params.gameId,
      score: Math.round(params.score),
      durationSec: Math.round(params.durationSec),
      difficulty: params.difficulty,
      won: params.won,
      gamesPlayedSoFar: existing?.gamesPlayed ?? 0,
      streakDaysSoFar: nextStreak,
      existingAchievements: existing?.achievements ?? [],
    }),
  });

  if (!resp.ok) {
    const errBody = (await resp.json().catch(() => ({}))) as { error?: string };
    throw new Error(errBody.error || 'Could not validate game session.');
  }

  const validated = (await resp.json()) as {
    gameId: GameId;
    score: number;
    durationSec: number;
    difficulty: string;
    won: boolean;
    pointsAwarded: number;
    achievements: string[];
  };

  const sessionId = makeDocId('gs');
  const sessionRef = doc(db, 'gameSessions', sessionId);
  const nextTotalPoints = (existing?.totalPoints ?? 0) + validated.pointsAwarded;
  const nextGamesPlayed = (existing?.gamesPlayed ?? 0) + 1;

  const nextBestRunner = Math.max(
    existing?.bestRunnerScore ?? 0,
    validated.gameId === 'paw_runner' ? validated.score : 0
  );
  const nextBestMemory = Math.max(
    existing?.bestMemoryScore ?? 0,
    validated.gameId === 'paw_memory' ? validated.score : 0
  );
  const nextBestCatcher = Math.max(
    existing?.bestCatcherScore ?? 0,
    validated.gameId === 'treat_catcher' ? validated.score : 0
  );

  try {
    const batch = writeBatch(db);
    batch.set(sessionRef, {
      uid: params.uid,
      gameId: validated.gameId,
      score: validated.score,
      pointsAwarded: validated.pointsAwarded,
      durationSec: validated.durationSec,
      difficulty: validated.difficulty,
      won: validated.won,
      createdAt: serverTimestamp(),
    });

    batch.set(rewardRef, {
      uid: params.uid,
      totalPoints: nextTotalPoints,
      gamesPlayed: nextGamesPlayed,
      bestRunnerScore: nextBestRunner,
      bestMemoryScore: nextBestMemory,
      bestCatcherScore: nextBestCatcher,
      achievements: validated.achievements,
      streakDays: nextStreak,
      lastPlayedDate: today,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    return {
      pointsAwarded: validated.pointsAwarded,
      totalPoints: nextTotalPoints,
      achievements: validated.achievements,
      streakDays: nextStreak,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `rewards/${params.uid}`);
  }
}

export { addDoc };
