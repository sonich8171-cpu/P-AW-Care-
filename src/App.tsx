import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { Navbar } from './components/ui/Navbar';
import { MobileBottomNav } from './components/ui/MobileBottomNav';
import { AuthModal } from './components/ui/AuthModal';
import { BookingWizardModal } from './components/ui/BookingWizardModal';
import { FloatingSupportStack } from './components/ui/FloatingSupportStack';
import { HomePage } from './components/pages/HomePage';
import { FindCarePage } from './components/pages/FindCarePage';
import { CaregiverApplyPage } from './components/pages/CaregiverApplyPage';
import { PlayZonePage } from './components/pages/PlayZonePage';
import { RewardsPage } from './components/pages/RewardsPage';
import { CustomerDashboard, type CustomerTab } from './components/pages/CustomerDashboard';
import { CaregiverDashboard } from './components/pages/CaregiverDashboard';
import { AdminDashboard } from './components/pages/AdminDashboard';
import type { AppView } from './types/pawcare';

interface RouteMatch {
  view: AppView;
  customerTab?: CustomerTab;
  sectionId?: string;
  authMode?: 'login' | 'signup';
}

function parsePathname(pathname: string): RouteMatch {
  const clean = pathname.replace(/\/+$/, '') || '/';
  switch (clean) {
    case '/services':
      return { view: 'home', sectionId: 'services' };
    case '/find-care':
      return { view: 'find-care' };
    case '/apply-caregiver':
      return { view: 'apply-caregiver' };
    case '/games':
      return { view: 'play-zone' };
    case '/rewards':
      return { view: 'rewards' };
    case '/login':
      return { view: 'home', authMode: 'login' };
    case '/register':
      return { view: 'home', authMode: 'signup' };
    case '/dashboard':
      return { view: 'customer-portal', customerTab: 'overview' };
    case '/pets':
      return { view: 'customer-portal', customerTab: 'pets' };
    case '/bookings':
      return { view: 'customer-portal', customerTab: 'bookings' };
    case '/caregiver':
      return { view: 'caregiver-portal' };
    case '/admin':
      return { view: 'admin-portal' };
    case '/home':
    case '/':
    default:
      return { view: 'home' };
  }
}

function viewToPath(view: AppView, sectionId?: string, customerTab?: CustomerTab): string {
  if (view === 'home') {
    return sectionId === 'services' ? '/services' : '/';
  }
  if (view === 'find-care') return '/find-care';
  if (view === 'apply-caregiver') return '/apply-caregiver';
  if (view === 'play-zone') return '/games';
  if (view === 'rewards') return '/rewards';
  if (view === 'customer-portal') {
    if (customerTab === 'pets') return '/pets';
    if (customerTab === 'bookings') return '/bookings';
    return '/dashboard';
  }
  if (view === 'caregiver-portal') return '/caregiver';
  if (view === 'admin-portal') return '/admin';
  return '/';
}

