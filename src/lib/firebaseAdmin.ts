import { initializeApp, getApps, cert, applicationDefault, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { db as clientDb } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const targetDatabaseId =
  (firebaseConfig as any).firestoreDatabaseId || 'ai-studio-53b8d6de-81d3-4f2a-9ea0-7359072dfac0';

// In-memory cache for session documents to ensure smooth operation across serverless invocations
const localDocsCache = new Map<string, Map<string, Record<string, any>>>();

export function getCachedLocalDoc(collectionName: string, docId: string): Record<string, any> | null {
  const col = localDocsCache.get(collectionName);
  return col?.get(docId) || null;
}

export function setCachedLocalDoc(collectionName: string, docId: string, data: Record<string, any>): void {
  let col = localDocsCache.get(collectionName);
  if (!col) {
    col = new Map();
    localDocsCache.set(collectionName, col);
  }
  const existing = col.get(docId) || {};
  col.set(docId, { ...existing, ...data });
}

/**
 * Checks whether FIREBASE_SERVICE_ACCOUNT credentials are provided in the environment.
 */
export function hasFirebaseServiceAccount(): boolean {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT && process.env.FIREBASE_SERVICE_ACCOUNT.trim().length > 10);
}

/**
 * Initializes and returns the Firebase Admin App instance.
 * Reads FIREBASE_SERVICE_ACCOUNT env var if provided (JSON string or Base64 encoded).
 */
export function getAdminApp(): App {
  const apps = getApps();
  if (apps.length > 0 && apps[0]) {
    return apps[0];
  }

  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  let credential;

  if (serviceAccountEnv) {
    try {
      const raw = serviceAccountEnv.trim();
      const parsed = raw.startsWith('{')
        ? JSON.parse(raw)
        : JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
      credential = cert(parsed);
      console.log('[Firebase Admin] Initialized with FIREBASE_SERVICE_ACCOUNT credentials');
    } catch (err: any) {
      console.warn('[Firebase Admin] Warning parsing FIREBASE_SERVICE_ACCOUNT:', err.message);
      credential = applicationDefault();
    }
  } else {
    try {
      credential = applicationDefault();
    } catch {
      credential = undefined;
    }
  }

  const app = initializeApp({
    ...(credential ? { credential } : {}),
    projectId: (firebaseConfig as any).projectId,
  });
  return app;
}

/**
 * Returns Firestore Admin instance.
 */
export function getAdminFirestore(): Firestore {
  const app = getAdminApp();
  try {
    if (targetDatabaseId && targetDatabaseId !== '(default)') {
      return getFirestore(app, targetDatabaseId);
    }
    return getFirestore(app);
  } catch {
    return getFirestore(app);
  }
}

/**
 * Universal Firestore document reader for whatsapp_sessions and whatsapp_qr.
 * Prioritizes Firebase Admin when service account is available, and Client SDK when running client/dev.
 */
export async function getFirestoreDoc(collectionName: string, docId: string): Promise<Record<string, any> | null> {
  const cleanId = String(docId).trim();

  // Mode 1: If FIREBASE_SERVICE_ACCOUNT is available, use Firebase Admin Firestore
  if (hasFirebaseServiceAccount()) {
    try {
      const firestore = getAdminFirestore();
      const snap = await firestore.collection(collectionName).doc(cleanId).get();
      if (snap.exists) {
        const data = (snap.data() as Record<string, any>) || null;
        if (data) setCachedLocalDoc(collectionName, cleanId, data);
        return data;
      }
      return null;
    } catch (adminErr: any) {
      console.warn(`[Firebase Admin ${collectionName}] Read fallback:`, adminErr.message);
    }
  }

  // Mode 2: Client Firestore SDK
  try {
    const docRef = doc(clientDb, collectionName, cleanId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = (snap.data() as Record<string, any>) || null;
      if (data) setCachedLocalDoc(collectionName, cleanId, data);
      return data;
    }
    return null;
  } catch (clientErr: any) {
    // Mode 3: In-memory cache fallback
    const cached = getCachedLocalDoc(collectionName, cleanId);
    if (cached) return cached;
    return null;
  }
}

/**
 * Universal Firestore document writer for whatsapp_sessions and whatsapp_qr.
 * Prioritizes Firebase Admin when service account is available, and Client SDK when running client/dev.
 */
export async function setFirestoreDoc(
  collectionName: string,
  docId: string,
  data: Record<string, any>,
  merge: boolean = true
): Promise<void> {
  const cleanId = String(docId).trim();
  // Always update in-memory cache for instant responsiveness
  setCachedLocalDoc(collectionName, cleanId, data);

  // Mode 1: Firebase Admin if service account is provided
  if (hasFirebaseServiceAccount()) {
    try {
      const firestore = getAdminFirestore();
      await firestore.collection(collectionName).doc(cleanId).set(data, { merge });
      return;
    } catch (adminErr: any) {
      console.warn(`[Firebase Admin ${collectionName}] Write fallback:`, adminErr.message);
    }
  }

  // Mode 2: Client Firestore SDK
  try {
    const docRef = doc(clientDb, collectionName, cleanId);
    await setDoc(docRef, data, { merge });
  } catch (clientErr: any) {
    console.warn(`[Firestore ${collectionName}] Write notice: cached locally (${clientErr.message})`);
  }
}
