import React, { useState } from 'react';
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
import { CustomerDashboard } from './components/pages/CustomerDashboard';
import { CaregiverDashboard } from './components/pages/CaregiverDashboard';
import { AdminDashboard } from './components/pages/AdminDashboard';
import type { AppView } from './types/pawcare';

function PawCareShell() {
  const { authReady, firebaseUser } = useAuth();
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');
  const [bookingOpen, setBookingOpen] = useState(false);
  const [preselectedService, setPreselectedService] = useState<string | undefined>(undefined);

  const handleNavigate = (view: AppView, sectionId?: string) => {
    setCurrentView(view);
    if (view === 'home' && sectionId) {
      window.setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleOpenAuth = (mode: 'login' | 'signup' = 'login') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  const handleStartBooking = (serviceSlug?: string) => {
    setPreselectedService(serviceSlug);
    setBookingOpen(true);
  };

  const renderProtectedOrView = () => {
    if (!authReady) {
      return (
        <div className="max-w-7xl mx-auto px-6 py-20 text-center text-sm text-[#526057]">
          Loading PawCare...
        </div>
      );
    }

    if (
      (currentView === 'customer-portal' ||
        currentView === 'caregiver-portal' ||
        currentView === 'admin-portal') &&
      !firebaseUser
    ) {
      return (
        <div className="max-w-lg mx-auto px-4 py-20 text-center space-y-4">
          <h1 className="font-display text-2xl font-bold text-[#1A221D]">
            Sign in to access your portal
          </h1>
          <p className="text-sm text-[#526057]">
            This area is protected. Please sign in with Google or email to continue.
          </p>
          <button
            type="button"
            onClick={() => handleOpenAuth('login')}
            className="px-5 py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-semibold cursor-pointer"
          >
            Sign In / Get Started
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
            onStartBooking={handleStartBooking}
            onNavigate={(v) => handleNavigate(v)}
          />
        );
      case 'caregiver-portal':
        return <CaregiverDashboard onNavigate={(v) => handleNavigate(v)} />;
      case 'admin-portal':
        return <AdminDashboard />;
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
        onClose={() => setAuthModalOpen(false)}
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
