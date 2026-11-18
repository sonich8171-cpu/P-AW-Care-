import React from 'react';
import {
  CalendarCheck,
  Gamepad2,
  Home,
  PawPrint,
  Shield,
  User,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { AppView } from '../../types/pawcare';

interface MobileBottomNavProps {
  currentView: AppView;
  onNavigate: (view: AppView, sectionId?: string) => void;
  onStartBooking: () => void;
  onOpenAuth: () => void;
}

export function MobileBottomNav({
  currentView,
  onNavigate,
  onStartBooking,
  onOpenAuth,
}: MobileBottomNavProps) {
  const { firebaseUser, effectiveRole, isAdmin } = useAuth();

  const handleBookingsTap = () => {
    if (!firebaseUser) {
      onStartBooking();
    } else if (effectiveRole === 'caregiver') {
      onNavigate('caregiver-portal');
    } else {
      onNavigate('customer-portal');
    }
  };

  const handleProfileTap = () => {
    if (!firebaseUser) {
      onOpenAuth();
    } else if (isAdmin) {
      onNavigate('admin-portal');
    } else if (effectiveRole === 'caregiver') {
      onNavigate('caregiver-portal');
    } else {
      onNavigate('customer-portal');
    }
  };

  const items: {
    id: string;
    label: string;
    icon: React.ReactNode;
    active: boolean;
    onClick: () => void;
  }[] = [
    {
      id: 'home',
      label: 'Home',
      icon: <Home className="w-5 h-5" />,
      active: currentView === 'home',
      onClick: () => onNavigate('home'),
    },
    {
      id: 'services',
      label: 'Services',
      icon: <PawPrint className="w-5 h-5" />,
      active: currentView === 'find-care',
      onClick: () => onNavigate('find-care'),
    },
    {
      id: 'bookings',
      label: 'Bookings',
      icon: <CalendarCheck className="w-5 h-5" />,
      active: currentView === 'customer-portal' || currentView === 'caregiver-portal',
      onClick: handleBookingsTap,
    },
    {
      id: 'play',
      label: 'Play',
      icon: <Gamepad2 className="w-5 h-5" />,
      active: currentView === 'play-zone' || currentView === 'rewards',
      onClick: () => onNavigate('play-zone'),
    },
    {
      id: 'profile',
      label: isAdmin ? 'Admin' : 'Profile',
      icon: isAdmin ? <Shield className="w-5 h-5" /> : <User className="w-5 h-5" />,
      active: currentView === 'admin-portal',
      onClick: handleProfileTap,
    },
  ];

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-[#FAF8F4]/95 backdrop-blur-md border-t border-[#E6E2D8] px-2 flex items-center justify-around shadow-[0_-4px_16px_rgba(27,67,50,0.06)]"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={item.onClick}
          className={`flex flex-col items-center justify-center gap-0.5 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer min-w-[56px] ${
            item.active
              ? 'text-[#1B4332] bg-[#E8F3EC] font-semibold'
              : 'text-[#526057] hover:text-[#1B4332]'
          }`}
        >
          {item.icon}
          <span className="text-[10px] leading-tight">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
