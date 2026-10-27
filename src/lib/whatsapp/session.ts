import {
  proto,
  initAuthCreds,
  BufferJSON,
  AuthenticationCreds,
  AuthenticationState,
  SignalDataTypeMap,
} from '@whiskeysockets/baileys';
import { getFirestoreDoc, setFirestoreDoc } from '../firebaseAdmin.js';

export interface FirestoreSessionDoc {
  userId: string;
  credsJson: string;
  keysJson?: string;
  connected?: boolean;
  number?: string;
  updatedAt: string;
}

/**
 * Function getAuthState(userId): read doc from whatsapp_sessions/{userId} from Firestore, return creds
 */
export async function getAuthState(userId: string = 'default_workspace'): Promise<AuthenticationCreds> {
  const cleanUser = String(userId || 'default_workspace').trim();
  try {
    const docData = await getFirestoreDoc('whatsapp_sessions', cleanUser);
    if (docData && typeof docData.credsJson === 'string' && docData.credsJson.trim()) {
      const creds = JSON.parse(docData.credsJson, BufferJSON.reviver);
      return creds as AuthenticationCreds;
    }
  } catch (err: any) {
    console.warn(`[Baileys Session] Error reading auth state for ${cleanUser}:`, err.message);
  }
  return initAuthCreds();
}

/**
 * Function saveAuthState(userId, creds): save creds to Firestore doc whatsapp_sessions/{userId}
 */
export async function saveAuthState(
  userId: string = 'default_workspace',
  creds: AuthenticationCreds,
  keysData?: Record<string, any>,
  extra?: { connected?: boolean; number?: string }
): Promise<void> {
  const cleanUser = String(userId || 'default_workspace').trim();
  const credsJson = JSON.stringify(creds, BufferJSON.replacer);
  const keysJson = keysData ? JSON.stringify(keysData, BufferJSON.replacer) : undefined;

  const payload: Record<string, any> = {
    userId: cleanUser,
    credsJson,
    updatedAt: new Date().toISOString(),
  };

  if (keysJson !== undefined) {
    payload.keysJson = keysJson;
  }
  if (extra?.connected !== undefined) {
    payload.connected = Boolean(extra.connected);
  }
  if (extra?.number !== undefined) {
    payload.number = String(extra.number);
  }

  await setFirestoreDoc('whatsapp_sessions', cleanUser, payload, true);
}

/**
 * Creates Firebase Admin Firestore custom auth state.
 * Replaces useMultiFileAuthState('./auth') so credentials survive on Vercel serverless.
 */
export async function useFirestoreAuthState(userId: string = 'default_workspace'): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> {
  const cleanUser = String(userId || 'default_workspace').trim();
  const creds: AuthenticationCreds = await getAuthState(cleanUser);

  // Load existing keys from Firestore
  let keysStore: Record<string, any> = {};
  try {
    const docData = await getFirestoreDoc('whatsapp_sessions', cleanUser);
    if (docData && typeof docData.keysJson === 'string') {
      keysStore = JSON.parse(docData.keysJson, BufferJSON.reviver) || {};
    }
  } catch {
    keysStore = {};
  }

  let saveTimeout: NodeJS.Timeout | null = null;
  const scheduleSaveKeys = () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      try {
        const keysJson = JSON.stringify(keysStore, BufferJSON.replacer);
        await setFirestoreDoc(
          'whatsapp_sessions',
          cleanUser,
          {
            userId: cleanUser,
            keysJson,
            updatedAt: new Date().toISOString(),
          },
          true
        );
      } catch (err: any) {
        console.warn(`[Baileys Session] Error updating keys to Firestore:`, err.message);
      }
    }, 500);
  };

  return {
    state: {
      creds,
      keys: {
        get: (type, ids) => {
          const data: { [key: string]: any } = {};
          for (const id of ids) {
            const val = keysStore[`${type}-${id}`];
            if (val) {
              data[id] =
                type === 'app-state-sync-key'
                  ? proto.Message.AppStateSyncKeyData.fromObject(val)
                  : val;
            }
          }
          return data;
        },
        set: (data) => {
          for (const category in data) {
            for (const id in data[category as keyof SignalDataTypeMap]) {
              const value = data[category as keyof SignalDataTypeMap]![id];
              const key = `${category}-${id}`;
              if (value) {
                keysStore[key] = value;
              } else {
                delete keysStore[key];
              }
            }
          }
          scheduleSaveKeys();
        },
      },
    },
    saveCreds: async () => {
      await saveAuthState(cleanUser, creds, keysStore);
    },
  };
}

/**
 * Helper to check connection status of a user in Firestore
 */
export async function getSessionConnectionStatus(userId: string = 'default_workspace'): Promise<{
  connected: boolean;
  number?: string;
  updatedAt?: string;
}> {
  const cleanUser = String(userId || 'default_workspace').trim();
  const docData = await getFirestoreDoc('whatsapp_sessions', cleanUser);
  if (!docData) {
    return { connected: false };
  }
  return {
    connected: Boolean(docData.connected),
    number: docData.number || '',
    updatedAt: docData.updatedAt || '',
  };
}
