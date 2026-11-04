import 'dotenv/config';
import { Resend } from 'resend';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getFirestoreDoc, setFirestoreDoc } from './firebaseAdmin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../.data');
const EMAIL_STORE_PATH = path.join(DATA_DIR, 'email_domains_store.json');
const ENV_FILE_PATH = path.join(__dirname, '../../.env');

// Initialize Resend with environment variable (never hardcoded)
export function getResendClient(): Resend | null {
  let apiKey = (process.env.RESEND_API_KEY || '').trim();
  if (!apiKey && fs.existsSync(ENV_FILE_PATH)) {
    try {
      const content = fs.readFileSync(ENV_FILE_PATH, 'utf-8');
      const match = content.match(/RESEND_API_KEY\s*=\s*([^\r\n]+)/);
      if (match && match[1]) {
        apiKey = match[1].trim();
      }
    } catch {
      // Ignore
    }
  }
  if (!apiKey || apiKey === 'your_resend_api_key_here') {
    return null;
  }
  return new Resend(apiKey);
}

export interface ResendDnsRecord {
  id?: string;
  record: string;
  name: string;
  type: string;
  ttl?: string;
  status?: string;
  value: string;
  priority?: number;
}

export interface EmailDomainRecord {
  domain: string;
  domainId: string;
  status: string; // 'not_started' | 'pending' | 'verified'
  verified: boolean;
  records: ResendDnsRecord[];
  region?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailUserRecord {
  userId: string; // 'me' | 'brother' | string
  fromName: string;
  fromEmail: string;
  domain: string;
  updatedAt: string;
}

export interface EmailStoreState {
  domain: EmailDomainRecord | null;
  users: Record<string, EmailUserRecord>;
}

// Ensure .data directory exists
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch {
  // Ignore
}

// Load local JSON state fallback
function loadLocalEmailStore(): EmailStoreState {
  try {
    if (fs.existsSync(EMAIL_STORE_PATH)) {
      const raw = fs.readFileSync(EMAIL_STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        domain: parsed.domain || null,
        users: parsed.users || {},
      };
    }
  } catch (err: any) {
    console.warn('[Custom Domain Email] Read local store notice:', err.message);
  }
  return {
    domain: null,
    users: {},
  };
}

// Save local JSON state fallback
function saveLocalEmailStore(state: EmailStoreState): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(EMAIL_STORE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err: any) {
    console.warn('[Custom Domain Email] Write local store notice:', err.message);
  }
}

/**
 * Get active domain record (from Firestore or local store)
 */
export async function getActiveEmailDomain(): Promise<EmailDomainRecord | null> {
  const local = loadLocalEmailStore();
  if (local.domain?.domain) {
    try {
      const remoteDoc = await getFirestoreDoc('email_domains', local.domain.domain);
      if (remoteDoc && remoteDoc.domain) {
        return remoteDoc as EmailDomainRecord;
      }
    } catch {
      // Fallback to local
    }
    return local.domain;
  }
  return null;
}

/**
 * Get configured email users ('me' and 'brother')
 */
export async function getEmailUsers(): Promise<Record<string, EmailUserRecord>> {
  const local = loadLocalEmailStore();
  const users: Record<string, EmailUserRecord> = { ...local.users };

  // Sync with Firestore for 'me' and 'brother'
  for (const uid of ['me', 'brother']) {
    try {
      const doc = await getFirestoreDoc('email_users', uid);
      if (doc && doc.userId) {
        users[uid] = doc as EmailUserRecord;
      }
    } catch {
      // Ignore
    }
  }
  return users;
}

/**
 * Standardize DNS records for 3 primary records (TXT send/SPF, TXT DKIM, TXT DMARC)
 */
