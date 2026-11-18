import React, { useEffect, useState } from 'react';
import {
  Award,
  Bell,
  Calendar,
  Check,
  Edit3,
  Eye,
  Gamepad2,
  History,
  LogOut,
  MessageSquare,
  PawPrint,
  Plus,
  Search,
  Send,
  Settings,
  Trash2,
  User,
  X,
} from 'lucide-react';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { BOOKING_STATUS_META, DEHRADUN_AREAS } from '../../lib/defaults';
import { db, handleFirestoreError, OperationType, uploadImageAsset } from '../../lib/firebase';
import {
  cancelBookingByCustomer,
  createOrOpenConversation,
  deletePetProfile,
  markNotificationRead,
  savePetProfile,
  sendConversationMessage,
} from '../../lib/firestoreService';
import type {
  AnimalType,
  AppView,
  Booking,
  ChatMessage,
  Conversation,
  PetProfile,
  PetSize,
} from '../../types/pawcare';
import { PageReveal, SkeletonRow } from '../ui/MotionPrimitives';
import { SafeImage } from '../ui/SafeImage';

interface CustomerDashboardProps {
  onStartBooking: (serviceSlug?: string) => void;
  onNavigate: (view: AppView) => void;
  initialTab?: CustomerTab;
}

export type CustomerTab =
  | 'overview'
  | 'bookings'
  | 'pets'
  | 'messages'
  | 'notifications'
  | 'settings';

