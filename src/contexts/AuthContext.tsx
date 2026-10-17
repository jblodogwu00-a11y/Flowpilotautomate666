import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  auth,
  db,
  signInWithGooglePopup,
  signUpWithEmailPassword,
  signInWithEmailPassword,
  signOutUser,
  sendPasswordReset,
  mapFirebaseAuthError,
  ensureUserDocumentInFirestore,
  createSyntheticFirebaseUser,
} from '../firebase';
import {
  ActiveAccountSession,
  getStoredActiveAccountSession,
  saveStoredActiveAccountSession,
} from '../services/accountPersistenceService';

export interface UserProfileData {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string | null;
  createdAt?: unknown;
}

export interface AuthContextType {
  user: User | null;
  userProfile: UserProfileData | null;
  loading: boolean;
  error: string | null;
  clearError: () => void;
  signInWithGoogle: () => Promise<User>;
  signInWithEmail: (email: string, pass: string) => Promise<User>;
  signUpWithEmail: (
    email: string,
    pass: string,
    displayName?: string
  ) => Promise<User>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  useEffect(() => {
    // 1. Preload local session so UI never flashes empty state
    const cached = getStoredActiveAccountSession();
    if (cached && cached.emailVerified) {
      setUser(auth.currentUser || createSyntheticFirebaseUser(cached));
    }

    // 2. Global Firebase Auth State Listener
    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setUser(fbUser);
        await ensureUserDocumentInFirestore(fbUser);
        const session: ActiveAccountSession = {
          uid: fbUser.uid,
          email: fbUser.email || 'user@flowpilot.app',
          displayName:
            fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
          workspaceName: `${fbUser.displayName || 'My'}'s Workspace`,
          provider:
            fbUser.providerData?.[0]?.providerId === 'google.com'
              ? 'google.com'
              : 'password',
          emailVerified: true,
          isFirebaseUser: true,
        };
        saveStoredActiveAccountSession(session);
      } else {
        const local = getStoredActiveAccountSession();
        if (local && local.emailVerified) {
          setUser(createSyntheticFirebaseUser(local));
        } else {
          setUser(null);
          setUserProfile(null);
        }
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
    };
  }, []);

  // Synchronize Firestore user document (/users/{uid}) in realtime
  useEffect(() => {
    if (!user) {
      setUserProfile(null);
      return;
    }

    const unsubDoc = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          setUserProfile(snap.data() as UserProfileData);
        } else {
          setUserProfile({
            uid: user.uid,
            email: user.email || '',
            displayName:
              user.displayName || user.email?.split('@')[0] || 'User',
            photoURL: user.photoURL || null,
          });
        }
      },
      () => {
        // Fallback without failing
        setUserProfile({
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || user.email?.split('@')[0] || 'User',
          photoURL: user.photoURL || null,
        });
      }
    );

    return () => {
      unsubDoc();
    };
  }, [user]);

  const signInWithGoogle = async (): Promise<User> => {
    setError(null);
    try {
      const u = await signInWithGooglePopup();
      setUser(u);
      return u;
    } catch (err) {
      const msg = mapFirebaseAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const signInWithEmail = async (
    email: string,
    pass: string
  ): Promise<User> => {
    setError(null);
    try {
      const u = await signInWithEmailPassword(email, pass);
      setUser(u);
      return u;
    } catch (err) {
      const msg = mapFirebaseAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const signUpWithEmail = async (
    email: string,
    pass: string,
    displayName?: string
  ): Promise<User> => {
    setError(null);
    try {
      const u = await signUpWithEmailPassword(email, pass, displayName);
      setUser(u);
      return u;
    } catch (err) {
      const msg = mapFirebaseAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const logout = async (): Promise<void> => {
    setError(null);
    try {
      await signOutUser();
      setUser(null);
      setUserProfile(null);
    } catch (err) {
      const msg = mapFirebaseAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const resetPassword = async (email: string): Promise<void> => {
    setError(null);
    try {
      await sendPasswordReset(email);
    } catch (err) {
      const msg = mapFirebaseAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        error,
        clearError,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        logout,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
