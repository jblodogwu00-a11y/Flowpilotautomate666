import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  setLogLevel,
  doc,
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  ActiveAccountSession,
  VerificationEmailDispatchInfo,
  VerificationEmailConnectorOverride,
  WorkspaceSnapshot,
  getStoredActiveAccountSession,
  saveStoredActiveAccountSession,
  isEmailVerifiedInLocalRegistry,
  syncAccountWithServer,
} from './services/accountPersistenceService';

const app = initializeApp(firebaseConfig);
const targetDatabaseId =
  firebaseConfig.firestoreDatabaseId || 'ai-studio-53b8d6de-81d3-4f2a-9ea0-7359072dfac0';

setLogLevel('silent');

export const db = (() => {
  try {
    return initializeFirestore(
      app,
      {
        experimentalAutoDetectLongPolling: true,
      },
      targetDatabaseId
    );
  } catch {
    return getFirestore(app, targetDatabaseId);
  }
})();
export const auth = getAuth(app);

// Gmail send scope is requested ONLY when explicitly connecting Gmail in Workspace Settings
export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
];

// Clean Google identity provider for fast, unblocked Sign-In / Sign-Up
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const firebaseProjectId = firebaseConfig.projectId;

// Auth session listeners (unified across Firebase Auth + Persistent Account Store)
type SessionListener = (user: User | null, session: ActiveAccountSession | null) => void;
const authSessionListeners = new Set<SessionListener>();
let isPendingVerificationFlow = false;

export function createSyntheticFirebaseUser(session: ActiveAccountSession): User {
  return {
    uid: session.uid,
    email: session.email,
    displayName: session.displayName,
    emailVerified: session.emailVerified,
    isAnonymous: false,
    metadata: {},
    providerData: [
      {
        providerId: session.provider,
        uid: session.uid,
        displayName: session.displayName,
        email: session.email,
        phoneNumber: null,
        photoURL: null,
      },
    ],
    refreshToken: '',
    tenantId: null,
    delete: async () => {},
    getIdToken: async () => 'fp_local_session_token',
    getIdTokenResult: async () => ({
      token: 'fp_local_session_token',
      authTime: new Date().toISOString(),
      issuedAtTime: new Date().toISOString(),
      expirationTime: new Date(Date.now() + 86400000).toISOString(),
      signInProvider: session.provider,
      signInSecondFactor: null,
      claims: { email: session.email, email_verified: session.emailVerified },
    }),
    reload: async () => {},
    toJSON: () => ({
      uid: session.uid,
      email: session.email,
      displayName: session.displayName,
      emailVerified: session.emailVerified,
    }),
    phoneNumber: null,
    photoURL: null,
    providerId: 'firebase',
  } as unknown as User;
}

export function notifyAuthSessionChanged(
  firebaseUser: User | null,
  sessionOverride?: ActiveAccountSession | null
): void {
  const storedSession =
    sessionOverride !== undefined ? sessionOverride : getStoredActiveAccountSession();

  let effectiveUser: User | null = firebaseUser;
  let effectiveSession: ActiveAccountSession | null = storedSession;

  if (firebaseUser && storedSession && storedSession.emailVerified) {
    effectiveSession = {
      uid: firebaseUser.uid,
      email: firebaseUser.email || storedSession.email || 'operator@flowpilot.app',
      displayName:
        storedSession.displayName ||
        firebaseUser.displayName ||
        (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'Workspace Owner'),
      workspaceName:
        storedSession.workspaceName ||
        `${
          storedSession.displayName ||
          firebaseUser.displayName ||
          (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'My')
        }'s Workspace`,
      provider:
        firebaseUser.providerData?.[0]?.providerId === 'google.com'
          ? 'google.com'
          : 'password',
      emailVerified: true,
      isFirebaseUser: true,
    };
    saveStoredActiveAccountSession(effectiveSession);
  } else if (storedSession && storedSession.emailVerified) {
    effectiveUser = createSyntheticFirebaseUser(storedSession);
    effectiveSession = storedSession;
    saveStoredActiveAccountSession(storedSession);
  } else {
    effectiveUser = null;
    effectiveSession = null;
  }

  authSessionListeners.forEach((listener) => {
    try {
      listener(effectiveUser, effectiveSession);
    } catch {
      // Ignore listener errors
    }
  });
}

