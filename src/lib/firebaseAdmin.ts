import { initializeApp, getApps, cert, applicationDefault, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { db as clientDb } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const targetDatabaseId =
  (firebaseConfig as any).firestoreDatabaseId || 'ai-studio-53b8d6de-81d3-4f2a-9ea0-7359072dfac0';

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
 * Returns Firestore instance. Uses firebase-admin if configured,
 * or provides unified helper methods to read/write Firestore docs.
 */
export function getAdminFirestore(): Firestore {
  const app = getAdminApp();
  try {
    if (targetDatabaseId && targetDatabaseId !== '(default)') {
      return getFirestore(app, targetDatabaseId);
    }
    return getFirestore(app);
  } catch (err) {
    return getFirestore(app);
  }
}

/**
 * Universal Firestore document reader for whatsapp_sessions and whatsapp_qr.
 * Works with firebase-admin and gracefully falls back to client SDK.
 */
export async function getFirestoreDoc(collectionName: string, docId: string): Promise<Record<string, any> | null> {
  const cleanId = String(docId).trim();
  // Attempt 1: Firebase Admin Firestore
  try {
    const firestore = getAdminFirestore();
    const snap = await firestore.collection(collectionName).doc(cleanId).get();
    if (snap.exists) {
      return (snap.data() as Record<string, any>) || null;
    }
    return null;
  } catch (adminErr: any) {
    // If admin has permission/ADC error, fallback to client Firestore
    try {
      const docRef = doc(clientDb, collectionName, cleanId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return (snap.data() as Record<string, any>) || null;
      }
      return null;
    } catch (clientErr: any) {
      console.warn(`[Firestore ${collectionName}] Read fallback error:`, clientErr.message);
      return null;
    }
  }
}

/**
 * Universal Firestore document writer for whatsapp_sessions and whatsapp_qr.
 * Works with firebase-admin and gracefully falls back to client SDK.
 */
export async function setFirestoreDoc(
  collectionName: string,
  docId: string,
  data: Record<string, any>,
  merge: boolean = true
): Promise<void> {
  const cleanId = String(docId).trim();
  // Attempt 1: Firebase Admin Firestore
  try {
    const firestore = getAdminFirestore();
    await firestore.collection(collectionName).doc(cleanId).set(data, { merge });
    return;
  } catch (adminErr: any) {
    // Fallback: client Firestore SDK
    try {
      const docRef = doc(clientDb, collectionName, cleanId);
      await setDoc(docRef, data, { merge });
      return;
    } catch (clientErr: any) {
      console.error(`[Firestore ${collectionName}] Write fallback error:`, clientErr.message);
      throw clientErr;
    }
  }
}