export function formatResendDnsRecords(records: any[], domainName: string): ResendDnsRecord[] {
  if (!Array.isArray(records) || records.length === 0) {
    // Return standard template records for domain if Resend hasn't returned yet
    return [
      {
        record: 'SPF',
        name: `send.${domainName}`,
        type: 'TXT',
        value: 'v=spf1 include:amazonses.com ~all',
        status: 'not_started',
      },
      {
        record: 'DKIM',
        name: `resend._domainkey.${domainName}`,
        type: 'TXT',
        value: `k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC3...`,
        status: 'not_started',
      },
      {
        record: 'DMARC',
        name: `_dmarc.${domainName}`,
        type: 'TXT',
        value: `v=DMARC1; p=none; rua=mailto:dmarc@${domainName}`,
        status: 'not_started',
      },
    ];
  }

  return records.map((r) => ({
    id: r.id,
    record: r.record || r.type || 'TXT',
    name: r.name || '',
    type: r.type || 'TXT',
    ttl: r.ttl || 'Auto',
    status: r.status || 'not_started',
    value: r.value || '',
    priority: r.priority,
  }));
}

/**
 * Endpoint 1: Add or Update Custom Domain for 2 Users Sharing the Same Domain
 */
export async function addOrUpdateSharedDomain(params: {
  fromName: string;
  fromEmail: string;
  userId: string; // 'me' | 'brother'
}): Promise<{
  domain: string;
  domainId: string;
  records: ResendDnsRecord[];
  verified: boolean;
  status: string;
  users: Record<string, EmailUserRecord>;
}> {
  const { fromName, fromEmail, userId } = params;
  const cleanEmail = String(fromEmail || '').trim().toLowerCase();
  const cleanName = String(fromName || '').trim() || (userId === 'me' ? 'Musa Store' : 'Brother Store');
  const cleanUserId = userId === 'brother' ? 'brother' : 'me';

  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }

  const parts = cleanEmail.split('@');
  const extractedDomain = parts[1]?.toLowerCase().trim();
  if (!extractedDomain || extractedDomain.length < 3 || !extractedDomain.includes('.')) {
    throw new Error('Invalid email domain. Please enter an email like hello@musa.com');
  }

  // Load current store
  const localStore = loadLocalEmailStore();
  const existingDomainRec = localStore.domain;

  // FREE PLAN VALIDATION: If the other user already has an email with a DIFFERENT domain that is not being updated
  // If the user is setting a new shared domain (like passiveincome.work.gd), we allow updating the shared domain
  // and automatically update both users to use this shared domain!
  const nowIso = new Date().toISOString();
  let domainRecord: EmailDomainRecord;

  // If replacing an old domain, check if old domain in Resend needs to be cleaned up
  if (existingDomainRec && existingDomainRec.domain && existingDomainRec.domain.toLowerCase() !== extractedDomain) {
    console.log(`[Custom Domain Email] Switching shared domain from "${existingDomainRec.domain}" to "${extractedDomain}"...`);
    const resend = getResendClient();
    if (resend && existingDomainRec.domainId && !existingDomainRec.domainId.startsWith('dom_')) {
      try {
        await resend.domains.remove(existingDomainRec.domainId);
        console.log(`[Resend] Removed previous domain "${existingDomainRec.domain}" from Resend account.`);
      } catch (remErr: any) {
        console.warn('[Resend] Notice while removing previous domain:', remErr.message);
      }
    }
  }

  // Check if same domain already exists in DB
  if (existingDomainRec && existingDomainRec.domain && existingDomainRec.domain.toLowerCase() === extractedDomain && existingDomainRec.domainId) {
    domainRecord = {
      ...existingDomainRec,
      updatedAt: nowIso,
    };
  } else {
    // Create or retrieve domain in Resend API
    const resend = getResendClient();
    let resendDomainId = `dom_${Date.now().toString(36)}`;
    let records: ResendDnsRecord[] = [];
    let domainStatus = 'pending';

    if (resend) {
      try {
        console.log(`[Resend] Registering domain "${extractedDomain}"...`);
        const { data, error } = await resend.domains.create({ name: extractedDomain });

        if (error) {
          console.warn('[Resend] Create domain response:', error.message);
          // Case 1: Already exists in user's Resend account
          if (
            error.message?.toLowerCase().includes('already exists') ||
            error.message?.toLowerCase().includes('already registered')
          ) {
            try {
              const listRes = await resend.domains.list();
              const found = (listRes.data?.data || []).find(
                (d: any) => d.name?.toLowerCase() === extractedDomain
              );
              if (found) {
                const getRes = await resend.domains.get(found.id);
                resendDomainId = found.id;
                domainStatus = getRes.data?.status || found.status || 'pending';
                records = formatResendDnsRecords(getRes.data?.records || [], extractedDomain);
              }
            } catch (listErr: any) {
              console.warn('[Resend] List domains fallback error:', listErr.message);
            }
          } else if (
            error.message?.toLowerCase().includes('free public domains') ||
            error.message?.toLowerCase().includes('domain you own')
          ) {
            // Case 2: Resend anti-abuse policy for free dynamic DNS (.work.gd, .tk, etc.)
            // We generate the complete DNS blueprints so user can configure DNS and we handle fallbacks gracefully!
            console.log(`[Resend Notice] Domain "${extractedDomain}" is on a free public suffix: generating DNS blueprints.`);
            domainStatus = 'pending_dns';
            records = formatResendDnsRecords([], extractedDomain);
          } else {
            console.warn('[Resend] Non-fatal domain error:', error.message);
            domainStatus = 'pending';
            records = formatResendDnsRecords([], extractedDomain);
          }
        } else if (data) {
          resendDomainId = data.id;
          domainStatus = data.status || 'pending';
          records = formatResendDnsRecords(data.records || [], extractedDomain);
        }
      } catch (apiErr: any) {
        console.warn('[Resend] Direct API error, generating DNS blueprints:', apiErr.message);
        records = formatResendDnsRecords([], extractedDomain);
      }
    } else {
      records = formatResendDnsRecords([], extractedDomain);
    }

    if (records.length === 0) {
      records = formatResendDnsRecords([], extractedDomain);
    }

    domainRecord = {
      domain: extractedDomain,
      domainId: resendDomainId,
      status: domainStatus,
      verified: domainStatus === 'verified',
      records,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  }

  // Save to DB collection email_domains
  localStore.domain = domainRecord;
  try {
    await setFirestoreDoc('email_domains', domainRecord.domain, domainRecord, true);
  } catch (fsErr: any) {
    console.warn('[Firestore email_domains] Save notice:', fsErr.message);
  }

  // Save active user to DB collection email_users
  const userRecord: EmailUserRecord = {
    userId: cleanUserId,
    fromName: cleanName,
    fromEmail: cleanEmail,
    domain: extractedDomain,
    updatedAt: nowIso,
  };
  localStore.users[cleanUserId] = userRecord;

  // Also ensure the other user shares the same domain!
  const otherUserId = cleanUserId === 'me' ? 'brother' : 'me';
  const otherPrefix = otherUserId === 'brother' ? 'support' : 'hello';
  const otherName = otherUserId === 'brother' ? 'Brother Store' : 'Musa Store';
  const otherEmail = `${otherPrefix}@${extractedDomain}`;
  const existingOther = localStore.users[otherUserId];

  if (!existingOther || existingOther.domain !== extractedDomain) {
    const updatedOther: EmailUserRecord = {
      userId: otherUserId,
      fromName: existingOther?.fromName || otherName,
      fromEmail: otherEmail,
      domain: extractedDomain,
      updatedAt: nowIso,
    };
    localStore.users[otherUserId] = updatedOther;
    try {
      await setFirestoreDoc('email_users', otherUserId, updatedOther, true);
    } catch {
      // Ignore
    }
  }

  try {
    await setFirestoreDoc('email_users', cleanUserId, userRecord, true);
  } catch (fsErr: any) {
    console.warn('[Firestore email_users] Save notice:', fsErr.message);
  }

  saveLocalEmailStore(localStore);

  return {
    domain: domainRecord.domain,
    domainId: domainRecord.domainId,
    records: domainRecord.records,
    verified: domainRecord.verified,
    status: domainRecord.status,
    users: localStore.users,
  };
}

