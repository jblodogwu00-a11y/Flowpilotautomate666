import type { WASocket } from '@whiskeysockets/baileys';
import { activeSockets, getOrStartWhatsAppSession } from '../../services/whatsappBaileysService.js';

/**
 * Returns the active WhatsApp Baileys socket for the given user/session.
 * Matches: import { getWhatsAppSock } from './client'
 */
export function getWhatsAppSock(userId: string = 'default_workspace'): WASocket | undefined {
  return activeSockets.get((userId || 'default_workspace').trim());
}

/**
 * Returns active socket, or starts/restores session if not active.
 */
export async function getOrConnectWhatsAppSock(userId: string = 'default_workspace'): Promise<WASocket | undefined> {
  const cleanUser = (userId || 'default_workspace').trim();
  let sock = activeSockets.get(cleanUser);
  if (!sock) {
    await getOrStartWhatsAppSession(cleanUser, false);
    sock = activeSockets.get(cleanUser);
  }
  return sock;
}
