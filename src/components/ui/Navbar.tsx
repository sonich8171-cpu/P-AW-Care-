import React, { useState } from 'react';
import {
  Award,
  Bell,
  Gamepad2,
  LogOut,
  Menu,
  PawPrint,
  Shield,
  Sparkles,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { AppView } from '../../types/pawcare';

interface NavbarProps {
  currentView: AppView;
  onNavigate: (view: AppView, sectionId?: string) => void;
  onOpenAuth: (mode?: 'login' | 'signup') => void;
}

export function Navbar({ currentView, onNavigate, onOpenAuth }: NavbarProps) {
  const {
    firebaseUser,
    userProfile,
    effectiveRole,
    isAdmin,
    unreadCount,
    websiteContent,
    signOutUser,
  } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNavClick = (view: AppView, sectionId?: string) => {
    setMobileOpen(false);
    onNavigate(view, sectionId);
  };

  const portalView: AppView =
    effectiveRole === 'admin'
      ? 'admin-portal'
      : effectiveRole === 'caregiver'
      ? 'caregiver-portal'
      : 'customer-portal';

  const portalLabel =
    effectiveRole === 'admin'
      ? 'Admin Console'
      : effectiveRole === 'caregiver'
      ? 'Caregiver Portal'
      : 'Profile';

  return (
    <header className="sticky top-0 z-40">
      {/* Compact Top Announcement Strip */}
      {websiteContent.announcementActive && websiteContent.announcementText && (
        <div className="bg-[#143326] text-[#FDE68A] text-[11px] sm:text-xs py-1.5 px-4 text-center border-b border-white/10">
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 truncate">
            <Sparkles className="w-3.5 h-3.5 shrink-0 text-[#FBBF24]" aria-hidden="true" />
            <span className="truncate font-medium">{websiteContent.announcementText}</span>
            <span className="hidden md:inline text-emerald-200/80">
              · Dehradun, Uttarakhand
            </span>
          </div>
        </div>
      )}

      <div className="bg-[#FAF8F4]/95 backdrop-blur-md border-b border-[#E6E2D8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 lg:h-16 flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <button
            type="button"
            onClick={() => handleNavClick('home')}
            className="inline-flex items-center gap-2 text-lg sm:text-xl font-bold tracking-tight text-[#1B4332] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B4332] rounded-md"
          >
            <span className="w-8 h-8 rounded-xl bg-[#1B4332] text-[#FDE68A] flex items-center justify-center shadow-xs">
              <PawPrint className="w-4 h-4" aria-hidden="true" />
            </span>
            <span className="font-display">PawCare</span>
          </button>

          {/* Desktop Single-Line Navigation */}
          <nav
            aria-label="Primary Navigation"
            className="hidden lg:flex items-center gap-5 xl:gap-6 text-sm font-medium text-[#445249]"
          >
            <button
              type="button"
              onClick={() => handleNavClick('home')}
              className={`hover:text-[#1B4332] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                currentView === 'home' ? 'text-[#1B4332] font-semibold' : ''
              }`}
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('home', 'services')}
              className="hover:text-[#1B4332] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Services
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('find-care')}
              className={`hover:text-[#1B4332] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                currentView === 'find-care' ? 'text-[#1B4332] font-semibold' : ''
              }`}
            >
              Find Caregiver
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('play-zone')}
              className={`inline-flex items-center gap-1.5 hover:text-[#1B4332] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                currentView === 'play-zone' ? 'text-[#1B4332] font-semibold' : ''
              }`}
            >
              <Gamepad2 className="w-4 h-4 text-[#2D6A4F]" />
              Games
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('rewards')}
              className={`inline-flex items-center gap-1.5 hover:text-[#1B4332] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                currentView === 'rewards' ? 'text-[#1B4332] font-semibold' : ''
              }`}
            >
              <Award className="w-4 h-4 text-[#D97706]" />
              Rewards
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('apply-caregiver')}
              className={`hover:text-[#1B4332] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                currentView === 'apply-caregiver' ? 'text-[#1B4332] font-semibold' : ''
              }`}
            >
              Become a Caregiver
            </button>
          </nav>

          {/* Desktop Account & Admin Corner */}
          <div className="hidden lg:flex items-center gap-2.5 shrink-0">
            {!firebaseUser ? (
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="px-4 py-2 rounded-xl bg-[#1B4332] text-white text-sm font-medium hover:bg-[#143326] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Login / Sign Up
              </button>
            ) : (
              <div className="flex items-center gap-2 shrink-0">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleNavClick('admin-portal')}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      currentView === 'admin-portal'
                        ? 'bg-[#1B4332] text-white border-[#1B4332]'
                        : 'border-[#D4CFC4] text-[#1B4332] bg-white hover:bg-[#F1F6F2]'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    Admin Corner
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleNavClick(portalView)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1B4332] text-white text-sm font-medium hover:bg-[#143326] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <UserIcon className="w-4 h-4" />
                  <span>{portalLabel}</span>
                  {unreadCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#E07A2B] text-white text-[11px] font-mono tabular-nums">
                      {unreadCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => void signOutUser()}
                  title="Sign out"
                  aria-label="Sign out"
                  className="p-2 rounded-xl border border-[#E6E2D8] text-[#526057] hover:text-[#1A221D] hover:bg-white transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Mobile Quick Actions + Drawer Toggle */}
          <div className="flex lg:hidden items-center gap-2">
            {isAdmin && (
              <button
                type="button"
                onClick={() => handleNavClick('admin-portal')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1B4332] text-[#FDE68A] text-[11px] font-semibold cursor-pointer"
              >
                <Shield className="w-3 h-3" />
                Admin
              </button>
            )}
            {!firebaseUser && (
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="px-3 py-1.5 rounded-lg bg-[#1B4332] text-white text-xs font-semibold cursor-pointer"
              >
                Login
              </button>
            )}
            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="p-2 rounded-xl border border-[#E6E2D8] text-[#1A221D] hover:bg-white cursor-pointer"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-[#E6E2D8] bg-[#FAF8F4] px-4 py-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleNavClick('home')}
                className="text-left px-3 py-2.5 rounded-xl text-sm font-medium text-[#1A221D] hover:bg-white"
              >
                Home
              </button>
              <button
                type="button"
                onClick={() => handleNavClick('home', 'services')}
                className="text-left px-3 py-2.5 rounded-xl text-sm font-medium text-[#1A221D] hover:bg-white"
              >
                Services
              </button>
              <button
                type="button"
                onClick={() => handleNavClick('find-care')}
                className="text-left px-3 py-2.5 rounded-xl text-sm font-medium text-[#1A221D] hover:bg-white"
              >
                Find Caregiver
              </button>
              <button
                type="button"
                onClick={() => handleNavClick('play-zone')}
                className="text-left px-3 py-2.5 rounded-xl text-sm font-medium text-[#1A221D] hover:bg-white"
              >
                Play Zone Games
              </button>
              <button
                type="button"
                onClick={() => handleNavClick('rewards')}
                className="text-left px-3 py-2.5 rounded-xl text-sm font-medium text-[#1A221D] hover:bg-white"
              >
                Rewards &amp; Badges
              </button>
              <button
                type="button"
                onClick={() => handleNavClick('apply-caregiver')}
                className="text-left px-3 py-2.5 rounded-xl text-sm font-medium text-[#1A221D] hover:bg-white"
              >
                Become a Caregiver
              </button>
              <button
                type="button"
                onClick={() => handleNavClick('home', 'about-dehradun')}
                className="text-left px-3 py-2.5 rounded-xl text-sm font-medium text-[#1A221D] hover:bg-white"
              >
                About Dehradun
              </button>
              <button
                type="button"
                onClick={() => handleNavClick('home', 'contact')}
                className="text-left px-3 py-2.5 rounded-xl text-sm font-medium text-[#1A221D] hover:bg-white"
              >
                Contact
              </button>
            </div>
            <div className="pt-3 border-t border-[#E6E2D8] flex flex-col gap-2">
              {!firebaseUser ? (
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    onOpenAuth('login');
                  }}
                  className="w-full py-3 rounded-xl bg-[#1B4332] text-white text-sm font-medium"
                >
                  Login / Get Started
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleNavClick('customer-portal')}
                    className="w-full py-2.5 px-3 rounded-xl bg-[#1B4332] text-white text-sm font-medium flex items-center justify-between"
                  >
                    <span className="truncate">
                      My Dashboard ({userProfile?.fullName || firebaseUser.email})
                    </span>
                    {unreadCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-mono shrink-0">
                        <Bell className="w-3.5 h-3.5" /> {unreadCount}
                      </span>
                    )}
                  </button>
                  {effectiveRole === 'caregiver' && (
                    <button
                      type="button"
                      onClick={() => handleNavClick('caregiver-portal')}
                      className="w-full py-2.5 px-3 rounded-xl bg-[#2D6A4F] text-white text-sm font-medium text-left"
                    >
                      Caregiver Portal
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleNavClick('admin-portal')}
                      className="w-full py-2.5 px-3 rounded-xl border border-[#1B4332] text-[#1B4332] text-sm font-medium text-left"
                    >
                      Admin Corner
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      void signOutUser();
                    }}
                    className="w-full py-2.5 px-3 rounded-xl border border-[#E6E2D8] text-[#526057] text-sm font-medium text-left"
                  >
                    Sign Out
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