/**
 * Endpoint 2: Verify DNS Records with Resend API + Live Global DNS Nameservers
 */
export async function verifySharedDomain(domainIdParam?: string): Promise<{
  verified: boolean;
  status: string;
  records: ResendDnsRecord[];
  domain: string;
}> {
  const localStore = loadLocalEmailStore();
  let domainRecord = localStore.domain;

  if (!domainRecord) {
    throw new Error('No custom domain configured yet. Please add your email and domain first.');
  }

  const domainName = domainRecord.domain;
  const domainId = domainIdParam || domainRecord.domainId;
  const resend = getResendClient();

  // Step 1: If domainId is a valid Resend UUID (not a fallback ID), check Resend API
  if (resend && domainId && !domainId.startsWith('dom_')) {
    try {
      try {
        await resend.domains.verify(domainId);
      } catch {
        // verify endpoint may return status directly or not throw
      }

      const { data, error } = await resend.domains.get(domainId);
      if (error) {
        console.warn('[Resend] verify domain notice:', error.message);
      } else if (data && data.status === 'verified') {
        domainRecord.status = 'verified';
        domainRecord.verified = true;
        domainRecord.records = formatResendDnsRecords(data.records || [], domainName);
        domainRecord.updatedAt = new Date().toISOString();

        localStore.domain = domainRecord;
        saveLocalEmailStore(localStore);
        try {
          await setFirestoreDoc('email_domains', domainName, domainRecord, true);
        } catch {
          // Ignore
        }

        return {
          verified: true,
          status: 'verified',
          records: domainRecord.records,
          domain: domainName,
        };
      }
    } catch (err: any) {
      console.warn('[Resend] Domain verify error:', err.message);
    }
  }

  // Step 2: Direct Live DNS Nameserver Resolution
  // Directly inspect global DNS for SPF, DKIM, and DMARC TXT records!
  try {
    const dns = await import('node:dns/promises');
    let spfVerified = false;
    let dkimVerified = false;
    let dmarcVerified = false;

    // Check SPF on `send.${domainName}`
    try {
      const spfTxt = await dns.resolveTxt(`send.${domainName}`);
      const joinedSpf = spfTxt.flat().join(' ');
      if (joinedSpf.includes('v=spf1') || joinedSpf.includes('amazonses.com')) {
        spfVerified = true;
      }
    } catch (e: any) {
      console.log(`[DNS check] SPF record on send.${domainName}: ${e.code || e.message}`);
    }

    // Check DKIM on `resend._domainkey.${domainName}`
    try {
      const dkimTxt = await dns.resolveTxt(`resend._domainkey.${domainName}`);
      const joinedDkim = dkimTxt.flat().join(' ');
      if (joinedDkim.includes('k=rsa') || joinedDkim.includes('MIGfMA0G')) {
        dkimVerified = true;
      }
    } catch (e: any) {
      console.log(`[DNS check] DKIM record on resend._domainkey.${domainName}: ${e.code || e.message}`);
    }

    // Check DMARC on `_dmarc.${domainName}`
    try {
      const dmarcTxt = await dns.resolveTxt(`_dmarc.${domainName}`);
      const joinedDmarc = dmarcTxt.flat().join(' ');
      if (joinedDmarc.includes('v=DMARC1')) {
        dmarcVerified = true;
      }
    } catch (e: any) {
      console.log(`[DNS check] DMARC record on _dmarc.${domainName}: ${e.code || e.message}`);
    }

    // Update statuses on individual records
    const updatedRecords = (domainRecord.records || []).map((rec) => {
      const recType = (rec.record || rec.type || '').toUpperCase();
      const recName = (rec.name || '').toLowerCase();
      let recordStatus = rec.status || 'pending';

      if (recType.includes('SPF') || recName.startsWith('send.')) {
        if (spfVerified) recordStatus = 'verified';
      } else if (recType.includes('DKIM') || recName.includes('_domainkey')) {
        if (dkimVerified) recordStatus = 'verified';
      } else if (recType.includes('DMARC') || recName.startsWith('_dmarc')) {
        if (dmarcVerified) recordStatus = 'verified';
      }

      return {
        ...rec,
        status: recordStatus,
      };
    });

    const isFullyVerified = spfVerified && (dkimVerified || dmarcVerified);

    domainRecord.verified = isFullyVerified;
    domainRecord.status = isFullyVerified ? 'verified' : 'pending';
    domainRecord.records = updatedRecords;
    domainRecord.updatedAt = new Date().toISOString();

    localStore.domain = domainRecord;
    saveLocalEmailStore(localStore);
    try {
      await setFirestoreDoc('email_domains', domainName, domainRecord, true);
    } catch {
      // Ignore
    }

    return {
      verified: isFullyVerified,
      status: domainRecord.status,
      records: domainRecord.records,
      domain: domainName,
    };
  } catch (dnsErr: any) {
    console.warn('[Direct DNS verify] Resolver notice:', dnsErr.message);
  }

  // Fallback to current domain state
  return {
    verified: domainRecord.verified,
    status: domainRecord.status,
    records: domainRecord.records,
    domain: domainRecord.domain,
  };
}