function PawCareShell() {
  const {
    authReady,
    roleReady,
    firebaseUser,
    userProfile,
    isAdmin,
    effectiveRole,
    lastAuthEvent,
    signOutUser,
  } = useAuth();

  const initialRoute = parsePathname(window.location.pathname);
  const [currentView, setCurrentView] = useState<AppView>(initialRoute.view);
  const [customerTab, setCustomerTab] = useState<CustomerTab>(
    initialRoute.customerTab || 'overview'
  );
  const [authModalOpen, setAuthModalOpen] = useState(Boolean(initialRoute.authMode));
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>(
    initialRoute.authMode || 'login'
  );
  const [bookingOpen, setBookingOpen] = useState(false);
  const [preselectedService, setPreselectedService] = useState<string | undefined>(undefined);
  const pendingAuthEventSeq = useRef<number | null>(null);

  const syncUrl = useCallback(
    (view: AppView, sectionId?: string, tab?: CustomerTab, replace = false) => {
      const targetPath = viewToPath(view, sectionId, tab);
      if (window.location.pathname !== targetPath) {
        if (replace) {
          window.history.replaceState(null, '', targetPath);
        } else {
          window.history.pushState(null, '', targetPath);
        }
      }
    },
    []
  );

  const handleNavigate = useCallback(
    (view: AppView, sectionId?: string, tab: CustomerTab = 'overview') => {
      setCurrentView(view);
      if (view === 'customer-portal') {
        setCustomerTab(tab);
      }
      syncUrl(view, sectionId, tab);
      if (view === 'home' && sectionId) {
        window.setTimeout(() => {
          document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
        }, 60);
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [syncUrl]
  );

  // Listen to browser Back / Forward navigation
  useEffect(() => {
    const onPopState = () => {
      const matched = parsePathname(window.location.pathname);
      setCurrentView(matched.view);
      if (matched.customerTab) setCustomerTab(matched.customerTab);
      if (matched.authMode) {
        setAuthModalMode(matched.authMode);
        setAuthModalOpen(true);
      } else {
        setAuthModalOpen(false);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Scroll to initial section if URL opened at /services
  useEffect(() => {
    if (initialRoute.sectionId) {
      window.setTimeout(() => {
        document.getElementById(initialRoute.sectionId!)?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Role-based routing on login, account switch, or logout
  useEffect(() => {
    if (!authReady || !roleReady || !lastAuthEvent) return;
    if (pendingAuthEventSeq.current === lastAuthEvent.seq) return;
    pendingAuthEventSeq.current = lastAuthEvent.seq;

    if (lastAuthEvent.type === 'logout') {
      if (
        currentView === 'customer-portal' ||
        currentView === 'caregiver-portal' ||
        currentView === 'admin-portal'
      ) {
        setCurrentView('home');
        syncUrl('home', undefined, undefined, true);
      }
      return;
    }

    if (lastAuthEvent.type === 'login' && firebaseUser) {
      setAuthModalOpen(false);
      // Do not interrupt booking wizard if user signed in mid-booking
      if (bookingOpen) return;

      const targetView: AppView = isAdmin
        ? 'admin-portal'
        : effectiveRole === 'caregiver'
        ? 'caregiver-portal'
        : 'customer-portal';

      // Always move away from home, login/register, or another role's protected portal
      if (
        currentView === 'home' ||
        currentView === 'admin-portal' ||
        currentView === 'caregiver-portal' ||
        currentView === 'customer-portal'
      ) {
        setCurrentView(targetView);
        setCustomerTab('overview');
        syncUrl(targetView, undefined, 'overview', true);
      }
    }
  }, [
    authReady,
    roleReady,
    lastAuthEvent,
    firebaseUser,
    isAdmin,
    effectiveRole,
    currentView,
    bookingOpen,
    syncUrl,
  ]);

  const handleOpenAuth = (mode: 'login' | 'signup' = 'login') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  const handleStartBooking = (serviceSlug?: string) => {
    setPreselectedService(serviceSlug);
    setBookingOpen(true);
  };

  const renderProtectedOrView = () => {
    const isProtectedView =
      currentView === 'customer-portal' ||
      currentView === 'caregiver-portal' ||
      currentView === 'admin-portal';

    if (!authReady || (isProtectedView && firebaseUser && !roleReady)) {
      return (
        <div className="max-w-7xl mx-auto px-6 py-20 text-center text-sm text-[#526057]">
          Loading PawCare...
        </div>
      );
    }

    if (isProtectedView && !firebaseUser) {
      return (
        <div className="max-w-lg mx-auto px-4 py-20 text-center space-y-4">
          <h1 className="font-display text-2xl font-bold text-[#1A221D]">
            Sign in to access your portal
          </h1>
          <p className="text-sm text-[#526057]">
            This area is protected. Please sign in with Google or email to continue.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => handleOpenAuth('login')}
              className="px-5 py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-semibold cursor-pointer"
            >
              Sign In / Get Started
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('home')}
              className="px-4 py-2.5 rounded-xl border border-[#D4CFC4] text-sm font-medium text-[#445249] cursor-pointer"
            >
              Back to Home
            </button>
          </div>
        </div>
      );
    }

    if (isProtectedView && userProfile?.status === 'suspended') {
      return (
        <div className="max-w-lg mx-auto px-4 py-20 text-center space-y-4">
          <h1 className="font-display text-2xl font-bold text-[#1A221D]">Account Suspended</h1>
          <p className="text-sm text-[#526057]">
            Your PawCare account is currently suspended. Please contact care@pawcare.in if you believe this is an error.
          </p>
          <button
            type="button"
            onClick={() => void signOutUser()}
            className="px-5 py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-semibold cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      );
    }

    switch (currentView) {
      case 'find-care':
        return (
          <FindCarePage
            onStartBooking={handleStartBooking}
            onBecomeCaregiver={() => handleNavigate('apply-caregiver')}
          />
        );
      case 'apply-caregiver':
        return (
          <CaregiverApplyPage
            onRequireAuth={() => handleOpenAuth('login')}
            onNavigate={(v) => handleNavigate(v)}
          />
        );
      case 'play-zone':
        return (
          <PlayZonePage
            onNavigate={(v) => handleNavigate(v)}
            onRequireAuth={() => handleOpenAuth('login')}
          />
        );
      case 'rewards':
        return (
          <RewardsPage
            onNavigate={(v) => handleNavigate(v)}
            onRequireAuth={() => handleOpenAuth('login')}
          />
        );
      case 'customer-portal':
        return (
          <CustomerDashboard
            initialTab={customerTab}
            onStartBooking={handleStartBooking}
            onNavigate={(v) => handleNavigate(v)}
          />
        );
      case 'caregiver-portal':
        return <CaregiverDashboard onNavigate={(v) => handleNavigate(v)} />;
      case 'admin-portal':
        return <AdminDashboard onNavigate={(v) => handleNavigate(v)} />;
      case 'home':
      default:
        return (
          <HomePage
            onNavigate={handleNavigate}
            onStartBooking={handleStartBooking}
          />
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F4] text-[#1A221D] pb-24 lg:pb-0">
      <Navbar
        currentView={currentView}
        onNavigate={handleNavigate}
        onOpenAuth={handleOpenAuth}
      />

      <div className="flex-1">{renderProtectedOrView()}</div>

      <AuthModal
        open={authModalOpen}
        initialMode={authModalMode}
        onClose={() => {
          setAuthModalOpen(false);
          if (
            window.location.pathname === '/login' ||
            window.location.pathname === '/register'
          ) {
            syncUrl(currentView, undefined, customerTab, true);
          }
        }}
      />

      <BookingWizardModal
        open={bookingOpen}
        preselectedServiceSlug={preselectedService}
        onClose={() => setBookingOpen(false)}
        onRequireAuth={() => {
          setBookingOpen(false);
          handleOpenAuth('login');
        }}
      />

      <FloatingSupportStack onRequireAuth={() => handleOpenAuth('login')} />

      <MobileBottomNav
        currentView={currentView}
        onNavigate={handleNavigate}
        onStartBooking={() => handleStartBooking()}
        onOpenAuth={() => handleOpenAuth('login')}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <AuthProvider>
          <PawCareShell />
        </AuthProvider>
      </MotionConfig>
    </ErrorBoundary>
  );
}
