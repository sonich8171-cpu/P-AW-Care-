import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import { DEFAULT_SERVICES, DEFAULT_WEBSITE_CONTENT } from '../lib/defaults';
import {
  seedInitialCatalogIfAdmin,
  verifyOwnerAdminRecord,
} from '../lib/firestoreService';
import {
  SCHEMA_LIMITS,
  type CaregiverApplication,
  type CaregiverPublicProfile,
  type NotificationItem,
  type ServiceItem,
  type UserProfile,
  type UserRole,
  type WebsiteContent,
} from '../types/pawcare';

export interface AuthEventMeta {
  type: 'login' | 'logout';
  seq: number;
}

interface AuthContextValue {
  firebaseUser: User | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  effectiveRole: UserRole | null;
  needsOnboarding: boolean;
  authReady: boolean;
  roleReady: boolean;
  profileError: string | null;
  lastAuthEvent: AuthEventMeta | null;
  services: ServiceItem[];
  servicesLoadedFromDb: boolean;
  websiteContent: WebsiteContent;
  caregiverApplication: CaregiverApplication | null;
  caregiverProfile: CaregiverPublicProfile | null;
  notifications: NotificationItem[];
  unreadCount: number;
  signInWithGoogle: () => Promise<'popup' | 'redirect'>;
  signUpWithEmail: (params: {
    email: string;
    password: string;
    fullName: string;
    city: string;
    phone?: string;
  }) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  signOutUser: () => Promise<void>;
  retryProfileSetup: () => Promise<void>;
  attemptOwnerAdminVerification: () => Promise<boolean>;
  completeOnboarding: (params: {
    fullName: string;
    city: string;
    phone?: string;
    photoUrl?: string;
  }) => Promise<void>;
  updateOwnProfile: (params: {
    fullName: string;
    city: string;
    phone?: string;
    photoUrl?: string;
  }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [hasAdminDoc, setHasAdminDoc] = useState(false);
  const [hasAdminClaim, setHasAdminClaim] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [lastAuthEvent, setLastAuthEvent] = useState<AuthEventMeta | null>(null);

  const [services, setServices] = useState<ServiceItem[]>(DEFAULT_SERVICES);
  const [servicesLoadedFromDb, setServicesLoadedFromDb] = useState(false);
  const [websiteContent, setWebsiteContent] = useState<WebsiteContent>(DEFAULT_WEBSITE_CONTENT);

  const [caregiverApplication, setCaregiverApplication] =
    useState<CaregiverApplication | null>(null);
  const [caregiverProfile, setCaregiverProfile] = useState<CaregiverPublicProfile | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const ensureCustomerProfile = useCallback(async (user: User) => {
    if (!user.emailVerified) return;
    const userRef = doc(db, 'users', user.uid);
    const defaultName = (
      user.displayName ||
      user.email?.split('@')[0] ||
      'Pet Parent'
    )
      .trim()
      .slice(0, SCHEMA_LIMITS.FULL_NAME_MAX);
    const cleanEmail = (user.email || '').trim().slice(0, SCHEMA_LIMITS.EMAIL_MAX);
    const cleanPhoto = (user.photoURL || '').slice(0, SCHEMA_LIMITS.PHOTO_MAX);

    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(userRef);
        if (!snap.exists()) {
          tx.set(userRef, {
            uid: user.uid,
            fullName: defaultName || 'Pet Parent',
            email: cleanEmail,
            phone: '',
            city: 'Dehradun',
            photoUrl: cleanPhoto,
            role: 'customer',
            status: 'active',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          const existing = snap.data() as Partial<UserProfile>;
          const updates: Record<string, unknown> = {};
          if (!existing.fullName || !existing.fullName.trim()) {
            updates.fullName = defaultName || 'Pet Parent';
          }
          if (!existing.city || !existing.city.trim()) {
            updates.city = 'Dehradun';
          }
          if (!existing.photoUrl && cleanPhoto) {
            updates.photoUrl = cleanPhoto;
          }
          if (Object.keys(updates).length > 0 && existing.status === 'active') {
            updates.updatedAt = serverTimestamp();
            tx.update(userRef, updates);
          }
        }
      });
      setProfileError(null);
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : 'Unable to initialize your customer profile right now.';
      console.error('Customer profile initialization error:', msg);
      setProfileError(msg);
      throw error;
    }
  }, []);

  const isAdmin = Boolean(firebaseUser?.emailVerified) && (hasAdminDoc || hasAdminClaim);

  const effectiveRole: UserRole | null = !firebaseUser
    ? null
    : isAdmin
    ? 'admin'
    : caregiverProfile?.verificationStatus === 'approved' || userProfile?.role === 'caregiver'
    ? 'caregiver'
    : 'customer';

  const roleReady = authReady && (!firebaseUser || (profileChecked && adminChecked));

