import type { WASocket, proto } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';

/**
 * Interface representing an auto-responder trigger rule.
 * Supports both custom user format ({ keyword, replyMessage })
 * and FlowPilot AutoResponder schema ({ triggerMessage, responseMessage }).
 */
export interface AutoResponderTrigger {
  id?: string;
  keyword: string;
  replyMessage: string;
  matchType?: 'contains' | 'exact' | 'startsWith' | 'any';
  enabled?: boolean;
  channel?: string;
  targetList?: string;
}

/**
 * Options accepted by startAutoResponder
 */
export interface AutoResponderOptions {
  userId?: string;
  cooldownMs?: number; // Anti-spam delay. Default: 5 * 60 * 1000 (5 minutes)
  triggers?: AutoResponderTrigger[];
  getTriggers?: (userId: string, sock: WASocket) => Promise<AutoResponderTrigger[]> | AutoResponderTrigger[];
  allowGroupMessages?: boolean; // Default: false (only direct private chats)
  onAutoReplied?: (info: {
    leadPhone: string;
    keyword: string;
    replyMessage: string;
    matchedText: string;
    messageId?: string;
  }) => void | Promise<void>;
  // Optional custom db adapter matching user Prisma / Drizzle / Mongoose schema
  db?: {
    whatsappSessions?: {
      findFirst: (query: { where: { sessionId: string } }) => Promise<{ userId: string } | null>;
    };
    autoResponders?: {
      findMany: (query: { where: { userId: string } }) => Promise<Array<{ keyword?: string; triggerMessage?: string; replyMessage?: string; responseMessage?: string }>>;
    };
  };
}

/**
 * -----------------------------------------------------------------------------
 * 1. ANTI-SPAM COOLDOWN CACHE
 * Prevents auto-replying to the same lead twice within 5 minutes.
 * -----------------------------------------------------------------------------
 */
export class SpamCooldownCache {
  private cache = new Map<string, number>();
  private defaultCooldownMs: number;

  constructor(defaultCooldownMs: number = 5 * 60 * 1000) {
    this.defaultCooldownMs = defaultCooldownMs;
    // Periodic garbage collection every 10 minutes to prevent memory leaks
    if (typeof setInterval !== 'undefined') {
      const timer = setInterval(() => this.cleanup(), 10 * 60 * 1000);
      if (typeof timer.unref === 'function') {
        timer.unref();
      }
    }
  }

  /**
   * Check if a lead is currently in cooldown (i.e. has received an auto-reply within cooldown window)
   */
  public isCoolingDown(leadPhone: string, cooldownMs?: number): boolean {
    const cleanPhone = leadPhone.replace(/[^0-9]/g, '');
    const lastTime = this.cache.get(cleanPhone);
    if (!lastTime) return false;

    const ttl = cooldownMs ?? this.defaultCooldownMs;
    const now = Date.now();
    if (now - lastTime < ttl) {
      return true;
    }

    // Expired entry
    this.cache.delete(cleanPhone);
    return false;
  }

  /**
   * Record that an auto-reply was just sent to this lead
   */
  public recordReply(leadPhone: string): void {
    const cleanPhone = leadPhone.replace(/[^0-9]/g, '');
    this.cache.set(cleanPhone, Date.now());
  }

  /**
   * Returns remaining cooldown in milliseconds (0 if not in cooldown)
   */
  public getRemainingCooldownMs(leadPhone: string, cooldownMs?: number): number {
    const cleanPhone = leadPhone.replace(/[^0-9]/g, '');
    const lastTime = this.cache.get(cleanPhone);
    if (!lastTime) return 0;
    const ttl = cooldownMs ?? this.defaultCooldownMs;
    const elapsed = Date.now() - lastTime;
    return elapsed < ttl ? ttl - elapsed : 0;
  }

  public clear(): void {
    this.cache.clear();
  }

  public size(): number {
    return this.cache.size;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [phone, timestamp] of this.cache.entries()) {
      if (now - timestamp > this.defaultCooldownMs * 2) {
        this.cache.delete(phone);
      }
    }
  }
}

// Global shared singleton for anti-spam tracking (5-minute window)
export const globalSpamCache = new SpamCooldownCache(5 * 60 * 1000);

/**
 * -----------------------------------------------------------------------------
 * 2. MESSAGE TEXT EXTRACTOR
 * Extracts raw textual payload from all WhatsApp message types:
 * - conversation
 * - extendedTextMessage (links, quotes, formatting)
 * - imageMessage caption
 * - videoMessage caption
 * - documentMessage caption
 * - buttonsResponseMessage (button reply)
 * - templateButtonReplyMessage (template button reply)
 * - listResponseMessage (list selection)
 * - interactiveResponseMessage (native flow buttons/forms)
 * -----------------------------------------------------------------------------
 */
