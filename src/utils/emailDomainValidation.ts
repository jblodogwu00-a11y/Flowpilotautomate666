export const FREE_EMAIL_PROVIDERS = new Set<string>([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'yahoo.fr',
  'yahoo.ca',
  'yahoo.in',
  'yahoo.com.au',
  'ymail.com',
  'rocketmail.com',
  'outlook.com',
  'hotmail.com',
  'hotmail.co.uk',
  'hotmail.fr',
  'live.com',
  'live.co.uk',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'aim.com',
  'proton.me',
  'protonmail.com',
  'protonmail.ch',
  'pm.me',
  'zoho.com',
  'zohomail.com',
  'gmx.com',
  'gmx.net',
  'gmx.de',
  'mail.com',
  'yandex.com',
  'yandex.ru',
  'tutanota.com',
  'tutanota.de',
  'tuta.io',
  'fastmail.com',
  'fastmail.fm',
  'hey.com',
  'inbox.com',
  'mail.ru',
  'rambler.ru',
  'qq.com',
  '163.com',
  '126.com',
  'rediffmail.com',
]);

export const RESERVED_DOMAINS = new Set<string>([
  'localhost',
  'localhost.localdomain',
  'example.com',
  'example.org',
  'example.net',
  'resend.dev',
  'flowpilot.app',
  'send.flowpilot.app',
]);

export type DomainVerificationStatus =
  | 'not_started'
  | 'pending'
  | 'verified'
  | 'failed'
  | 'temporary_failure';

export interface EmailDnsRecord {
  id?: string;
  record: string;
  name: string;
  type: string;
  ttl?: string | number;
  status?: string;
  value: string;
  priority?: number;
}

export interface EmailDomainRecord {
  id: string;
  ownerId: string;
  domain: string;
  resendDomainId: string;
  status: DomainVerificationStatus;
  verified: boolean;
  region?: string;
  records: EmailDnsRecord[];
  capabilities?: {
    sending?: string;
    receiving?: string;
  };
  lastWebhookEvent?: string;
  lastVerifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailSenderRecord {
  id: string;
  ownerId: string;
  domain: string;
  fromName: string;
  fromEmail: string;
  replyToEmail?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmailDeliveryLog {
  id: string;
  ownerId?: string;
  resendEmailId?: string;
  eventType: string;
  from?: string;
  to?: string;
  subject?: string;
  domain?: string;
  detail?: string;
  createdAt: string;
}

export interface EmailDomainStatusSummary {
  loaded: boolean;
  domain: string;
  domainId: string;
  status: DomainVerificationStatus;
  verified: boolean;
  records: EmailDnsRecord[];
  sender: EmailSenderRecord | null;
  senders: EmailSenderRecord[];
  domainRecord: EmailDomainRecord | null;
  resendConfigured: boolean;
}

export function normalizeCustomDomain(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/\.+$/, '')
    .replace(/^www\./, '');
}

export function extractDomainFromEmail(rawEmail: string): string {
  const clean = String(rawEmail || '').trim().toLowerCase();
  const atIdx = clean.lastIndexOf('@');
  if (atIdx < 1) return '';
  return normalizeCustomDomain(clean.slice(atIdx + 1));
}

export function validateCustomDomainEmailInput(params: {
  fromName: string;
  fromEmail: string;
}): {
  valid: boolean;
  error?: string;
  cleanName: string;
  cleanEmail: string;
  domain: string;
} {
  const cleanName = String(params.fromName || '')
    .replace(/[\r\n<>"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const cleanEmail = String(params.fromEmail || '').trim().toLowerCase();

  if (!cleanName || cleanName.length < 2) {
    return {
      valid: false,
      error: 'Please enter a sender name (at least 2 characters, e.g. Musa Store).',
      cleanName,
      cleanEmail,
      domain: extractDomainFromEmail(cleanEmail),
    };
  }

  if (cleanName.length > 100) {
    return {
      valid: false,
      error: 'Sender name must be 100 characters or fewer.',
      cleanName,
      cleanEmail,
      domain: extractDomainFromEmail(cleanEmail),
    };
  }

  if (!cleanEmail || cleanEmail.length > 150 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(cleanEmail)) {
    return {
      valid: false,
      error: 'Please enter a valid custom domain email address (e.g. hello@musa.com).',
      cleanName,
      cleanEmail,
      domain: extractDomainFromEmail(cleanEmail),
    };
  }

  const [localPart, rawDomain] = cleanEmail.split('@');
  const domain = normalizeCustomDomain(rawDomain || '');

  if (!localPart || localPart.length > 64 || !domain || !domain.includes('.')) {
    return {
      valid: false,
      error: 'Email address must include a valid domain name (e.g. hello@musa.com).',
      cleanName,
      cleanEmail,
      domain,
    };
  }

  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(domain)) {
    return {
      valid: false,
      error: `Invalid domain format "${domain}".`,
      cleanName,
      cleanEmail,
      domain,
    };
  }

  if (FREE_EMAIL_PROVIDERS.has(domain)) {
    return {
      valid: false,
      error: `Free email providers like "${domain}" are not supported. Please use an email address on your own custom domain (e.g. hello@yourbrand.com).`,
      cleanName,
      cleanEmail,
      domain,
    };
  }

  if (RESERVED_DOMAINS.has(domain)) {
    return {
      valid: false,
      error: `Domain "${domain}" is reserved and cannot be registered.`,
      cleanName,
      cleanEmail,
      domain,
    };
  }

  return {
    valid: true,
    cleanName,
    cleanEmail,
    domain,
  };
}