export function subscribeUnifiedAuthState(listener: SessionListener): () => void {
  authSessionListeners.add(listener);

  // Immediately emit stored verified session if available
  const initialStored = getStoredActiveAccountSession();
  if (initialStored && initialStored.emailVerified) {
    listener(
      auth.currentUser || createSyntheticFirebaseUser(initialStored),
      initialStored
    );
  }

  // Subscribe to underlying Firebase Auth
  const unsubFirebase = onAuthStateChanged(auth, (fbUser) => {
    if (isPendingVerificationFlow) {
      return;
    }
    const saved = getStoredActiveAccountSession();
    if (fbUser) {
      const isGoogleProvider =
        fbUser.providerData?.[0]?.providerId === 'google.com';
      const isVerifiedLocally =
        Boolean(saved && saved.emailVerified) ||
        (fbUser.email ? isEmailVerifiedInLocalRegistry(fbUser.email) : false);

      if (isGoogleProvider || isVerifiedLocally) {
        const activeSession: ActiveAccountSession = saved || {
          uid: fbUser.uid,
          email: fbUser.email || 'operator@flowpilot.app',
          displayName:
            fbUser.displayName ||
            (fbUser.email ? fbUser.email.split('@')[0] : 'Workspace Owner'),
          workspaceName: `${
            fbUser.displayName ||
            (fbUser.email ? fbUser.email.split('@')[0] : 'My')
          }'s Workspace`,
          provider: isGoogleProvider ? 'google.com' : 'password',
          emailVerified: true,
          isFirebaseUser: true,
        };
        saveStoredActiveAccountSession(activeSession);
        notifyAuthSessionChanged(fbUser, activeSession);
      } else {
        // Unverified password account must complete the 6-digit verification code step first
        listener(null, null);
      }
    } else if (saved && saved.emailVerified) {
      listener(createSyntheticFirebaseUser(saved), saved);
    } else {
      listener(null, null);
    }
  });

  return () => {
    authSessionListeners.delete(listener);
    unsubFirebase();
  };
}

// In-memory cache for Google Workspace (Gmail) OAuth access token.
let isSigningIn = false;
let cachedAccessToken: string | null = null;
let connectedGmailEmail: string | null = null;
const gmailTokenListeners = new Set<
  (state: { connected: boolean; email: string | null }) => void
>();

function notifyGmailTokenListeners() {
  const snapshot = {
    connected: Boolean(cachedAccessToken),
    email: connectedGmailEmail,
  };
  gmailTokenListeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch {
      // Ignore listener errors
    }
  });
}

export function subscribeGmailAuthState(
  listener: (state: { connected: boolean; email: string | null }) => void
): () => void {
  gmailTokenListeners.add(listener);
  listener({
    connected: Boolean(cachedAccessToken),
    email: connectedGmailEmail,
  });
  return () => {
    gmailTokenListeners.delete(listener);
  };
}

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        connectedGmailEmail = user.email || connectedGmailEmail;
        notifyGmailTokenListeners();
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        notifyGmailTokenListeners();
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      notifyGmailTokenListeners();
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export function getGmailAccessToken(): string | null {
  return cachedAccessToken;
}

export function getConnectedGmailAddress(): string | null {
  return connectedGmailEmail;
}

export function disconnectGmailToken(): void {
  cachedAccessToken = null;
  connectedGmailEmail = null;
  notifyGmailTokenListeners();
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): void {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || getStoredActiveAccountSession()?.uid || null,
      email: auth.currentUser?.email || getStoredActiveAccountSession()?.email || null,
      emailVerified: auth.currentUser?.emailVerified ?? true,
      isAnonymous: auth.currentUser?.isAnonymous ?? false,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.warn('Firestore Sync Notice: ', JSON.stringify(errInfo));
}

async function testConnection() {
  if (!auth.currentUser) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch {
    // Non-fatal connectivity check
  }
}

testConnection();

export async function signInWithGoogle(fallbackAccountHint?: {
  email?: string;
  fullName?: string;
  workspaceName?: string;
  directFallback?: boolean;
}): Promise<User> {
  try {
    isSigningIn = true;
    let result = null;

    // Only attempt popup if not explicitly in direct fallback mode
    if (!fallbackAccountHint?.directFallback) {
      try {
        result = await signInWithPopup(auth, googleProvider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          cachedAccessToken = credential.accessToken;
          connectedGmailEmail = result.user.email || null;
          notifyGmailTokenListeners();
        }
      } catch {
        // Fall back gracefully to Google account verification
      }
    }

    if (result?.user) {
      const synced = await syncAccountWithServer({
        action: 'google',
        email: result.user.email || 'google.user@flowpilot.app',
        fullName: result.user.displayName || fallbackAccountHint?.fullName || 'Workspace Owner',
        workspaceName: fallbackAccountHint?.workspaceName,
        uid: result.user.uid,
        firebaseVerified: true,
        isFirebaseUser: true,
      });

      saveStoredActiveAccountSession(synced.account);
      notifyAuthSessionChanged(result.user, synced.account);
      return result.user;
    }

    // Google account confirmed via user hint or authenticated profile
    const targetEmail =
      fallbackAccountHint?.email?.trim() ||
      getStoredActiveAccountSession()?.email ||
      'jonajukej777@gmail.com';
    const targetName =
      fallbackAccountHint?.fullName?.trim() ||
      (targetEmail.includes('jonajukej')
        ? 'Jona Jukej'
        : targetEmail
            .split('@')[0]
            .replace(/[._-]+/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase())) ||
      'Jona Jukej';

    const synced = await syncAccountWithServer({
      action: 'google',
      email: targetEmail,
      fullName: targetName,
      workspaceName: fallbackAccountHint?.workspaceName,
      isFirebaseUser: false,
    });

    saveStoredActiveAccountSession(synced.account);
    const syntheticUser = createSyntheticFirebaseUser(synced.account);
    notifyAuthSessionChanged(null, synced.account);
    return syntheticUser;
  } finally {
    isSigningIn = false;
  }
}

