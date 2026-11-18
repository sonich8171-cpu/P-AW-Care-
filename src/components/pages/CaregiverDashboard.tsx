import React, { useEffect, useState } from 'react';
import {
  Bell,
  Calendar,
  Check,
  Clock,
  MessageSquare,
  Send,
  ShieldCheck,
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
import {
  AVAILABILITY_DAYS,
  BOOKING_STATUS_META,
  CAREGIVER_STATUS_META,
} from '../../lib/defaults';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import {
  caregiverUpdateBookingStatus,
  createOrOpenConversation,
  markNotificationRead,
  sendConversationMessage,
  updateCaregiverAvailability,
} from '../../lib/firestoreService';
import type { AppView, Booking, ChatMessage, Conversation } from '../../types/pawcare';
import { PageReveal, SkeletonRow } from '../ui/MotionPrimitives';

interface CaregiverDashboardProps {
  onNavigate: (view: AppView) => void;
}

type CaregiverTab = 'assignments' | 'availability' | 'messages' | 'notifications';

export function CaregiverDashboard({ onNavigate }: CaregiverDashboardProps) {
  const {
    firebaseUser,
    caregiverApplication,
    caregiverProfile,
    notifications,
    unreadCount,
  } = useAuth();

  const [tab, setTab] = useState<CaregiverTab>('assignments');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [msgText, setMsgText] = useState('');
  const [loading, setLoading] = useState(true);

  const [slots, setSlots] = useState<string[]>([]);
  const [unavailableDates, setUnavailableDates] = useState<string[]>([]);
  const [newBlockedDate, setNewBlockedDate] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [intro, setIntro] = useState('');
  const [savedNotice, setSavedNotice] = useState('');

  useEffect(() => {
    if (caregiverProfile) {
      setSlots(caregiverProfile.availabilitySlots || []);
      setUnavailableDates(caregiverProfile.unavailableDates || []);
      setIsAvailable(caregiverProfile.isAvailable);
      setIntro(caregiverProfile.intro);
    }
  }, [caregiverProfile]);

  useEffect(() => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;

    const bQ = query(
      collection(db, 'bookings'),
      where('assignedCaregiverId', '==', uid),
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

    const cQ = query(
      collection(db, 'conversations'),
      where('assignedCaregiverId', '==', uid),
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
      () => setConversations([])
    );

    return () => {
      unsubB();
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

  if (!caregiverProfile || caregiverProfile.verificationStatus !== 'approved') {
    const status = caregiverApplication?.status || 'not_submitted';
    return (
      <PageReveal className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-6">
        <div className="rounded-2xl border border-[#E6E2D8] bg-white p-8 space-y-4">
          <ShieldCheck className="w-9 h-9 text-[#1B4332]" />
          <h1 className="font-display text-2xl font-bold text-[#1A221D]">
            Caregiver Verification Status
          </h1>
          <p className="text-sm text-[#526057]">
            Only admin-approved caregivers can manage availability and receive assigned bookings.
          </p>
          {caregiverApplication ? (
            <div className="p-4 rounded-xl bg-[#FAF8F4] border border-[#E6E2D8] flex items-center justify-between">
              <span className="text-sm font-medium text-[#1A221D]">Current Status</span>
              <span
                className={`px-3 py-1 rounded-lg border text-xs font-semibold ${
                  CAREGIVER_STATUS_META[status]?.toneClass || ''
                }`}
              >
                {CAREGIVER_STATUS_META[status]?.label || status}
              </span>
            </div>
          ) : (
            <p className="text-sm text-[#526057]">No caregiver application found yet.</p>
          )}
          <button
            type="button"
            onClick={() => onNavigate('apply-caregiver')}
            className="px-5 py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-semibold cursor-pointer"
          >
            {caregiverApplication ? 'View / Update Application' : 'Apply as Caregiver'}
          </button>
        </div>
      </PageReveal>
    );
  }

  const upcoming = bookings.filter((b) =>
    ['pending', 'accepted', 'confirmed', 'in_progress'].includes(b.status)
  );
  const history = bookings.filter((b) =>
    ['completed', 'cancelled', 'rejected'].includes(b.status)
  );

  const toggleSlot = (slot: string) => {
    setSlots((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]
    );
  };

  const handleSaveAvailability = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavedNotice('');
    await updateCaregiverAvailability(
      firebaseUser.uid,
      slots,
      isAvailable,
      intro,
      unavailableDates
    );
    setSavedNotice('Availability schedule, blocked dates, and introduction saved.');
  };

  const handleOpenChat = async (b: Booking) => {
    const convId = await createOrOpenConversation({
      type: 'booking_chat',
      customerId: b.customerId,
      customerName: b.customerName,
      assignedCaregiverId: firebaseUser.uid,
      bookingId: b.id,
      subject: `${b.serviceName} · ${b.petName} (${b.requestedDate})`,
      initialMessage: `Hello ${b.customerName}, I am ready for ${b.petName}'s ${b.serviceName} session.`,
      senderId: firebaseUser.uid,
      senderName: caregiverProfile.displayName,
      senderRole: 'caregiver',
    });
    setActiveConvId(convId);
    setTab('messages');
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConvId || !msgText.trim()) return;
    await sendConversationMessage({
      conversationId: activeConvId,
      senderId: firebaseUser.uid,
      senderName: caregiverProfile.displayName,
      senderRole: 'caregiver',
      text: msgText.trim(),
    });
    setMsgText('');
  };

  return (
    <PageReveal className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      {/* Status Header */}
      <div className="rounded-2xl border border-[#E6E2D8] bg-white p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-[#2D6A4F]">
            Verified Caregiver Portal · {caregiverProfile.city}
          </div>
          <h1 className="font-display text-2xl font-bold text-[#1A221D] mt-0.5">
            {caregiverProfile.displayName}
          </h1>
          <div className="text-xs text-[#526057] mt-1">
            Status: Approved · Availability: {caregiverProfile.isAvailable ? 'Accepting Assignments' : 'Paused'}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'assignments', label: 'Assigned Bookings', icon: <Calendar className="w-4 h-4" /> },
              { id: 'availability', label: 'Availability', icon: <Clock className="w-4 h-4" /> },
              { id: 'messages', label: 'Booking Messages', icon: <MessageSquare className="w-4 h-4" /> },
              {
                id: 'notifications',
                label: `Notifications${unreadCount > 0 ? ` (${unreadCount})` : ''}`,
                icon: <Bell className="w-4 h-4" />,
              },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                tab === t.id
                  ? 'bg-[#1B4332] text-white'
                  : 'bg-[#FAF8F4] border border-[#E6E2D8] text-[#445249] hover:bg-[#F1F6F2]'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'assignments' && (
        <div className="space-y-6">
          {loading ? (
            <SkeletonRow className="h-32" />
          ) : bookings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#D4CFC4] bg-white p-8 text-center text-sm text-[#526057]">
              No bookings assigned to you yet. Ensure your availability slots are up to date so administrators can assign Dehradun requests.
            </div>
          ) : (
            [
              { title: 'Upcoming & Active Assignments', list: upcoming },
              { title: 'Service History', list: history },
            ].map(
              (group) =>
                group.list.length > 0 && (
                  <div key={group.title} className="space-y-3">
                    <h2 className="text-xs font-semibold text-[#526057]">{group.title}</h2>
                    <div className="space-y-3">
                      {group.list.map((b) => (
                        <div
                          key={b.id}
                          className="rounded-2xl border border-[#E6E2D8] bg-white p-5 space-y-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h3 className="font-semibold text-base text-[#1A221D]">
                                {b.serviceName} · {b.petName} ({b.petAnimalType})
                              </h3>
                              <div className="text-xs text-[#526057] font-mono tabular-nums mt-0.5">
                                {b.requestedDate} · {b.requestedTime} · Customer: {b.customerName}
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

                          <div className="text-xs text-[#445249] space-y-1 bg-[#FAF8F4] p-3.5 rounded-xl border border-[#EFECE4]">
                            <div>
                              <strong>Location:</strong> {b.serviceLocation}
                            </div>
                            {b.petCareSummary && (
                              <div>
                                <strong>Pet Care Summary:</strong> {b.petCareSummary}
                              </div>
                            )}
                            {b.customerInstructions && (
                              <div>
                                <strong>Customer Instructions:</strong> {b.customerInstructions}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2 pt-1">
                            {b.status === 'pending' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void caregiverUpdateBookingStatus(b, 'accepted')}
                                  className="px-3.5 py-1.5 rounded-lg bg-[#1B4332] text-white text-xs font-semibold cursor-pointer"
                                >
                                  Accept Assignment
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void caregiverUpdateBookingStatus(b, 'rejected')}
                                  className="px-3.5 py-1.5 rounded-lg border border-rose-200 text-rose-700 text-xs font-semibold cursor-pointer"
                                >
                                  Decline
                                </button>
                              </>
                            )}
                            {b.status === 'confirmed' && (
                              <button
                                type="button"
                                onClick={() => void caregiverUpdateBookingStatus(b, 'in_progress')}
                                className="px-3.5 py-1.5 rounded-lg bg-[#1B4332] text-white text-xs font-semibold cursor-pointer"
                              >
                                Start Service (In Progress)
                              </button>
                            )}
                            {b.status === 'in_progress' && (
                              <button
                                type="button"
                                onClick={() => void caregiverUpdateBookingStatus(b, 'completed')}
                                className="px-3.5 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                              >
                                Mark Completed
                              </button>
                            )}
                            {['accepted', 'confirmed', 'in_progress'].includes(b.status) && (
                              <button
                                type="button"
                                onClick={() => void handleOpenChat(b)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-[#D4CFC4] text-xs font-semibold text-[#1A221D] cursor-pointer"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                Message Customer
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
            )
          )}
        </div>
      )}

      {tab === 'availability' && (
        <form
          onSubmit={handleSaveAvailability}
          className="rounded-2xl border border-[#E6E2D8] bg-white p-6 space-y-5"
        >
          <h2 className="font-display text-xl font-bold text-[#1A221D]">
            Availability &amp; Profile Intro
          </h2>
          {savedNotice && (
            <div className="text-xs text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              {savedNotice}
            </div>
          )}
          <label className="flex items-center gap-2.5 text-sm font-medium text-[#1A221D] cursor-pointer">
            <input
              type="checkbox"
              checked={isAvailable}
              onChange={(e) => setIsAvailable(e.target.checked)}
              className="w-4 h-4 accent-[#1B4332]"
            />
            Currently available to receive new Dehradun booking assignments
          </label>

          <div className="space-y-2">
            <div className="text-xs font-medium text-[#445249]">Weekly Time Windows</div>
            <div className="flex flex-wrap gap-2">
              {AVAILABILITY_DAYS.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => toggleSlot(slot)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                    slots.includes(slot)
                      ? 'bg-[#1B4332] text-white border-[#1B4332]'
                      : 'bg-[#FAF8F4] text-[#445249] border-[#D8D3C8]'
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-[#EFECE4]">
            <div className="text-xs font-medium text-[#445249]">
              Specific Unavailable / Blocked Dates
            </div>
            <p className="text-[11px] text-[#6B786F]">
              Admins cannot assign you to bookings on dates you mark unavailable.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                min={new Date().toISOString().split('T')[0]}
                value={newBlockedDate}
                onChange={(e) => setNewBlockedDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-[#D8D3C8] text-xs bg-white"
              />
              <button
                type="button"
                disabled={!newBlockedDate}
                onClick={() => {
                  if (!newBlockedDate) return;
                  setUnavailableDates((prev) =>
                    prev.includes(newBlockedDate)
                      ? prev
                      : [...prev, newBlockedDate].sort().slice(0, 30)
                  );
                  setNewBlockedDate('');
                }}
                className="px-3 py-1.5 rounded-xl border border-[#1B4332] text-[#1B4332] text-xs font-semibold disabled:opacity-45 cursor-pointer"
              >
                + Block Date
              </button>
            </div>
            {unavailableDates.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {unavailableDates.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() =>
                      setUnavailableDates((prev) => prev.filter((item) => item !== d))
                    }
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-mono cursor-pointer"
                    title="Click to remove blocked date"
                  >
                    <span>{d}</span>
                    <span>×</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-[#445249] mb-1">
              Public Caregiver Introduction
            </label>
            <textarea
              rows={3}
              required
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D3C8] text-sm"
            />
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-[#1B4332] text-white text-xs font-semibold hover:bg-[#143326] cursor-pointer"
          >
            Save Availability
          </button>
        </form>
      )}

      {tab === 'messages' && (
        <div className="rounded-2xl border border-[#E6E2D8] bg-white overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[420px]">
          <div className="md:col-span-4 border-b md:border-b-0 md:border-r border-[#E6E2D8] p-3 space-y-2 bg-[#FAF8F4]">
            <div className="text-xs font-semibold text-[#526057] px-2 py-1">Booking Chats</div>
            {conversations.length === 0 ? (
              <p className="text-xs text-[#526057] p-2">No active booking threads.</p>
            ) : (
              conversations.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveConvId(c.id)}
                  className={`w-full text-left p-3 rounded-xl border cursor-pointer ${
                    activeConvId === c.id ? 'bg-white border-[#1B4332]' : 'border-transparent'
                  }`}
                >
                  <div className="font-semibold text-xs text-[#1A221D] truncate">{c.subject}</div>
                  <div className="text-[11px] text-[#526057] truncate">{c.customerName}</div>
                </button>
              ))
            )}
          </div>
          <div className="md:col-span-8 flex flex-col">
            {!activeConvId ? (
              <div className="flex-1 flex items-center justify-center p-6 text-sm text-[#526057]">
                Select a booking thread to coordinate with the customer.
              </div>
            ) : (
              <>
                <div className="flex-1 p-4 space-y-2.5 overflow-y-auto max-h-[340px]">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-xs ${
                        m.senderId === firebaseUser.uid
                          ? 'ml-auto bg-[#1B4332] text-white'
                          : 'mr-auto bg-[#FAF8F4] border border-[#E6E2D8] text-[#1A221D]'
                      }`}
                    >
                      <div className="text-[10px] opacity-75 mb-0.5">{m.senderName}</div>
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
                    placeholder="Message customer..."
                    className="flex-1 px-3 py-2 rounded-xl border border-[#D8D3C8] text-sm"
                  />
                  <button
                    type="submit"
                    disabled={!msgText.trim()}
                    className="px-4 py-2 rounded-xl bg-[#1B4332] text-white cursor-pointer"
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
        <div className="rounded-2xl border border-[#E6E2D8] bg-white p-6 space-y-3">
          <h2 className="font-display text-xl font-bold text-[#1A221D]">Notifications</h2>
          {notifications.length === 0 ? (
            <p className="text-sm text-[#526057]">No notifications yet.</p>
          ) : (
            <div className="divide-y divide-[#EFECE4]">
              {notifications.map((n) => (
                <div key={n.id} className="py-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-sm text-[#1A221D]">{n.title}</div>
                    <p className="text-xs text-[#526057]">{n.body}</p>
                  </div>
                  {!n.read && (
                    <button
                      type="button"
                      onClick={() => void markNotificationRead(n.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#D4CFC4] text-xs cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Read
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </PageReveal>
  );
}
