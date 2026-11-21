import { ChannelType } from '../types';

export function formatWhatsAppPhoneFromJid(rawJidOrPhone?: string | null): string {
  const raw = String(rawJidOrPhone || '').trim();
  if (!raw) return '';
  // Strip "@s.whatsapp.net" / "@c.us" AND Baileys multi-device ":12" suffix
  const beforeAt = raw.split('@')[0];
  const beforeDevice = beforeAt.split(':')[0];
  const digits = beforeDevice.replace(/[^0-9]/g, '');
  if (digits.length < 6) return '';
  return `+${digits}`;
}

export function isHtmlRichContent(text: string): boolean {
  if (!text) return false;
  return /<\/?(p|div|span|strong|b|em|i|u|s|del|strike|h[1-6]|ul|ol|li|a|br|hr|img|blockquote|code|pre)\b[^>]*>/i.test(
    text
  );
}

function decodeBasicEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&rarr;/gi, '→')
    .replace(/&larr;/gi, '←')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function sanitizeRichHtmlForPreview(input: string): string {
  const raw = String(input || '');
  if (!raw.trim()) return '';
  const withoutDangerous = raw
    .replace(/<\s*(script|iframe|object|embed|style|meta|link)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|iframe|object|embed|meta|link)[^>]*\/?>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, 'blocked:');

  if (isHtmlRichContent(withoutDangerous)) {
    return withoutDangerous;
  }

  return renderWhatsAppFormattedHtml(withoutDangerous);
}

export function ensureHtmlForEditor(input: string): string {
  const raw = String(input || '').trim();
  if (!raw) {
    return '<p></p>';
  }
  if (isHtmlRichContent(raw)) {
    return sanitizeRichHtmlForPreview(raw);
  }

  // Convert plain text or WhatsApp markdown into clean TipTap paragraphs
  const lines = raw.split(/\r?\n/);
  const htmlLines: string[] = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inList) {
        htmlLines.push('</ul>');
        inList = false;
      }
      htmlLines.push('<p></p>');
      continue;
    }

    const formatted = escapeHtml(trimmed)
      .replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')
      .replace(/(^|\s)_([^_\n]+)_(?=\s|$|[.,!?])/g, '$1<em>$2</em>')
      .replace(/~([^~\n]+)~/g, '<s>$1</s>')
      .replace(/`([^`\n]+)`/g, '<code>$1</code>');

    if (/^[•\-]\s+/.test(trimmed)) {
      const itemBody = formatted.replace(/^[•\-]\s+/, '');
      if (!inList) {
        htmlLines.push('<ul>');
        inList = true;
      }
      htmlLines.push(`<li>${itemBody}</li>`);
    } else {
      if (inList) {
        htmlLines.push('</ul>');
        inList = false;
      }
      htmlLines.push(`<p>${formatted}</p>`);
    }
  }

  if (inList) {
    htmlLines.push('</ul>');
  }
  return htmlLines.join('');
}

export function htmlToWhatsAppText(input: string): string {
  const raw = String(input || '');
  if (!raw.trim()) return '';
  if (!isHtmlRichContent(raw)) {
    return raw.trim();
  }

  let out = raw;

  // Strip comments & MSO conditional blocks used by CTA buttons
  out = out.replace(/<!--[\s\S]*?-->/g, '');
  out = out.replace(/<\s*(script|style)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, '');

  // Headings -> Bold line
  out = out.replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_, inner) => {
    const clean = inner.replace(/<[^>]+>/g, '').trim();
    return clean ? `\n*${clean}*\n` : '\n';
  });

  // Links & CTA buttons -> label (url) or url
  out = out.replace(
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_, href: string, inner: string) => {
      const cleanLabel = decodeBasicEntities(inner.replace(/<[^>]+>/g, '')).trim();
      const cleanHref = href.trim();
      if (!cleanHref || cleanHref.startsWith('blocked:')) return cleanLabel;
      if (!cleanLabel || cleanLabel === cleanHref) return cleanHref;
      return `${cleanLabel} (${cleanHref})`;
    }
  );

  // Inline formatting -> WhatsApp native markers
  out = out.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, _t, inner) => {
    const clean = inner.replace(/\*/g, '').trim();
    return clean ? `*${clean}*` : '';
  });
  out = out.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, _t, inner) => {
    const clean = inner.trim();
    return clean ? `_${clean}_` : '';
  });
  out = out.replace(/<(del|s|strike)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, _t, inner) => {
    const clean = inner.trim();
    return clean ? `~${clean}~` : '';
  });
  out = out.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_, inner) => {
    const clean = inner.trim();
    return clean ? `\`${clean}\`` : '';
  });

  // Images -> readable caption
  out = out.replace(/<img\b[^>]*alt=["']([^"']*)["'][^>]*>/gi, (_, alt) =>
    alt ? `[Image: ${alt}]` : ''
  );

  // Lists
  out = out.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_, inner) => {
    const clean = inner.trim();
    return clean ? `\n• ${clean}` : '';
  });
  out = out.replace(/<\/?(ul|ol)\b[^>]*>/gi, '\n');

  // Dividers & line breaks & block endings
  out = out.replace(/<hr\b[^>]*\/?>/gi, '\n──────────\n');
  out = out.replace(/<br\b[^>]*\/?>/gi, '\n');
  out = out.replace(/<\/(p|div|blockquote|tr)>/gi, '\n\n');
  out = out.replace(/<(p|div|blockquote|tr)\b[^>]*>/gi, '');

  // Remove any remaining tags
  out = out.replace(/<[^>]+>/g, '');

  // Decode entities and normalize excessive blank lines
  out = decodeBasicEntities(out)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return out;
}

export function htmlToPlainText(input: string): string {
  const wa = htmlToWhatsAppText(input);
  // Strip standalone formatting symbols if clean SMS text is needed
  return wa
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/(^|\s)_([^_\n]+)_(?=\s|$|[.,!?])/g, '$1$2')
    .replace(/~([^~\n]+)~/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
    .trim();
}

export function formatRichMessageForChannel(
  htmlOrText: string,
  channel: ChannelType
): string {
  const raw = String(htmlOrText || '');
  if (channel === 'email') {
    return isHtmlRichContent(raw)
      ? sanitizeRichHtmlForPreview(raw)
      : renderWhatsAppFormattedHtml(raw);
  }
  if (channel === 'whatsapp') {
    return htmlToWhatsAppText(raw);
  }
  return htmlToPlainText(raw);
}

export function renderWhatsAppFormattedHtml(input: string): string {
  const waText = isHtmlRichContent(input) ? htmlToWhatsAppText(input) : String(input || '');
  if (!waText.trim()) return '';

  const lines = waText.split(/\r?\n/);
  const rendered = lines.map((line) => {
    if (!line.trim()) return '<div class="h-2"></div>';
    let safe = escapeHtml(line);
    safe = safe.replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>');
    safe = safe.replace(/(^|\s)_([^_\n]+)_(?=\s|$|[.,!?])/g, '$1<em>$2</em>');
    safe = safe.replace(/~([^~\n]+)~/g, '<del>$1</del>');
    safe = safe.replace(
      /`([^`\n]+)`/g,
      '<code class="px-1 py-0.5 rounded bg-slate-100 font-mono text-[11px]">$1</code>'
    );
    safe = safe.replace(
      /(https?:\/\/[^\s<)]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-emerald-700 underline font-medium">$1</a>'
    );
    return `<div>${safe}</div>`;
  });

  return rendered.join('');
}
