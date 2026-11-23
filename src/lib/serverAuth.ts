import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type express from 'express';
import { getAuth } from 'firebase-admin/auth';
import { getAdminApp } from './firebaseAdmin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../.data');
const SESSION_SECRET_PATH = path.join(DATA_DIR, '.session_secret');

export interface AuthenticatedServerUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  authSource: 'firebase_id_token' | 'flowpilot_session';
}

let cachedSecret: string | null = null;

function getSessionSigningSecret(): string {
  if (cachedSecret) return cachedSecret;
  const envSecret = (
    process.env.FLOWPILOT_SESSION_SECRET ||
    process.env.SESSION_SECRET ||
    ''
  ).trim();
  if (envSecret && envSecret !== 'change_this_to_a_long_random_secret') {
    cachedSecret = envSecret;
    return cachedSecret;
  }

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(SESSION_SECRET_PATH)) {
      const existing = fs.readFileSync(SESSION_SECRET_PATH, 'utf-8').trim();
      if (existing.length >= 32) {
        cachedSecret = existing;
        return cachedSecret;
      }
    }
    const generated = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(SESSION_SECRET_PATH, generated, { encoding: 'utf-8', mode: 0o600 });
    cachedSecret = generated;
    return cachedSecret;
  } catch {
    cachedSecret = crypto.randomBytes(48).toString('hex');
    return cachedSecret;
  }
}

function toBase64Url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf-8') : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4);
  return Buffer.from(padded, 'base64').toString('utf-8');
}

export function signFlowPilotSessionToken(params: {
  uid: string;
  email: string;
  ttlSeconds?: number;
}): string {
  const cleanUid = String(params.uid || '').trim();
  const cleanEmail = String(params.email || '').trim().toLowerCase();
  const nowSec = Math.floor(Date.now() / 1000);
  const exp = nowSec + (params.ttlSeconds || 60 * 60 * 24 * 7); // 7 days

  const payload = JSON.stringify({
    uid: cleanUid,
    email: cleanEmail,
    iat: nowSec,
    exp,
  });
  const encodedPayload = toBase64Url(payload);
  const sig = crypto
    .createHmac('sha256', getSessionSigningSecret())
    .update(encodedPayload)
    .digest();
  return `fp_sess.${encodedPayload}.${toBase64Url(sig)}`;
}

export function verifyFlowPilotSessionToken(token: string): AuthenticatedServerUser | null {
  try {
    const clean = String(token || '').trim();
    if (!clean.startsWith('fp_sess.')) return null;
    const parts = clean.split('.');
    if (parts.length !== 3) return null;

    const [, encodedPayload, encodedSig] = parts;
    if (!encodedPayload || !encodedSig) return null;

    const expectedSig = crypto
      .createHmac('sha256', getSessionSigningSecret())
      .update(encodedPayload)
      .digest();
    const expectedEncoded = toBase64Url(expectedSig);

    const a = Buffer.from(encodedSig, 'utf-8');
    const b = Buffer.from(expectedEncoded, 'utf-8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }

    const decoded = JSON.parse(fromBase64Url(encodedPayload));
    if (!decoded || typeof decoded.uid !== 'string' || !decoded.uid) return null;
    if (typeof decoded.exp !== 'number' || decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      uid: decoded.uid,
      email: typeof decoded.email === 'string' ? decoded.email : '',
      emailVerified: true,
      authSource: 'flowpilot_session',
    };
  } catch {
    return null;
  }
}

export function extractBearerToken(req: express.Request): string {
  const authHeader = String(req.headers.authorization || '').trim();
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  const sessionHeader = String(req.headers['x-flowpilot-session'] || '').trim();
  if (sessionHeader) return sessionHeader;
  return '';
}

export async function verifyAuthenticatedRequest(
  req: express.Request
): Promise<AuthenticatedServerUser | null> {
  const token = extractBearerToken(req);
  if (!token || token === 'fp_local_session_token') {
    return null;
  }

  if (token.startsWith('fp_sess.')) {
    return verifyFlowPilotSessionToken(token);
  }

  try {
    const decoded = await getAuth(getAdminApp()).verifyIdToken(token);
    if (decoded && decoded.uid) {
      return {
        uid: decoded.uid,
        email: String(decoded.email || '').toLowerCase(),
        emailVerified: Boolean(decoded.email_verified),
        authSource: 'firebase_id_token',
      };
    }
  } catch {
    // Token could be a third-party access token (e.g., Gmail OAuth) — check x-flowpilot-session header as secondary
    const fallbackHeader = String(req.headers['x-flowpilot-session'] || '').trim();
    if (fallbackHeader.startsWith('fp_sess.')) {
      return verifyFlowPilotSessionToken(fallbackHeader);
    }
    if (fallbackHeader && fallbackHeader !== 'fp_local_session_token') {
      try {
        const decodedFallback = await getAuth(getAdminApp()).verifyIdToken(fallbackHeader);
        if (decodedFallback && decodedFallback.uid) {
          return {
            uid: decodedFallback.uid,
            email: String(decodedFallback.email || '').toLowerCase(),
            emailVerified: Boolean(decodedFallback.email_verified),
            authSource: 'firebase_id_token',
          };
        }
      } catch {
        return null;
      }
    }
  }

  return null;
}