  const needsOnboarding = Boolean(
    firebaseUser &&
      firebaseUser.emailVerified &&
      profileChecked &&
      !profileError &&
      userProfile &&
      !userProfile.city
  );

  // Public listeners: active services and website content
  useEffect(() => {
    const servicesQ = query(collection(db, 'services'), where('active', '==', true));
    const unsubServices = onSnapshot(
      servicesQ,
      (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ServiceItem, 'id'>),
          }));
          setServices(list);
          setServicesLoadedFromDb(true);
        } else {
          setServices(DEFAULT_SERVICES);
          setServicesLoadedFromDb(false);
        }
      },
      (error) => {
        console.warn('Public services listener fallback:', error.message);
      }
    );

    const unsubContent = onSnapshot(
      doc(db, 'websiteContent', 'main'),
      (snap) => {
        if (snap.exists()) {
          setWebsiteContent({
            ...DEFAULT_WEBSITE_CONTENT,
            ...(snap.data() as WebsiteContent),
          });
        }
      },
      (error) => {
        console.warn('Public websiteContent listener fallback:', error.message);
      }
    );

    return () => {
      unsubServices();
      unsubContent();
    };
  }, []);

  // Complete Google redirect flow if returning from signInWithRedirect (mobile browsers)
  useEffect(() => {
    let active = true;
    void getRedirectResult(auth)
      .then(async (result) => {
        if (!active || !result?.user) return;
        await ensureCustomerProfile(result.user);
        if (active) {
          setLastAuthEvent({ type: 'login', seq: Date.now() });
        }
      })
      .catch((error) => {
        console.error(
          'Google redirect result error:',
          error instanceof Error ? error.message : String(error)
        );
      });
    return () => {
      active = false;
    };
  }, [ensureCustomerProfile]);

  // Auth state listener
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setProfileError(null);
      if (!user) {
        setUserProfile(null);
        setHasAdminDoc(false);
        setHasAdminClaim(false);
        setCaregiverApplication(null);
        setCaregiverProfile(null);
        setNotifications([]);
        setProfileChecked(false);
        setAdminChecked(false);
        setAuthReady(true);
      } else {
        setProfileChecked(false);
        setAdminChecked(false);
        setHasAdminDoc(false);
        setHasAdminClaim(false);
        setAuthReady(true);

        void user
          .getIdTokenResult()
          .then((tokenResult) => {
            setHasAdminClaim(tokenResult.claims?.admin === true);
          })
          .catch(() => {
            setHasAdminClaim(false);
          });

        if (user.emailVerified) {
          void ensureCustomerProfile(user).catch(() => {
            // profileError state already captures failure for retry UI
          });
        }
      }
    });
    return () => unsubAuth();
  }, [ensureCustomerProfile]);

  // User-scoped Firestore listeners (only after auth user exists)
  useEffect(() => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;
    setProfileChecked(false);
    setAdminChecked(false);

    const unsubUser = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (snap.exists()) {
          setUserProfile(snap.data() as UserProfile);
        } else {
          setUserProfile(null);
        }
        setProfileChecked(true);
      },
      (error) => {
        console.error('User profile listener error:', error.message);
        setProfileError(error.message);
        setProfileChecked(true);
      }
    );

    const unsubAdmin = onSnapshot(
      doc(db, 'admins', uid),
      (snap) => {
        setHasAdminDoc(snap.exists());
        setAdminChecked(true);
      },
      () => {
        setHasAdminDoc(false);
        setAdminChecked(true);
      }
    );

    const unsubApp = onSnapshot(
      doc(db, 'caregiverApplications', uid),
      (snap) => {
        if (snap.exists()) {
          setCaregiverApplication({
            id: snap.id,
            ...(snap.data() as Omit<CaregiverApplication, 'id'>),
          });
        } else {
          setCaregiverApplication(null);
        }
      },
      () => {
        setCaregiverApplication(null);
      }
    );

    const unsubCg = onSnapshot(
      doc(db, 'caregivers', uid),
      (snap) => {
        if (snap.exists()) {
          setCaregiverProfile({
            id: snap.id,
            ...(snap.data() as Omit<CaregiverPublicProfile, 'id'>),
          });
        } else {
          setCaregiverProfile(null);
        }
      },
      () => {
        setCaregiverProfile(null);
      }
    );

    const notifQ = query(
      collection(db, 'notifications'),
      where('userId', '==', uid),
      limit(50)
    );
    const unsubNotif = onSnapshot(
      notifQ,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<NotificationItem, 'id'>),
        }));
        list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
        setNotifications(list);
      },
      () => {
        setNotifications([]);
      }
    );

    return () => {
      unsubUser();
      unsubAdmin();
      unsubApp();
      unsubCg();
      unsubNotif();
    };
  }, [firebaseUser]);

  // Seed initial catalog when an admin signs in
  useEffect(() => {
    if (!firebaseUser || !isAdmin) return;
    void seedInitialCatalogIfAdmin(firebaseUser.uid).catch((err) => {
      console.warn('Admin catalog seed check:', err);
    });
  }, [firebaseUser, isAdmin]);

  const signInWithGoogle = async (): Promise<'popup' | 'redirect'> => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await ensureCustomerProfile(result.user);
      setLastAuthEvent({ type: 'login', seq: Date.now() });
      return 'popup';
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-browser'
      ) {
        await signInWithRedirect(auth, googleProvider);
        return 'redirect';
      }
      throw err;
    }
  };

  const signUpWithEmail = async (params: {
    email: string;
    password: string;
    fullName: string;
    city: string;
    phone?: string;
  }) => {
    const cred = await createUserWithEmailAndPassword(auth, params.email, params.password);
    await updateProfile(cred.user, {
      displayName: params.fullName.trim().slice(0, SCHEMA_LIMITS.FULL_NAME_MAX),
    });
    await sendEmailVerification(cred.user);
  };

  const signInWithEmail = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    if (cred.user.emailVerified) {
      await ensureCustomerProfile(cred.user);
      setLastAuthEvent({ type: 'login', seq: Date.now() });
    }
  };

  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const resendVerificationEmail = async () => {
    if (auth.currentUser && !auth.currentUser.emailVerified) {
      await sendEmailVerification(auth.currentUser);
    }
  };

  const signOutUser = async () => {
    await signOut(auth);
    setHasAdminDoc(false);
    setHasAdminClaim(false);
    setUserProfile(null);
    setProfileError(null);
    setLastAuthEvent({ type: 'logout', seq: Date.now() });
  };

  const retryProfileSetup = async () => {
    if (!auth.currentUser) return;
    await ensureCustomerProfile(auth.currentUser);
  };

  const attemptOwnerAdminVerification = async (): Promise<boolean> => {
    if (!firebaseUser || !firebaseUser.emailVerified || !firebaseUser.email) {
      return false;
    }
    try {
      const ok = await verifyOwnerAdminRecord({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
      });
      if (ok) {
        setHasAdminDoc(true);
      }
      return ok;
    } catch {
      return false;
    }
  };

  const completeOnboarding = async (params: {
    fullName: string;
    city: string;
    phone?: string;
    photoUrl?: string;
  }) => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    try {
      if (!snap.exists()) {
        await setDoc(userRef, {
          uid,
          fullName: params.fullName.trim().slice(0, SCHEMA_LIMITS.FULL_NAME_MAX),
          email: (firebaseUser.email || '').slice(0, SCHEMA_LIMITS.EMAIL_MAX),
          phone: (params.phone || '').trim().slice(0, SCHEMA_LIMITS.PHONE_MAX),
          city: (params.city || 'Dehradun').trim().slice(0, SCHEMA_LIMITS.CITY_MAX),
          photoUrl: (params.photoUrl || firebaseUser.photoURL || '').slice(
            0,
            SCHEMA_LIMITS.PHOTO_MAX
          ),
          role: 'customer',
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(userRef, {
          fullName: params.fullName.trim().slice(0, SCHEMA_LIMITS.FULL_NAME_MAX),
          phone: (params.phone || '').trim().slice(0, SCHEMA_LIMITS.PHONE_MAX),
          city: (params.city || 'Dehradun').trim().slice(0, SCHEMA_LIMITS.CITY_MAX),
          photoUrl: (params.photoUrl || firebaseUser.photoURL || '').slice(
            0,
            SCHEMA_LIMITS.PHOTO_MAX
          ),
          updatedAt: serverTimestamp(),
        });
      }
      setProfileError(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
    }
  };

  const updateOwnProfile = async (params: {
    fullName: string;
    city: string;
    phone?: string;
    photoUrl?: string;
  }) => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;
    try {
      await updateDoc(doc(db, 'users', uid), {
        fullName: params.fullName.trim().slice(0, SCHEMA_LIMITS.FULL_NAME_MAX),
        phone: (params.phone || '').trim().slice(0, SCHEMA_LIMITS.PHONE_MAX),
        city: (params.city || 'Dehradun').trim().slice(0, SCHEMA_LIMITS.CITY_MAX),
        photoUrl: (params.photoUrl ?? userProfile?.photoUrl ?? '').slice(
          0,
          SCHEMA_LIMITS.PHOTO_MAX
        ),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userProfile,
        isAdmin,
        effectiveRole,
        needsOnboarding,
        authReady,
        roleReady,
        profileError,
        lastAuthEvent,
        services,
        servicesLoadedFromDb,
        websiteContent,
        caregiverApplication,
        caregiverProfile,
        notifications,
        unreadCount,
        signInWithGoogle,
        signUpWithEmail,
        signInWithEmail,
        sendPasswordReset,
        resendVerificationEmail,
        signOutUser,
        retryProfileSetup,
        attemptOwnerAdminVerification,
        completeOnboarding,
        updateOwnProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