export function CustomerDashboard({
  onStartBooking,
  onNavigate,
  initialTab = 'overview',
}: CustomerDashboardProps) {
  const {
    firebaseUser,
    userProfile,
    services,
    notifications,
    unreadCount,
    updateOwnProfile,
    signOutUser,
  } = useAuth();

  const [tab, setTab] = useState<CustomerTab>(initialTab);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [pets, setPets] = useState<PetProfile[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  // Pet form & detail modal state
  const [showPetForm, setShowPetForm] = useState(false);
  const [editingPet, setEditingPet] = useState<PetProfile | null>(null);
  const [viewingPet, setViewingPet] = useState<PetProfile | null>(null);
  const [petName, setPetName] = useState('');
  const [petType, setPetType] = useState<AnimalType>('Dog');
  const [petBreed, setPetBreed] = useState('');
  const [petAge, setPetAge] = useState('');
  const [petSize, setPetSize] = useState<PetSize>('Medium');
  const [petPhoto, setPetPhoto] = useState('');
  const [petBehavior, setPetBehavior] = useState('');
  const [petFeeding, setPetFeeding] = useState('');
  const [petSpecialCare, setPetSpecialCare] = useState('');
  const [petMed, setPetMed] = useState('');
  const [petBusy, setPetBusy] = useState(false);

  // Cancel booking modal state
  const [cancellingBooking, setCancellingBooking] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Messaging state
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [msgText, setMsgText] = useState('');

  // Settings form state
  const [fullName, setFullName] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');
  const [settingsSaved, setSettingsSaved] = useState('');

  useEffect(() => {
    if (userProfile) {
      setFullName(userProfile.fullName);
      setCity(userProfile.city);
      setPhone(userProfile.phone || '');
      setProfilePhoto(userProfile.photoUrl || '');
    }
  }, [userProfile]);

  useEffect(() => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;

    const bQ = query(
      collection(db, 'bookings'),
      where('customerId', '==', uid),
      limit(100)
    );
    const unsubB = onSnapshot(
      bQ,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Booking, 'id'>),
        }));
        list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
        setBookings(list);
        setLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'bookings')
    );

    const pQ = query(collection(db, 'pets'), where('ownerId', '==', uid));
    const unsubP = onSnapshot(
      pQ,
      (snap) => {
        setPets(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PetProfile, 'id'>) }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'pets')
    );

    const cQ = query(
      collection(db, 'conversations'),
      where('customerId', '==', uid),
      limit(50)
    );
    const unsubC = onSnapshot(
      cQ,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Conversation, 'id'>),
        }));
        list.sort(
          (a, b) => (b.lastMessageAt?.toMillis?.() ?? 0) - (a.lastMessageAt?.toMillis?.() ?? 0)
        );
        setConversations(list);
        if (list.length > 0 && !activeConvId) {
          setActiveConvId(list[0].id);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'conversations')
    );

    return () => {
      unsubB();
      unsubP();
      unsubC();
    };
  }, [firebaseUser, activeConvId]);

  useEffect(() => {
    if (!activeConvId || !firebaseUser) {
      setMessages([]);
      return;
    }
    const q = query(
      collection(db, 'conversations', activeConvId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );
    return onSnapshot(q, (snap) => {
      setMessages(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChatMessage, 'id'>) }))
      );
    });
  }, [activeConvId, firebaseUser]);

  if (!firebaseUser) return null;

  const upcomingBookings = bookings.filter((b) =>
    ['pending', 'accepted', 'confirmed', 'in_progress'].includes(b.status)
  );
  const previousBookings = bookings.filter((b) =>
    ['completed', 'cancelled', 'rejected'].includes(b.status)
  );

  const openPetEditor = (pet?: PetProfile) => {
    if (pet) {
      setEditingPet(pet);
      setPetName(pet.name);
      setPetType(pet.animalType);
      setPetBreed(pet.breed || '');
      setPetAge(pet.age);
      setPetSize(pet.size);
      setPetPhoto(pet.photoUrl || '');
      setPetBehavior(pet.behaviorNotes || '');
      setPetFeeding(pet.feedingInstructions || '');
      setPetSpecialCare(pet.specialCareInstructions || '');
      setPetMed(pet.medicationNotes || '');
    } else {
      setEditingPet(null);
      setPetName('');
      setPetType('Dog');
      setPetBreed('');
      setPetAge('');
      setPetSize('Medium');
      setPetPhoto('');
      setPetBehavior('');
      setPetFeeding('');
      setPetSpecialCare('');
      setPetMed('');
    }
    setShowPetForm(true);
  };

  const handlePetPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPetBusy(true);
    try {
      const url = await uploadImageAsset(
        file,
        `pets/${firebaseUser.uid}/pet_${Date.now()}`
      );
      setPetPhoto(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to upload pet photo.');
    } finally {
      setPetBusy(false);
    }
  };

  const handleSavePet = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPetBusy(true);
    try {
      await savePetProfile(
        firebaseUser.uid,
        {
          name: petName,
          animalType: petType,
          breed: petBreed,
          age: petAge,
          size: petSize,
          photoUrl: petPhoto,
          behaviorNotes: petBehavior,
          feedingInstructions: petFeeding,
          specialCareInstructions: petSpecialCare,
          medicationNotes: petMed,
        },
        editingPet?.id
      );
      setShowPetForm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save pet profile.');
    } finally {
      setPetBusy(false);
    }
  };

  const handleOpenBookingChat = async (booking: Booking) => {
    if (!booking.assignedCaregiverId) return;
    try {
      const convId = await createOrOpenConversation({
        type: 'booking_chat',
        customerId: firebaseUser.uid,
        customerName: userProfile?.fullName || firebaseUser.displayName || 'Customer',
        assignedCaregiverId: booking.assignedCaregiverId,
        bookingId: booking.id,
        subject: `${booking.serviceName} · ${booking.petName} (${booking.requestedDate})`,
        initialMessage: `Hi ${booking.assignedCaregiverName}, sharing coordination details for ${booking.petName}.`,
        senderId: firebaseUser.uid,
        senderName: userProfile?.fullName || firebaseUser.displayName || 'Customer',
        senderRole: 'customer',
      });
      setActiveConvId(convId);
      setTab('messages');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to open booking chat.');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConvId || !msgText.trim()) return;
    await sendConversationMessage({
      conversationId: activeConvId,
      senderId: firebaseUser.uid,
      senderName: userProfile?.fullName || firebaseUser.displayName || 'Customer',
      senderRole: 'customer',
      text: msgText.trim(),
    });
    setMsgText('');
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSaved('');
    await updateOwnProfile({
      fullName,
      city,
      phone,
      photoUrl: profilePhoto,
    });
    setSettingsSaved('Account settings updated.');
  };

  const handleProfilePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadImageAsset(
      file,
      `users/${firebaseUser.uid}/avatar_${Date.now()}`
    );
    setProfilePhoto(url);
  };

  const tabs: { id: CustomerTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'overview', label: 'Overview', icon: <User className="w-4 h-4" /> },
    { id: 'bookings', label: 'My Bookings', icon: <Calendar className="w-4 h-4" />, badge: upcomingBookings.length },
    { id: 'pets', label: 'My Pets', icon: <PawPrint className="w-4 h-4" />, badge: pets.length },
    { id: 'messages', label: 'Messages', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" />, badge: unreadCount },
    { id: 'settings', label: 'Account Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <PageReveal className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar */}
        <aside className="lg:col-span-3 space-y-4">
          <div className="rounded-2xl border border-[#E6E2D8] bg-white p-5 space-y-3">
            <div className="flex items-center gap-3">
              <SafeImage
                src={userProfile?.photoUrl || firebaseUser.photoURL}
                alt={userProfile?.fullName || 'Customer'}
                aspectClass="w-12 h-12 rounded-xl shrink-0"
                fallbackLabel=""
              />
              <div className="min-w-0">
                <div className="font-semibold text-sm text-[#1A221D] truncate">
                  {userProfile?.fullName || firebaseUser.displayName || 'Pet Parent'}
                </div>
                <div className="text-xs text-[#526057] truncate">
                  {userProfile?.city || 'Dehradun'} · Customer
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onStartBooking()}
              className="w-full py-2.5 rounded-xl bg-[#1B4332] text-white text-xs font-semibold hover:bg-[#143326] cursor-pointer"
            >
              + Book Pet Care
            </button>
          </div>

          <nav className="flex lg:flex-col gap-1.5 overflow-x-auto pb-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  tab === t.id
                    ? 'bg-[#1B4332] text-white'
                    : 'bg-white border border-[#E6E2D8] text-[#445249] hover:bg-[#F1F6F2]'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  {t.icon}
                  {t.label}
                </span>
                {typeof t.badge === 'number' && t.badge > 0 && (
                  <span
                    className={`font-mono text-[11px] tabular-nums px-1.5 py-0.5 rounded-md ${
                      tab === t.id ? 'bg-white/20 text-white' : 'bg-[#EFECE4] text-[#1A221D]'
                    }`}
                  >
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Viewport */}
        <main className="lg:col-span-9 space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
              {error}
            </div>
          )}

          {tab === 'overview' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-[#E6E2D8] bg-white p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <h1 className="font-display text-2xl font-bold text-[#1A221D]">
                    Welcome back, {userProfile?.fullName || firebaseUser.displayName || 'Pet Parent'}!
                  </h1>
                  <p className="text-sm text-[#526057]">
                    Manage your pet profiles, track real-time booking statuses, and stay in sync with assigned caregivers and PawCare Support.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setTab('notifications')}
                    aria-label="Notifications"
                    className="relative p-2.5 rounded-xl border border-[#E6E2D8] bg-[#FAF8F4] text-[#1B4332] hover:bg-[#F1F6F2] cursor-pointer"
                  >
                    <Bell className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#E07A2B] text-white text-[10px] font-mono font-bold flex items-center justify-center tabular-nums">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab('settings')}
                    aria-label="Profile settings"
                    className="p-2.5 rounded-xl border border-[#E6E2D8] bg-[#FAF8F4] text-[#445249] hover:bg-[#F1F6F2] cursor-pointer"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void signOutUser()}
                    className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-[#E6E2D8] text-xs font-semibold text-[#445249] hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              </div>

              {/* 10 Interactive Customer Dashboard Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                  {
                    title: 'My Pets',
                    sub: `${pets.length} profile${pets.length === 1 ? '' : 's'}`,
                    icon: <PawPrint className="w-4 h-4 text-[#1B4332]" />,
                    action: () => setTab('pets'),
                  },
                  {
                    title: 'Book Pet Care',
                    sub: 'Schedule visit',
                    icon: <Plus className="w-4 h-4 text-[#1B4332]" />,
                    action: () => onStartBooking(),
                  },
                  {
                    title: 'Upcoming Bookings',
                    sub: `${upcomingBookings.length} active`,
                    icon: <Calendar className="w-4 h-4 text-[#2D6A4F]" />,
                    action: () => setTab('bookings'),
                  },
                  {
                    title: 'Booking History',
                    sub: `${previousBookings.length} past`,
                    icon: <History className="w-4 h-4 text-[#526057]" />,
                    action: () => setTab('bookings'),
                  },
                  {
                    title: 'Find Caregiver',
                    sub: 'Verified directory',
                    icon: <Search className="w-4 h-4 text-[#1B4332]" />,
                    action: () => onNavigate('find-care'),
                  },
                  {
                    title: 'PawCare Games',
                    sub: 'Play 4 mini-games',
                    icon: <Gamepad2 className="w-4 h-4 text-[#2D6A4F]" />,
                    action: () => onNavigate('play-zone'),
                  },
                  {
                    title: 'My Rewards',
                    sub: 'Points & badges',
                    icon: <Award className="w-4 h-4 text-[#D97706]" />,
                    action: () => onNavigate('rewards'),
                  },
                  {
                    title: 'Notifications',
                    sub: `${unreadCount} unread`,
                    icon: <Bell className="w-4 h-4 text-[#E07A2B]" />,
                    action: () => setTab('notifications'),
                  },
                  {
                    title: 'Message Support',
                    sub: `${conversations.length} thread${conversations.length === 1 ? '' : 's'}`,
                    icon: <MessageSquare className="w-4 h-4 text-[#1B4332]" />,
                    action: () => setTab('messages'),
                  },
                  {
                    title: 'Account Settings',
                    sub: userProfile?.city || 'Profile',
                    icon: <Settings className="w-4 h-4 text-[#526057]" />,
                    action: () => setTab('settings'),
                  },
                ].map((card) => (
                  <button
                    key={card.title}
                    type="button"
                    onClick={card.action}
                    className="text-left rounded-2xl border border-[#E6E2D8] bg-white p-4 hover:border-[#2D6A4F]/60 hover:bg-[#FAF8F4] transition-all cursor-pointer space-y-1.5"
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#F1F6F2] flex items-center justify-center">
                      {card.icon}
                    </div>
                    <div className="font-semibold text-xs sm:text-sm text-[#1A221D]">
                      {card.title}
                    </div>
                    <div className="text-[11px] text-[#526057] truncate">{card.sub}</div>
                  </button>
                ))}
              </div>

              <div className="rounded-2xl border border-[#E6E2D8] bg-white p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg font-bold text-[#1A221D]">
                    Available Pet-Care Services
                  </h2>
                  <button
                    type="button"
                    onClick={() => onStartBooking()}
                    className="text-xs font-semibold text-[#1B4332] hover:underline cursor-pointer"
                  >
                    Book Service →
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {services
                    .filter((s) => s.active)
                    .map((svc) => (
                      <div
                        key={svc.slug}
                        className="p-4 rounded-xl border border-[#E6E2D8] bg-[#FAF8F4] flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="font-semibold text-sm text-[#1A221D]">{svc.name}</div>
                          <div className="text-xs text-[#526057]">
                            {svc.durationLabel} · ₹{svc.customerPriceInr}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onStartBooking(svc.slug)}
                          className="px-3 py-1.5 rounded-lg bg-white border border-[#D4CFC4] text-xs font-semibold text-[#1B4332] hover:bg-[#1B4332] hover:text-white transition-colors cursor-pointer"
                        >
                          Book
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'bookings' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl font-bold text-[#1A221D]">Your Bookings</h2>
                <button
                  type="button"
                  onClick={() => onStartBooking()}
                  className="px-4 py-2 rounded-xl bg-[#1B4332] text-white text-xs font-semibold cursor-pointer"
                >
                  + New Booking
                </button>
              </div>

              {loading ? (
                <div className="space-y-3">
                  <SkeletonRow className="h-28" />
                  <SkeletonRow className="h-28" />
                </div>
              ) : bookings.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#D4CFC4] bg-white p-8 text-center space-y-3">
                  <Calendar className="w-8 h-8 text-[#2D6A4F] mx-auto" />
                  <h3 className="font-semibold text-base text-[#1A221D]">No bookings yet</h3>
                  <p className="text-sm text-[#526057]">
                    Add your pet profile and submit your first request in under 2 minutes.
                  </p>
                  <button
                    type="button"
                    onClick={() => onStartBooking()}
                    className="px-4 py-2 rounded-xl bg-[#1B4332] text-white text-xs font-semibold cursor-pointer"
                  >
                    Create First Booking
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {[
                    { title: 'Upcoming & Active', list: upcomingBookings },
                    { title: 'Previous Bookings', list: previousBookings },
                  ].map(
                    (group) =>
                      group.list.length > 0 && (
                        <div key={group.title} className="space-y-3">
                          <h3 className="text-xs font-semibold text-[#526057] tracking-wide">
                            {group.title}
                          </h3>
                          <div className="space-y-3">
                            {group.list.map((b) => (
                              <div
                                key={b.id}
                                className="rounded-2xl border border-[#E6E2D8] bg-white p-5 space-y-3"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <div className="font-semibold text-base text-[#1A221D]">
                                      {b.serviceName} for {b.petName}
                                    </div>
                                    <div className="text-xs text-[#526057] font-mono tabular-nums mt-0.5">
                                      {b.requestedDate} · {b.requestedTime} · ₹
                                      {b.priceSnapshotInr.toLocaleString('en-IN')} · ID:{' '}
                                      {b.id.slice(-8).toUpperCase()}
                                    </div>
                                  </div>
                                  <span
                                    className={`px-2.5 py-1 rounded-lg border text-xs font-semibold ${
                                      BOOKING_STATUS_META[b.status]?.toneClass || ''
                                    }`}
                                  >
                                    {BOOKING_STATUS_META[b.status]?.label || b.status}
                                  </span>
                                </div>

                                <div className="text-xs text-[#445249] space-y-1">
                                  <div>
                                    <strong>Location:</strong> {b.serviceLocation}
                                  </div>
                                  <div>
                                    <strong>Assigned Caregiver:</strong>{' '}
                                    {b.assignedCaregiverName || 'Pending admin assignment'}
                                  </div>
                                  {b.customerInstructions && (
                                    <div>
                                      <strong>Your Instructions:</strong> {b.customerInstructions}
                                    </div>
                                  )}
                                  {b.cancellationReason && (
                                    <div className="text-rose-700">
                                      <strong>Cancellation Reason:</strong> {b.cancellationReason}
                                    </div>
                                  )}
                                </div>

                                <div className="flex flex-wrap gap-2 pt-2 border-t border-[#EFECE4]">
                                  {b.assignedCaregiverId &&
                                    ['accepted', 'confirmed', 'in_progress'].includes(b.status) && (
                                      <button
                                        type="button"
                                        onClick={() => void handleOpenBookingChat(b)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F1F6F2] text-[#1B4332] text-xs font-semibold hover:bg-[#E0EDE4] cursor-pointer"
                                      >
                                        <MessageSquare className="w-3.5 h-3.5" />
                                        Message Caregiver
                                      </button>
                                    )}
                                  {['pending', 'accepted', 'confirmed'].includes(b.status) && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCancellingBooking(b);
                                        setCancelReason('');
                                      }}
                                      className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 text-xs font-semibold hover:bg-rose-50 cursor-pointer"
                                    >
                                      Cancel Booking
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                  )}
                </div>
              )}
            </div>
          )}

          {tab === 'pets' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-2xl font-bold text-[#1A221D]">My Pets</h2>
                  <p className="text-xs text-[#526057]">
                    Saved pet care instructions stay private to you and your assigned caregiver.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openPetEditor()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1B4332] text-white text-xs font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Pet
                </button>
              </div>

              {showPetForm && (
                <form
                  onSubmit={handleSavePet}
                  className="rounded-2xl border border-[#D4CFC4] bg-white p-6 space-y-4"
                >
                  <h3 className="font-semibold text-base text-[#1A221D]">
                    {editingPet ? `Edit ${editingPet.name}` : 'Add New Pet Profile'}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[#445249] mb-1">
                        Pet Name
                      </label>
                      <input
                        type="text"
                        required
                        value={petName}
                        onChange={(e) => setPetName(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-[#D8D3C8] text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#445249] mb-1">
                        Animal Type
                      </label>
                      <select
                        value={petType}
                        onChange={(e) => setPetType(e.target.value as AnimalType)}
                        className="w-full px-3.5 py-2 rounded-xl border border-[#D8D3C8] text-sm bg-white"
                      >
                        <option value="Dog">Dog</option>
                        <option value="Cat">Cat</option>
                        <option value="Bird">Bird</option>
                        <option value="Rabbit">Rabbit</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#445249] mb-1">
                        Breed (optional)
                      </label>
                      <input
                        type="text"
                        value={petBreed}
                        onChange={(e) => setPetBreed(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-[#D8D3C8] text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-[#445249] mb-1">
                          Age
                        </label>
                        <input
                          type="text"
                          required
                          value={petAge}
                          onChange={(e) => setPetAge(e.target.value)}
                          placeholder="e.g. 3 years"
                          className="w-full px-3.5 py-2 rounded-xl border border-[#D8D3C8] text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#445249] mb-1">
                          Size
                        </label>
                        <select
                          value={petSize}
                          onChange={(e) => setPetSize(e.target.value as PetSize)}
                          className="w-full px-3 py-2 rounded-xl border border-[#D8D3C8] text-sm bg-white"
                        >
                          <option value="Small">Small</option>
                          <option value="Medium">Medium</option>
                          <option value="Large">Large</option>
                          <option value="Extra Large">Extra Large</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#445249] mb-1">
                      Pet Photo (optional)
                    </label>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handlePetPhotoUpload}
                      className="block w-full text-xs text-[#526057] file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-[#D8D3C8] file:bg-[#FAF8F4]"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[#445249] mb-1">
                        Behavior Notes
                      </label>
                      <textarea
                        rows={2}
                        value={petBehavior}
                        onChange={(e) => setPetBehavior(e.target.value)}
                        placeholder="Friendly with strangers, shy around traffic..."
                        className="w-full px-3.5 py-2 rounded-xl border border-[#D8D3C8] text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#445249] mb-1">
                        Feeding Instructions
                      </label>
                      <textarea
                        rows={2}
                        value={petFeeding}
                        onChange={(e) => setPetFeeding(e.target.value)}
                        placeholder="1 cup dry kibble at 8 AM & 7 PM..."
                        className="w-full px-3.5 py-2 rounded-xl border border-[#D8D3C8] text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#445249] mb-1">
                        Special Care Instructions
                      </label>
                      <textarea
                        rows={2}
                        value={petSpecialCare}
                        onChange={(e) => setPetSpecialCare(e.target.value)}
                        placeholder="Harness clip, indoor wipe-down..."
                        className="w-full px-3.5 py-2 rounded-xl border border-[#D8D3C8] text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#445249] mb-1">
                        Medication Info (only if needed for service)
                      </label>
                      <textarea
                        rows={2}
                        value={petMed}
                        onChange={(e) => setPetMed(e.target.value)}
                        placeholder="Only include routine instructions relevant to sitting/feeding"
                        className="w-full px-3.5 py-2 rounded-xl border border-[#D8D3C8] text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={petBusy}
                      className="px-5 py-2.5 rounded-xl bg-[#1B4332] text-white text-xs font-semibold cursor-pointer"
                    >
                      {petBusy ? 'Saving...' : 'Save Pet Profile'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPetForm(false)}
                      className="px-4 py-2.5 rounded-xl border border-[#D4CFC4] text-xs font-medium cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {pets.length === 0 && !showPetForm ? (
                <div className="rounded-2xl border border-dashed border-[#D4CFC4] bg-white p-8 text-center space-y-3">
                  <PawPrint className="w-8 h-8 text-[#2D6A4F] mx-auto" />
                  <h3 className="font-semibold text-base text-[#1A221D]">
                    No pet profiles added yet
                  </h3>
                  <p className="text-sm text-[#526057]">
                    Add your dog, cat, or small pet so you can quickly schedule bookings.
                  </p>
                  <button
                    type="button"
                    onClick={() => openPetEditor()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1B4332] text-white text-xs font-semibold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Your First Pet
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pets.map((pet) => (
                    <div
                      key={pet.id}
                      className="rounded-2xl border border-[#E6E2D8] bg-white p-5 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <SafeImage
                            src={pet.photoUrl}
                            alt={pet.name}
                            aspectClass="w-14 h-14 rounded-xl shrink-0"
                            fallbackLabel=""
                          />
                          <div>
                            <h3 className="font-semibold text-base text-[#1A221D]">
                              {pet.name}
                            </h3>
                            <div className="text-xs text-[#526057]">
                              {pet.animalType} {pet.breed ? `· ${pet.breed}` : ''} · {pet.age} ·{' '}
                              {pet.size}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setViewingPet(pet)}
                            aria-label={`View ${pet.name}`}
                            className="p-2 rounded-lg text-[#1B4332] hover:bg-[#F1F6F2] cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openPetEditor(pet)}
                            aria-label={`Edit ${pet.name}`}
                            className="p-2 rounded-lg text-[#526057] hover:bg-[#FAF8F4] cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void deletePetProfile(pet.id)}
                            aria-label={`Remove ${pet.name}`}
                            className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="text-xs text-[#445249] space-y-1 pt-2 border-t border-[#EFECE4]">
                        {pet.feedingInstructions && (
                          <div>
                            <strong>Feeding:</strong> {pet.feedingInstructions}
                          </div>
                        )}
                        {pet.behaviorNotes && (
                          <div>
                            <strong>Behavior:</strong> {pet.behaviorNotes}
                          </div>
                        )}
                        {pet.specialCareInstructions && (
                          <div>
                            <strong>Care:</strong> {pet.specialCareInstructions}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'messages' && (
            <div className="rounded-2xl border border-[#E6E2D8] bg-white overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[440px]">
              <div className="md:col-span-4 border-b md:border-b-0 md:border-r border-[#E6E2D8] p-3 space-y-2 bg-[#FAF8F4]">
                <div className="text-xs font-semibold text-[#526057] px-2 py-1">
                  Your Conversations
                </div>
                {conversations.length === 0 ? (
                  <p className="text-xs text-[#526057] p-2">
                    No messages yet. Use Message PawCare Support or open a booking chat once a caregiver is assigned.
                  </p>
                ) : (
                  conversations.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setActiveConvId(c.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-colors cursor-pointer ${
                        activeConvId === c.id
                          ? 'bg-white border-[#1B4332]'
                          : 'bg-transparent border-transparent hover:bg-white'
                      }`}
                    >
                      <div className="font-semibold text-xs text-[#1A221D] truncate">
                        {c.subject}
                      </div>
                      <div className="text-[11px] text-[#526057] truncate mt-0.5">
                        {c.type === 'support' ? 'Support' : 'Booking Chat'} · {c.status}
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="md:col-span-8 flex flex-col">
                {!activeConvId ? (
                  <div className="flex-1 flex items-center justify-center p-6 text-sm text-[#526057]">
                    Select a conversation to view messages.
                  </div>
                ) : (
                  <>
                    <div className="flex-1 p-4 space-y-2.5 overflow-y-auto max-h-[360px]">
                      {messages.map((m) => (
                        <div
                          key={m.id}
                          className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                            m.senderId === firebaseUser.uid
                              ? 'ml-auto bg-[#1B4332] text-white'
                              : 'mr-auto bg-[#FAF8F4] border border-[#E6E2D8] text-[#1A221D]'
                          }`}
                        >
                          <div className="text-[10px] opacity-75 mb-0.5">
                            {m.senderName} ({m.senderRole})
                          </div>
                          <div>{m.text}</div>
                        </div>
                      ))}
                    </div>
                    <form
                      onSubmit={handleSendMessage}
                      className="p-3 border-t border-[#E6E2D8] flex gap-2"
                    >
                      <input
                        type="text"
                        value={msgText}
                        onChange={(e) => setMsgText(e.target.value)}
                        placeholder="Write a message..."
                        className="flex-1 px-3 py-2 rounded-xl border border-[#D8D3C8] text-sm"
                      />
                      <button
                        type="submit"
                        disabled={!msgText.trim()}
                        className="px-4 py-2 rounded-xl bg-[#1B4332] text-white cursor-pointer disabled:opacity-45"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          )}

          {tab === 'notifications' && (
            <div className="rounded-2xl border border-[#E6E2D8] bg-white p-6 space-y-4">
              <h2 className="font-display text-xl font-bold text-[#1A221D]">Notifications</h2>
              {notifications.length === 0 ? (
                <p className="text-sm text-[#526057]">
                  No notifications yet. System updates for bookings, support replies, and account changes appear here.
                </p>
              ) : (
                <div className="divide-y divide-[#EFECE4]">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`py-3.5 flex items-start justify-between gap-4 ${
                        n.read ? 'opacity-70' : ''
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="font-semibold text-sm text-[#1A221D]">{n.title}</div>
                        <p className="text-xs text-[#526057]">{n.body}</p>
                      </div>
                      {!n.read && (
                        <button
                          type="button"
                          onClick={() => void markNotificationRead(n.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#D4CFC4] text-xs font-medium text-[#1B4332] shrink-0 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Mark read
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'settings' && (
            <form
              onSubmit={handleProfileSave}
              className="rounded-2xl border border-[#E6E2D8] bg-white p-6 space-y-4"
            >
              <h2 className="font-display text-xl font-bold text-[#1A221D]">Account Settings</h2>
              {settingsSaved && (
                <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  {settingsSaved}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#445249] mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D3C8] text-sm"
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
                  <label className="block text-xs font-medium text-[#445249] mb-1">City</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    list="settings-areas"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D3C8] text-sm"
                  />
                  <datalist id="settings-areas">
                    <option value="Dehradun" />
                    {DEHRADUN_AREAS.map((a) => (
                      <option key={a} value={`Dehradun (${a})`} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#445249] mb-1">Phone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D3C8] text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#445249] mb-1">
                  Profile Photo
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleProfilePhotoUpload}
                  className="block w-full text-xs text-[#526057] file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-[#D8D3C8] file:bg-[#FAF8F4]"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-[#1B4332] text-white text-xs font-semibold hover:bg-[#143326] cursor-pointer"
              >
                Save Account Changes
              </button>
            </form>
          )}
        </main>
      </div>

      {/* View Pet Profile Modal */}
      {viewingPet && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-[#E6E2D8] rounded-2xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <SafeImage
                  src={viewingPet.photoUrl}
                  alt={viewingPet.name}
                  aspectClass="w-16 h-16 rounded-xl shrink-0"
                  fallbackLabel=""
                />
                <div>
                  <h3 className="font-display text-xl font-bold text-[#1A221D]">
                    {viewingPet.name}
                  </h3>
                  <div className="text-xs text-[#526057]">
                    {viewingPet.animalType} {viewingPet.breed ? `· ${viewingPet.breed}` : ''} ·{' '}
                    {viewingPet.age} · {viewingPet.size}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingPet(null)}
                aria-label="Close pet details"
                className="p-1.5 rounded-lg text-[#526057] hover:bg-[#FAF8F4] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2.5 text-xs text-[#445249] bg-[#FAF8F4] rounded-xl p-4 border border-[#EFECE4]">
              <div>
                <strong>Feeding Routine:</strong>{' '}
                {viewingPet.feedingInstructions || 'No specific feeding notes saved.'}
              </div>
              <div>
                <strong>Behavior &amp; Temperament:</strong>{' '}
                {viewingPet.behaviorNotes || 'No behavior notes saved.'}
              </div>
              <div>
                <strong>Special Care Instructions:</strong>{' '}
                {viewingPet.specialCareInstructions || 'Standard everyday care.'}
              </div>
              {viewingPet.medicationNotes && (
                <div>
                  <strong>Routine Medication Notes:</strong> {viewingPet.medicationNotes}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const p = viewingPet;
                  setViewingPet(null);
                  openPetEditor(p);
                }}
                className="px-4 py-2 rounded-xl border border-[#D4CFC4] text-xs font-semibold text-[#1A221D] cursor-pointer"
              >
                Edit Profile
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewingPet(null);
                  onStartBooking();
                }}
                className="px-4 py-2 rounded-xl bg-[#1B4332] text-white text-xs font-semibold cursor-pointer"
              >
                Book Care for {viewingPet.name}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Confirmation Modal */}
      {cancellingBooking && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-[#E6E2D8] rounded-2xl p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-[#1A221D]">
              Cancel Booking for {cancellingBooking.petName}?
            </h3>
            <p className="text-xs text-[#526057]">
              Cancellations before service start are recorded immediately. Please share a brief reason.
            </p>
            <textarea
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Reason for cancellation..."
              className="w-full px-3 py-2 rounded-xl border border-[#D8D3C8] text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancellingBooking(null)}
                className="px-4 py-2 rounded-xl border border-[#D4CFC4] text-xs font-medium cursor-pointer"
              >
                Keep Booking
              </button>
              <button
                type="button"
                onClick={async () => {
                  await cancelBookingByCustomer(
                    cancellingBooking,
                    firebaseUser.uid,
                    cancelReason
                  );
                  setCancellingBooking(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-700 text-white text-xs font-semibold cursor-pointer"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </PageReveal>
  );
}