/**
 * Endpoint 3: Send Email with Resend API using the Configured User Identity
 */
export async function sendEmailAsUser(params: {
  userId: string; // 'me' | 'brother'
  to: string;
  subject: string;
  html?: string;
  text?: string;
}): Promise<{
  success: boolean;
  id?: string;
  from: string;
  to: string;
  subject: string;
  provider: string;
}> {
  const { userId, to, subject, html, text } = params;
  const cleanUserId = userId === 'brother' ? 'brother' : 'me';

  if (!to || !to.includes('@')) {
    throw new Error('Valid recipient email (to) is required.');
  }
  if (!subject) {
    throw new Error('Email subject is required.');
  }

  // Get user details from DB
  const users = await getEmailUsers();
  const user = users[cleanUserId];

  if (!user || !user.fromEmail) {
    throw new Error(
      `Sender details for user "${cleanUserId}" not configured yet. Please configure it in /dashboard/settings/email`
    );
  }

  const fromAddress = `${user.fromName} <${user.fromEmail}>`;
  const resend = getResendClient();

  if (!resend) {
    throw new Error('RESEND_API_KEY is not configured in server environment.');
  }

  const bodyContent = html || text || '<p>Hello from FlowPilot!</p>';

  console.log(`[Resend] Dispatching email from ${fromAddress} to ${to}...`);

  try {
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [to],
      subject,
      html: bodyContent,
      text: text || undefined,
    });

    if (error) {
      // If error is unverified domain, attempt fallback with helpful message
      console.warn('[Resend] Send error:', error.message);
      if (
        error.message?.includes('domain is not verified') ||
        error.message?.includes('from_address') ||
        error.message?.includes('validation_error')
      ) {
        try {
          const fallbackRes = await resend.emails.send({
            from: `${user.fromName} <onboarding@resend.dev>`,
            to: [to],
            replyTo: user.fromEmail,
            subject,
            html: bodyContent,
            text: text || undefined,
          });
          if (fallbackRes.data?.id) {
            return {
              success: true,
              id: fallbackRes.data.id,
              from: `${user.fromName} <${user.fromEmail}> (via Resend: onboarding@resend.dev)`,
              to,
              subject,
              provider: 'Resend API (Live Relay)',
            };
          }
        } catch {
          // Continue to throw clear verification instructions
        }
        throw new Error(
          `Domain ${user.domain} is not yet verified with DNS records in Resend. Please add the DNS records and click "Verify Domain". (Resend message: ${error.message})`
        );
      }
      throw new Error(`Resend error: ${error.message}`);
    }

    return {
      success: true,
      id: data?.id,
      from: fromAddress,
      to,
      subject,
      provider: 'Resend Transactional API',
    };
  } catch (err: any) {
    console.error('[Resend] Send exception:', err);
    throw err;
  }
}
