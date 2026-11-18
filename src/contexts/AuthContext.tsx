import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
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
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import { DEFAULT_SERVICES, DEFAULT_WEBSITE_CONTENT } from '../lib/defaults';
import { seedInitialCatalogIfAdmin } from '../lib/firestoreService';
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

interface AuthContextValue {
  firebaseUser: User | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  effectiveRole: UserRole | null;
  needsOnboarding: boolean;
  authReady: boolean;
  services: ServiceItem[];
  servicesLoadedFromDb: boolean;
  websiteContent: WebsiteContent;
  caregiverApplication: CaregiverApplication | null;
  caregiverProfile: CaregiverPublicProfile | null;
  notifications: NotificationItem[];
  unreadCount: number;
  signInWithGoogle: () => Promise<void>;
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
  const [authReady, setAuthReady] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);

  const [services, setServices] = useState<ServiceItem[]>(DEFAULT_SERVICES);
  const [servicesLoadedFromDb, setServicesLoadedFromDb] = useState(false);
  const [websiteContent, setWebsiteContent] = useState<WebsiteContent>(DEFAULT_WEBSITE_CONTENT);

  const [caregiverApplication, setCaregiverApplication] =
    useState<CaregiverApplication | null>(null);
  const [caregiverProfile, setCaregiverProfile] = useState<CaregiverPublicProfile | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const isBootstrappedAdmin =
    Boolean(firebaseUser?.emailVerified) &&
    firebaseUser?.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();

  const isAdmin = isBootstrappedAdmin || (Boolean(firebaseUser?.emailVerified) && hasAdminDoc);

  const effectiveRole: UserRole | null = !firebaseUser
    ? null
    : isAdmin
    ? 'admin'
    : caregiverProfile?.verificationStatus === 'approved' || userProfile?.role === 'caregiver'
    ? 'caregiver'
    : 'customer';

  const needsOnboarding = Boolean(
    firebaseUser && profileChecked && (!userProfile || !userProfile.city)
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

  // Auth listener
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (!user) {
        setUserProfile(null);
        setHasAdminDoc(false);
        setCaregiverApplication(null);
        setCaregiverProfile(null);
        setNotifications([]);
        setProfileChecked(false);
        setAuthReady(true);
      } else {
        setAuthReady(true);
      }
    });
    return () => unsubAuth();
  }, []);

  // User-scoped Firestore listeners (only after auth is ready & user exists)
  useEffect(() => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;
    setProfileChecked(false);

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
        handleFirestoreError(error, OperationType.GET, `users/${uid}`);
      }
    );

    const unsubAdmin = onSnapshot(
      doc(db, 'admins', uid),
      (snap) => {
        setHasAdminDoc(snap.exists());
      },
      () => {
        setHasAdminDoc(false);
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

  // Ensure bootstrapped admin can seed initial catalog & create admin registry record once
  useEffect(() => {
    if (!firebaseUser || !isAdmin) return;
    const ensureAdminBootstrapped = async () => {
      try {
        const adminRef = doc(db, 'admins', firebaseUser.uid);
        const adminSnap = await getDoc(adminRef);
        if (!adminSnap.exists()) {
          await setDoc(adminRef, {
            uid: firebaseUser.uid,
            email: firebaseUser.email || BOOTSTRAPPED_ADMIN_EMAIL,
            grantedBy: 'bootstrap',
            createdAt: serverTimestamp(),
          });
        }
        await seedInitialCatalogIfAdmin(firebaseUser.uid);
      } catch (err) {
        console.warn('Admin bootstrap check:', err);
      }
    };
    void ensureAdminBootstrapped();
  }, [firebaseUser, isAdmin]);

  const signInWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    const u = result.user;
    const userRef = doc(db, 'users', u.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: u.uid,
        fullName: (u.displayName || u.email?.split('@')[0] || 'Pet Parent').slice(
          0,
          SCHEMA_LIMITS.FULL_NAME_MAX
        ),
        email: (u.email || '').slice(0, SCHEMA_LIMITS.EMAIL_MAX),
        phone: '',
        city: 'Dehradun',
        photoUrl: u.photoURL || '',
        role: 'customer',
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
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
    const u = cred.user;
    if (u.emailVerified) {
      const userRef = doc(db, 'users', u.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          uid: u.uid,
          fullName: (u.displayName || u.email?.split('@')[0] || 'Pet Parent').slice(
            0,
            SCHEMA_LIMITS.FULL_NAME_MAX
          ),
          email: (u.email || '').slice(0, SCHEMA_LIMITS.EMAIL_MAX),
          phone: '',
          city: 'Dehradun',
          photoUrl: u.photoURL || '',
          role: 'customer',
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
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