export function extractMessageText(rawMessage: any): string {
  if (!rawMessage) return '';

  let message = rawMessage;

  // Unwrap ephemeral or view-once wrapper envelopes
  if (message.ephemeralMessage?.message) {
    message = message.ephemeralMessage.message;
  }
  if (message.viewOnceMessage?.message) {
    message = message.viewOnceMessage.message;
  }
  if (message.viewOnceMessageV2?.message) {
    message = message.viewOnceMessageV2.message;
  }
  if (message.documentWithCaptionMessage?.message) {
    message = message.documentWithCaptionMessage.message;
  }

  // 1. Plain text conversation
  if (typeof message.conversation === 'string' && message.conversation.trim()) {
    return message.conversation.trim();
  }

  // 2. Extended text message (formatting, quoted message, URLs)
  if (typeof message.extendedTextMessage?.text === 'string' && message.extendedTextMessage.text.trim()) {
    return message.extendedTextMessage.text.trim();
  }

  // 3. Media captions (image, video, document)
  if (typeof message.imageMessage?.caption === 'string' && message.imageMessage.caption.trim()) {
    return message.imageMessage.caption.trim();
  }
  if (typeof message.videoMessage?.caption === 'string' && message.videoMessage.caption.trim()) {
    return message.videoMessage.caption.trim();
  }
  if (typeof message.documentMessage?.caption === 'string' && message.documentMessage.caption.trim()) {
    return message.documentMessage.caption.trim();
  }

  // 4. Button response message (Interactive quick reply buttons)
  if (message.buttonsResponseMessage) {
    return (
      message.buttonsResponseMessage.selectedDisplayText ||
      message.buttonsResponseMessage.selectedButtonId ||
      ''
    ).trim();
  }

  // 5. Template button reply message
  if (message.templateButtonReplyMessage) {
    return (
      message.templateButtonReplyMessage.selectedDisplayText ||
      message.templateButtonReplyMessage.selectedId ||
      ''
    ).trim();
  }

  // 6. Interactive list reply message
  if (message.listResponseMessage) {
    return (
      message.listResponseMessage.title ||
      message.listResponseMessage.singleSelectReply?.selectedRowId ||
      message.listResponseMessage.description ||
      ''
    ).trim();
  }

  // 7. Interactive native flow response (CTA, carousels, payment, forms)
  if (message.interactiveResponseMessage) {
    const nativeFlow = message.interactiveResponseMessage.nativeFlowResponseMessage;
    if (nativeFlow?.paramsJson) {
      try {
        const parsed = JSON.parse(nativeFlow.paramsJson);
        if (parsed.id) return String(parsed.id).trim();
        if (parsed.button_id) return String(parsed.button_id).trim();
      } catch {
        // ignore parse error
      }
    }
    if (message.interactiveResponseMessage.body?.text) {
      return message.interactiveResponseMessage.body.text.trim();
    }
  }

  return '';
}

/**
 * -----------------------------------------------------------------------------
 * 3. TRIGGER RESOLVER
 * Finds triggers for this user via:
 * 1) Provided triggers array in options
 * 2) Custom options.getTriggers callback
 * 3) Custom options.db queries (db.whatsappSessions & db.autoResponders)
 * 4) Default FlowPilot storage (.data/workspaces_store.json)
 * -----------------------------------------------------------------------------
 */
