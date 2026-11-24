import { doc, getDoc, serverTimestamp, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, db, getClientAuthHeaders } from '../firebase';
import {
  EmailDeliveryLog,
  EmailDomainRecord,
  EmailDomainStatusSummary,
  EmailSenderRecord,
} from '../utils/emailDomainValidation';

export const EMPTY_EMAIL_DOMAIN_STATUS: EmailDomainStatusSummary = {
  loaded: false,
  domain: '',
  domainId: '',
  status: 'not_started',
  verified: false,
  records: [],
  sender: null,
  senders: [],
  domainRecord: null,
  resendConfigured: true,
};

function sanitizeDocKey(uid: string): string {
  return String(uid || 'default').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 90);
}

async function syncDomainAndSenderToFirestore(params: {
  domainRecord: EmailDomainRecord | null;
  sender: EmailSenderRecord | null;
}): Promise<void> {
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.uid) return;
  const uid = fbUser.uid;
  const domainDocId = `dom_${sanitizeDocKey(uid)}`;
  const senderDocId = `snd_${sanitizeDocKey(uid)}`;

  try {
    if (params.domainRecord) {
      const ref = doc(db, 'email_domains', domainDocId);
      const existing = await getDoc(ref);
      const payload: Record<string, unknown> = {
        ownerId: uid,
        domain: params.domainRecord.domain.slice(0, 120),
        resendDomainId: params.domainRecord.resendDomainId.slice(0, 128),
        status: params.domainRecord.status,
        verified: Boolean(params.domainRecord.verified),
        recordsJson: JSON.stringify(params.domainRecord.records || []).slice(0, 15500),
        ...(params.domainRecord.region
          ? { region: params.domainRecord.region.slice(0, 32) }
          : {}),
        updatedAt: serverTimestamp(),
      };
      if (!existing.exists()) {
        payload.createdAt = serverTimestamp();
      } else {
        payload.createdAt = existing.data()?.createdAt || serverTimestamp();
      }
      await setDoc(ref, payload);
    }

    if (params.sender) {
      const sRef = doc(db, 'email_senders', senderDocId);
      const existingS = await getDoc(sRef);
      const sPayload: Record<string, unknown> = {
        ownerId: uid,
        domain: params.sender.domain.slice(0, 120),
        fromName: params.sender.fromName.slice(0, 100),
        fromEmail: params.sender.fromEmail.slice(0, 150),
        ...(params.sender.replyToEmail
          ? { replyToEmail: params.sender.replyToEmail.slice(0, 150) }
          : {}),
        isDefault: Boolean(params.sender.isDefault),
        updatedAt: serverTimestamp(),
      };
      if (!existingS.exists()) {
        sPayload.createdAt = serverTimestamp();
      } else {
        sPayload.createdAt = existingS.data()?.createdAt || serverTimestamp();
      }
      await setDoc(sRef, sPayload);
    }
  } catch (err) {
    console.warn('[CustomDomainEmailClient] Firestore sync notice:', err);
  }
}

async function deleteDomainAndSenderFromFirestore(): Promise<void> {
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.uid) return;
  const uid = fbUser.uid;
  try {
    await deleteDoc(doc(db, 'email_domains', `dom_${sanitizeDocKey(uid)}`)).catch(() => {});
    await deleteDoc(doc(db, 'email_senders', `snd_${sanitizeDocKey(uid)}`)).catch(() => {});
  } catch {
    // Non-fatal
  }
}

