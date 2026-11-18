import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Calendar,
  Download,
  Eye,
  FileText,
  Globe,
  IndianRupee,
  LayoutDashboard,
  MessageSquare,
  Plus,
  Send,
  Shield,
  ShieldAlert,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import {
  BOOKING_STATUS_META,
  CAREGIVER_STATUS_META,
  DEFAULT_WEBSITE_CONTENT,
  SERVICE_IMAGES,
} from '../../lib/defaults';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import {
  adminAssignCaregiverToBooking,
  adminGrantAdminAccess,
  adminRevokeAdminAccess,
  adminReviewCaregiverApplication,
  adminSaveServiceAndPricing,
  adminSaveWebsiteContent,
  adminUpdateBookingStatus,
  adminUpdateConversationStatus,
  adminUpdateUserAccount,
  seedInitialCatalogIfAdmin,
  sendConversationMessage,
} from '../../lib/firestoreService';
import type {
  AppView,
  AuditLog,
  Booking,
  BookingStatus,
  CaregiverApplication,
  CaregiverPublicProfile,
  ChatMessage,
  Conversation,
  ConversationStatus,
  InternalPricing,
  PricingHistoryItem,
  ServiceItem,
  UserProfile,
  WebsiteContent,
} from '../../types/pawcare';
import { AnimatedCounter, PageReveal } from '../ui/MotionPrimitives';

interface AdminRegistryEntry {
  uid: string;
  email: string;
  grantedBy: string;
}

type AdminTab =
  | 'overview'
  | 'bookings'
  | 'caregivers'
  | 'customers'
  | 'admins'
  | 'services'
  | 'support'
  | 'reports'
  | 'website'
  | 'audit';