export async function resolveUserTriggers(
  userId: string,
  sock: any,
  options: AutoResponderOptions = {}
): Promise<AutoResponderTrigger[]> {
  // Option A: Direct array passed in options
  if (options.triggers && Array.isArray(options.triggers) && options.triggers.length > 0) {
    return options.triggers;
  }

  // Option B: Custom getTriggers callback
  if (typeof options.getTriggers === 'function') {
    try {
      const customTriggers = await options.getTriggers(userId, sock);
      if (Array.isArray(customTriggers)) return customTriggers;
    } catch (err) {
      console.warn(`[AutoResponder] getTriggers callback failed for user ${userId}:`, err);
    }
  }

  // Option C: Custom db object (e.g., Prisma db.whatsappSessions and db.autoResponders)
  if (options.db) {
    try {
      let targetUserId = userId;
      if (options.db.whatsappSessions && typeof options.db.whatsappSessions.findFirst === 'function') {
        const sessionOwner = await options.db.whatsappSessions.findFirst({
          where: { sessionId: sock.id || userId },
        });
        if (sessionOwner?.userId) {
          targetUserId = sessionOwner.userId;
        }
      }

      if (options.db.autoResponders && typeof options.db.autoResponders.findMany === 'function') {
        const rawTriggers = await options.db.autoResponders.findMany({
          where: { userId: targetUserId },
        });
        if (Array.isArray(rawTriggers)) {
          return rawTriggers.map((t) => ({
            keyword: t.keyword || t.triggerMessage || '',
            replyMessage: t.replyMessage || t.responseMessage || '',
          })).filter((t) => t.keyword && t.replyMessage);
        }
      }
    } catch (dbErr) {
      console.warn(`[AutoResponder] Custom db lookup failed:`, dbErr);
    }
  }

  // Option D: FlowPilot default workspace storage (.data/workspaces_store.json)
  const triggers: AutoResponderTrigger[] = [];
  try {
    const workspacesPath = path.join(process.cwd(), '.data', 'workspaces_store.json');
    if (fs.existsSync(workspacesPath)) {
      const raw = fs.readFileSync(workspacesPath, 'utf-8');
      const store = JSON.parse(raw);

      // Search matching workspace by userId or fallback to first workspace
      const targetSnapshot =
        store[userId] ||
        Object.values(store).find((s: any) => s?.workspace?.id === userId || s?.workspace?.ownerId === userId) ||
        Object.values(store)[0];

      if (targetSnapshot && typeof targetSnapshot === 'object') {
        // 1. AutoResponders in snapshot
        if (Array.isArray((targetSnapshot as any).autoResponders)) {
          for (const ar of (targetSnapshot as any).autoResponders) {
            const kw = ar.triggerMessage || ar.keyword;
            const reply = ar.responseMessage || ar.replyMessage;
            if (kw && reply && ar.status !== 'paused') {
              triggers.push({
                id: ar.id,
                keyword: String(kw).trim(),
                replyMessage: String(reply).trim(),
                matchType: ar.matchType || 'contains',
                targetList: ar.targetList,
              });
            }
          }
        }

        // 2. Chatbots in snapshot (keyword concierge flows)
        if (Array.isArray((targetSnapshot as any).chatbots)) {
          for (const bot of (targetSnapshot as any).chatbots) {
            const kw = bot.triggerKeyword || bot.keyword;
            const reply = bot.welcomeMessage || bot.replyMessage;
            if (kw && reply && bot.enabled !== false) {
              triggers.push({
                id: bot.id,
                keyword: String(kw).trim(),
                replyMessage: String(reply).trim(),
                matchType: bot.matchType || 'contains',
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[AutoResponder] Error reading local workspaces store:`, err);
  }

  return triggers;
}

/**
 * -----------------------------------------------------------------------------
 * 4. KEYWORD MATCHER
 * Checks whether the incoming message text matches a trigger keyword.
 * -----------------------------------------------------------------------------
 */
export function matchesTrigger(
  lowerMessage: string,
  trigger: AutoResponderTrigger
): boolean {
  if (!trigger.keyword || !trigger.replyMessage) return false;
  const kw = trigger.keyword.toLowerCase().trim();
  if (!kw) return false;

  const mode = trigger.matchType || 'contains';

  switch (mode) {
    case 'exact':
      return lowerMessage === kw;
    case 'startsWith':
      return lowerMessage.startsWith(kw);
    case 'any':
      return true;
    case 'contains':
    default:
      return lowerMessage.includes(kw);
  }
}

/**
 * -----------------------------------------------------------------------------
 * 5. START AUTO RESPONDER LISTENER
 * Attaches to sock.ev.on('messages.upsert', ...).
 * 
 * Flow:
 * - Checks if message exists and is NOT from me
 * - Extracts text from conversation, extended text, captions, buttons, and list replies
 * - Checks anti-spam cooldown cache (5-minute limit per lead)
 * - Resolves auto-responder triggers for the session owner
 * - Finds first matching trigger keyword (case-insensitive)
 * - Sends auto-reply message via Baileys socket
 * - Logs confirmation: "Auto responded to ${leadPhone} with keyword ${trigger.keyword}"
 * - Returns cleanup unsubscribe function
 * -----------------------------------------------------------------------------
 */
export function startAutoResponder(
  sock: any,
  options: AutoResponderOptions = {}
): () => void {
  if (!sock || !sock.ev) {
    throw new Error('Valid Baileys socket instance (sock) is required to startAutoResponder');
  }

  const userId = options.userId || sock._flowpilot_userId || sock.id || 'default_workspace';
  const cooldownMs = options.cooldownMs ?? (5 * 60 * 1000); // 5 minutes
  const spamCache = globalSpamCache;

  console.log(`[WhatsApp AutoResponder] Initializing listener for user: ${userId} (Spam Cooldown: ${cooldownMs / 1000}s)`);

  const handleMessagesUpsert = async (upsert: { messages: proto.IWebMessageInfo[]; type?: string }) => {
    try {
      const messages = upsert.messages;
      if (!Array.isArray(messages) || messages.length === 0) return;

      const msg = messages[0];
      if (!msg || !msg.message) return;
      if (msg.key?.fromMe) return; // ignore my own messages

      const leadPhone = msg.key?.remoteJid;
      if (!leadPhone) return;

      // Ignore broadcast status updates
      if (leadPhone === 'status@broadcast') return;

      // Ignore group chats unless explicitly allowed
      if (leadPhone.endsWith('@g.us') && !options.allowGroupMessages) {
        return;
      }

      // Extract full text from conversation, extendedTextMessage, caption, buttons, or list response
      const leadMessage = extractMessageText(msg.message);
      if (!leadMessage) return;

      const lowerMessage = leadMessage.toLowerCase().trim();

      // Check anti-spam cache: Don't auto-reply to same lead twice within 5 minutes
      if (spamCache.isCoolingDown(leadPhone, cooldownMs)) {
        const remainingSec = Math.round(spamCache.getRemainingCooldownMs(leadPhone, cooldownMs) / 1000);
        console.log(
          `[WhatsApp AutoResponder] Spam Prevention: Lead ${leadPhone} sent "${leadMessage}", but is cooling down (${remainingSec}s remaining). Skipping.`
        );
        return;
      }

      // 1 & 2. Find user triggers (via custom db or FlowPilot workspace store)
      const triggers = await resolveUserTriggers(userId, sock, options);
      if (!triggers || triggers.length === 0) return;

      // 3. Check if lead message matches any keyword
      for (const trigger of triggers) {
        if (matchesTrigger(lowerMessage, trigger)) {
          // Send reply message via socket
          const sendResult = await sock.sendMessage(leadPhone, { text: trigger.replyMessage });

          // Record in anti-spam cache
          spamCache.recordReply(leadPhone);

          console.log(`Auto responded to ${leadPhone} with keyword ${trigger.keyword}`);

          // Record activity into persistent workspace store
          try {
            const storePath = path.join(process.cwd(), '.data', 'workspaces_store.json');
            if (fs.existsSync(storePath)) {
              const rawSnap = fs.readFileSync(storePath, 'utf-8');
              const parsed = JSON.parse(rawSnap);
              const userSnap = parsed[userId] || parsed['default_workspace'];
              if (userSnap) {
                const nowIso = new Date().toISOString();
                const newAct = {
                  id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                  workspaceId: userSnap.workspace?.id || userId,
                  ownerId: userId,
                  eventType: 'whatsapp_replied',
                  title: `Auto-replied to +${leadPhone.replace(/[^0-9]/g, '')}`,
                  detail: `Trigger Keyword: "${trigger.keyword}" · Reply: "${trigger.replyMessage.slice(0, 120)}"`,
                  channel: 'whatsapp',
                  createdAt: nowIso,
                  updatedAt: nowIso,
                };
                const existingActs = Array.isArray(userSnap.activities) ? userSnap.activities : [];
                userSnap.activities = [newAct, ...existingActs].slice(0, 150);
                userSnap.updatedAt = nowIso;
                parsed[userId] = userSnap;
                fs.writeFileSync(storePath, JSON.stringify(parsed, null, 2), 'utf-8');
              }
            }
          } catch {
            // Non-fatal
          }

          // Optional callback
          if (typeof options.onAutoReplied === 'function') {
            try {
              await options.onAutoReplied({
                leadPhone,
                keyword: trigger.keyword,
                replyMessage: trigger.replyMessage,
                matchedText: leadMessage,
                messageId: sendResult?.key?.id,
              });
            } catch (cbErr) {
              console.warn('[WhatsApp AutoResponder] onAutoReplied callback error:', cbErr);
            }
          }

          break; // send only first match
        }
      }
    } catch (err: any) {
      console.error('[WhatsApp AutoResponder] Error processing inbound message:', err?.message || err);
    }
  };

  // Register on Baileys event emitter
  sock.ev.on('messages.upsert', handleMessagesUpsert);

  // Return unbind function for cleanup when connection closes
  return () => {
    try {
      sock.ev.off('messages.upsert', handleMessagesUpsert);
      console.log(`[WhatsApp AutoResponder] Listener detached for user ${userId}`);
    } catch {
      // ignore
    }
  };
}

/**
 * Convenience helper to clear the anti-spam cache (useful in tests or administrative resets)
 */
export function clearSpamCache(): void {
  globalSpamCache.clear();
}