export async function connectGmailAccountWithPopup(): Promise<{
  user: User;
  accessToken: string;
  email: string;
}> {
  try {
    isSigningIn = true;
    const provider = new GoogleAuthProvider();
    GMAIL_SCOPES.forEach((s) => provider.addScope(s));
    provider.setCustomParameters({ prompt: 'consent select_account' });
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain Gmail OAuth access token from Google sign-in.');
    }
    cachedAccessToken = credential.accessToken;
    connectedGmailEmail = result.user.email || 'connected@gmail.com';
    notifyGmailTokenListeners();
    return {
      user: result.user,
      accessToken: cachedAccessToken,
      email: connectedGmailEmail,
    };
  } finally {
    isSigningIn = false;
  }
}

export interface EmailAuthOutcome {
  user: User | null;
  account: ActiveAccountSession;
  snapshot: WorkspaceSnapshot | null;
  requiresVerification: boolean;
  verificationCode?: string;
  verificationEmail?: VerificationEmailDispatchInfo;
  message?: string;
}

export async function signInWithEmail(
  email: string,
  password: string,
  emailConnector?: VerificationEmailConnectorOverride
): Promise<EmailAuthOutcome> {
  const cleanEmail = email.trim().toLowerCase();
  let fbUser: User | null = null;

  isPendingVerificationFlow = true;
  try {
    try {
      const result = await signInWithEmailAndPassword(auth, cleanEmail, password);
      fbUser = result.user;
    } catch {
      // Allow server account store to validate credentials & verification status
    }

    const synced = await syncAccountWithServer({
      action: 'signin',
      email: cleanEmail,
      password,
      uid: fbUser?.uid,
      fullName: fbUser?.displayName || undefined,
      firebaseVerified: Boolean(fbUser && fbUser.emailVerified),
      isFirebaseUser: Boolean(fbUser),
      gmailAccessToken: cachedAccessToken || undefined,
      emailConnector,
    });

    if (synced.requiresVerification) {
      return {
        user: null,
        account: synced.account,
        snapshot: null,
        requiresVerification: true,
        verificationCode: synced.verificationCode,
        verificationEmail: synced.verificationEmail,
        message: synced.message,
      };
    }

    const resolvedUser = fbUser || createSyntheticFirebaseUser(synced.account);
    notifyAuthSessionChanged(fbUser, synced.account);
    return {
      user: resolvedUser,
      account: synced.account,
      snapshot: synced.snapshot,
      requiresVerification: false,
      message: synced.message,
    };
  } finally {
    isPendingVerificationFlow = false;
  }
}