export function AdminDashboard({ onNavigate }: { onNavigate?: (view: AppView) => void }) {
  const {
    firebaseUser,
    userProfile,
    isAdmin,
    roleReady,
    websiteContent,
    attemptOwnerAdminVerification,
  } = useAuth();
  const [tab, setTab] = useState<AdminTab>('overview');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [verifyingAdmin, setVerifyingAdmin] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState('');

  // Live collections
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [adminEntries, setAdminEntries] = useState<AdminRegistryEntry[]>([]);
  const [applications, setApplications] = useState<CaregiverApplication[]>([]);
  const [caregivers, setCaregivers] = useState<CaregiverPublicProfile[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [allServices, setAllServices] = useState<ServiceItem[]>([]);
  const [pricingList, setPricingList] = useState<InternalPricing[]>([]);
  const [pricingHistory, setPricingHistory] = useState<PricingHistoryItem[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Filters & local UI state
  const [dateRange, setDateRange] = useState<'all' | '7d' | '30d'>('all');
  const [hoveredBarIdx, setHoveredBarIdx] = useState<number | null>(null);
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null);
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>('all');
  const [bookingSearch, setBookingSearch] = useState('');
  const [assignCaregiverSelection, setAssignCaregiverSelection] = useState<Record<string, string>>({});
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [selectedCustomerUid, setSelectedCustomerUid] = useState<string | null>(null);

  // Support inbox state
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [convMessages, setConvMessages] = useState<ChatMessage[]>([]);
  const [adminReply, setAdminReply] = useState('');

  // Service & Pricing editor state
  const [editingSlug, setEditingSlug] = useState<string>('new');
  const [svcName, setSvcName] = useState('');
  const [svcSlug, setSvcSlug] = useState('');
  const [svcShortDesc, setSvcShortDesc] = useState('');
  const [svcDesc, setSvcDesc] = useState('');
  const [svcDurationLabel, setSvcDurationLabel] = useState('60 Minutes');
  const [svcDurationMins, setSvcDurationMins] = useState(60);
  const [svcPrice, setSvcPrice] = useState(500);
  const [svcVarCost, setSvcVarCost] = useState(300);
  const [svcCommission, setSvcCommission] = useState(200);
  const [svcNotes, setSvcNotes] = useState('');
  const [svcActive, setSvcActive] = useState(true);

  // Website content editor state
  const [cmsForm, setCmsForm] = useState<WebsiteContent>(DEFAULT_WEBSITE_CONTENT);

  useEffect(() => {
    setCmsForm(websiteContent);
  }, [websiteContent]);

  useEffect(() => {
    if (!firebaseUser || !isAdmin) return;

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => setUsers(snap.docs.map((d) => d.data() as UserProfile)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );

    const unsubAdmins = onSnapshot(
      collection(db, 'admins'),
      (snap) => setAdminEntries(snap.docs.map((d) => d.data() as AdminRegistryEntry)),
      () => setAdminEntries([])
    );

    const unsubApps = onSnapshot(
      query(collection(db, 'caregiverApplications'), orderBy('createdAt', 'desc')),
      (snap) =>
        setApplications(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<CaregiverApplication, 'id'>),
          }))
        ),
      (err) => handleFirestoreError(err, OperationType.LIST, 'caregiverApplications')
    );

    const unsubCg = onSnapshot(
      collection(db, 'caregivers'),
      (snap) =>
        setCaregivers(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<CaregiverPublicProfile, 'id'>),
          }))
        ),
      (err) => handleFirestoreError(err, OperationType.LIST, 'caregivers')
    );

    const unsubBookings = onSnapshot(
      query(collection(db, 'bookings'), orderBy('createdAt', 'desc'), limit(200)),
      (snap) =>
        setBookings(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Booking, 'id'>) }))
        ),
      (err) => handleFirestoreError(err, OperationType.LIST, 'bookings')
    );

    const unsubSvc = onSnapshot(
      collection(db, 'services'),
      (snap) =>
        setAllServices(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ServiceItem, 'id'>) }))
        ),
      (err) => handleFirestoreError(err, OperationType.LIST, 'services')
    );

    const unsubPricing = onSnapshot(
      collection(db, 'pricing'),
      (snap) =>
        setPricingList(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InternalPricing, 'id'>) }))
        ),
      (err) => handleFirestoreError(err, OperationType.LIST, 'pricing')
    );

    const unsubPH = onSnapshot(
      query(collection(db, 'pricingHistory'), orderBy('changedAt', 'desc'), limit(40)),
      (snap) =>
        setPricingHistory(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<PricingHistoryItem, 'id'>),
          }))
        ),
      () => setPricingHistory([])
    );

    const unsubConvs = onSnapshot(
      query(collection(db, 'conversations'), orderBy('lastMessageAt', 'desc'), limit(100)),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Conversation, 'id'>),
        }));
        setConversations(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'conversations')
    );

    const unsubLogs = onSnapshot(
      query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(60)),
      (snap) =>
        setAuditLogs(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditLog, 'id'>) }))
        ),
      () => setAuditLogs([])
    );

    return () => {
      unsubUsers();
      unsubAdmins();
      unsubApps();
      unsubCg();
      unsubBookings();
      unsubSvc();
      unsubPricing();
      unsubPH();
      unsubConvs();
      unsubLogs();
    };
  }, [firebaseUser, isAdmin]);

  useEffect(() => {
    if (!selectedConvId || !isAdmin) {
      setConvMessages([]);
      return;
    }
    const q = query(
      collection(db, 'conversations', selectedConvId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );
    return onSnapshot(q, (snap) => {
      setConvMessages(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChatMessage, 'id'>) }))
      );
    });
  }, [selectedConvId, isAdmin]);

  if (!roleReady) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center text-sm text-[#526057]">
        Verifying your PawCare permissions...
      </div>
    );
  }

  if (!firebaseUser || !isAdmin) {
    return (
      <PageReveal className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <ShieldAlert className="w-10 h-10 text-rose-700 mx-auto" />
        <h1 className="font-display text-2xl font-bold text-[#1A221D]">
          Administrator Access Required
        </h1>
        <p className="text-sm text-[#526057] leading-relaxed">
          This control center is protected by server-verified Firestore admin rules and is restricted to authorized PawCare administrators.
        </p>
        {verifyMsg && (
          <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
            {verifyMsg}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate(firebaseUser ? 'customer-portal' : 'home')}
              className="px-5 py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-semibold hover:bg-[#143326] cursor-pointer"
            >
              {firebaseUser ? 'Return to My Dashboard' : 'Back to Home'}
            </button>
          )}
          {firebaseUser && (
            <button
              type="button"
              disabled={verifyingAdmin}
              onClick={async () => {
                setVerifyingAdmin(true);
                setVerifyMsg('');
                const ok = await attemptOwnerAdminVerification();
                if (!ok) {
                  setVerifyMsg(
                    'Your account is not listed in the server-side admins registry.'
                  );
                }
                setVerifyingAdmin(false);
              }}
              className="px-4 py-2.5 rounded-xl border border-[#D4CFC4] bg-white text-xs font-semibold text-[#445249] hover:bg-[#FAF8F4] cursor-pointer"
            >
              {verifyingAdmin ? 'Checking...' : 'Verify Admin Authorization'}
            </button>
          )}
        </div>
      </PageReveal>
    );
  }

  const adminEmail = firebaseUser.email || 'admin@pawcare.in';

  // Computed metrics strictly from genuine Firestore records (filtered by dateRange)
  const cutoffMs =
    dateRange === '7d'
      ? Date.now() - 7 * 86400000
      : dateRange === '30d'
      ? Date.now() - 30 * 86400000
      : 0;

  const rangedBookings =
    dateRange === 'all'
      ? bookings
      : bookings.filter((b) => (b.createdAt?.toMillis?.() ?? Date.now()) >= cutoffMs);

  const rangedCustomers =
    dateRange === 'all'
      ? users.filter((u) => u.role === 'customer')
      : users.filter(
          (u) => u.role === 'customer' && (u.createdAt?.toMillis?.() ?? Date.now()) >= cutoffMs
        );

  const customers = rangedCustomers;
  const pendingApps = applications.filter((a) =>
    ['submitted', 'under_review'].includes(a.status)
  );
  const approvedCaregivers = caregivers.filter((c) => c.verificationStatus === 'approved');

  const pendingBookingsCount = rangedBookings.filter((b) => b.status === 'pending').length;
  const confirmedBookingsCount = rangedBookings.filter((b) => b.status === 'confirmed').length;
  const completedBookingsCount = rangedBookings.filter((b) => b.status === 'completed').length;
  const cancelledBookingsCount = rangedBookings.filter((b) => b.status === 'cancelled').length;

  // Service demand counts
  const demandByService = allServices.map((svc) => ({
    name: svc.name,
    count: rangedBookings.filter((b) => b.serviceId === svc.slug).length,
  }));
  const maxDemand = Math.max(1, ...demandByService.map((d) => d.count));

  // Last 7 days genuine booking trend
  const dailyTrend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const iso = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const count = bookings.filter((b) => b.requestedDate === iso).length;
    return { iso, label, count };
  });
  const maxTrend = Math.max(1, ...dailyTrend.map((t) => t.count));

  // Financial figures strictly from actual completed bookings
  const completedBookings = rangedBookings.filter((b) => b.status === 'completed');
  const completedGrossInr = completedBookings.reduce(
    (sum, b) => sum + (Number(b.priceSnapshotInr) || 0),
    0
  );
  const estimatedRealizedCommissionInr = completedBookings.reduce((sum, b) => {
    const p = pricingList.find((item) => item.serviceId === b.serviceId);
    return sum + (p ? Number(p.platformCommissionInr) : 0);
  }, 0);

  const filteredBookings = bookings.filter((b) => {
    if (bookingStatusFilter !== 'all' && b.status !== bookingStatusFilter) return false;
    if (bookingSearch.trim()) {
      const q = bookingSearch.toLowerCase();
      return (
        b.customerName.toLowerCase().includes(q) ||
        b.petName.toLowerCase().includes(q) ||
        b.serviceName.toLowerCase().includes(q) ||
        b.assignedCaregiverName.toLowerCase().includes(q) ||
        b.id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const supportConvs = conversations.filter((c) => c.type === 'support');
  const selectedConversation = conversations.find((c) => c.id === selectedConvId);

  const loadServiceToEditor = (svc: ServiceItem) => {
    const p = pricingList.find((item) => item.serviceId === svc.slug);
    setEditingSlug(svc.slug);
    setSvcName(svc.name);
    setSvcSlug(svc.slug);
    setSvcShortDesc(svc.shortDescription);
    setSvcDesc(svc.description);
    setSvcDurationLabel(svc.durationLabel);
    setSvcDurationMins(svc.durationMinutes);
    setSvcPrice(svc.customerPriceInr);
    setSvcVarCost(p?.variableCostInr ?? Math.round(svc.customerPriceInr * 0.6));
    setSvcCommission(
      p?.platformCommissionInr ??
        svc.customerPriceInr - (p?.variableCostInr ?? Math.round(svc.customerPriceInr * 0.6))
    );
    setSvcNotes(p?.notes || '');
    setSvcActive(svc.active);
  };

  const resetNewServiceEditor = () => {
    setEditingSlug('new');
    setSvcName('');
    setSvcSlug('');
    setSvcShortDesc('');
    setSvcDesc('');
    setSvcDurationLabel('60 Minutes');
    setSvcDurationMins(60);
    setSvcPrice(500);
    setSvcVarCost(300);
    setSvcCommission(200);
    setSvcNotes('');
    setSvcActive(true);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    try {
      const slug = (editingSlug === 'new' ? svcSlug || svcName : editingSlug)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
      const prevSvc = allServices.find((s) => s.slug === slug);

      await adminSaveServiceAndPricing({
        service: {
          id: slug,
          slug,
          name: svcName,
          shortDescription: svcShortDesc,
          description: svcDesc,
          durationLabel: svcDurationLabel,
          durationMinutes: Number(svcDurationMins),
          customerPriceInr: Number(svcPrice),
          active: svcActive,
          imageUrl: prevSvc?.imageUrl || SERVICE_IMAGES[slug] || '',
        },
        previousPriceInr: prevSvc?.customerPriceInr ?? 0,
        variableCostInr: Number(svcVarCost),
        platformCommissionInr: Number(svcCommission),
        pricingNotes: svcNotes,
        adminUid: firebaseUser.uid,
        adminEmail,
      });
      setNotice(`Saved service & pricing for "${svcName}".`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to save service.');
    }
  };

  const handleExportCsv = () => {
    const header = [
      'BookingID',
      'Date',
      'Time',
      'Service',
      'Customer',
      'Pet',
      'Caregiver',
      'PriceINR',
      'Status',
    ];
    const rows = bookings.map((b) => [
      b.id,
      b.requestedDate,
      b.requestedTime,
      b.serviceName,
      b.customerName,
      b.petName,
      b.assignedCaregiverName || 'Unassigned',
      String(b.priceSnapshotInr),
      b.status,
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pawcare-bookings-report-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const navItems: { id: AdminTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'bookings', label: 'Bookings', icon: <Calendar className="w-4 h-4" />, badge: pendingBookingsCount },
    { id: 'caregivers', label: 'Caregivers', icon: <UserCheck className="w-4 h-4" />, badge: pendingApps.length },
    { id: 'customers', label: 'Customers', icon: <Users className="w-4 h-4" /> },
    { id: 'admins', label: 'Admin Access', icon: <Shield className="w-4 h-4" /> },
    { id: 'services', label: 'Services & Pricing', icon: <IndianRupee className="w-4 h-4" /> },
    { id: 'support', label: 'Support Inbox', icon: <MessageSquare className="w-4 h-4" />, badge: supportConvs.filter((c) => c.status !== 'resolved').length },
    { id: 'reports', label: 'Reports', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'website', label: 'Website CMS', icon: <Globe className="w-4 h-4" /> },
    { id: 'audit', label: 'Audit Logs', icon: <FileText className="w-4 h-4" /> },
  ];

  return (
    <PageReveal className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
        {/* Sidebar */}
        <aside className="lg:col-span-3 space-y-4">
          <div className="rounded-2xl border border-[#E6E2D8] bg-white p-5 space-y-2">
            <div className="text-xs font-medium text-[#2D6A4F]">Admin Control Center</div>
            <div className="font-display text-lg font-bold text-[#1A221D]">
              {userProfile?.fullName || 'Administrator'}
            </div>
            <div className="text-xs text-[#526057] truncate">{adminEmail}</div>
            {allServices.length === 0 && (
              <button
                type="button"
                onClick={async () => {
                  await seedInitialCatalogIfAdmin(firebaseUser.uid);
                  setNotice('Initial Dehradun service catalog initialized.');
                }}
                className="w-full mt-2 py-2 rounded-xl bg-[#1B4332] text-white text-xs font-semibold cursor-pointer"
              >
                Initialize Default Catalog
              </button>
            )}
          </div>

          <nav className="flex lg:flex-col gap-1.5 overflow-x-auto pb-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id);
                  setError('');
                  setNotice('');
                }}
                className={`flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  tab === item.id
                    ? 'bg-[#1B4332] text-white'
                    : 'bg-white border border-[#E6E2D8] text-[#445249] hover:bg-[#F1F6F2]'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  {item.icon}
                  {item.label}
                </span>
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span
                    className={`font-mono text-[11px] tabular-nums px-1.5 py-0.5 rounded-md ${
                      tab === item.id ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Panel */}
        <main className="lg:col-span-9 space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
              {error}
            </div>
          )}
          {notice && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
              {notice}
            </div>
          )}

          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="font-display text-2xl font-bold text-[#1A221D]">
                    Live Platform Overview
                  </h1>
                  <p className="text-xs text-[#526057]">
                    Metrics calculated strictly from live Firestore documents.
                  </p>
                </div>
                <div className="inline-flex rounded-xl border border-[#D8D3C8] bg-white p-1 text-xs">
                  {(
                    [
                      { id: 'all', label: 'All Time' },
                      { id: '7d', label: 'Last 7d' },
                      { id: '30d', label: 'Last 30d' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDateRange(opt.id)}
                      className={`px-3 py-1 rounded-lg font-medium cursor-pointer ${
                        dateRange === opt.id
                          ? 'bg-[#1B4332] text-white'
                          : 'text-[#445249] hover:text-[#1A221D]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Registered Customers', val: customers.length },
                  { label: 'Caregiver Applications', val: applications.length },
                  { label: 'Pending Reviews', val: pendingApps.length },
                  { label: 'Approved Caregivers', val: approvedCaregivers.length },
                  { label: 'Total Bookings', val: rangedBookings.length },
                  { label: 'Pending Bookings', val: pendingBookingsCount },
                  { label: 'Confirmed Bookings', val: confirmedBookingsCount },
                  { label: 'Completed Bookings', val: completedBookingsCount },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-[#E6E2D8] bg-white p-4 space-y-1"
                  >
                    <div className="text-xs text-[#526057]">{stat.label}</div>
                    <div className="text-2xl font-bold font-mono text-[#1A221D]">
                      <AnimatedCounter value={stat.val} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-[#E6E2D8] bg-white p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-base text-[#1A221D]">
                      Daily Booking Volume (7-Day Window)
                    </h2>
                    {hoveredBarIdx !== null && (
                      <span className="text-xs font-mono text-[#1B4332]">
                        {dailyTrend[hoveredBarIdx].label}: {dailyTrend[hoveredBarIdx].count}
                      </span>
                    )}
                  </div>
                  <div className="h-36 flex items-end justify-between gap-2 pt-4">
                    {dailyTrend.map((day, idx) => {
                      const heightPct = day.count === 0 ? 6 : Math.max(14, (day.count / maxTrend) * 100);
                      return (
                        <button
                          key={day.iso}
                          type="button"
                          onMouseEnter={() => setHoveredBarIdx(idx)}
                          onMouseLeave={() => setHoveredBarIdx(null)}
                          onFocus={() => setHoveredBarIdx(idx)}
                          className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full cursor-pointer group"
                          aria-label={`${day.label}: ${day.count} bookings`}
                        >
                          <span className="text-[10px] font-mono text-[#526057] tabular-nums">
                            {day.count}
                          </span>
                          <div className="w-full max-w-[32px] flex-1 flex items-end">
                            <div
                              className={`w-full rounded-t-lg transition-all ${
                                hoveredBarIdx === idx ? 'bg-[#E07A2B]' : 'bg-[#1B4332]'
                              }`}
                              style={{ height: `${heightPct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-[#526057] whitespace-nowrap">
                            {day.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#E6E2D8] bg-white p-5 space-y-4">
                  <h2 className="font-semibold text-base text-[#1A221D]">
                    Service Demand &amp; Cancellation Rate
                  </h2>
                  {rangedBookings.length === 0 ? (
                    <p className="text-xs text-[#526057] py-6 text-center">
                      No booking requests recorded in this range yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {demandByService.map((row) => (
                        <div key={row.name} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-medium text-[#1A221D]">{row.name}</span>
                            <span className="font-mono tabular-nums text-[#526057]">
                              {row.count}
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-[#EFECE4] overflow-hidden">
                            <div
                              className="h-full bg-[#1B4332] rounded-full transition-all duration-500"
                              style={{ width: `${(row.count / maxDemand) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                      <div className="pt-2 border-t border-[#EFECE4] flex justify-between text-xs text-[#526057]">
                        <span>Cancellation Analysis</span>
                        <span className="font-mono tabular-nums font-semibold text-[#1A221D]">
                          {cancelledBookingsCount} cancelled (
                          {Math.round((cancelledBookingsCount / rangedBookings.length) * 100)}%)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* BOOKINGS MANAGEMENT */}
          {tab === 'bookings' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="font-display text-2xl font-bold text-[#1A221D]">
                  Booking Management
                </h2>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={bookingSearch}
                    onChange={(e) => setBookingSearch(e.target.value)}
                    placeholder="Search customer, pet, ID..."
                    className="px-3 py-2 rounded-xl border border-[#D8D3C8] bg-white text-xs"
                  />
                  <select
                    value={bookingStatusFilter}
                    onChange={(e) => setBookingStatusFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-[#D8D3C8] bg-white text-xs"
                  >
                    <option value="all">All Statuses</option>
                    {Object.entries(BOOKING_STATUS_META).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {filteredBookings.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#D4CFC4] bg-white p-8 text-center text-sm text-[#526057]">
                  No booking requests match your filter.
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredBookings.map((b) => {
                    const selectedCgUid =
                      assignCaregiverSelection[b.id] ?? b.assignedCaregiverId ?? '';
                    const availableCaregivers = approvedCaregivers.filter((c) => c.isAvailable);

                    return (
                      <div
                        key={b.id}
                        className="rounded-2xl border border-[#E6E2D8] bg-white p-5 space-y-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-base text-[#1A221D]">
                              {b.serviceName} · {b.petName} ({b.petAnimalType})
                            </div>
                            <div className="text-xs text-[#526057] font-mono tabular-nums">
                              Customer: {b.customerName} · {b.requestedDate} · {b.requestedTime} · ₹
                              {b.priceSnapshotInr.toLocaleString('en-IN')}
                            </div>
                            <div className="text-xs text-[#526057] mt-0.5">
                              Location: {b.serviceLocation}
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

                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#EFECE4]">
                          <select
                            value={selectedCgUid}
                            onChange={(e) =>
                              setAssignCaregiverSelection((prev) => ({
                                ...prev,
                                [b.id]: e.target.value,
                              }))
                            }
                            className="px-3 py-1.5 rounded-lg border border-[#D8D3C8] text-xs bg-white"
                          >
                            <option value="">Select Approved Caregiver...</option>
                            {availableCaregivers.map((cg) => (
                              <option key={cg.uid} value={cg.uid}>
                                {cg.displayName} ({cg.city})
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            disabled={!selectedCgUid}
                            onClick={async () => {
                              setError('');
                              setNotice('');
                              const cg = approvedCaregivers.find((c) => c.uid === selectedCgUid);
                              if (!cg) return;
                              try {
                                await adminAssignCaregiverToBooking({
                                  booking: b,
                                  caregiver: cg,
                                  nextStatus: 'confirmed',
                                  adminUid: firebaseUser.uid,
                                  adminEmail,
                                });
                                setNotice(`Assigned ${cg.displayName} and confirmed booking.`);
                              } catch (err: unknown) {
                                setError(
                                  err instanceof Error ? err.message : 'Assignment conflict.'
                                );
                              }
                            }}
                            className="px-3 py-1.5 rounded-lg bg-[#1B4332] text-white text-xs font-semibold disabled:opacity-45 cursor-pointer"
                          >
                            Assign &amp; Confirm
                          </button>

                          <select
                            value={b.status}
                            onChange={async (e) => {
                              await adminUpdateBookingStatus({
                                booking: b,
                                status: e.target.value as BookingStatus,
                                adminUid: firebaseUser.uid,
                                adminEmail,
                              });
                              setNotice(`Updated booking status to ${e.target.value}.`);
                            }}
                            className="px-3 py-1.5 rounded-lg border border-[#D8D3C8] text-xs bg-[#FAF8F4]"
                          >
                            {Object.entries(BOOKING_STATUS_META).map(([k, v]) => (
                              <option key={k} value={k}>
                                Set Status: {v.label}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() => setDetailBooking(b)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#D4CFC4] text-xs font-medium text-[#1A221D] cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Details
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* CAREGIVER MANAGEMENT */}
          {tab === 'caregivers' && (
            <div className="space-y-5">
              <h2 className="font-display text-2xl font-bold text-[#1A221D]">
                Caregiver Applications &amp; Verification
              </h2>
              {applications.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#D4CFC4] bg-white p-8 text-center text-sm text-[#526057]">
                  No caregiver applications submitted yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {applications.map((app) => (
                    <div
                      key={app.uid}
                      className="rounded-2xl border border-[#E6E2D8] bg-white p-5 space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-base text-[#1A221D]">
                            {app.fullName}
                          </h3>
                          <div className="text-xs text-[#526057]">
                            {app.email} · {app.phone} · {app.city}
                          </div>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-lg border text-xs font-semibold ${
                            CAREGIVER_STATUS_META[app.status]?.toneClass || ''
                          }`}
                        >
                          {CAREGIVER_STATUS_META[app.status]?.label || app.status}
                        </span>
                      </div>

                      <div className="text-xs text-[#445249] space-y-1">
                        <div>
                          <strong>Services:</strong> {app.servicesOffered.join(', ')} ·{' '}
                          <strong>Pets:</strong> {app.petTypesHandled.join(', ')}
                        </div>
                        <div>
                          <strong>Availability:</strong> {app.availabilitySummary}
                        </div>
                        <div>
                          <strong>Experience:</strong> {app.experienceSummary}
                        </div>
                        <div>
                          <strong>Introduction:</strong> {app.intro}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#EFECE4]">
                        <button
                          type="button"
                          onClick={async () => {
                            await adminReviewCaregiverApplication({
                              application: app,
                              decision: 'under_review',
                              adminUid: firebaseUser.uid,
                              adminEmail,
                            });
                            setNotice(`Marked ${app.fullName} as Under Review.`);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-[#D4CFC4] text-xs font-medium cursor-pointer"
                        >
                          Mark Under Review
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await adminReviewCaregiverApplication({
                              application: app,
                              decision: 'approved',
                              adminUid: firebaseUser.uid,
                              adminEmail,
                            });
                            setNotice(`Approved ${app.fullName} as a verified caregiver.`);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#1B4332] text-white text-xs font-semibold cursor-pointer"
                        >
                          Approve Caregiver
                        </button>

                        <input
                          type="text"
                          value={rejectReasons[app.uid] || ''}
                          onChange={(e) =>
                            setRejectReasons((prev) => ({
                              ...prev,
                              [app.uid]: e.target.value,
                            }))
                          }
                          placeholder="Rejection reason..."
                          className="px-2.5 py-1.5 rounded-lg border border-[#D8D3C8] text-xs"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            const reason = (rejectReasons[app.uid] || '').trim();
                            if (!reason) {
                              setError('Please enter a rejection reason before rejecting.');
                              return;
                            }
                            await adminReviewCaregiverApplication({
                              application: app,
                              decision: 'rejected',
                              rejectionReason: reason,
                              adminUid: firebaseUser.uid,
                              adminEmail,
                            });
                            setNotice(`Rejected application for ${app.fullName}.`);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 text-xs font-semibold cursor-pointer"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await adminReviewCaregiverApplication({
                              application: app,
                              decision: 'suspended',
                              adminUid: firebaseUser.uid,
                              adminEmail,
                            });
                            setNotice(`Suspended caregiver ${app.fullName}.`);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 text-xs font-semibold cursor-pointer"
                        >
                          Suspend
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CUSTOMER MANAGEMENT */}
          {tab === 'customers' && (
            <div className="space-y-5">
              <h2 className="font-display text-2xl font-bold text-[#1A221D]">
                Customer Management
              </h2>
              <div className="rounded-2xl border border-[#E6E2D8] bg-white overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F4] border-b border-[#E6E2D8] text-[#526057]">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Name</th>
                      <th className="py-3 px-4 font-semibold">Email</th>
                      <th className="py-3 px-4 font-semibold">City</th>
                      <th className="py-3 px-4 font-semibold">Role</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold text-right">Bookings</th>
                      <th className="py-3 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFECE4]">
                    {users.map((u) => {
                      const count = bookings.filter((b) => b.customerId === u.uid).length;
                      return (
                        <tr key={u.uid} className="hover:bg-[#FAF8F4]">
                          <td className="py-3 px-4 font-medium text-[#1A221D]">{u.fullName}</td>
                          <td className="py-3 px-4 text-[#526057]">{u.email}</td>
                          <td className="py-3 px-4 text-[#526057]">{u.city}</td>
                          <td className="py-3 px-4 font-mono">{u.role}</td>
                          <td className="py-3 px-4 font-mono">{u.status}</td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">{count}</td>
                          <td className="py-3 px-4 text-right space-x-2">
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedCustomerUid(
                                  selectedCustomerUid === u.uid ? null : u.uid
                                )
                              }
                              className="text-[#1B4332] font-semibold hover:underline cursor-pointer"
                            >
                              History
                            </button>
                            {u.email !== adminEmail && (
                              <button
                                type="button"
                                onClick={() =>
                                  void adminUpdateUserAccount({
                                    targetUid: u.uid,
                                    role: u.role,
                                    status: u.status === 'active' ? 'suspended' : 'active',
                                    adminUid: firebaseUser.uid,
                                    adminEmail,
                                  })
                                }
                                className="text-rose-700 font-semibold hover:underline cursor-pointer"
                              >
                                {u.status === 'active' ? 'Suspend' : 'Reactivate'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {selectedCustomerUid && (
                <div className="rounded-2xl border border-[#E6E2D8] bg-white p-5 space-y-2">
                  <h3 className="font-semibold text-sm text-[#1A221D]">
                    Booking History for{' '}
                    {users.find((u) => u.uid === selectedCustomerUid)?.fullName}
                  </h3>
                  {bookings.filter((b) => b.customerId === selectedCustomerUid).length === 0 ? (
                    <p className="text-xs text-[#526057]">No bookings for this customer.</p>
                  ) : (
                    <div className="space-y-1.5 text-xs">
                      {bookings
                        .filter((b) => b.customerId === selectedCustomerUid)
                        .map((b) => (
                          <div key={b.id} className="flex justify-between py-1 border-b border-[#EFECE4]">
                            <span>
                              {b.serviceName} for {b.petName} ({b.requestedDate})
                            </span>
                            <span className="font-mono">
                              ₹{b.priceSnapshotInr} · {b.status}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ADMIN ACCESS MANAGEMENT */}
          {tab === 'admins' && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl font-bold text-[#1A221D]">
                  Admin Access Control
                </h2>
                <p className="text-xs text-[#526057]">
                  Admin privileges are enforced server-side via the Firestore admins registry. Customers can never promote themselves.
                </p>
              </div>

              <div className="rounded-2xl border border-[#E6E2D8] bg-white p-5 space-y-3">
                <h3 className="font-semibold text-sm text-[#1A221D]">
                  Authorized Administrators ({adminEntries.length})
                </h3>
                {adminEntries.length === 0 ? (
                  <p className="text-xs text-[#526057]">
                    No explicit entries in /admins yet.
                  </p>
                ) : (
                  <div className="divide-y divide-[#EFECE4] text-xs">
                    {adminEntries.map((entry) => (
                      <div
                        key={entry.uid}
                        className="py-2.5 flex flex-wrap items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-semibold text-[#1A221D]">{entry.email}</div>
                          <div className="font-mono text-[11px] text-[#526057]">
                            UID: {entry.uid} · Granted by: {entry.grantedBy}
                          </div>
                        </div>
                        {entry.uid !== firebaseUser.uid ? (
                          <button
                            type="button"
                            onClick={async () => {
                              setError('');
                              setNotice('');
                              try {
                                await adminRevokeAdminAccess({
                                  targetUid: entry.uid,
                                  targetEmail: entry.email,
                                  adminUid: firebaseUser.uid,
                                  adminEmail,
                                });
                                setNotice(`Revoked admin privileges for ${entry.email}.`);
                              } catch (err: unknown) {
                                setError(
                                  err instanceof Error ? err.message : 'Unable to revoke admin.'
                                );
                              }
                            }}
                            className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 font-semibold hover:bg-rose-50 cursor-pointer"
                          >
                            Revoke Admin
                          </button>
                        ) : (
                          <span className="text-[11px] font-mono text-[#2D6A4F]">Current Session</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-[#E6E2D8] bg-white p-5 space-y-3">
                <h3 className="font-semibold text-sm text-[#1A221D]">
                  Promote Registered Account to Admin
                </h3>
                <div className="divide-y divide-[#EFECE4] text-xs">
                  {users
                    .filter(
                      (u) =>
                        u.status === 'active' &&
                        !adminEntries.some((a) => a.uid === u.uid) &&
                        u.uid !== firebaseUser.uid
                    )
                    .map((u) => (
                      <div
                        key={u.uid}
                        className="py-2.5 flex flex-wrap items-center justify-between gap-2"
                      >
                        <div>
                          <span className="font-semibold text-[#1A221D]">{u.fullName}</span>{' '}
                          <span className="text-[#526057]">({u.email})</span>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            setError('');
                            setNotice('');
                            try {
                              await adminGrantAdminAccess({
                                targetUid: u.uid,
                                targetEmail: u.email,
                                adminUid: firebaseUser.uid,
                                adminEmail,
                              });
                              setNotice(`Granted admin access to ${u.email}.`);
                            } catch (err: unknown) {
                              setError(
                                err instanceof Error ? err.message : 'Unable to grant admin.'
                              );
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#1B4332] text-white font-semibold cursor-pointer"
                        >
                          Grant Admin Access
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* SERVICES & PRIVATE PRICING */}
          {tab === 'services' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-2xl font-bold text-[#1A221D]">
                    Services &amp; Private Pricing Controls
                  </h2>
                  <p className="text-xs text-[#526057]">
                    Customer tariffs are published to the catalog; variable cost &amp; commission remain private to admins.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetNewServiceEditor}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1B4332] text-white text-xs font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Service
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {allServices.map((svc) => {
                  const priv = pricingList.find((p) => p.serviceId === svc.slug);
                  return (
                    <div
                      key={svc.slug}
                      className="rounded-2xl border border-[#E6E2D8] bg-white p-4 flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm text-[#1A221D]">{svc.name}</span>
                          <span className="font-mono text-xs text-[#526057]">
                            {svc.active ? 'Active' : 'Disabled'}
                          </span>
                        </div>
                        <div className="text-xs text-[#526057] font-mono tabular-nums mt-1">
                          Customer: ₹{svc.customerPriceInr} · Internal Cost: ₹
                          {priv?.variableCostInr ?? 0} · Commission: ₹
                          {priv?.platformCommissionInr ?? 0}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => loadServiceToEditor(svc)}
                        className="px-3 py-1.5 rounded-lg border border-[#D4CFC4] text-xs font-semibold text-[#1B4332] self-start cursor-pointer"
                      >
                        Edit Service &amp; Pricing
                      </button>
                    </div>
                  );
                })}
              </div>

              <form
                onSubmit={handleSaveService}
                className="rounded-2xl border border-[#E6E2D8] bg-white p-6 space-y-4"
              >
                <h3 className="font-semibold text-base text-[#1A221D]">
                  {editingSlug === 'new' ? 'Create New Service' : `Edit Service (${editingSlug})`}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#445249] mb-1">
                      Service Name
                    </label>
                    <input
                      type="text"
                      required
                      value={svcName}
                      onChange={(e) => setSvcName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#D8D3C8] text-sm"
                    />
                  </div>
                  {editingSlug === 'new' && (
                    <div>
                      <label className="block text-xs font-medium text-[#445249] mb-1">
                        Slug ID
                      </label>
                      <input
                        type="text"
                        required
                        value={svcSlug}
                        onChange={(e) => setSvcSlug(e.target.value)}
                        placeholder="e.g. evening_walk"
                        className="w-full px-3 py-2 rounded-xl border border-[#D8D3C8] text-sm font-mono"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-[#445249] mb-1">
                      Duration Label
                    </label>
                    <input
                      type="text"
                      required
                      value={svcDurationLabel}
                      onChange={(e) => setSvcDurationLabel(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#D8D3C8] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#445249] mb-1">
                      Duration (Minutes)
                    </label>
                    <input
                      type="number"
                      required
                      min={10}
                      max={1440}
                      value={svcDurationMins}
                      onChange={(e) => setSvcDurationMins(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-[#D8D3C8] text-sm font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#445249] mb-1">
                    Short Summary
                  </label>
                  <input
                    type="text"
                    required
                    value={svcShortDesc}
                    onChange={(e) => setSvcShortDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D8D3C8] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#445249] mb-1">
                    Full Description
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={svcDesc}
                    onChange={(e) => setSvcDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D8D3C8] text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-[#FAF8F4] border border-[#EFECE4]">
                  <div>
                    <label className="block text-xs font-medium text-[#445249] mb-1">
                      Customer Price (₹)
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={svcPrice}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setSvcPrice(val);
                        setSvcCommission(val - svcVarCost);
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-[#D8D3C8] bg-white text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#445249] mb-1">
                      Private Variable Cost (₹)
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={svcVarCost}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setSvcVarCost(val);
                        setSvcCommission(svcPrice - val);
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-[#D8D3C8] bg-white text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#445249] mb-1">
                      Private Commission (₹)
                    </label>
                    <input
                      type="number"
                      required
                      value={svcCommission}
                      onChange={(e) => setSvcCommission(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-[#D8D3C8] bg-white text-sm font-mono"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs font-medium text-[#1A221D]">
                  <input
                    type="checkbox"
                    checked={svcActive}
                    onChange={(e) => setSvcActive(e.target.checked)}
                    className="accent-[#1B4332]"
                  />
                  Service Active in Public Booking Catalog
                </label>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#1B4332] text-white text-xs font-semibold cursor-pointer"
                >
                  Save Service &amp; Log Price Change
                </button>
              </form>

              {pricingHistory.length > 0 && (
                <div className="rounded-2xl border border-[#E6E2D8] bg-white p-5 space-y-2">
                  <h3 className="font-semibold text-sm text-[#1A221D]">
                    Pricing Change Audit History
                  </h3>
                  <div className="space-y-1.5 text-xs font-mono">
                    {pricingHistory.slice(0, 10).map((ph) => (
                      <div key={ph.id} className="flex justify-between py-1 border-b border-[#EFECE4]">
                        <span>
                          {ph.serviceName}: ₹{ph.previousCustomerPriceInr} → ₹{ph.newCustomerPriceInr}{' '}
                          (Cost ₹{ph.newVariableCostInr}, Comm ₹{ph.newCommissionInr})
                        </span>
                        <span className="text-[#526057]">{ph.changedBy}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SUPPORT INBOX */}
          {tab === 'support' && (
            <div className="rounded-2xl border border-[#E6E2D8] bg-white overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[480px]">
              <div className="md:col-span-4 border-b md:border-b-0 md:border-r border-[#E6E2D8] p-3 space-y-2 bg-[#FAF8F4]">
                <div className="text-xs font-semibold text-[#526057] px-2 py-1">
                  Support Threads ({supportConvs.length})
                </div>
                {supportConvs.length === 0 ? (
                  <p className="text-xs text-[#526057] p-2">No support messages yet.</p>
                ) : (
                  supportConvs.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedConvId(c.id)}
                      className={`w-full text-left p-3 rounded-xl border cursor-pointer ${
                        selectedConvId === c.id ? 'bg-white border-[#1B4332]' : 'border-transparent'
                      }`}
                    >
                      <div className="font-semibold text-xs text-[#1A221D] truncate">
                        {c.customerName} · {c.status}
                      </div>
                      <div className="text-[11px] text-[#526057] truncate">{c.subject}</div>
                    </button>
                  ))
                )}
              </div>

              <div className="md:col-span-8 flex flex-col">
                {!selectedConversation ? (
                  <div className="flex-1 flex items-center justify-center p-6 text-sm text-[#526057]">
                    Select a customer support thread to respond.
                  </div>
                ) : (
                  <>
                    <div className="p-3.5 border-b border-[#E6E2D8] flex flex-wrap items-center justify-between gap-2 bg-[#FAF8F4]">
                      <div>
                        <div className="font-semibold text-sm text-[#1A221D]">
                          {selectedConversation.subject}
                        </div>
                        <div className="text-xs text-[#526057]">
                          Customer: {selectedConversation.customerName}
                        </div>
                      </div>
                      <select
                        value={selectedConversation.status}
                        onChange={(e) =>
                          void adminUpdateConversationStatus(
                            selectedConversation.id,
                            e.target.value as ConversationStatus
                          )
                        }
                        className="px-3 py-1.5 rounded-lg border border-[#D8D3C8] bg-white text-xs font-medium"
                      >
                        <option value="open">Open</option>
                        <option value="pending">Pending</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </div>
                    <div className="flex-1 p-4 space-y-2.5 overflow-y-auto max-h-[340px]">
                      {convMessages.map((m) => (
                        <div
                          key={m.id}
                          className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-xs ${
                            m.senderRole === 'admin'
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
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!adminReply.trim()) return;
                        await sendConversationMessage({
                          conversationId: selectedConversation.id,
                          senderId: firebaseUser.uid,
                          senderName: userProfile?.fullName || 'PawCare Support',
                          senderRole: 'admin',
                          text: adminReply.trim(),
                          recipientUserId: selectedConversation.customerId,
                        });
                        setAdminReply('');
                      }}
                      className="p-3 border-t border-[#E6E2D8] flex gap-2"
                    >
                      <input
                        type="text"
                        value={adminReply}
                        onChange={(e) => setAdminReply(e.target.value)}
                        placeholder="Reply to customer..."
                        className="flex-1 px-3 py-2 rounded-xl border border-[#D8D3C8] text-sm"
                      />
                      <button
                        type="submit"
                        disabled={!adminReply.trim()}
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

          {/* REPORTS */}
          {tab === 'reports' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl font-bold text-[#1A221D]">
                    Operations &amp; Financial Reports
                  </h2>
                  <p className="text-xs text-[#526057]">
                    Figures reflect genuine completed transactions only. Zero placeholder revenue.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1B4332] text-white text-xs font-semibold cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Export Bookings CSV
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-[#E6E2D8] bg-white p-5">
                  <div className="text-xs text-[#526057]">Completed Booking Value</div>
                  <div className="text-2xl font-bold font-mono text-[#1B4332] tabular-nums mt-1">
                    ₹{completedGrossInr.toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="rounded-2xl border border-[#E6E2D8] bg-white p-5">
                  <div className="text-xs text-[#526057]">Realized Platform Commission</div>
                  <div className="text-2xl font-bold font-mono text-[#1A221D] tabular-nums mt-1">
                    ₹{estimatedRealizedCommissionInr.toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="rounded-2xl border border-[#E6E2D8] bg-white p-5">
                  <div className="text-xs text-[#526057]">Completion Rate</div>
                  <div className="text-2xl font-bold font-mono text-[#1A221D] tabular-nums mt-1">
                    {bookings.length > 0
                      ? `${Math.round((completedBookingsCount / bookings.length) * 100)}%`
                      : '0%'}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#E6E2D8] bg-white p-5 space-y-3">
                <h3 className="font-semibold text-sm text-[#1A221D]">
                  Caregiver Performance Summary
                </h3>
                {approvedCaregivers.length === 0 ? (
                  <p className="text-xs text-[#526057]">No approved caregivers yet.</p>
                ) : (
                  <div className="space-y-2 text-xs">
                    {approvedCaregivers.map((cg) => {
                      const assigned = bookings.filter(
                        (b) => b.assignedCaregiverId === cg.uid
                      ).length;
                      const done = bookings.filter(
                        (b) => b.assignedCaregiverId === cg.uid && b.status === 'completed'
                      ).length;
                      return (
                        <div
                          key={cg.uid}
                          className="flex justify-between py-2 border-b border-[#EFECE4]"
                        >
                          <span className="font-medium text-[#1A221D]">{cg.displayName}</span>
                          <span className="font-mono tabular-nums text-[#526057]">
                            Assigned: {assigned} · Completed: {done}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* WEBSITE CMS */}
          {tab === 'website' && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await adminSaveWebsiteContent(cmsForm, firebaseUser.uid, adminEmail);
                setNotice('Website homepage content, FAQ, and contact details updated.');
              }}
              className="rounded-2xl border border-[#E6E2D8] bg-white p-6 space-y-4"
            >
              <h2 className="font-display text-2xl font-bold text-[#1A221D]">
                Website Management
              </h2>
              <div>
                <label className="block text-xs font-medium text-[#445249] mb-1">
                  Announcement Banner Text
                </label>
                <input
                  type="text"
                  value={cmsForm.announcementText || ''}
                  onChange={(e) =>
                    setCmsForm((p) => ({ ...p, announcementText: e.target.value }))
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-[#D8D3C8] text-sm"
                />
                <label className="inline-flex items-center gap-2 text-xs mt-2">
                  <input
                    type="checkbox"
                    checked={Boolean(cmsForm.announcementActive)}
                    onChange={(e) =>
                      setCmsForm((p) => ({ ...p, announcementActive: e.target.checked }))
                    }
                  />
                  Show Announcement Banner
                </label>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#445249] mb-1">
                  Hero Headline
                </label>
                <input
                  type="text"
                  value={cmsForm.heroHeadline || ''}
                  onChange={(e) => setCmsForm((p) => ({ ...p, heroHeadline: e.target.value }))}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#D8D3C8] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#445249] mb-1">
                  Hero Subtext
                </label>
                <textarea
                  rows={2}
                  value={cmsForm.heroSubtext || ''}
                  onChange={(e) => setCmsForm((p) => ({ ...p, heroSubtext: e.target.value }))}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#D8D3C8] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#445249] mb-1">
                  Dehradun Introduction
                </label>
                <textarea
                  rows={3}
                  value={cmsForm.dehradunIntro || ''}
                  onChange={(e) => setCmsForm((p) => ({ ...p, dehradunIntro: e.target.value }))}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#D8D3C8] text-sm"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#445249] mb-1">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    value={cmsForm.contactEmail || ''}
                    onChange={(e) =>
                      setCmsForm((p) => ({ ...p, contactEmail: e.target.value }))
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-[#D8D3C8] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#445249] mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    value={cmsForm.contactPhone || ''}
                    onChange={(e) =>
                      setCmsForm((p) => ({ ...p, contactPhone: e.target.value }))
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-[#D8D3C8] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#445249] mb-1">
                    Contact Address
                  </label>
                  <input
                    type="text"
                    value={cmsForm.contactAddress || ''}
                    onChange={(e) =>
                      setCmsForm((p) => ({ ...p, contactAddress: e.target.value }))
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-[#D8D3C8] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#445249] mb-1">
                    Service Hours
                  </label>
                  <input
                    type="text"
                    value={cmsForm.serviceHours || ''}
                    onChange={(e) =>
                      setCmsForm((p) => ({ ...p, serviceHours: e.target.value }))
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-[#D8D3C8] text-sm"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-[#1B4332] text-white text-xs font-semibold cursor-pointer"
              >
                Publish Website Updates
              </button>
            </form>
          )}

          {/* AUDIT LOGS */}
          {tab === 'audit' && (
            <div className="rounded-2xl border border-[#E6E2D8] bg-white p-5 space-y-3">
              <h2 className="font-display text-xl font-bold text-[#1A221D]">
                Operational Audit Trail
              </h2>
              {auditLogs.length === 0 ? (
                <p className="text-xs text-[#526057]">No audit entries recorded yet.</p>
              ) : (
                <div className="divide-y divide-[#EFECE4] text-xs">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="py-2.5 flex flex-wrap justify-between gap-2">
                      <div>
                        <span className="font-mono font-semibold text-[#1B4332]">
                          {log.action}
                        </span>{' '}
                        · {log.summary}
                      </div>
                      <span className="text-[#526057] font-mono">{log.actorEmail}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Booking Detail Modal */}
      {detailBooking && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white border border-[#E6E2D8] rounded-2xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-mono text-[#526057]">
                  ID: {detailBooking.id}
                </div>
                <h3 className="font-display text-xl font-bold text-[#1A221D]">
                  {detailBooking.serviceName} · {detailBooking.petName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailBooking(null)}
                aria-label="Close booking details"
                className="p-1.5 rounded-lg text-[#526057] hover:bg-[#FAF8F4] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs text-[#445249] bg-[#FAF8F4] rounded-xl p-4 border border-[#EFECE4]">
              <div>
                <strong>Customer:</strong> {detailBooking.customerName}
              </div>
              <div>
                <strong>Pet:</strong> {detailBooking.petName} ({detailBooking.petAnimalType})
              </div>
              <div>
                <strong>Schedule:</strong> {detailBooking.requestedDate} · {detailBooking.requestedTime} ({detailBooking.durationMinutes}m)
              </div>
              <div>
                <strong>Location:</strong> {detailBooking.serviceLocation}, {detailBooking.city}
              </div>
              <div>
                <strong>Price Snapshot:</strong> ₹{detailBooking.priceSnapshotInr.toLocaleString('en-IN')}
              </div>
              <div>
                <strong>Assigned Caregiver:</strong> {detailBooking.assignedCaregiverName || 'Unassigned'}
              </div>
              {detailBooking.petCareSummary && (
                <div>
                  <strong>Pet Care Summary:</strong> {detailBooking.petCareSummary}
                </div>
              )}
              {detailBooking.customerInstructions && (
                <div>
                  <strong>Customer Instructions:</strong> {detailBooking.customerInstructions}
                </div>
              )}
              {detailBooking.cancellationReason && (
                <div className="text-rose-700">
                  <strong>Cancellation Reason:</strong> {detailBooking.cancellationReason}
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setDetailBooking(null)}
                className="px-4 py-2 rounded-xl bg-[#1B4332] text-white text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </PageReveal>
  );
}