export async function fetchCustomDomainStatus(options?: {
  refresh?: boolean;
}): Promise<EmailDomainStatusSummary> {
  try {
    const authHeaders = await getClientAuthHeaders();
    const query = options?.refresh ? '?refresh=true' : '';
    const res = await fetch(`/api/email/domains/status${query}`, {
      headers: authHeaders,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      console.warn('[CustomDomainEmailClient] Status fetch non-ok or empty:', res.status, data);
      return { ...EMPTY_EMAIL_DOMAIN_STATUS, loaded: true };
    }

    const summary: EmailDomainStatusSummary = {
      loaded: true,
      domain: String(data.domain || ''),
      domainId: String(data.domainId || ''),
      status: data.status || 'not_started',
      verified: Boolean(data.verified),
      records: Array.isArray(data.records) ? data.records : [],
      sender: data.sender || null,
      senders: Array.isArray(data.senders) ? data.senders : [],
      domainRecord: data.domainRecord || null,
      resendConfigured: data.resendConfigured !== false,
    };

    if (summary.domainRecord || summary.sender) {
      void syncDomainAndSenderToFirestore({
        domainRecord: summary.domainRecord,
        sender: summary.sender,
      });
    }

    return summary;
  } catch (err) {
    console.error('[CustomDomainEmailClient] fetchCustomDomainStatus error:', err);
    return { ...EMPTY_EMAIL_DOMAIN_STATUS, loaded: true };
  }
}

export async function connectCustomDomain(params: {
  fromName: string;
  fromEmail: string;
  replyToEmail?: string;
  region?: string;
}): Promise<{ summary: EmailDomainStatusSummary; message: string }> {
  const authHeaders = await getClientAuthHeaders();
  const res = await fetch('/api/email/domains', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify(params),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || 'Failed to connect custom domain.');
  }

  const summary: EmailDomainStatusSummary = {
    loaded: true,
    domain: String(data.domain || ''),
    domainId: String(data.domainId || ''),
    status: data.status || 'not_started',
    verified: Boolean(data.verified),
    records: Array.isArray(data.records) ? data.records : [],
    sender: data.sender || null,
    senders: Array.isArray(data.senders) ? data.senders : [],
    domainRecord: data.domainRecord || null,
    resendConfigured: data.resendConfigured !== false,
  };

  await syncDomainAndSenderToFirestore({
    domainRecord: summary.domainRecord,
    sender: summary.sender,
  });

  return {
    summary,
    message: data.message || `Domain ${summary.domain} connected.`,
  };
}

export async function updateCustomEmailSender(params: {
  fromName: string;
  fromEmail: string;
  replyToEmail?: string;
}): Promise<{ sender: EmailSenderRecord; senders: EmailSenderRecord[]; message: string }> {
  const authHeaders = await getClientAuthHeaders();
  const res = await fetch('/api/email/sender', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify(params),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || 'Failed to update sender identity.');
  }

  if (data.sender) {
    await syncDomainAndSenderToFirestore({
      domainRecord: null,
      sender: data.sender,
    });
  }

  return {
    sender: data.sender,
    senders: Array.isArray(data.senders) ? data.senders : [],
    message: data.message || 'Sender identity saved.',
  };
}

export async function verifyCustomDomainDns(): Promise<{
  verified: boolean;
  status: EmailDomainStatusSummary['status'];
  domain: string;
  records: EmailDomainStatusSummary['records'];
  domainRecord: EmailDomainRecord | null;
  message: string;
}> {
  const authHeaders = await getClientAuthHeaders();
  const res = await fetch('/api/email/domains/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify({}),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || 'Failed to verify DNS records.');
  }

  if (data.domainRecord) {
    await syncDomainAndSenderToFirestore({
      domainRecord: data.domainRecord,
      sender: null,
    });
  }

  return {
    verified: Boolean(data.verified),
    status: data.status || 'pending',
    domain: String(data.domain || ''),
    records: Array.isArray(data.records) ? data.records : [],
    domainRecord: data.domainRecord || null,
    message: data.message || 'Verification status refreshed.',
  };
}

export async function removeCustomDomain(): Promise<{ removedDomain: string | null; message: string }> {
  const authHeaders = await getClientAuthHeaders();
  const res = await fetch('/api/email/domains', {
    method: 'DELETE',
    headers: authHeaders,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || 'Failed to remove custom domain.');
  }

  await deleteDomainAndSenderFromFirestore();

  return {
    removedDomain: data.removedDomain || null,
    message: data.message || 'Custom domain removed.',
  };
}

export async function fetchCustomDomainDeliveryLogs(): Promise<EmailDeliveryLog[]> {
  const authHeaders = await getClientAuthHeaders();
  if (!authHeaders.Authorization && !authHeaders['x-flowpilot-session']) {
    return [];
  }
  const res = await fetch('/api/email/logs', { headers: authHeaders });
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  return Array.isArray(data?.logs) ? data.logs : [];
}

export async function sendCustomDomainTestEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}): Promise<{ id?: string; from: string; to: string[]; message: string }> {
  const authHeaders = await getClientAuthHeaders();
  const res = await fetch('/api/email/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify(params),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || 'Failed to send test email.');
  }

  return {
    id: data.id,
    from: data.from,
    to: Array.isArray(data.to) ? data.to : [params.to],
    message: data.message || `Test email sent from ${data.from}.`,
  };
}