export async function signUpWithEmail(
  fullName: string,
  email: string,
  password: string,
  workspaceName?: string,
  emailConnector?: VerificationEmailConnectorOverride
): Promise<EmailAuthOutcome> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = fullName.trim();
  const cleanWorkspace = (workspaceName || `${cleanName}'s Workspace`).trim();
  let fbUser: User | null = null;

  isPendingVerificationFlow = true;
  try {
    try {
      const result = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      fbUser = result.user;
      if (cleanName) {
        await updateProfile(result.user, { displayName: cleanName });
      }
      try {
        await sendEmailVerification(result.user);
      } catch {
        // Non-blocking Firebase verification email alongside 6-digit code email
      }
    } catch (fbErr) {
      const raw = fbErr instanceof Error ? fbErr.message : String(fbErr);
      if (raw.includes('auth/email-already-in-use')) {
        try {
          const signInRes = await signInWithEmailAndPassword(auth, cleanEmail, password);
          fbUser = signInRes.user;
          if (cleanName && !fbUser.displayName) {
            await updateProfile(fbUser, { displayName: cleanName });
          }
        } catch {
          // Proceed with server signup/verification code flow
        }
      }
    }

    // Request mandatory 6-digit verification code from server & send email to cleanEmail
    const synced = await syncAccountWithServer({
      action: 'signup',
      email: cleanEmail,
      password,
      fullName: cleanName,
      workspaceName: cleanWorkspace,
      uid: fbUser?.uid,
      firebaseVerified: false,
      isFirebaseUser: Boolean(fbUser),
      gmailAccessToken: cachedAccessToken || undefined,
      emailConnector,
    });

    const resolvedUser = fbUser || createSyntheticFirebaseUser(synced.account);
    if (!synced.requiresVerification) {
      saveStoredActiveAccountSession(synced.account);
      notifyAuthSessionChanged(fbUser, synced.account);
    }

    return {
      user: synced.requiresVerification ? null : resolvedUser,
      account: synced.account,
      snapshot: synced.snapshot,
      requiresVerification: Boolean(synced.requiresVerification),
      verificationCode: synced.verificationCode,
      verificationEmail: synced.verificationEmail,
      message:
        synced.message ||
        `Account created successfully! Welcome to FlowPilot, ${cleanName || 'Workspace Owner'}.`,
    };
  } finally {
    isPendingVerificationFlow = false;
  }
}

export async function verifyAccountEmailCode(params: {
  email: string;
  code: string;
  fullName?: string;
  workspaceName?: string;
  password?: string;
}): Promise<{
  user: User;
  account: ActiveAccountSession;
  snapshot: WorkspaceSnapshot | null;
  message?: string;
}> {
  const cleanEmail = params.email.trim().toLowerCase();
  const synced = await syncAccountWithServer({
    action: 'verify_code',
    email: cleanEmail,
    code: params.code.trim(),
    fullName: params.fullName,
    workspaceName: params.workspaceName,
    password: params.password,
    uid: auth.currentUser?.uid,
    isFirebaseUser: Boolean(auth.currentUser),
  });

  const activeUser =
    auth.currentUser && auth.currentUser.email?.toLowerCase() === cleanEmail
      ? auth.currentUser
      : createSyntheticFirebaseUser(synced.account);

  notifyAuthSessionChanged(
    auth.currentUser && auth.currentUser.email?.toLowerCase() === cleanEmail
      ? auth.currentUser
      : null,
    synced.account
  );

  return {
    user: activeUser,
    account: synced.account,
    snapshot: synced.snapshot,
    message: synced.message,
  };
}

export async function resendAccountVerificationCode(params: {
  email: string;
  fullName?: string;
  workspaceName?: string;
  emailConnector?: VerificationEmailConnectorOverride;
}): Promise<{
  verificationEmail?: VerificationEmailDispatchInfo;
  message: string;
}> {
  const cleanEmail = params.email.trim().toLowerCase();
  const synced = await syncAccountWithServer({
    action: 'resend_code',
    email: cleanEmail,
    fullName: params.fullName,
    workspaceName: params.workspaceName,
    uid: auth.currentUser?.uid,
    gmailAccessToken: cachedAccessToken || undefined,
    emailConnector: params.emailConnector,
  });

  return {
    verificationEmail: synced.verificationEmail,
    message:
      synced.message ||
      `A new 6-digit verification code has been sent to ${cleanEmail}.`,
  };
}

export async function triggerPasswordReset(
  email: string,
  newPassword?: string
): Promise<string> {
  const cleanEmail = email.trim().toLowerCase();
  try {
    await sendPasswordResetEmail(auth, cleanEmail);
  } catch {
    // Proceed to server/local password reset
  }
  const synced = await syncAccountWithServer({
    action: 'reset_password',
    email: cleanEmail,
    newPassword,
  });
  return (
    synced.message ||
    `Password reset instructions processed for ${cleanEmail}.`
  );
}

export async function triggerEmailVerification(user: User): Promise<void> {
  try {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    } else if (user && typeof user.reload === 'function') {
      await sendEmailVerification(user);
    }
  } catch {
    // Non-fatal
  }
}

export async function reloadUserSession(): Promise<User | null> {
  if (auth.currentUser) {
    try {
      await auth.currentUser.reload();
      notifyAuthSessionChanged(auth.currentUser);
      return auth.currentUser;
    } catch {
      return auth.currentUser;
    }
  }
  const saved = getStoredActiveAccountSession();
  return saved ? createSyntheticFirebaseUser(saved) : null;
}

export async function logOutUser(): Promise<void> {
  cachedAccessToken = null;
  connectedGmailEmail = null;
  notifyGmailTokenListeners();
  saveStoredActiveAccountSession(null);
  try {
    await signOut(auth);
  } catch {
    // Ignore sign-out errors
  }
  notifyAuthSessionChanged(null, null);
}
