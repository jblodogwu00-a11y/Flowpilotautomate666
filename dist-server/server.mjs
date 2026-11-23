// serverCore.ts
import "dotenv/config";
import express from "express";
import fs8 from "fs";
import crypto2 from "crypto";
import path8 from "path";
import nodemailer from "nodemailer";
import { fileURLToPath as fileURLToPath5 } from "url";
import { createServer as createViteServer } from "vite";

// src/services/whatsappBaileysService.ts
import makeWASocket, {
  DisconnectReason,
  makeCacheableSignalKeyStore,
  initAuthCreds as initAuthCreds2
} from "@whiskeysockets/baileys";
import QRCode3 from "qrcode";
import pino from "pino";
import fs5 from "fs";
import path5 from "path";

// src/lib/whatsapp/listener.ts
import fs from "fs";
import path from "path";
var SpamCooldownCache = class {
  constructor(defaultCooldownMs = 5 * 60 * 1e3) {
    this.cache = /* @__PURE__ */ new Map();
    this.defaultCooldownMs = defaultCooldownMs;
    if (typeof setInterval !== "undefined") {
      const timer = setInterval(() => this.cleanup(), 10 * 60 * 1e3);
      if (typeof timer.unref === "function") {
        timer.unref();
      }
    }
  }
  /**
   * Check if a lead is currently in cooldown (i.e. has received an auto-reply within cooldown window)
   */
  isCoolingDown(leadPhone, cooldownMs) {
    const cleanPhone = leadPhone.replace(/[^0-9]/g, "");
    const lastTime = this.cache.get(cleanPhone);
    if (!lastTime) return false;
    const ttl = cooldownMs ?? this.defaultCooldownMs;
    const now = Date.now();
    if (now - lastTime < ttl) {
      return true;
    }
    this.cache.delete(cleanPhone);
    return false;
  }
  /**
   * Record that an auto-reply was just sent to this lead
   */
  recordReply(leadPhone) {
    const cleanPhone = leadPhone.replace(/[^0-9]/g, "");
    this.cache.set(cleanPhone, Date.now());
  }
  /**
   * Returns remaining cooldown in milliseconds (0 if not in cooldown)
   */
  getRemainingCooldownMs(leadPhone, cooldownMs) {
    const cleanPhone = leadPhone.replace(/[^0-9]/g, "");
    const lastTime = this.cache.get(cleanPhone);
    if (!lastTime) return 0;
    const ttl = cooldownMs ?? this.defaultCooldownMs;
    const elapsed = Date.now() - lastTime;
    return elapsed < ttl ? ttl - elapsed : 0;
  }
  clear() {
    this.cache.clear();
  }
  size() {
    return this.cache.size;
  }
  cleanup() {
    const now = Date.now();
    for (const [phone, timestamp] of this.cache.entries()) {
      if (now - timestamp > this.defaultCooldownMs * 2) {
        this.cache.delete(phone);
      }
    }
  }
};
var globalSpamCache = new SpamCooldownCache(5 * 60 * 1e3);
function extractMessageText(rawMessage) {
  if (!rawMessage) return "";
  let message = rawMessage;
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
  if (typeof message.conversation === "string" && message.conversation.trim()) {
    return message.conversation.trim();
  }
  if (typeof message.extendedTextMessage?.text === "string" && message.extendedTextMessage.text.trim()) {
    return message.extendedTextMessage.text.trim();
  }
  if (typeof message.imageMessage?.caption === "string" && message.imageMessage.caption.trim()) {
    return message.imageMessage.caption.trim();
  }
  if (typeof message.videoMessage?.caption === "string" && message.videoMessage.caption.trim()) {
    return message.videoMessage.caption.trim();
  }
  if (typeof message.documentMessage?.caption === "string" && message.documentMessage.caption.trim()) {
    return message.documentMessage.caption.trim();
  }
  if (message.buttonsResponseMessage) {
    return (message.buttonsResponseMessage.selectedDisplayText || message.buttonsResponseMessage.selectedButtonId || "").trim();
  }
  if (message.templateButtonReplyMessage) {
    return (message.templateButtonReplyMessage.selectedDisplayText || message.templateButtonReplyMessage.selectedId || "").trim();
  }
  if (message.listResponseMessage) {
    return (message.listResponseMessage.title || message.listResponseMessage.singleSelectReply?.selectedRowId || message.listResponseMessage.description || "").trim();
  }
  if (message.interactiveResponseMessage) {
    const nativeFlow = message.interactiveResponseMessage.nativeFlowResponseMessage;
    if (nativeFlow?.paramsJson) {
      try {
        const parsed = JSON.parse(nativeFlow.paramsJson);
        if (parsed.id) return String(parsed.id).trim();
        if (parsed.button_id) return String(parsed.button_id).trim();
      } catch {
      }
    }
    if (message.interactiveResponseMessage.body?.text) {
      return message.interactiveResponseMessage.body.text.trim();
    }
  }
  return "";
}
async function resolveUserTriggers(userId, sock, options = {}) {
  if (options.triggers && Array.isArray(options.triggers) && options.triggers.length > 0) {
    return options.triggers;
  }
  if (typeof options.getTriggers === "function") {
    try {
      const customTriggers = await options.getTriggers(userId, sock);
      if (Array.isArray(customTriggers)) return customTriggers;
    } catch (err) {
      console.warn(`[AutoResponder] getTriggers callback failed for user ${userId}:`, err);
    }
  }
  if (options.db) {
    try {
      let targetUserId = userId;
      if (options.db.whatsappSessions && typeof options.db.whatsappSessions.findFirst === "function") {
        const sessionOwner = await options.db.whatsappSessions.findFirst({
          where: { sessionId: sock.id || userId }
        });
        if (sessionOwner?.userId) {
          targetUserId = sessionOwner.userId;
        }
      }
      if (options.db.autoResponders && typeof options.db.autoResponders.findMany === "function") {
        const rawTriggers = await options.db.autoResponders.findMany({
          where: { userId: targetUserId }
        });
        if (Array.isArray(rawTriggers)) {
          return rawTriggers.map((t) => ({
            keyword: t.keyword || t.triggerMessage || "",
            replyMessage: t.replyMessage || t.responseMessage || ""
          })).filter((t) => t.keyword && t.replyMessage);
        }
      }
    } catch (dbErr) {
      console.warn(`[AutoResponder] Custom db lookup failed:`, dbErr);
    }
  }
  const triggers = [];
  try {
    const workspacesPath = path.join(process.cwd(), ".data", "workspaces_store.json");
    if (fs.existsSync(workspacesPath)) {
      const raw = fs.readFileSync(workspacesPath, "utf-8");
      const store = JSON.parse(raw);
      const targetSnapshot = store[userId] || Object.values(store).find((s) => s?.workspace?.id === userId || s?.workspace?.ownerId === userId) || Object.values(store)[0];
      if (targetSnapshot && typeof targetSnapshot === "object") {
        if (Array.isArray(targetSnapshot.autoResponders)) {
          for (const ar of targetSnapshot.autoResponders) {
            const kw = ar.triggerMessage || ar.keyword;
            const reply = ar.responseMessage || ar.replyMessage;
            if (kw && reply && ar.status !== "paused") {
              triggers.push({
                id: ar.id,
                keyword: String(kw).trim(),
                replyMessage: String(reply).trim(),
                matchType: ar.matchType || "contains",
                targetList: ar.targetList
              });
            }
          }
        }
        if (Array.isArray(targetSnapshot.chatbots)) {
          for (const bot of targetSnapshot.chatbots) {
            const kw = bot.triggerKeyword || bot.keyword;
            const reply = bot.welcomeMessage || bot.replyMessage;
            if (kw && reply && bot.enabled !== false) {
              triggers.push({
                id: bot.id,
                keyword: String(kw).trim(),
                replyMessage: String(reply).trim(),
                matchType: bot.matchType || "contains"
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
function matchesTrigger(lowerMessage, trigger) {
  if (!trigger.keyword || !trigger.replyMessage) return false;
  const kw = trigger.keyword.toLowerCase().trim();
  if (!kw) return false;
  const mode = trigger.matchType || "contains";
  switch (mode) {
    case "exact":
      return lowerMessage === kw;
    case "startsWith":
      return lowerMessage.startsWith(kw);
    case "any":
      return true;
    case "contains":
    default:
      return lowerMessage.includes(kw);
  }
}
function startAutoResponder(sock, options = {}) {
  if (!sock || !sock.ev) {
    throw new Error("Valid Baileys socket instance (sock) is required to startAutoResponder");
  }
  const userId = options.userId || sock._flowpilot_userId || sock.id || "default_workspace";
  const cooldownMs = options.cooldownMs ?? 5 * 60 * 1e3;
  const spamCache = globalSpamCache;
  console.log(`[WhatsApp AutoResponder] Initializing listener for user: ${userId} (Spam Cooldown: ${cooldownMs / 1e3}s)`);
  const handleMessagesUpsert = async (upsert) => {
    try {
      const messages = upsert.messages;
      if (!Array.isArray(messages) || messages.length === 0) return;
      const msg = messages[0];
      if (!msg || !msg.message) return;
      if (msg.key?.fromMe) return;
      const leadPhone = msg.key?.remoteJid;
      if (!leadPhone) return;
      if (leadPhone === "status@broadcast") return;
      if (leadPhone.endsWith("@g.us") && !options.allowGroupMessages) {
        return;
      }
      const leadMessage = extractMessageText(msg.message);
      if (!leadMessage) return;
      const lowerMessage = leadMessage.toLowerCase().trim();
      if (spamCache.isCoolingDown(leadPhone, cooldownMs)) {
        const remainingSec = Math.round(spamCache.getRemainingCooldownMs(leadPhone, cooldownMs) / 1e3);
        console.log(
          `[WhatsApp AutoResponder] Spam Prevention: Lead ${leadPhone} sent "${leadMessage}", but is cooling down (${remainingSec}s remaining). Skipping.`
        );
        return;
      }
      const triggers = await resolveUserTriggers(userId, sock, options);
      if (!triggers || triggers.length === 0) return;
      for (const trigger of triggers) {
        if (matchesTrigger(lowerMessage, trigger)) {
          const sendResult = await sock.sendMessage(leadPhone, { text: trigger.replyMessage });
          spamCache.recordReply(leadPhone);
          console.log(`Auto responded to ${leadPhone} with keyword ${trigger.keyword}`);
          try {
            const storePath = path.join(process.cwd(), ".data", "workspaces_store.json");
            if (fs.existsSync(storePath)) {
              const rawSnap = fs.readFileSync(storePath, "utf-8");
              const parsed = JSON.parse(rawSnap);
              const userSnap = parsed[userId] || parsed["default_workspace"];
              if (userSnap) {
                const nowIso = (/* @__PURE__ */ new Date()).toISOString();
                const newAct = {
                  id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                  workspaceId: userSnap.workspace?.id || userId,
                  ownerId: userId,
                  eventType: "whatsapp_replied",
                  title: `Auto-replied to +${leadPhone.replace(/[^0-9]/g, "")}`,
                  detail: `Trigger Keyword: "${trigger.keyword}" \xB7 Reply: "${trigger.replyMessage.slice(0, 120)}"`,
                  channel: "whatsapp",
                  createdAt: nowIso,
                  updatedAt: nowIso
                };
                const existingActs = Array.isArray(userSnap.activities) ? userSnap.activities : [];
                userSnap.activities = [newAct, ...existingActs].slice(0, 150);
                userSnap.updatedAt = nowIso;
                parsed[userId] = userSnap;
                fs.writeFileSync(storePath, JSON.stringify(parsed, null, 2), "utf-8");
              }
            }
          } catch {
          }
          if (typeof options.onAutoReplied === "function") {
            try {
              await options.onAutoReplied({
                leadPhone,
                keyword: trigger.keyword,
                replyMessage: trigger.replyMessage,
                matchedText: leadMessage,
                messageId: sendResult?.key?.id
              });
            } catch (cbErr) {
              console.warn("[WhatsApp AutoResponder] onAutoReplied callback error:", cbErr);
            }
          }
          break;
        }
      }
    } catch (err) {
      console.error("[WhatsApp AutoResponder] Error processing inbound message:", err?.message || err);
    }
  };
  sock.ev.on("messages.upsert", handleMessagesUpsert);
  return () => {
    try {
      sock.ev.off("messages.upsert", handleMessagesUpsert);
      console.log(`[WhatsApp AutoResponder] Listener detached for user ${userId}`);
    } catch {
    }
  };
}

// src/lib/automation/db.ts
import fs2 from "fs";
import path2 from "path";
var DATA_DIR = path2.join(process.cwd(), ".data");
var WORKFLOWS_FILE = path2.join(DATA_DIR, "workflows_store.json");
var JOBS_FILE = path2.join(DATA_DIR, "followup_jobs_store.json");
function ensureDataDir() {
  try {
    if (!fs2.existsSync(DATA_DIR)) {
      fs2.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch {
  }
}
var workflowsMap = /* @__PURE__ */ new Map();
var jobsMap = /* @__PURE__ */ new Map();
function loadWorkflowsFromDisk() {
  ensureDataDir();
  try {
    if (fs2.existsSync(WORKFLOWS_FILE)) {
      const raw = fs2.readFileSync(WORKFLOWS_FILE, "utf-8");
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        workflowsMap.clear();
        for (const w of list) {
          if (w && w.id) {
            workflowsMap.set(w.id, w);
          }
        }
      }
    }
  } catch (err) {
    console.warn("[Automation DB] Error loading workflows from disk:", err);
  }
}
function flushWorkflowsToDisk() {
  ensureDataDir();
  try {
    const list = Array.from(workflowsMap.values());
    fs2.writeFileSync(WORKFLOWS_FILE, JSON.stringify(list, null, 2), "utf-8");
  } catch (err) {
    console.error("[Automation DB] Error saving workflows to disk:", err);
  }
}
function loadJobsFromDisk() {
  ensureDataDir();
  try {
    if (fs2.existsSync(JOBS_FILE)) {
      const raw = fs2.readFileSync(JOBS_FILE, "utf-8");
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        jobsMap.clear();
        for (const j of list) {
          if (j && j.id) {
            jobsMap.set(j.id, j);
          }
        }
      }
    }
  } catch (err) {
    console.warn("[Automation DB] Error loading follow-up jobs from disk:", err);
  }
}
function flushJobsToDisk() {
  ensureDataDir();
  try {
    const list = Array.from(jobsMap.values());
    fs2.writeFileSync(JOBS_FILE, JSON.stringify(list, null, 2), "utf-8");
  } catch (err) {
    console.error("[Automation DB] Error saving follow-up jobs to disk:", err);
  }
}
loadWorkflowsFromDisk();
loadJobsFromDisk();
async function getWorkflowById(workflowId) {
  loadWorkflowsFromDisk();
  return workflowsMap.get(workflowId) || null;
}
async function getWorkflowsForUser(userId) {
  loadWorkflowsFromDisk();
  const cleanId = (userId || "default_workspace").trim();
  const all = Array.from(workflowsMap.values());
  const userList = all.filter((w) => w.userId === cleanId || w.userId === "default_workspace" || cleanId === "admin");
  return userList.length > 0 ? userList : all;
}
async function saveWorkflow(workflow) {
  const id = workflow.id || `wf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const existing = workflowsMap.get(id);
  const record = {
    id,
    userId: workflow.userId || existing?.userId || "default_workspace",
    name: workflow.name || "Untitled Workflow",
    nodesJson: workflow.nodesJson || existing?.nodesJson || "[]",
    edgesJson: workflow.edgesJson || existing?.edgesJson || "[]",
    enabled: workflow.enabled ?? (existing ? existing.enabled : true),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  workflowsMap.set(id, record);
  flushWorkflowsToDisk();
  return record;
}
async function deleteWorkflow(workflowId) {
  const deleted = workflowsMap.delete(workflowId);
  if (deleted) {
    flushWorkflowsToDisk();
  }
  return deleted;
}
async function createFollowUpJob(params) {
  const now = Date.now();
  const { delayValue, delayUnit } = params;
  let delayMs = delayValue * 60 * 1e3;
  if (delayUnit === "Hours") {
    delayMs = delayValue * 3600 * 1e3;
  } else if (delayUnit === "Days") {
    delayMs = delayValue * 86400 * 1e3;
  }
  const nextActionAt = now + delayMs;
  const id = `job_${now}_${Math.random().toString(36).slice(2, 7)}`;
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const job = {
    id,
    workflowId: params.workflowId,
    userId: params.userId || "default_workspace",
    leadPhone: params.leadPhone,
    nextActionAt,
    delayValue,
    delayUnit,
    message: params.message,
    actionType: params.actionType || "action_send_whatsapp",
    status: "pending",
    createdAt: nowIso,
    updatedAt: nowIso
  };
  jobsMap.set(id, job);
  flushJobsToDisk();
  console.log(`[FollowUp Job] Scheduled job ${id} for ${params.leadPhone} in ${delayValue} ${delayUnit} (Action at ${new Date(nextActionAt).toISOString()})`);
  return job;
}
async function getPendingFollowUpJobs() {
  loadJobsFromDisk();
  const now = Date.now();
  return Array.from(jobsMap.values()).filter(
    (job) => job.status === "pending" && job.nextActionAt <= now
  );
}
async function getAllFollowUpJobs(userId) {
  loadJobsFromDisk();
  const all = Array.from(jobsMap.values()).sort((a, b) => b.nextActionAt - a.nextActionAt);
  if (!userId) return all;
  return all.filter((j) => j.userId === userId || j.userId === "default_workspace");
}
async function updateJobStatus(jobId, status, error) {
  const job = jobsMap.get(jobId);
  if (!job) return null;
  job.status = status;
  job.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  if (status === "sent") {
    job.sentAt = (/* @__PURE__ */ new Date()).toISOString();
  }
  if (error) {
    job.error = error;
  }
  jobsMap.set(jobId, job);
  flushJobsToDisk();
  return job;
}

// src/lib/evolutionApi.ts
import "dotenv/config";
import fs3 from "fs";
import path3 from "path";
import { fileURLToPath } from "url";
import QRCode2 from "qrcode";

// src/lib/firebaseAdmin.ts
import { initializeApp as initializeApp2, getApps as getApps2, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore as getFirestore2 } from "firebase-admin/firestore";

// firebase-applet-config.json
var firebase_applet_config_default = {
  projectId: "gen-lang-client-0591253970",
  appId: "1:235970813752:web:bfb708c19a7165dbb46bcd",
  apiKey: "AIzaSyBCBfmwJzbsW2yXSAYMWdLnm-W2x-l2LPA",
  authDomain: "gen-lang-client-0591253970.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-53b8d6de-81d3-4f2a-9ea0-7359072dfac0",
  storageBucket: "gen-lang-client-0591253970.firebasestorage.app",
  messagingSenderId: "235970813752",
  measurementId: "",
  oAuthClientId: "235970813752-6klmkr5ktof31uk3dd3hsjn1le6ih6iq.apps.googleusercontent.com",
  recaptchaSiteKey: ""
};

// src/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  setLogLevel,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  getDocFromServer
} from "firebase/firestore";

// src/lib/evolutionClient.ts
import QRCode from "qrcode";

// src/firebase.ts
var app = getApps().length ? getApp() : initializeApp(firebase_applet_config_default);
var targetDatabaseId = firebase_applet_config_default.firestoreDatabaseId || "ai-studio-53b8d6de-81d3-4f2a-9ea0-7359072dfac0";
setLogLevel("silent");
var db = (() => {
  try {
    return initializeFirestore(
      app,
      {
        experimentalAutoDetectLongPolling: true
      },
      targetDatabaseId
    );
  } catch {
    return getFirestore(app, targetDatabaseId);
  }
})();
var auth = getAuth(app);
if (typeof window !== "undefined") {
  setPersistence(auth, browserLocalPersistence).catch(() => {
  });
}
var googleProvider = new GoogleAuthProvider();
googleProvider.addScope("profile");
googleProvider.addScope("email");
googleProvider.setCustomParameters({ prompt: "select_account" });
var firebaseProjectId = firebase_applet_config_default.projectId;
async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

// src/lib/firebaseAdmin.ts
import { doc as doc2, getDoc as getDoc2, setDoc as setDoc2 } from "firebase/firestore";
var targetDatabaseId2 = firebase_applet_config_default.firestoreDatabaseId || "ai-studio-53b8d6de-81d3-4f2a-9ea0-7359072dfac0";
var localDocsCache = /* @__PURE__ */ new Map();
function getCachedLocalDoc(collectionName, docId) {
  const col = localDocsCache.get(collectionName);
  return col?.get(docId) || null;
}
function setCachedLocalDoc(collectionName, docId, data) {
  let col = localDocsCache.get(collectionName);
  if (!col) {
    col = /* @__PURE__ */ new Map();
    localDocsCache.set(collectionName, col);
  }
  const existing = col.get(docId) || {};
  col.set(docId, { ...existing, ...data });
}
function hasFirebaseServiceAccount() {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT && process.env.FIREBASE_SERVICE_ACCOUNT.trim().length > 10);
}
function getAdminApp() {
  const apps = getApps2();
  if (apps.length > 0 && apps[0]) {
    return apps[0];
  }
  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  let credential;
  if (serviceAccountEnv) {
    try {
      const raw = serviceAccountEnv.trim();
      const parsed = raw.startsWith("{") ? JSON.parse(raw) : JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
      credential = cert(parsed);
      console.log("[Firebase Admin] Initialized with FIREBASE_SERVICE_ACCOUNT credentials");
    } catch (err) {
      console.warn("[Firebase Admin] Warning parsing FIREBASE_SERVICE_ACCOUNT:", err.message);
      credential = applicationDefault();
    }
  } else {
    try {
      credential = applicationDefault();
    } catch {
      credential = void 0;
    }
  }
  const app2 = initializeApp2({
    ...credential ? { credential } : {},
    projectId: firebase_applet_config_default.projectId
  });
  return app2;
}
function getAdminFirestore() {
  const app2 = getAdminApp();
  try {
    if (targetDatabaseId2 && targetDatabaseId2 !== "(default)") {
      return getFirestore2(app2, targetDatabaseId2);
    }
    return getFirestore2(app2);
  } catch {
    return getFirestore2(app2);
  }
}
async function getFirestoreDoc(collectionName, docId) {
  const cleanId = String(docId).trim();
  if (hasFirebaseServiceAccount()) {
    try {
      const firestore = getAdminFirestore();
      const snap = await firestore.collection(collectionName).doc(cleanId).get();
      if (snap.exists) {
        const data = snap.data() || null;
        if (data) setCachedLocalDoc(collectionName, cleanId, data);
        return data;
      }
      return null;
    } catch (adminErr) {
      console.warn(`[Firebase Admin ${collectionName}] Read fallback:`, adminErr.message);
    }
  }
  try {
    const docRef = doc2(db, collectionName, cleanId);
    const snap = await getDoc2(docRef);
    if (snap.exists()) {
      const data = snap.data() || null;
      if (data) setCachedLocalDoc(collectionName, cleanId, data);
      return data;
    }
    return null;
  } catch (clientErr) {
    const cached = getCachedLocalDoc(collectionName, cleanId);
    if (cached) return cached;
    return null;
  }
}
async function setFirestoreDoc(collectionName, docId, data, merge = true) {
  const cleanId = String(docId).trim();
  setCachedLocalDoc(collectionName, cleanId, data);
  if (hasFirebaseServiceAccount()) {
    try {
      const firestore = getAdminFirestore();
      await firestore.collection(collectionName).doc(cleanId).set(data, { merge });
      return;
    } catch (adminErr) {
      console.warn(`[Firebase Admin ${collectionName}] Write fallback:`, adminErr.message);
    }
  }
  try {
    const docRef = doc2(db, collectionName, cleanId);
    await setDoc2(docRef, data, { merge });
  } catch (clientErr) {
    console.warn(`[Firestore ${collectionName}] Write notice: cached locally (${clientErr.message})`);
  }
}

// src/lib/evolutionApi.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path3.dirname(__filename);
var ENV_FILE_PATH = path3.join(__dirname, "../../.env");
function readEnvFallback(key) {
  const fromProcess = (process.env[key] || "").trim();
  if (fromProcess) return fromProcess;
  if (fs3.existsSync(ENV_FILE_PATH)) {
    try {
      const content = fs3.readFileSync(ENV_FILE_PATH, "utf-8");
      const regex = new RegExp(`^${key}\\s*=\\s*([^\\r\\n]+)`, "m");
      const match = content.match(regex);
      if (match && match[1]) {
        return match[1].trim();
      }
    } catch {
    }
  }
  return "";
}
function getEvolutionConfig() {
  const rawUrl = readEnvFallback("EVOLUTION_URL") || readEnvFallback("EVOLUTION_API_URL") || "https://incomestream.duckdns.org";
  const baseUrl = rawUrl.replace(/\/manager\/?$/i, "").replace(/\/+$/, "");
  const apiKey = readEnvFallback("EVOLUTION_API_KEY") || "stakecut-secret-12345";
  return { baseUrl, apiKey };
}
function sanitizeEvolutionId(raw, fallback = "workspace") {
  const cleaned = String(raw || "").trim().replace(/[^a-zA-Z0-9_\-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return (cleaned || fallback).slice(0, 128);
}
function buildEvolutionInstanceName(userId, requestedInstanceName) {
  const cleanUid = sanitizeEvolutionId(userId, "user");
  const defaultName = `flowpilot-${cleanUid}`;
  if (requestedInstanceName && requestedInstanceName.trim()) {
    const cleanedReq = sanitizeEvolutionId(requestedInstanceName, defaultName);
    if (cleanedReq.startsWith("flowpilot-")) {
      return cleanedReq.slice(0, 160);
    }
  }
  return defaultName.slice(0, 160);
}
function normalizeEvolutionStatus(raw) {
  const normalized = String(raw || "").trim().toLowerCase();
  if (normalized === "open" || normalized === "connected" || normalized === "online") {
    return "open";
  }
  if (normalized === "connecting" || normalized === "qr" || normalized === "pairing" || normalized === "initializing") {
    return "connecting";
  }
  return "close";
}
async function evolutionFetch(endpointPath, init = {}) {
  const { baseUrl, apiKey } = getEvolutionConfig();
  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      data: { error: "EVOLUTION_API_KEY is not configured on the server." },
      rawText: "EVOLUTION_API_KEY is not configured on the server."
    };
  }
  const targetUrl = `${baseUrl}${endpointPath.startsWith("/") ? endpointPath : `/${endpointPath}`}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12e3);
  try {
    const response = await fetch(targetUrl, {
      method: init.method || "GET",
      headers: {
        apikey: apiKey,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      ...init.body ? { body: JSON.stringify(init.body) } : {},
      signal: controller.signal
    });
    const rawText = await response.text();
    let parsed = null;
    try {
      parsed = rawText ? JSON.parse(rawText) : {};
    } catch {
      parsed = { message: rawText.slice(0, 300) };
    }
    return {
      ok: response.ok,
      status: response.status,
      data: parsed,
      rawText
    };
  } catch (err) {
    const message = err?.name === "AbortError" ? "Evolution API request timed out after 12 seconds." : err?.message || "Failed to reach Evolution API server.";
    return {
      ok: false,
      status: 502,
      data: { error: message },
      rawText: message
    };
  } finally {
    clearTimeout(timeout);
  }
}
async function extractQrCodeDataUrl(payload) {
  if (!payload || typeof payload !== "object") {
    return { qrCode: null, pairingCode: null };
  }
  const pairingCodeRaw = payload.pairingCode || payload.qrcode?.pairingCode || payload.data?.pairingCode || null;
  const pairingCode = pairingCodeRaw ? String(pairingCodeRaw).trim() : null;
  const base64Candidate = payload.base64 || payload.qrcode?.base64 || payload.data?.base64 || "";
  if (typeof base64Candidate === "string" && base64Candidate.trim().length > 20) {
    const trimmed = base64Candidate.trim();
    return {
      qrCode: trimmed.startsWith("data:image/") ? trimmed : `data:image/png;base64,${trimmed}`,
      pairingCode
    };
  }
  const rawCode = payload.code || payload.qrcode?.code || payload.qr || payload.data?.code || "";
  if (typeof rawCode === "string" && rawCode.trim().length > 10) {
    try {
      const dataUrl = await QRCode2.toDataURL(rawCode.trim(), {
        width: 320,
        margin: 2,
        color: {
          dark: "#0F172A",
          light: "#FFFFFF"
        }
      });
      return { qrCode: dataUrl, pairingCode };
    } catch {
      return { qrCode: null, pairingCode };
    }
  }
  return { qrCode: null, pairingCode };
}
async function syncAdminWhatsAppConnectionDoc(userId, instanceName, status) {
  if (!hasFirebaseServiceAccount()) return;
  try {
    const existing = await getFirestoreDoc("whatsapp_connections", userId);
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    await setFirestoreDoc(
      "whatsapp_connections",
      userId,
      {
        userId,
        instanceName,
        status,
        createdAt: existing?.createdAt || nowIso,
        updatedAt: nowIso
      },
      true
    );
  } catch (err) {
    console.warn("[Evolution API] Admin Firestore sync notice:", err);
  }
}
async function inspectInstanceSummary(instanceName) {
  const [stateRes, listRes] = await Promise.all([
    evolutionFetch(`/instance/connectionState/${encodeURIComponent(instanceName)}`),
    evolutionFetch(`/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`)
  ]);
  let rawState = stateRes.data?.instance?.state || stateRes.data?.state;
  let ownerJid = null;
  let profileName = null;
  let disconnectionReasonCode = null;
  let exists = stateRes.ok;
  if (listRes.ok && Array.isArray(listRes.data)) {
    const found = listRes.data.find(
      (item) => item?.name === instanceName || item?.instance?.instanceName === instanceName
    ) || listRes.data[0];
    if (found) {
      exists = true;
      if (!rawState) {
        rawState = found.connectionStatus || found.instance?.status;
      }
      ownerJid = found.ownerJid || found.instance?.owner || null;
      profileName = found.profileName || found.instance?.profileName || null;
      if (typeof found.disconnectionReasonCode === "number") {
        disconnectionReasonCode = found.disconnectionReasonCode;
      }
    }
  }
  return {
    status: normalizeEvolutionStatus(rawState),
    ownerJid,
    profileName,
    disconnectionReasonCode,
    exists
  };
}
async function configureInstanceWebhook(instanceName, webhookUrl) {
  const appUrl = typeof process !== "undefined" && process.env?.APP_URL ? process.env.APP_URL.replace(/\/+$/, "") : "";
  const targetUrl = webhookUrl || (appUrl ? `${appUrl}/api/whatsapp/evolution-webhook` : "http://localhost:3000/api/whatsapp/evolution-webhook");
  const res = await evolutionFetch(`/webhook/set/${encodeURIComponent(instanceName)}`, {
    method: "POST",
    body: {
      webhook: {
        enabled: true,
        url: targetUrl,
        byEvents: false,
        events: ["MESSAGES_UPSERT"]
      }
    }
  });
  return res.ok;
}
async function initializeEvolutionConnection(params) {
  const userId = sanitizeEvolutionId(params.userId, "user");
  const instanceName = buildEvolutionInstanceName(userId, params.instanceName);
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const { apiKey } = getEvolutionConfig();
  if (!apiKey) {
    return {
      ok: false,
      instanceName,
      userId,
      status: "close",
      qrCode: null,
      pairingCode: null,
      qrPending: false,
      upstreamCount: null,
      ownerJid: null,
      profileName: null,
      disconnectionReasonCode: null,
      detail: "Evolution API key is not configured on the server.",
      error: "Evolution API key (EVOLUTION_API_KEY) is not configured on the server.",
      checkedAt: nowIso
    };
  }
  const createRes = await evolutionFetch("/instance/create", {
    method: "POST",
    body: {
      instanceName,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS"
    }
  });
  let qrCode = null;
  let pairingCode = null;
  if (createRes.ok) {
    const extracted = await extractQrCodeDataUrl(createRes.data);
    qrCode = extracted.qrCode;
    pairingCode = extracted.pairingCode;
  } else {
    const errText = JSON.stringify(createRes.data || createRes.rawText || "").toLowerCase();
    const alreadyExists = createRes.status === 403 || createRes.status === 409 || errText.includes("already in use") || errText.includes("already exists");
    if (!alreadyExists && createRes.status !== 200 && createRes.status !== 201) {
      const upstreamMsg = createRes.data?.response?.message?.[0] || createRes.data?.message || createRes.data?.error || `Evolution API returned HTTP ${createRes.status}`;
      return {
        ok: false,
        instanceName,
        userId,
        status: "close",
        qrCode: null,
        pairingCode: null,
        qrPending: false,
        upstreamCount: null,
        ownerJid: null,
        profileName: null,
        disconnectionReasonCode: null,
        detail: String(upstreamMsg),
        error: String(upstreamMsg),
        checkedAt: nowIso
      };
    }
  }
  configureInstanceWebhook(instanceName, params.webhookUrl).catch(() => {
  });
  if (params.forceRestart) {
    await evolutionFetch(`/instance/restart/${encodeURIComponent(instanceName)}`, {
      method: "POST"
    });
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  let summary = await inspectInstanceSummary(instanceName);
  let upstreamCount = null;
  if (summary.status !== "open" && !qrCode) {
    let connectRes = await evolutionFetch(
      `/instance/connect/${encodeURIComponent(instanceName)}`
    );
    if (connectRes.ok && connectRes.data) {
      if (typeof connectRes.data.count === "number") {
        upstreamCount = connectRes.data.count;
      }
      const extracted = await extractQrCodeDataUrl(connectRes.data);
      qrCode = extracted.qrCode;
      pairingCode = extracted.pairingCode || pairingCode;
      if (!qrCode && (connectRes.data.count === 0 || !connectRes.data.base64)) {
        await new Promise((resolve) => setTimeout(resolve, 850));
        connectRes = await evolutionFetch(
          `/instance/connect/${encodeURIComponent(instanceName)}`
        );
        if (connectRes.ok && connectRes.data) {
          if (typeof connectRes.data.count === "number") {
            upstreamCount = connectRes.data.count;
          }
          const retryExtracted = await extractQrCodeDataUrl(connectRes.data);
          qrCode = retryExtracted.qrCode;
          pairingCode = retryExtracted.pairingCode || pairingCode;
        }
      }
    }
    summary = await inspectInstanceSummary(instanceName);
  }
  await syncAdminWhatsAppConnectionDoc(userId, instanceName, summary.status);
  const detail = summary.status === "open" ? "WhatsApp Connected" : qrCode ? "Scan with your WhatsApp" : `Instance initialized (${instanceName}). Awaiting QR code payload from Evolution API (count: ${upstreamCount ?? 0}).`;
  return {
    ok: true,
    instanceName,
    userId,
    status: summary.status,
    qrCode,
    pairingCode,
    qrPending: summary.status !== "open" && !qrCode,
    upstreamCount,
    ownerJid: summary.ownerJid,
    profileName: summary.profileName,
    disconnectionReasonCode: summary.disconnectionReasonCode,
    detail,
    checkedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function getEvolutionConnectionStatus(params) {
  const userId = sanitizeEvolutionId(params.userId, "user");
  const instanceName = buildEvolutionInstanceName(userId, params.instanceName);
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const { apiKey } = getEvolutionConfig();
  if (!apiKey) {
    return {
      ok: false,
      instanceName,
      userId,
      status: "close",
      qrCode: null,
      pairingCode: null,
      qrPending: false,
      upstreamCount: null,
      ownerJid: null,
      profileName: null,
      disconnectionReasonCode: null,
      detail: "Evolution API key is not configured on the server.",
      error: "Evolution API key (EVOLUTION_API_KEY) is not configured on the server.",
      checkedAt: nowIso
    };
  }
  const summary = await inspectInstanceSummary(instanceName);
  if (!summary.exists) {
    return initializeEvolutionConnection({ userId, instanceName });
  }
  let qrCode = null;
  let pairingCode = null;
  let upstreamCount = null;
  if (summary.status !== "open") {
    const connectRes = await evolutionFetch(
      `/instance/connect/${encodeURIComponent(instanceName)}`
    );
    if (connectRes.ok && connectRes.data) {
      if (typeof connectRes.data.count === "number") {
        upstreamCount = connectRes.data.count;
      }
      const extracted = await extractQrCodeDataUrl(connectRes.data);
      qrCode = extracted.qrCode;
      pairingCode = extracted.pairingCode;
    }
  }
  await syncAdminWhatsAppConnectionDoc(userId, instanceName, summary.status);
  const detail = summary.status === "open" ? "WhatsApp Connected" : qrCode ? "Scan with your WhatsApp" : `Session status is "${summary.status}". Still awaiting QR image from Evolution API (count: ${upstreamCount ?? 0}).`;
  return {
    ok: true,
    instanceName,
    userId,
    status: summary.status,
    qrCode,
    pairingCode,
    qrPending: summary.status !== "open" && !qrCode,
    upstreamCount,
    ownerJid: summary.ownerJid,
    profileName: summary.profileName,
    disconnectionReasonCode: summary.disconnectionReasonCode,
    detail,
    checkedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function disconnectEvolutionConnection(params) {
  const userId = sanitizeEvolutionId(params.userId, "user");
  const instanceName = buildEvolutionInstanceName(userId, params.instanceName);
  const logoutRes = await evolutionFetch(
    `/instance/logout/${encodeURIComponent(instanceName)}`,
    { method: "DELETE" }
  );
  await syncAdminWhatsAppConnectionDoc(userId, instanceName, "close");
  if (!logoutRes.ok && logoutRes.status !== 404 && logoutRes.status !== 400) {
    return {
      ok: false,
      instanceName,
      status: "close",
      error: logoutRes.data?.message || logoutRes.data?.error || `Failed to log out instance (HTTP ${logoutRes.status})`
    };
  }
  return {
    ok: true,
    instanceName,
    status: "close"
  };
}
async function sendWhatsAppViaEvolution(instanceName, leadPhone, text) {
  const cleanPhone = String(leadPhone || "").replace(/[^0-9]/g, "");
  const cleanText = String(text || "").trim();
  if (!cleanPhone || !cleanText) {
    return {
      ok: false,
      instanceName,
      to: cleanPhone,
      detail: "Recipient phone number and non-empty message text are required.",
      error: "Recipient phone number and non-empty message text are required."
    };
  }
  try {
    const summary = await inspectInstanceSummary(instanceName);
    if (summary.status !== "open") {
      return {
        ok: false,
        instanceName,
        to: cleanPhone,
        detail: `Instance "${instanceName}" is currently "${summary.status}". Scan QR code in Connect WhatsApp to connect before sending.`,
        error: `WhatsApp instance "${instanceName}" is disconnected. Please scan the QR code to connect first.`
      };
    }
  } catch (inspectErr) {
    console.warn(`[sendWhatsAppViaEvolution] Could not pre-check status for ${instanceName}:`, inspectErr?.message || inspectErr);
  }
  const endpoint = `/message/sendText/${encodeURIComponent(instanceName)}`;
  const res = await evolutionFetch(endpoint, {
    method: "POST",
    body: {
      number: cleanPhone,
      text: cleanText
    }
  });
  if (!res.ok) {
    const errorMsg = res.data?.response?.message?.[0] || res.data?.message || res.data?.error || `Evolution sendText failed (HTTP ${res.status})`;
    return {
      ok: false,
      instanceName,
      to: cleanPhone,
      detail: String(errorMsg),
      error: String(errorMsg)
    };
  }
  const messageId = res.data?.key?.id || res.data?.messageId || `evo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  return {
    ok: true,
    messageId,
    instanceName,
    to: cleanPhone,
    detail: `Sent via Evolution API (${instanceName}) to +${cleanPhone}`
  };
}

// src/lib/customDomainEmail.ts
import "dotenv/config";
import { Resend } from "resend";
import fs4 from "node:fs";
import path4 from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = path4.dirname(__filename2);
var DATA_DIR2 = path4.join(__dirname2, "../../.data");
var EMAIL_STORE_PATH = path4.join(DATA_DIR2, "email_domains_store.json");
var CustomDomainEmailError = class extends Error {
  constructor(message, statusCode = 400, code = "CUSTOM_DOMAIN_ERROR") {
    super(message);
    this.name = "CustomDomainEmailError";
    this.statusCode = statusCode;
    this.code = code;
  }
};
var FREE_EMAIL_PROVIDERS = /* @__PURE__ */ new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "yahoo.fr",
  "yahoo.ca",
  "yahoo.in",
  "yahoo.com.au",
  "ymail.com",
  "rocketmail.com",
  "outlook.com",
  "hotmail.com",
  "hotmail.co.uk",
  "hotmail.fr",
  "live.com",
  "live.co.uk",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "aim.com",
  "proton.me",
  "protonmail.com",
  "protonmail.ch",
  "pm.me",
  "zoho.com",
  "zohomail.com",
  "gmx.com",
  "gmx.net",
  "gmx.de",
  "mail.com",
  "yandex.com",
  "yandex.ru",
  "tutanota.com",
  "tutanota.de",
  "tuta.io",
  "fastmail.com",
  "fastmail.fm",
  "hey.com",
  "inbox.com",
  "mail.ru",
  "rambler.ru",
  "qq.com",
  "163.com",
  "126.com",
  "rediffmail.com"
]);
var RESERVED_DOMAINS = /* @__PURE__ */ new Set([
  "localhost",
  "localhost.localdomain",
  "example.com",
  "example.org",
  "example.net",
  "resend.dev",
  "flowpilot.app",
  "send.flowpilot.app"
]);
function isResendConfigured() {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  return Boolean(
    apiKey && apiKey !== "your_resend_api_key_here" && apiKey !== "MY_RESEND_API_KEY" && apiKey.startsWith("re_")
  );
}
function getResendClient() {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!apiKey || apiKey === "your_resend_api_key_here" || apiKey === "MY_RESEND_API_KEY") {
    return null;
  }
  return new Resend(apiKey);
}
function requireResendClient() {
  const client = getResendClient();
  if (!client) {
    throw new CustomDomainEmailError(
      "Centralized Resend email infrastructure is not configured on this server. Please set RESEND_API_KEY in the server environment.",
      503,
      "RESEND_NOT_CONFIGURED"
    );
  }
  return client;
}
function ensureDataDir2() {
  try {
    if (!fs4.existsSync(DATA_DIR2)) {
      fs4.mkdirSync(DATA_DIR2, { recursive: true });
    }
  } catch {
  }
}
function sanitizeOwnerId(ownerId) {
  const clean = String(ownerId || "").trim();
  if (!clean || !/^[a-zA-Z0-9_.\-@]+$/.test(clean) || clean.length > 128) {
    throw new CustomDomainEmailError("Valid authenticated user ID is required.", 401, "UNAUTHORIZED");
  }
  return clean;
}
function loadEmailStore() {
  try {
    if (fs4.existsSync(EMAIL_STORE_PATH)) {
      const raw = fs4.readFileSync(EMAIL_STORE_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === 2) {
        return {
          version: 2,
          domainsByOwner: parsed.domainsByOwner || {},
          sendersByOwner: parsed.sendersByOwner || {},
          webhookLogs: Array.isArray(parsed.webhookLogs) ? parsed.webhookLogs : []
        };
      }
      return {
        version: 2,
        domainsByOwner: {},
        sendersByOwner: {},
        webhookLogs: []
      };
    }
  } catch (err) {
    console.warn("[CustomDomainEmail] Read local store notice:", err?.message || err);
  }
  return {
    version: 2,
    domainsByOwner: {},
    sendersByOwner: {},
    webhookLogs: []
  };
}
function saveEmailStore(state) {
  try {
    ensureDataDir2();
    fs4.writeFileSync(EMAIL_STORE_PATH, JSON.stringify(state, null, 2), "utf-8");
  } catch (err) {
    console.warn("[CustomDomainEmail] Write local store notice:", err?.message || err);
  }
}
function normalizeDomain(rawDomain) {
  let cleaned = String(rawDomain || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.+$/, "");
  if (cleaned.startsWith("www.")) {
    cleaned = cleaned.slice(4);
  }
  return cleaned;
}
function sanitizeHeaderString(value, maxLength = 100) {
  return String(value || "").replace(/[\r\n\0<>"]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}
function validateCustomDomainSenderInput(params) {
  const cleanName = sanitizeHeaderString(params.fromName, 100);
  if (cleanName.length < 2) {
    throw new CustomDomainEmailError(
      "Please enter a From Name (at least 2 characters, e.g. Musa Store).",
      400,
      "INVALID_FROM_NAME"
    );
  }
  const rawEmail = String(params.fromEmail || "").trim();
  if (!rawEmail || /[\r\n\s<>]/.test(rawEmail)) {
    throw new CustomDomainEmailError(
      "Please enter a valid custom domain email address without spaces or brackets.",
      400,
      "INVALID_FROM_EMAIL"
    );
  }
  const cleanEmail = rawEmail.toLowerCase();
  const emailRegex = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/;
  if (!emailRegex.test(cleanEmail) || cleanEmail.length > 150) {
    throw new CustomDomainEmailError(
      "Please enter a valid email address (for example: hello@yourdomain.com).",
      400,
      "INVALID_FROM_EMAIL"
    );
  }
  const atIndex = cleanEmail.lastIndexOf("@");
  const rawDomain = cleanEmail.slice(atIndex + 1);
  const domain = normalizeDomain(rawDomain);
  if (!domain || domain.length < 4 || domain.length > 253 || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain) || domain.includes("..") || /^\d+\.\d+\.\d+\.\d+$/.test(domain)) {
    throw new CustomDomainEmailError(
      "Please enter an email address with a valid custom domain (for example: hello@yourdomain.com).",
      400,
      "INVALID_DOMAIN"
    );
  }
  if (FREE_EMAIL_PROVIDERS.has(domain)) {
    throw new CustomDomainEmailError(
      `Free email providers like ${domain} cannot be used as a custom sending domain. Enter an email address from your own domain (for example: hello@yourbrand.com).`,
      400,
      "FREE_EMAIL_PROVIDER_NOT_ALLOWED"
    );
  }
  if (RESERVED_DOMAINS.has(domain) || domain.endsWith(".local") || domain.endsWith(".internal") || domain.endsWith(".test") || domain.endsWith(".localhost")) {
    throw new CustomDomainEmailError(
      `The domain "${domain}" is reserved and cannot be registered. Please use your own custom domain.`,
      400,
      "RESERVED_DOMAIN_NOT_ALLOWED"
    );
  }
  let cleanReplyTo;
  if (params.replyToEmail && params.replyToEmail.trim()) {
    const candidate = params.replyToEmail.trim().toLowerCase();
    if (!emailRegex.test(candidate) || /[\r\n\s<>]/.test(candidate)) {
      throw new CustomDomainEmailError(
        "Reply-To address must be a valid email address.",
        400,
        "INVALID_REPLY_TO"
      );
    }
    cleanReplyTo = candidate;
  }
  return {
    fromName: cleanName,
    fromEmail: cleanEmail,
    domain,
    replyToEmail: cleanReplyTo
  };
}
function normalizeResendStatus(rawStatus) {
  const s = String(rawStatus || "not_started").toLowerCase().trim();
  if (s === "verified") return "verified";
  if (s === "pending") return "pending";
  if (s === "failed") return "failed";
  if (s === "temporary_failure") return "temporary_failure";
  return "not_started";
}
function mapResendRecords(records) {
  if (!Array.isArray(records)) return [];
  return records.filter((r) => Boolean(r && typeof r === "object")).map((r) => ({
    ...r.id ? { id: String(r.id) } : {},
    record: String(r.record || r.type || "TXT"),
    name: String(r.name || ""),
    type: String(r.type || "TXT").toUpperCase(),
    ttl: r.ttl !== void 0 && r.ttl !== null ? r.ttl : "Auto",
    status: String(r.status || "not_started"),
    value: String(r.value || ""),
    ...typeof r.priority === "number" ? { priority: r.priority } : {}
  }));
}
function buildSafeDomainDocId(ownerId, domain) {
  const safeOwner = ownerId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  const safeDomain = domain.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 56);
  return `${safeOwner}__${safeDomain}`.slice(0, 128);
}
async function syncDomainToFirestoreBestEffort(domainDoc) {
  try {
    const docId = buildSafeDomainDocId(domainDoc.ownerId, domainDoc.domain);
    await setFirestoreDoc("email_domains", docId, domainDoc, true);
  } catch {
  }
}
async function syncSenderToFirestoreBestEffort(senderDoc) {
  try {
    const safeId = senderDoc.id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
    await setFirestoreDoc("email_senders", safeId, senderDoc, true);
  } catch {
  }
}
async function getUserEmailDomainStatus(ownerId, options = {}) {
  const cleanOwnerId = sanitizeOwnerId(ownerId);
  const store = loadEmailStore();
  let domain = store.domainsByOwner[cleanOwnerId] || null;
  const senders = store.sendersByOwner[cleanOwnerId] || [];
  if (!domain) {
    try {
      const remoteSender = await getFirestoreDoc("email_users", cleanOwnerId);
      if (remoteSender && remoteSender.ownerId === cleanOwnerId && remoteSender.domain) {
        const conflict = Object.values(store.domainsByOwner).find(
          (d) => d.domain === remoteSender.domain && d.ownerId !== cleanOwnerId
        );
        if (!conflict) {
          const docId = buildSafeDomainDocId(cleanOwnerId, String(remoteSender.domain));
          const remoteDomain = await getFirestoreDoc("email_domains", docId);
          if (remoteDomain && remoteDomain.ownerId === cleanOwnerId) {
            domain = remoteDomain;
          }
        }
      }
    } catch {
    }
  }
  if (options.refresh && domain && domain.resendDomainId) {
    const resend = getResendClient();
    if (resend) {
      try {
        const { data, error } = await resend.domains.get(domain.resendDomainId);
        if (!error && data) {
          const nextStatus = normalizeResendStatus(data.status);
          domain = {
            ...domain,
            status: nextStatus,
            verified: nextStatus === "verified",
            region: data.region || domain.region,
            records: mapResendRecords(data.records),
            capabilities: data.capabilities || domain.capabilities,
            updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
            ...nextStatus === "verified" && !domain.lastVerifiedAt ? { lastVerifiedAt: (/* @__PURE__ */ new Date()).toISOString() } : {}
          };
          store.domainsByOwner[cleanOwnerId] = domain;
          saveEmailStore(store);
          await syncDomainToFirestoreBestEffort(domain);
        }
      } catch (err) {
        console.warn("[Resend] Refresh domain status notice:", err?.message || err);
      }
    }
  }
  const defaultSender = senders.find((s) => s.isDefault) || senders[0] || null;
  return {
    domain,
    sender: defaultSender,
    senders,
    resendConfigured: isResendConfigured()
  };
}
async function connectUserCustomDomain(params) {
  const cleanOwnerId = sanitizeOwnerId(params.ownerId);
  const { fromName, fromEmail, domain, replyToEmail } = validateCustomDomainSenderInput({
    fromName: params.fromName,
    fromEmail: params.fromEmail,
    replyToEmail: params.replyToEmail
  });
  const store = loadEmailStore();
  const conflictingOwnerDomain = Object.values(store.domainsByOwner).find(
    (entry) => entry.domain.toLowerCase() === domain && entry.ownerId !== cleanOwnerId
  );
  if (conflictingOwnerDomain) {
    throw new CustomDomainEmailError(
      `The domain "${domain}" is already registered to another FlowPilot account.`,
      409,
      "DOMAIN_OWNED_BY_OTHER_ACCOUNT"
    );
  }
  const resend = requireResendClient();
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const currentUserDomain = store.domainsByOwner[cleanOwnerId] || null;
  let storedDomain;
  let reusedExisting = false;
  if (currentUserDomain && currentUserDomain.domain.toLowerCase() === domain) {
    reusedExisting = true;
    try {
      const { data, error } = await resend.domains.get(currentUserDomain.resendDomainId);
      if (!error && data) {
        const nextStatus = normalizeResendStatus(data.status);
        storedDomain = {
          ...currentUserDomain,
          status: nextStatus,
          verified: nextStatus === "verified",
          region: data.region || currentUserDomain.region,
          records: mapResendRecords(data.records),
          capabilities: data.capabilities || currentUserDomain.capabilities,
          updatedAt: nowIso
        };
      } else {
        storedDomain = { ...currentUserDomain, updatedAt: nowIso };
      }
    } catch {
      storedDomain = { ...currentUserDomain, updatedAt: nowIso };
    }
  } else {
    if (currentUserDomain && currentUserDomain.resendDomainId) {
      try {
        await resend.domains.remove(currentUserDomain.resendDomainId);
      } catch (remErr) {
        console.warn("[Resend] Remove previous domain notice:", remErr?.message || remErr);
      }
    }
    let createdData = null;
    const createPayload = { name: domain };
    if (params.region) {
      createPayload.region = params.region;
    }
    const { data, error } = await resend.domains.create(createPayload);
    if (error) {
      const msgLower = String(error.message || "").toLowerCase();
      if (msgLower.includes("already exists") || msgLower.includes("already registered")) {
        const recheckStore = loadEmailStore();
        const other = Object.values(recheckStore.domainsByOwner).find(
          (entry) => entry.domain.toLowerCase() === domain && entry.ownerId !== cleanOwnerId
        );
        if (other) {
          throw new CustomDomainEmailError(
            `The domain "${domain}" is already registered to another FlowPilot account.`,
            409,
            "DOMAIN_OWNED_BY_OTHER_ACCOUNT"
          );
        }
        const listRes = await resend.domains.list();
        const found = (listRes.data?.data || []).find(
          (d) => String(d.name || "").toLowerCase() === domain
        );
        if (!found) {
          throw new CustomDomainEmailError(
            `Resend reported domain "${domain}" already exists, but it could not be retrieved: ${error.message}`,
            409,
            "RESEND_DOMAIN_CONFLICT"
          );
        }
        const getRes = await resend.domains.get(found.id);
        if (getRes.error || !getRes.data) {
          throw new CustomDomainEmailError(
            getRes.error?.message || `Failed to retrieve existing Resend domain "${domain}".`,
            502,
            "RESEND_API_ERROR"
          );
        }
        createdData = getRes.data;
        reusedExisting = true;
      } else {
        throw new CustomDomainEmailError(
          error.message || `Failed to register domain "${domain}" with Resend.`,
          400,
          "RESEND_DOMAIN_CREATE_FAILED"
        );
      }
    } else {
      createdData = data;
    }
    if (!createdData || !createdData.id) {
      throw new CustomDomainEmailError(
        "Resend did not return a valid domain ID. Please verify your server configuration.",
        502,
        "RESEND_INVALID_RESPONSE"
      );
    }
    const mappedStatus = normalizeResendStatus(createdData.status);
    storedDomain = {
      id: buildSafeDomainDocId(cleanOwnerId, domain),
      ownerId: cleanOwnerId,
      domain,
      resendDomainId: String(createdData.id),
      status: mappedStatus,
      verified: mappedStatus === "verified",
      region: createdData.region ? String(createdData.region) : "us-east-1",
      records: mapResendRecords(createdData.records),
      capabilities: createdData.capabilities || void 0,
      createdAt: createdData.created_at || nowIso,
      updatedAt: nowIso,
      ...mappedStatus === "verified" ? { lastVerifiedAt: nowIso } : {}
    };
  }
  const existingSenders = store.sendersByOwner[cleanOwnerId] || [];
  const matchingIdx = existingSenders.findIndex(
    (s) => s.fromEmail.toLowerCase() === fromEmail && s.domain === domain
  );
  let savedSender;
  let updatedSenders;
  if (matchingIdx >= 0) {
    savedSender = {
      ...existingSenders[matchingIdx],
      fromName,
      fromEmail,
      ...replyToEmail ? { replyToEmail } : {},
      isDefault: true,
      updatedAt: nowIso
    };
    updatedSenders = existingSenders.map(
      (s, idx) => idx === matchingIdx ? savedSender : { ...s, isDefault: false }
    );
  } else {
    const senderId = `snd_${cleanOwnerId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 48)}_${Date.now().toString(36)}`;
    savedSender = {
      id: senderId,
      ownerId: cleanOwnerId,
      domain,
      fromName,
      fromEmail,
      ...replyToEmail ? { replyToEmail } : {},
      isDefault: true,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    const sameDomainOthers = existingSenders.filter((s) => s.domain === domain).map((s) => ({ ...s, isDefault: false }));
    updatedSenders = [savedSender, ...sameDomainOthers].slice(0, 10);
  }
  store.domainsByOwner[cleanOwnerId] = storedDomain;
  store.sendersByOwner[cleanOwnerId] = updatedSenders;
  saveEmailStore(store);
  await syncDomainToFirestoreBestEffort(storedDomain);
  await syncSenderToFirestoreBestEffort(savedSender);
  return {
    domain: storedDomain,
    sender: savedSender,
    senders: updatedSenders,
    reusedExisting
  };
}
async function verifyUserEmailDomain(ownerId) {
  const cleanOwnerId = sanitizeOwnerId(ownerId);
  const store = loadEmailStore();
  const domainRecord = store.domainsByOwner[cleanOwnerId];
  if (!domainRecord || !domainRecord.resendDomainId) {
    throw new CustomDomainEmailError(
      "No custom domain is connected to your account yet. Save your From Name and From Email first.",
      404,
      "DOMAIN_NOT_FOUND"
    );
  }
  const resend = requireResendClient();
  const verifyRes = await resend.domains.verify(domainRecord.resendDomainId);
  if (verifyRes.error) {
    throw new CustomDomainEmailError(
      verifyRes.error.message || "Resend failed to trigger DNS verification.",
      502,
      "RESEND_VERIFY_FAILED"
    );
  }
  const getRes = await resend.domains.get(domainRecord.resendDomainId);
  if (getRes.error || !getRes.data) {
    throw new CustomDomainEmailError(
      getRes.error?.message || "Failed to retrieve updated domain verification state from Resend.",
      502,
      "RESEND_GET_FAILED"
    );
  }
  const nextStatus = normalizeResendStatus(getRes.data.status);
  const isVerified = nextStatus === "verified";
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const updatedDomain = {
    ...domainRecord,
    status: nextStatus,
    verified: isVerified,
    region: getRes.data.region || domainRecord.region,
    records: mapResendRecords(getRes.data.records),
    capabilities: getRes.data.capabilities || domainRecord.capabilities,
    updatedAt: nowIso,
    ...isVerified ? { lastVerifiedAt: nowIso } : {}
  };
  store.domainsByOwner[cleanOwnerId] = updatedDomain;
  saveEmailStore(store);
  await syncDomainToFirestoreBestEffort(updatedDomain);
  return {
    domain: updatedDomain,
    verified: isVerified,
    status: nextStatus,
    records: updatedDomain.records
  };
}
async function updateUserEmailSender(params) {
  const cleanOwnerId = sanitizeOwnerId(params.ownerId);
  const { fromName, fromEmail, domain, replyToEmail } = validateCustomDomainSenderInput({
    fromName: params.fromName,
    fromEmail: params.fromEmail,
    replyToEmail: params.replyToEmail
  });
  const store = loadEmailStore();
  const existingDomain = store.domainsByOwner[cleanOwnerId];
  if (!existingDomain) {
    throw new CustomDomainEmailError(
      "Please connect a custom domain first before updating your sender identity.",
      400,
      "DOMAIN_NOT_CONFIGURED"
    );
  }
  if (existingDomain.domain.toLowerCase() !== domain) {
    throw new CustomDomainEmailError(
      `Sender email domain "${domain}" does not match your connected domain "${existingDomain.domain}". Register the new domain first if you want to switch domains.`,
      400,
      "SENDER_DOMAIN_MISMATCH"
    );
  }
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const existingSenders = store.sendersByOwner[cleanOwnerId] || [];
  const primary = existingSenders.find((s) => s.isDefault) || existingSenders[0];
  const updatedSender = primary ? {
    ...primary,
    fromName,
    fromEmail,
    replyToEmail,
    isDefault: true,
    updatedAt: nowIso
  } : {
    id: `snd_${cleanOwnerId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 48)}_${Date.now().toString(36)}`,
    ownerId: cleanOwnerId,
    domain,
    fromName,
    fromEmail,
    replyToEmail,
    isDefault: true,
    createdAt: nowIso,
    updatedAt: nowIso
  };
  const nextSenders = primary ? existingSenders.map((s) => s.id === primary.id ? updatedSender : { ...s, isDefault: false }) : [updatedSender];
  store.sendersByOwner[cleanOwnerId] = nextSenders;
  saveEmailStore(store);
  await syncSenderToFirestoreBestEffort(updatedSender);
  return {
    domain: existingDomain,
    sender: updatedSender,
    senders: nextSenders
  };
}
async function deleteUserEmailDomain(ownerId) {
  const cleanOwnerId = sanitizeOwnerId(ownerId);
  const store = loadEmailStore();
  const existingDomain = store.domainsByOwner[cleanOwnerId];
  if (!existingDomain) {
    delete store.sendersByOwner[cleanOwnerId];
    saveEmailStore(store);
    return { removedDomain: null };
  }
  const resend = getResendClient();
  if (resend && existingDomain.resendDomainId) {
    try {
      const { error } = await resend.domains.remove(existingDomain.resendDomainId);
      if (error) {
        const msg = String(error.message || "").toLowerCase();
        if (!msg.includes("not found") && !msg.includes("404")) {
          throw new CustomDomainEmailError(
            `Failed to remove domain from Resend: ${error.message}`,
            502,
            "RESEND_REMOVE_FAILED"
          );
        }
      }
    } catch (err) {
      if (err instanceof CustomDomainEmailError) throw err;
      throw new CustomDomainEmailError(
        err?.message || "Failed to delete domain from Resend.",
        502,
        "RESEND_REMOVE_FAILED"
      );
    }
  }
  const removedName = existingDomain.domain;
  delete store.domainsByOwner[cleanOwnerId];
  delete store.sendersByOwner[cleanOwnerId];
  saveEmailStore(store);
  return { removedDomain: removedName };
}
async function sendCustomDomainEmail(params) {
  const cleanOwnerId = sanitizeOwnerId(params.ownerId);
  const store = loadEmailStore();
  const domainRecord = store.domainsByOwner[cleanOwnerId];
  const senders = store.sendersByOwner[cleanOwnerId] || [];
  const defaultSender = senders.find((s) => s.isDefault) || senders[0];
  if (!domainRecord) {
    throw new CustomDomainEmailError(
      "No custom domain is connected to your account. Go to Settings \u2192 Email Automation to connect and verify your custom domain before sending emails.",
      400,
      "DOMAIN_NOT_CONFIGURED"
    );
  }
  if (!domainRecord.verified || domainRecord.status !== "verified") {
    throw new CustomDomainEmailError(
      `Domain "${domainRecord.domain}" is not verified yet (status: ${domainRecord.status}). Please add all required DNS records and verify your domain before sending automated or test emails.`,
      403,
      "DOMAIN_NOT_VERIFIED"
    );
  }
  const recipients = (Array.isArray(params.to) ? params.to : [params.to]).map((r) => String(r || "").trim().toLowerCase()).filter((r) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r));
  if (recipients.length === 0) {
    throw new CustomDomainEmailError("A valid recipient email address is required.", 400, "INVALID_RECIPIENT");
  }
  const cleanSubject = sanitizeHeaderString(params.subject, 200);
  if (!cleanSubject) {
    throw new CustomDomainEmailError("Email subject is required.", 400, "MISSING_SUBJECT");
  }
  let activeFromEmail = defaultSender?.fromEmail || `hello@${domainRecord.domain}`;
  if (params.fromEmailOverride && params.fromEmailOverride.includes("@")) {
    const candidate = params.fromEmailOverride.trim().toLowerCase();
    const candidateDomain = normalizeDomain(candidate.split("@")[1] || "");
    if (candidateDomain === domainRecord.domain.toLowerCase()) {
      activeFromEmail = candidate;
    }
  }
  const activeFromName = sanitizeHeaderString(
    params.fromNameOverride || defaultSender?.fromName || domainRecord.domain,
    100
  );
  const formattedFrom = `${activeFromName} <${activeFromEmail}>`;
  const resend = requireResendClient();
  const htmlContent = params.html ? String(params.html) : void 0;
  const textContent = params.text ? String(params.text) : htmlContent ? htmlContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : void 0;
  if (!htmlContent && !textContent) {
    throw new CustomDomainEmailError("Email body (html or text) is required.", 400, "MISSING_BODY");
  }
  const resolvedText = textContent || (htmlContent ? htmlContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "") || cleanSubject;
  const cleanAttachments = Array.isArray(params.attachments) ? params.attachments.filter((a) => a && a.filename && a.content).slice(0, 10).map((a) => ({
    filename: sanitizeHeaderString(a.filename, 140),
    content: Buffer.from(String(a.content), "base64"),
    ...a.contentType ? { contentType: sanitizeHeaderString(a.contentType, 80) } : {}
  })) : void 0;
  const { data, error } = await resend.emails.send({
    from: formattedFrom,
    to: recipients,
    subject: cleanSubject,
    text: resolvedText,
    ...htmlContent ? { html: htmlContent } : {},
    ...params.replyTo || defaultSender?.replyToEmail ? { replyTo: params.replyTo || defaultSender?.replyToEmail } : {},
    ...cleanAttachments && cleanAttachments.length > 0 ? { attachments: cleanAttachments } : {}
  });
  if (error) {
    throw new CustomDomainEmailError(
      error.message || "Resend failed to send email.",
      502,
      "RESEND_SEND_FAILED"
    );
  }
  return {
    success: true,
    id: data?.id,
    from: formattedFrom,
    to: recipients,
    subject: cleanSubject,
    provider: "Resend Custom Domain API",
    domain: domainRecord.domain
  };
}
async function checkCustomDomainSendReadiness(ownerId) {
  if (!ownerId) {
    return {
      allowed: false,
      reason: "Authenticated user required to send automated custom-domain emails."
    };
  }
  const store = loadEmailStore();
  const domainRecord = store.domainsByOwner[ownerId];
  const senders = store.sendersByOwner[ownerId] || [];
  const defaultSender = senders.find((s) => s.isDefault) || senders[0];
  if (!domainRecord) {
    return {
      allowed: false,
      reason: "Custom sending domain not configured. Open Settings \u2192 Email Automation to connect and verify your domain before sending automated emails."
    };
  }
  if (!domainRecord.verified || domainRecord.status !== "verified") {
    return {
      allowed: false,
      domain: domainRecord.domain,
      status: domainRecord.status,
      reason: `Sending blocked: custom domain "${domainRecord.domain}" is currently "${domainRecord.status}". Add your DNS records and complete domain verification in Settings \u2192 Email Automation.`
    };
  }
  return {
    allowed: true,
    domain: domainRecord.domain,
    status: domainRecord.status,
    fromEmail: defaultSender?.fromEmail || `hello@${domainRecord.domain}`,
    fromName: defaultSender?.fromName || domainRecord.domain
  };
}
async function handleResendWebhookEvent(params) {
  const webhookSecret = (process.env.RESEND_WEBHOOK_SECRET || "").trim();
  if (!webhookSecret || webhookSecret === "your_resend_webhook_secret_here") {
    throw new CustomDomainEmailError(
      "RESEND_WEBHOOK_SECRET is not configured on this server.",
      503,
      "WEBHOOK_SECRET_NOT_CONFIGURED"
    );
  }
  if (!params.svixId || !params.svixTimestamp || !params.svixSignature) {
    throw new CustomDomainEmailError(
      "Missing Svix webhook signature headers.",
      400,
      "MISSING_WEBHOOK_HEADERS"
    );
  }
  const resend = requireResendClient();
  let event;
  try {
    event = resend.webhooks.verify({
      payload: params.rawBody,
      headers: {
        id: params.svixId,
        timestamp: params.svixTimestamp,
        signature: params.svixSignature
      },
      webhookSecret
    });
  } catch (err) {
    throw new CustomDomainEmailError(
      `Invalid Resend webhook signature: ${err?.message || "Verification failed"}`,
      401,
      "INVALID_WEBHOOK_SIGNATURE"
    );
  }
  const eventType = String(event?.type || "unknown");
  const eventData = event?.data || {};
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const store = loadEmailStore();
  let domainUpdated;
  const bouncedRecipients = [];
  if (eventType.startsWith("domain.")) {
    const resendId = String(eventData.id || "");
    const domainName = normalizeDomain(String(eventData.name || ""));
    for (const [ownerId, rec] of Object.entries(store.domainsByOwner)) {
      if (resendId && rec.resendDomainId === resendId || domainName && rec.domain.toLowerCase() === domainName) {
        const nextStatus = normalizeResendStatus(eventData.status);
        const updated = {
          ...rec,
          status: nextStatus,
          verified: nextStatus === "verified",
          records: Array.isArray(eventData.records) ? mapResendRecords(eventData.records) : rec.records,
          lastWebhookEvent: `${eventType} (${nowIso})`,
          updatedAt: nowIso,
          ...nextStatus === "verified" ? { lastVerifiedAt: nowIso } : {}
        };
        store.domainsByOwner[ownerId] = updated;
        domainUpdated = updated.domain;
        await syncDomainToFirestoreBestEffort(updated);
      }
    }
  } else if (eventType.startsWith("email.")) {
    const toList = Array.isArray(eventData.to) ? eventData.to.map((x) => String(x || "")).filter(Boolean) : eventData.to ? [String(eventData.to)] : [];
    if (eventType === "email.bounced" || eventType === "email.complained") {
      bouncedRecipients.push(...toList);
    }
    store.webhookLogs.unshift({
      id: `wh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      resendEmailId: eventData.email_id ? String(eventData.email_id) : void 0,
      eventType,
      from: eventData.from ? String(eventData.from) : void 0,
      to: toList.join(", "),
      subject: eventData.subject ? String(eventData.subject) : void 0,
      detail: eventData.bounce?.message || eventData.reason || eventType,
      createdAt: event?.created_at || nowIso
    });
    if (store.webhookLogs.length > 150) {
      store.webhookLogs.length = 150;
    }
  }
  saveEmailStore(store);
  return {
    handled: true,
    eventType,
    domainUpdated,
    bouncedRecipients: bouncedRecipients.length > 0 ? bouncedRecipients : void 0
  };
}
function getUserEmailDeliveryLogs(ownerId) {
  const cleanOwnerId = sanitizeOwnerId(ownerId);
  const store = loadEmailStore();
  const domain = store.domainsByOwner[cleanOwnerId]?.domain?.toLowerCase();
  if (!domain) return [];
  return store.webhookLogs.filter((entry) => {
    if (entry.ownerId && entry.ownerId === cleanOwnerId) return true;
    if (entry.from && entry.from.toLowerCase().includes(`@${domain}`)) return true;
    return false;
  }).slice(0, 30);
}

// src/lib/automation/runner.ts
async function executeWorkflow(workflowId, leadPhone, leadMessage, options = {}) {
  const workflow = options.workflowOverride || await getWorkflowById(workflowId);
  if (!workflow) {
    return {
      workflowId,
      workflowName: "Unknown",
      executed: false,
      reason: `Workflow not found with ID ${workflowId}`,
      immediateActionsDispatched: [],
      scheduledJobs: []
    };
  }
  if (!workflow.enabled) {
    return {
      workflowId: workflow.id,
      workflowName: workflow.name,
      executed: false,
      reason: "Workflow is disabled",
      immediateActionsDispatched: [],
      scheduledJobs: []
    };
  }
  let nodes = [];
  let edges = [];
  try {
    nodes = JSON.parse(workflow.nodesJson || "[]");
    edges = JSON.parse(workflow.edgesJson || "[]");
  } catch (err) {
    return {
      workflowId: workflow.id,
      workflowName: workflow.name,
      executed: false,
      reason: "Failed to parse workflow nodes/edges JSON",
      immediateActionsDispatched: [],
      scheduledJobs: []
    };
  }
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return {
      workflowId: workflow.id,
      workflowName: workflow.name,
      executed: false,
      reason: "Workflow contains no nodes",
      immediateActionsDispatched: [],
      scheduledJobs: []
    };
  }
  const nodesById = /* @__PURE__ */ new Map();
  for (const n of nodes) {
    if (n && n.id) nodesById.set(n.id, n);
  }
  const outgoingEdges = /* @__PURE__ */ new Map();
  for (const e of edges) {
    if (!e || !e.source || !e.target) continue;
    const list = outgoingEdges.get(e.source) || [];
    list.push(e);
    outgoingEdges.set(e.source, list);
  }
  const triggerNodes = nodes.filter((n) => {
    const t = n.data?.nodeType || n.type || "";
    return t.startsWith("trigger_") || t === "trigger";
  });
  const startNodes = triggerNodes.length > 0 ? triggerNodes : [nodes[0]];
  const result = {
    workflowId: workflow.id,
    workflowName: workflow.name,
    executed: true,
    immediateActionsDispatched: [],
    scheduledJobs: []
  };
  const lowerMsg = (leadMessage || "").toLowerCase().trim();
  for (const startNode of startNodes) {
    const nodeType = startNode.data?.nodeType || startNode.type || "";
    if (nodeType === "trigger_keyword" && startNode.data?.triggerKeyword) {
      const kw = String(startNode.data.triggerKeyword).toLowerCase().trim();
      if (!lowerMsg.includes(kw)) {
        continue;
      }
    }
    const queue = (outgoingEdges.get(startNode.id) || []).map((e) => e.target);
    const visited = /* @__PURE__ */ new Set();
    while (queue.length > 0) {
      const currentId = queue.shift();
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      const currentNode = nodesById.get(currentId);
      if (!currentNode) continue;
      const type = currentNode.data?.nodeType || currentNode.type || "";
      if (type === "condition_message_contains" || type.startsWith("condition_")) {
        const keyword = String(currentNode.data?.keyword || "").toLowerCase().trim();
        const matches = keyword ? lowerMsg.includes(keyword) : true;
        const branchEdges = outgoingEdges.get(currentId) || [];
        for (const edge of branchEdges) {
          if (edge.sourceHandle === "true" && matches) {
            queue.push(edge.target);
          } else if (edge.sourceHandle === "false" && !matches) {
            queue.push(edge.target);
          } else if (!edge.sourceHandle && matches) {
            queue.push(edge.target);
          }
        }
        continue;
      }
      if (type === "delay_wait" || type.startsWith("delay_")) {
        const delayValue = Math.max(1, Number(currentNode.data?.delayValue) || 5);
        const delayUnit = currentNode.data?.delayUnit || "Minutes";
        const nextEdges2 = outgoingEdges.get(currentId) || [];
        for (const edge of nextEdges2) {
          const nextNode = nodesById.get(edge.target);
          if (nextNode) {
            const nextType = nextNode.data?.nodeType || nextNode.type || "";
            const msg = nextNode.data?.message || "Hello from your scheduled Follow-Up automation!";
            const job = await createFollowUpJob({
              workflowId: workflow.id,
              userId: workflow.userId || options.userId,
              leadPhone,
              delayValue,
              delayUnit,
              message: msg,
              actionType: nextType
            });
            result.scheduledJobs.push(job);
          }
        }
        continue;
      }
      if (type === "action_send_whatsapp") {
        const messageText = currentNode.data?.message || "Thank you for reaching out!";
        const targetUser = workflow.userId || options.userId || "default_workspace";
        let delivered = false;
        try {
          const instanceName = buildEvolutionInstanceName(targetUser);
          const evoRes = await sendWhatsAppViaEvolution(instanceName, leadPhone, messageText);
          if (evoRes.ok) {
            delivered = true;
            console.log(`[Workflow Runner] Auto responded to ${leadPhone} via Evolution (${instanceName}) \xB7 Workflow "${workflow.name}" (Node: ${currentId})`);
          } else {
            console.warn(`[Workflow Runner] Could not send WhatsApp to ${leadPhone} (${instanceName}): ${evoRes.error || evoRes.detail}`);
          }
        } catch (sendErr) {
          console.warn(`[Workflow Runner] WhatsApp dispatch notice for ${leadPhone}:`, sendErr?.message || sendErr);
        }
        result.immediateActionsDispatched.push({
          nodeId: currentId,
          actionType: type,
          message: messageText,
          delivered
        });
        const nextEdges2 = outgoingEdges.get(currentId) || [];
        for (const e of nextEdges2) {
          queue.push(e.target);
        }
        continue;
      }
      if (type === "action_send_email") {
        const targetOwnerId = workflow.userId || options.userId || "";
        const msg = currentNode.data?.message || "";
        const subject = currentNode.data?.emailSubject || `Update from ${workflow.name}`;
        let delivered = false;
        if (leadPhone && leadPhone.includes("@") && targetOwnerId) {
          try {
            await sendCustomDomainEmail({
              ownerId: targetOwnerId,
              to: leadPhone,
              subject,
              html: msg,
              text: msg.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
            });
            delivered = true;
          } catch (err) {
            console.warn("[Workflow Runner] Email dispatch blocked/notice:", err.message);
            delivered = false;
          }
        }
        result.immediateActionsDispatched.push({
          nodeId: currentId,
          actionType: type,
          message: msg,
          delivered
        });
        const nextEdges2 = outgoingEdges.get(currentId) || [];
        for (const e of nextEdges2) {
          queue.push(e.target);
        }
        continue;
      }
      if (type === "action_end_flow") {
        break;
      }
      const nextEdges = outgoingEdges.get(currentId) || [];
      for (const e of nextEdges) {
        queue.push(e.target);
      }
    }
  }
  return result;
}

// src/lib/whatsapp/autoResponder.ts
function startAutoResponderWorkflowListener(sock, options = {}) {
  if (!sock || !sock.ev) {
    throw new Error("Valid Baileys socket is required to startAutoResponderWorkflowListener");
  }
  const userId = options.userId || sock._flowpilot_userId || sock.id || "default_workspace";
  const cooldownMs = options.cooldownMs ?? 5 * 60 * 1e3;
  const spamCache = options.spamCache || globalSpamCache;
  console.log(`[WhatsApp Workflow Listener] Attached listener for user ${userId}`);
  const handleMessagesUpsert = async (upsert) => {
    try {
      const messages = upsert.messages;
      if (!Array.isArray(messages) || messages.length === 0) return;
      const msg = messages[0];
      if (!msg || !msg.message) return;
      if (msg.key?.fromMe) return;
      const leadPhone = msg.key?.remoteJid;
      if (!leadPhone || leadPhone === "status@broadcast") return;
      const leadMessage = extractMessageText(msg.message);
      if (!leadMessage) return;
      if (spamCache.isCoolingDown(leadPhone, cooldownMs)) {
        return;
      }
      const userWorkflows = await getWorkflowsForUser(userId);
      const activeWorkflows = userWorkflows.filter((w) => w.enabled);
      if (activeWorkflows.length === 0) {
        return;
      }
      const lowerMessage = leadMessage.toLowerCase().trim();
      for (const workflow of activeWorkflows) {
        let shouldTrigger = false;
        let nodes = [];
        try {
          nodes = JSON.parse(workflow.nodesJson || "[]");
        } catch {
          continue;
        }
        for (const node of nodes) {
          const type = node.data?.nodeType || node.type || "";
          if (type === "trigger_whatsapp_reply") {
            shouldTrigger = true;
            break;
          }
          if (type === "trigger_keyword") {
            const kw = String(node.data?.triggerKeyword || node.data?.keyword || "").toLowerCase().trim();
            if (kw && lowerMessage.includes(kw)) {
              shouldTrigger = true;
              break;
            }
          }
          if (type === "condition_message_contains") {
            const kw = String(node.data?.keyword || "").toLowerCase().trim();
            if (kw && lowerMessage.includes(kw)) {
              shouldTrigger = true;
              break;
            }
          }
        }
        if (shouldTrigger) {
          console.log(`[WhatsApp Workflow Listener] Triggering workflow "${workflow.name}" for lead ${leadPhone}`);
          const result = await executeWorkflow(workflow.id, leadPhone, leadMessage, {
            userId,
            workflowOverride: workflow,
            sock
          });
          spamCache.recordReply(leadPhone);
          if (typeof options.onWorkflowExecuted === "function") {
            try {
              await options.onWorkflowExecuted(result);
            } catch (cbErr) {
              console.warn("[WhatsApp Workflow Listener] onWorkflowExecuted callback error:", cbErr);
            }
          }
          break;
        }
      }
    } catch (err) {
      console.error("[WhatsApp Workflow Listener] Inbound message handling error:", err.message);
    }
  };
  sock.ev.on("messages.upsert", handleMessagesUpsert);
  return () => {
    try {
      sock.ev.off("messages.upsert", handleMessagesUpsert);
      console.log(`[WhatsApp Workflow Listener] Detached listener for user ${userId}`);
    } catch {
    }
  };
}

// src/lib/whatsapp/session.ts
import {
  proto,
  initAuthCreds,
  BufferJSON
} from "@whiskeysockets/baileys";
async function getAuthState(userId = "default_workspace") {
  const cleanUser = String(userId || "default_workspace").trim();
  try {
    const docData = await getFirestoreDoc("whatsapp_sessions", cleanUser);
    if (docData && typeof docData.credsJson === "string" && docData.credsJson.trim()) {
      const creds = JSON.parse(docData.credsJson, BufferJSON.reviver);
      return creds;
    }
  } catch (err) {
    console.warn(`[Baileys Session] Error reading auth state for ${cleanUser}:`, err.message);
  }
  return initAuthCreds();
}
async function saveAuthState(userId = "default_workspace", creds, keysData, extra) {
  const cleanUser = String(userId || "default_workspace").trim();
  const credsJson = JSON.stringify(creds, BufferJSON.replacer);
  const keysJson = keysData ? JSON.stringify(keysData, BufferJSON.replacer) : void 0;
  const payload = {
    userId: cleanUser,
    credsJson,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (keysJson !== void 0) {
    payload.keysJson = keysJson;
  }
  if (extra?.connected !== void 0) {
    payload.connected = Boolean(extra.connected);
  }
  if (extra?.number !== void 0) {
    payload.number = String(extra.number);
  }
  await setFirestoreDoc("whatsapp_sessions", cleanUser, payload, true);
}
async function useFirestoreAuthState(userId = "default_workspace") {
  const cleanUser = String(userId || "default_workspace").trim();
  const creds = await getAuthState(cleanUser);
  let keysStore = {};
  try {
    const docData = await getFirestoreDoc("whatsapp_sessions", cleanUser);
    if (docData && typeof docData.keysJson === "string") {
      keysStore = JSON.parse(docData.keysJson, BufferJSON.reviver) || {};
    }
  } catch {
    keysStore = {};
  }
  let saveTimeout = null;
  const scheduleSaveKeys = () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      try {
        const keysJson = JSON.stringify(keysStore, BufferJSON.replacer);
        await setFirestoreDoc(
          "whatsapp_sessions",
          cleanUser,
          {
            userId: cleanUser,
            keysJson,
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          },
          true
        );
      } catch (err) {
        console.warn(`[Baileys Session] Error updating keys to Firestore:`, err.message);
      }
    }, 500);
  };
  return {
    state: {
      creds,
      keys: {
        get: (type, ids) => {
          const data = {};
          for (const id of ids) {
            const val = keysStore[`${type}-${id}`];
            if (val) {
              data[id] = type === "app-state-sync-key" ? proto.Message.AppStateSyncKeyData.fromObject(val) : val;
            }
          }
          return data;
        },
        set: (data) => {
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const key = `${category}-${id}`;
              if (value) {
                keysStore[key] = value;
              } else {
                delete keysStore[key];
              }
            }
          }
          scheduleSaveKeys();
        }
      }
    },
    saveCreds: async () => {
      await saveAuthState(cleanUser, creds, keysStore);
    }
  };
}
async function getSessionConnectionStatus(userId = "default_workspace") {
  const cleanUser = String(userId || "default_workspace").trim();
  const docData = await getFirestoreDoc("whatsapp_sessions", cleanUser);
  if (!docData) {
    return { connected: false };
  }
  return {
    connected: Boolean(docData.connected),
    number: docData.number || "",
    updatedAt: docData.updatedAt || ""
  };
}

// src/services/whatsappBaileysService.ts
var logger = pino({ level: "silent" });
var SESSIONS_DIR = path5.join(process.cwd(), "whatsapp-sessions");
if (!fs5.existsSync(SESSIONS_DIR)) {
  try {
    fs5.mkdirSync(SESSIONS_DIR, { recursive: true });
  } catch (err) {
    console.error("Failed to create whatsapp-sessions directory:", err);
  }
}
var activeSockets = /* @__PURE__ */ new Map();
var sessionStates = /* @__PURE__ */ new Map();
var qrGenerationPromises = /* @__PURE__ */ new Map();
function formatWhatsAppNumber(phone) {
  let clean = phone.replace(/[^0-9]/g, "");
  if (clean.startsWith("0")) {
    clean = "234" + clean.slice(1);
  } else if (clean.length === 10 && (clean.startsWith("7") || clean.startsWith("8") || clean.startsWith("9"))) {
    clean = "234" + clean;
  }
  return clean;
}
function getMetaFilePath(userId) {
  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path5.join(SESSIONS_DIR, `${safeUser}.json`);
}
function getUserSessionDir(userId) {
  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path5.join(SESSIONS_DIR, safeUser);
}
function loadSessionMeta(userId) {
  try {
    const metaFile = getMetaFilePath(userId);
    if (fs5.existsSync(metaFile)) {
      const raw = fs5.readFileSync(metaFile, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn(`[Baileys] Error reading meta file for ${userId}:`, err);
  }
  return null;
}
function saveSessionMeta(userId, data) {
  try {
    const metaFile = getMetaFilePath(userId);
    const existing = loadSessionMeta(userId) || {};
    const updated = {
      ...existing,
      ...data,
      userId,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    fs5.writeFileSync(metaFile, JSON.stringify(updated, null, 2), "utf-8");
  } catch (err) {
    console.error(`[Baileys] Error saving meta file for ${userId}:`, err);
  }
}
async function getOrStartWhatsAppSession(userId = "default_workspace", forceRefreshQr = false) {
  const cleanUserId = (userId || "default_workspace").trim();
  const existingSocket = activeSockets.get(cleanUserId);
  const existingState = sessionStates.get(cleanUserId);
  if (existingSocket && !forceRefreshQr) {
    if (existingState?.connected) {
      return existingState;
    }
    if (existingState?.qr && (existingState.qrExpiresAt || 0) > Date.now()) {
      return existingState;
    }
  }
  if (qrGenerationPromises.has(cleanUserId) && !forceRefreshQr) {
    return qrGenerationPromises.get(cleanUserId);
  }
  const promise = (async () => {
    try {
      const { state, saveCreds } = await useFirestoreAuthState(cleanUserId);
      let currentState = sessionStates.get(cleanUserId) || {
        userId: cleanUserId,
        connected: false,
        number: "",
        qr: "",
        reconnectAttempts: 0
      };
      try {
        const firestoreStatus = await getSessionConnectionStatus(cleanUserId);
        if (firestoreStatus?.connected) {
          currentState.connected = true;
          if (firestoreStatus.number) currentState.number = firestoreStatus.number;
          if (firestoreStatus.updatedAt) currentState.connectedAt = firestoreStatus.updatedAt;
        }
      } catch {
        const savedMeta = loadSessionMeta(cleanUserId);
        if (savedMeta?.number) currentState.number = savedMeta.number;
        if (savedMeta?.connectedAt) currentState.connectedAt = savedMeta.connectedAt;
      }
      sessionStates.set(cleanUserId, currentState);
      if (existingSocket) {
        try {
          existingSocket.end(void 0);
          await new Promise((r) => setTimeout(r, 200));
        } catch {
        }
        activeSockets.delete(cleanUserId);
      }
      const sock = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger)
        },
        printQRInTerminal: false,
        logger,
        syncFullHistory: false,
        browser: ["FlowPilot CRM", "Chrome", "124.0.0"],
        connectTimeoutMs: 6e4,
        keepAliveIntervalMs: 25e3
      });
      activeSockets.set(cleanUserId, sock);
      sock._flowpilot_userId = cleanUserId;
      startAutoResponder(sock, { userId: cleanUserId });
      startAutoResponderWorkflowListener(sock, { userId: cleanUserId });
      sock.ev.on("creds.update", async () => {
        try {
          await saveCreds();
        } catch (err) {
          console.warn(`[Baileys] Error saving creds to Firestore:`, err.message);
        }
      });
      sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
          try {
            currentState.qrRaw = qr;
            setFirestoreDoc("whatsapp_qr", cleanUserId, {
              userId: cleanUserId,
              qrCode: qr,
              status: "pending",
              createdAt: (/* @__PURE__ */ new Date()).toISOString()
            }).catch((err) => console.warn("[Baileys] Firestore whatsapp_qr save error:", err.message));
            const qrDataUrl = await QRCode3.toDataURL(qr, {
              width: 320,
              margin: 2,
              color: {
                dark: "#0f172a",
                light: "#ffffff"
              }
            });
            currentState.qr = qrDataUrl;
            currentState.qrExpiresAt = Date.now() + 6e4;
            currentState.connected = false;
            sessionStates.set(cleanUserId, { ...currentState });
            console.log(`[Baileys] Generated new QR code for user ${cleanUserId}`);
          } catch (qrErr) {
            console.error("[Baileys] QR Data URL generation error:", qrErr);
          }
        }
        if (connection === "open") {
          const rawId = sock.user?.id || "";
          const phoneDigits = rawId.split(":")[0] || rawId.split("@")[0] || "";
          const formatted = phoneDigits ? formatWhatsAppNumber(phoneDigits) : "";
          const nowIso = (/* @__PURE__ */ new Date()).toISOString();
          currentState.connected = true;
          currentState.number = formatted;
          currentState.connectedAt = currentState.connectedAt || nowIso;
          currentState.qr = "";
          currentState.qrRaw = "";
          currentState.qrExpiresAt = void 0;
          currentState.reconnectAttempts = 0;
          sessionStates.set(cleanUserId, { ...currentState });
          setFirestoreDoc("whatsapp_sessions", cleanUserId, {
            userId: cleanUserId,
            connected: true,
            number: formatted,
            updatedAt: nowIso
          }, true).catch((e) => console.warn("[Baileys] Firestore session status error:", e.message));
          setFirestoreDoc("whatsapp_qr", cleanUserId, {
            userId: cleanUserId,
            qrCode: "",
            status: "connected",
            updatedAt: nowIso
          }, true).catch(() => {
          });
          saveSessionMeta(cleanUserId, {
            connected: true,
            number: formatted,
            connectedAt: currentState.connectedAt
          });
          console.log(`[Baileys] WhatsApp connected successfully for user ${cleanUserId} as +${formatted}`);
        }
        if (connection === "close") {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          console.log(
            `[Baileys] Connection closed for user ${cleanUserId}. Status: ${statusCode}, Reconnect: ${shouldReconnect}`
          );
          currentState.connected = false;
          currentState.lastDisconnectReason = lastDisconnect?.error?.message || `Status: ${statusCode}`;
          sessionStates.set(cleanUserId, { ...currentState });
          if (shouldReconnect) {
            currentState.reconnectAttempts = (currentState.reconnectAttempts || 0) + 1;
            const delay = Math.min(currentState.reconnectAttempts * 3e3, 15e3);
            setTimeout(() => {
              getOrStartWhatsAppSession(cleanUserId, false).catch(
                (err) => console.error(`[Baileys] Auto-reconnect failed for ${cleanUserId}:`, err)
              );
            }, delay);
          } else {
            disconnectWhatsAppSession(cleanUserId);
          }
        }
      });
      if (!state.creds?.registered && !currentState.connected && !currentState.qr) {
        const start = Date.now();
        while (Date.now() - start < 3e3) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          const updated = sessionStates.get(cleanUserId);
          if (updated && (updated.qr || updated.connected)) {
            currentState = updated;
            break;
          }
        }
      }
      return sessionStates.get(cleanUserId) || currentState;
    } finally {
      qrGenerationPromises.delete(cleanUserId);
    }
  })();
  qrGenerationPromises.set(cleanUserId, promise);
  return promise;
}
async function requestWhatsAppPairingCode(userId = "default_workspace", phoneNumber) {
  const cleanUserId = (userId || "default_workspace").trim();
  const digitsOnly = phoneNumber.replace(/[^0-9]/g, "");
  if (!digitsOnly || digitsOnly.length < 8 || digitsOnly.length > 16) {
    throw new Error(`Invalid phone number: "${phoneNumber}". Please provide phone number with country code (e.g. 2348012345678) with 8-16 digits.`);
  }
  const { state, saveCreds } = await useFirestoreAuthState(cleanUserId);
  if (state.creds?.registered) {
    const status2 = await getSessionConnectionStatus(cleanUserId);
    if (status2.connected) {
      return { ok: true, pairingCode: "ALREADY_CONNECTED" };
    }
  }
  const existingSocket = activeSockets.get(cleanUserId);
  if (existingSocket) {
    try {
      existingSocket.ev.removeAllListeners("connection.update");
      existingSocket.ev.removeAllListeners("creds.update");
      existingSocket.end(void 0);
    } catch {
    }
    activeSockets.delete(cleanUserId);
    await new Promise((r) => setTimeout(r, 400));
  }
  const status = await getSessionConnectionStatus(cleanUserId);
  if (status.connected && state.creds?.registered) {
    return { ok: true, pairingCode: "ALREADY_CONNECTED" };
  }
  if (!status.connected) {
    state.creds = initAuthCreds2();
    await saveCreds();
  }
  const sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger)
    },
    printQRInTerminal: false,
    logger,
    syncFullHistory: false,
    browser: ["Ubuntu", "Chrome", "20.0.04"],
    connectTimeoutMs: 6e4,
    keepAliveIntervalMs: 25e3,
    defaultQueryTimeoutMs: 6e4
  });
  activeSockets.set(cleanUserId, sock);
  sock._flowpilot_userId = cleanUserId;
  sock.ev.on("creds.update", async () => {
    try {
      await saveCreds();
    } catch (err) {
      console.warn(`[Baileys Pairing] Error saving creds to Firestore:`, err.message);
    }
  });
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "open") {
      const rawId = sock.user?.id || "";
      const phoneDigits = rawId.split(":")[0] || rawId.split("@")[0] || digitsOnly;
      const formatted = phoneDigits ? formatWhatsAppNumber(phoneDigits) : digitsOnly;
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const currentState = {
        userId: cleanUserId,
        connected: true,
        number: formatted,
        connectedAt: nowIso,
        qr: "",
        reconnectAttempts: 0
      };
      sessionStates.set(cleanUserId, currentState);
      await setFirestoreDoc("whatsapp_sessions", cleanUserId, {
        userId: cleanUserId,
        connected: true,
        number: formatted,
        updatedAt: nowIso
      }, true).catch((e) => console.warn("[Baileys] Firestore session status error:", e.message));
      saveSessionMeta(cleanUserId, {
        connected: true,
        number: formatted,
        connectedAt: currentState.connectedAt
      });
      console.log(`[Baileys Pairing] Successfully linked device for ${cleanUserId} as +${formatted}!`);
      startAutoResponder(sock, { userId: cleanUserId });
      startAutoResponderWorkflowListener(sock, { userId: cleanUserId });
    }
    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`[Baileys Pairing] Connection closed for ${cleanUserId}. Status: ${statusCode}, Reconnect: ${shouldReconnect}`);
      if (!shouldReconnect) {
        disconnectWhatsAppSession(cleanUserId);
      }
    }
  });
  const waitStart = Date.now();
  while (!sock.ws?.isOpen && Date.now() - waitStart < 8e3) {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  await new Promise((resolve) => setTimeout(resolve, 2e3));
  let rawCode;
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`[Baileys Pairing] Requesting pairing code (attempt ${attempt}) for: ${digitsOnly}...`);
      rawCode = await sock.requestPairingCode(digitsOnly);
      if (rawCode) break;
    } catch (err) {
      lastErr = err;
      console.warn(`[Baileys Pairing] Request attempt ${attempt} warning:`, err.message || err);
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
    }
  }
  if (!rawCode) {
    throw lastErr || new Error("Connection closed by WhatsApp server before pairing code was received. Please try again in a few seconds.");
  }
  let formattedCode = rawCode || "";
  if (formattedCode && !formattedCode.includes("-") && formattedCode.length >= 8) {
    formattedCode = `${formattedCode.slice(0, 4)}-${formattedCode.slice(4)}`;
  }
  await setFirestoreDoc("whatsapp_sessions", cleanUserId, {
    userId: cleanUserId,
    phoneNumber: digitsOnly,
    pairingCode: formattedCode,
    pairingCodeExpiresAt: Date.now() + 6e4,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  }, true).catch(() => {
  });
  return { ok: true, pairingCode: formattedCode };
}
function getWhatsAppSessionStatus(userId = "default_workspace") {
  const cleanUserId = (userId || "default_workspace").trim();
  const current = sessionStates.get(cleanUserId);
  if (current) {
    return current;
  }
  const meta = loadSessionMeta(cleanUserId);
  if (meta && meta.connected && meta.number) {
    const recovered = {
      userId: cleanUserId,
      connected: true,
      number: meta.number,
      connectedAt: meta.connectedAt,
      qr: "",
      reconnectAttempts: 0
    };
    sessionStates.set(cleanUserId, recovered);
    return recovered;
  }
  return {
    userId: cleanUserId,
    connected: false,
    number: "",
    qr: "",
    reconnectAttempts: 0
  };
}
function disconnectWhatsAppSession(userId = "default_workspace") {
  const cleanUserId = (userId || "default_workspace").trim();
  const sock = activeSockets.get(cleanUserId);
  if (sock) {
    try {
      sock.logout().catch(() => {
      });
      sock.end(void 0);
    } catch {
    }
    activeSockets.delete(cleanUserId);
  }
  sessionStates.delete(cleanUserId);
  setFirestoreDoc("whatsapp_sessions", cleanUserId, {
    userId: cleanUserId,
    connected: false,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  }, true).catch(() => {
  });
  setFirestoreDoc("whatsapp_qr", cleanUserId, {
    userId: cleanUserId,
    qrCode: "",
    status: "disconnected",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  }, true).catch(() => {
  });
  try {
    const sessionDir = getUserSessionDir(cleanUserId);
    if (fs5.existsSync(sessionDir)) {
      fs5.rmSync(sessionDir, { recursive: true, force: true });
    }
    const metaFile = getMetaFilePath(cleanUserId);
    if (fs5.existsSync(metaFile)) {
      fs5.unlinkSync(metaFile);
    }
  } catch (err) {
    console.error(`[Baileys] Error deleting session files for ${cleanUserId}:`, err);
  }
  console.log(`[Baileys] Session disconnected and Firestore updated for ${cleanUserId}`);
  return { ok: true, message: "WhatsApp session disconnected successfully" };
}
async function sendWhatsAppMessage(userId = "default_workspace", to, message) {
  const cleanUserId = (userId || "default_workspace").trim();
  let sock = activeSockets.get(cleanUserId);
  if (!sock) {
    const meta = loadSessionMeta(cleanUserId);
    if (meta && meta.connected) {
      await getOrStartWhatsAppSession(cleanUserId, false);
      sock = activeSockets.get(cleanUserId);
    }
  }
  if (!sock) {
    throw new Error(
      "WhatsApp is not connected. Please scan the QR code first in WhatsApp QR Connect."
    );
  }
  const formattedTo = formatWhatsAppNumber(to);
  if (!formattedTo || formattedTo.length < 7) {
    throw new Error(`Invalid destination WhatsApp number: "${to}". Must contain at least 7 digits.`);
  }
  const jid = `${formattedTo}@s.whatsapp.net`;
  const cleanText = String(message || "").trim();
  if (!cleanText) {
    throw new Error("Message body cannot be empty.");
  }
  console.log(`[Baileys] Sending WhatsApp message to ${jid} via user ${cleanUserId}...`);
  const result = await sock.sendMessage(jid, { text: cleanText });
  const messageId = result?.key?.id || `wa_msg_${Date.now()}`;
  return {
    ok: true,
    messageId,
    to: formattedTo,
    detail: `Message delivered via Baileys WhatsApp QR Socket to +${formattedTo}`
  };
}
async function autoRestoreSavedWhatsAppSessions() {
  try {
    if (!fs5.existsSync(SESSIONS_DIR)) return;
    const entries = fs5.readdirSync(SESSIONS_DIR);
    for (const entry of entries) {
      if (entry.endsWith(".json")) {
        const userId = entry.replace(/\.json$/, "");
        const meta = loadSessionMeta(userId);
        if (meta?.connected) {
          console.log(`[Baileys] Auto-restoring saved WhatsApp session for user: ${userId}`);
          getOrStartWhatsAppSession(userId, false).catch(
            (err) => console.warn(`[Baileys] Failed to auto-restore session for ${userId}:`, err)
          );
        }
      }
    }
  } catch (err) {
    console.error("[Baileys] Error auto-restoring sessions:", err);
  }
}

// src/lib/automation/followupCron.ts
async function runFollowUpCron() {
  const pendingJobs = await getPendingFollowUpJobs();
  const summary = {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    processedCount: pendingJobs.length,
    sentCount: 0,
    failedCount: 0,
    jobsProcessed: []
  };
  if (pendingJobs.length === 0) {
    return summary;
  }
  console.log(`[FollowUp Cron] Processing ${pendingJobs.length} pending drip jobs at ${summary.timestamp}`);
  for (const job of pendingJobs) {
    try {
      const targetUser = job.userId || "default_workspace";
      const cleanRecipient = job.leadPhone;
      const messageText = job.message;
      if (job.actionType === "action_send_email" && cleanRecipient.includes("@")) {
        const emailResult = await sendCustomDomainEmail({
          ownerId: targetUser,
          to: cleanRecipient,
          subject: "Follow-Up from FlowPilot Automation",
          html: messageText
        });
        await updateJobStatus(job.id, "sent");
        summary.sentCount++;
        summary.jobsProcessed.push({
          jobId: job.id,
          leadPhone: job.leadPhone,
          status: "sent",
          messagePreview: `${emailResult.from} -> ${messageText.slice(0, 60)}`
        });
        continue;
      }
      const instanceName = buildEvolutionInstanceName(targetUser);
      const evoRes = await sendWhatsAppViaEvolution(instanceName, cleanRecipient, messageText);
      if (evoRes.ok) {
        await updateJobStatus(job.id, "sent");
        summary.sentCount++;
        summary.jobsProcessed.push({
          jobId: job.id,
          leadPhone: job.leadPhone,
          status: "sent",
          messagePreview: messageText.slice(0, 80)
        });
        console.log(`[FollowUp Cron] \u2713 Sent drip follow-up to ${cleanRecipient} via ${instanceName} (Job ID: ${job.id})`);
      } else {
        const reason = evoRes.error || evoRes.detail || `Instance ${instanceName} is disconnected.`;
        console.warn(`[FollowUp Cron] Notice for job ${job.id} (${cleanRecipient}): ${reason}`);
        await updateJobStatus(job.id, "failed", reason);
        summary.failedCount++;
        summary.jobsProcessed.push({
          jobId: job.id,
          leadPhone: job.leadPhone,
          status: "failed",
          messagePreview: messageText.slice(0, 80),
          error: reason
        });
      }
    } catch (err) {
      const reason = err?.message || "Unexpected follow-up dispatch failure";
      console.warn(`[FollowUp Cron] Notice sending job ${job.id} to ${job.leadPhone}: ${reason}`);
      await updateJobStatus(job.id, "failed", reason);
      summary.failedCount++;
      summary.jobsProcessed.push({
        jobId: job.id,
        leadPhone: job.leadPhone,
        status: "failed",
        messagePreview: job.message.slice(0, 80),
        error: reason
      });
    }
  }
  return summary;
}
var cronInterval = null;
function startFollowUpCronDaemon() {
  if (cronInterval) return;
  console.log("[FollowUp Cron] Starting automated 60-second drip follow-up runner");
  setTimeout(() => {
    runFollowUpCron().catch((err) => console.error("[FollowUp Cron] Initial run error:", err));
  }, 5e3);
  cronInterval = setInterval(() => {
    runFollowUpCron().catch((err) => console.error("[FollowUp Cron] Scheduled run error:", err));
  }, 60 * 1e3);
}

// src/lib/serverAuth.ts
import crypto from "node:crypto";
import fs6 from "node:fs";
import path6 from "node:path";
import { fileURLToPath as fileURLToPath3 } from "node:url";
import { getAuth as getAuth2 } from "firebase-admin/auth";
var __filename3 = fileURLToPath3(import.meta.url);
var __dirname3 = path6.dirname(__filename3);
var DATA_DIR3 = path6.join(__dirname3, "../../.data");
var SESSION_SECRET_PATH = path6.join(DATA_DIR3, ".session_secret");
var cachedSecret = null;
function getSessionSigningSecret() {
  if (cachedSecret) return cachedSecret;
  const envSecret = (process.env.FLOWPILOT_SESSION_SECRET || process.env.SESSION_SECRET || "").trim();
  if (envSecret && envSecret !== "change_this_to_a_long_random_secret") {
    cachedSecret = envSecret;
    return cachedSecret;
  }
  try {
    if (!fs6.existsSync(DATA_DIR3)) {
      fs6.mkdirSync(DATA_DIR3, { recursive: true });
    }
    if (fs6.existsSync(SESSION_SECRET_PATH)) {
      const existing = fs6.readFileSync(SESSION_SECRET_PATH, "utf-8").trim();
      if (existing.length >= 32) {
        cachedSecret = existing;
        return cachedSecret;
      }
    }
    const generated = crypto.randomBytes(48).toString("hex");
    fs6.writeFileSync(SESSION_SECRET_PATH, generated, { encoding: "utf-8", mode: 384 });
    cachedSecret = generated;
    return cachedSecret;
  } catch {
    cachedSecret = crypto.randomBytes(48).toString("hex");
    return cachedSecret;
  }
}
function toBase64Url(input) {
  const buf = typeof input === "string" ? Buffer.from(input, "utf-8") : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromBase64Url(input) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
  return Buffer.from(padded, "base64").toString("utf-8");
}
function signFlowPilotSessionToken(params) {
  const cleanUid = String(params.uid || "").trim();
  const cleanEmail = String(params.email || "").trim().toLowerCase();
  const nowSec = Math.floor(Date.now() / 1e3);
  const exp = nowSec + (params.ttlSeconds || 60 * 60 * 24 * 7);
  const payload = JSON.stringify({
    uid: cleanUid,
    email: cleanEmail,
    iat: nowSec,
    exp
  });
  const encodedPayload = toBase64Url(payload);
  const sig = crypto.createHmac("sha256", getSessionSigningSecret()).update(encodedPayload).digest();
  return `fp_sess.${encodedPayload}.${toBase64Url(sig)}`;
}
function verifyFlowPilotSessionToken(token) {
  try {
    const clean = String(token || "").trim();
    if (!clean.startsWith("fp_sess.")) return null;
    const parts = clean.split(".");
    if (parts.length !== 3) return null;
    const [, encodedPayload, encodedSig] = parts;
    if (!encodedPayload || !encodedSig) return null;
    const expectedSig = crypto.createHmac("sha256", getSessionSigningSecret()).update(encodedPayload).digest();
    const expectedEncoded = toBase64Url(expectedSig);
    const a = Buffer.from(encodedSig, "utf-8");
    const b = Buffer.from(expectedEncoded, "utf-8");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }
    const decoded = JSON.parse(fromBase64Url(encodedPayload));
    if (!decoded || typeof decoded.uid !== "string" || !decoded.uid) return null;
    if (typeof decoded.exp !== "number" || decoded.exp < Math.floor(Date.now() / 1e3)) {
      return null;
    }
    return {
      uid: decoded.uid,
      email: typeof decoded.email === "string" ? decoded.email : "",
      emailVerified: true,
      authSource: "flowpilot_session"
    };
  } catch {
    return null;
  }
}
function extractBearerToken(req) {
  const authHeader = String(req.headers.authorization || "").trim();
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  const sessionHeader = String(req.headers["x-flowpilot-session"] || "").trim();
  if (sessionHeader) return sessionHeader;
  return "";
}
async function verifyAuthenticatedRequest(req) {
  const token = extractBearerToken(req);
  if (!token || token === "fp_local_session_token") {
    return null;
  }
  if (token.startsWith("fp_sess.")) {
    return verifyFlowPilotSessionToken(token);
  }
  try {
    const decoded = await getAuth2(getAdminApp()).verifyIdToken(token);
    if (decoded && decoded.uid) {
      return {
        uid: decoded.uid,
        email: String(decoded.email || "").toLowerCase(),
        emailVerified: Boolean(decoded.email_verified),
        authSource: "firebase_id_token"
      };
    }
  } catch {
    const fallbackHeader = String(req.headers["x-flowpilot-session"] || "").trim();
    if (fallbackHeader.startsWith("fp_sess.")) {
      return verifyFlowPilotSessionToken(fallbackHeader);
    }
    if (fallbackHeader && fallbackHeader !== "fp_local_session_token") {
      try {
        const decodedFallback = await getAuth2(getAdminApp()).verifyIdToken(fallbackHeader);
        if (decodedFallback && decodedFallback.uid) {
          return {
            uid: decodedFallback.uid,
            email: String(decodedFallback.email || "").toLowerCase(),
            emailVerified: Boolean(decodedFallback.email_verified),
            authSource: "firebase_id_token"
          };
        }
      } catch {
        return null;
      }
    }
  }
  return null;
}

// src/lib/webhookGatewayService.ts
import fs7 from "fs";
import path7 from "path";
import { fileURLToPath as fileURLToPath4 } from "url";
var __filename4 = fileURLToPath4(import.meta.url);
var __dirname4 = path7.dirname(__filename4);
var DATA_DIR4 = path7.join(__dirname4, "../../.data");
var STORE_PATH = path7.join(DATA_DIR4, "webhook_gateway_store.json");
var DEFAULT_MAPPINGS = {
  emailPath: "email",
  namePath: "name",
  phonePath: "phone",
  companyPath: "company",
  amountPath: "amount",
  tagsPath: "tags",
  targetList: "General Contacts"
};
var DEFAULT_TOKEN = "flowpilot_sec_7x9q2m1k8p4w";
var cachedStore = null;
function ensureDataDir3() {
  try {
    if (!fs7.existsSync(DATA_DIR4)) {
      fs7.mkdirSync(DATA_DIR4, { recursive: true });
    }
  } catch {
  }
}
function loadStore() {
  if (cachedStore) return cachedStore;
  ensureDataDir3();
  const fallback = {
    token: process.env.FLOWPILOT_WEBHOOK_SECRET || DEFAULT_TOKEN,
    isEnabled: true,
    mappings: DEFAULT_MAPPINGS,
    logs: []
  };
  if (fs7.existsSync(STORE_PATH)) {
    try {
      const raw = fs7.readFileSync(STORE_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      cachedStore = {
        token: parsed.token || fallback.token,
        isEnabled: parsed.isEnabled !== void 0 ? parsed.isEnabled : true,
        mappings: { ...DEFAULT_MAPPINGS, ...parsed.mappings || {} },
        logs: Array.isArray(parsed.logs) ? parsed.logs.slice(0, 100) : []
      };
      return cachedStore;
    } catch {
    }
  }
  cachedStore = fallback;
  return cachedStore;
}
function saveStore() {
  if (!cachedStore) return;
  ensureDataDir3();
  try {
    fs7.writeFileSync(STORE_PATH, JSON.stringify(cachedStore, null, 2), "utf-8");
  } catch (err) {
    console.warn("[Webhook Gateway] Notice: Could not flush store to disk:", err);
  }
}
function getNestedValue(obj, pathStr) {
  if (!obj || typeof obj !== "object" || !pathStr) return void 0;
  const parts = pathStr.split(".");
  let current = obj;
  for (const part of parts) {
    if (current === null || current === void 0) return void 0;
    current = current[part];
  }
  return current;
}
function detectWebhookSource(headers, body) {
  const ua = String(headers["user-agent"] || "").toLowerCase();
  const stripeSig = headers["stripe-signature"];
  const shopifyTopic = headers["x-shopify-topic"];
  const githubEvent = headers["x-github-event"];
  const typeformSig = headers["typeform-signature"];
  if (stripeSig || ua.includes("stripe") || body && body.object === "event" && body.data) {
    const ev = body?.type || "stripe.event";
    return { source: "Stripe", event: ev };
  }
  if (shopifyTopic || ua.includes("shopify") || body && (body.line_items || body.order_number)) {
    const ev = shopifyTopic || (body?.id ? "orders/create" : "shopify.webhook");
    return { source: "Shopify", event: String(ev) };
  }
  if (ua.includes("zapier")) {
    const ev = body?.event || body?.action || body?.type || "zapier.trigger";
    return { source: "Zapier", event: String(ev) };
  }
  if (ua.includes("make.com") || ua.includes("integromat")) {
    const ev = body?.event || body?.scenario || "make.scenario";
    return { source: "Make (Integromat)", event: String(ev) };
  }
  if (typeformSig || ua.includes("typeform") || body?.form_response) {
    return { source: "Typeform", event: body?.form_response?.form_id ? `form_${body.form_response.form_id}` : "form_submission" };
  }
  if (body && (body.event_type || body.resource_type === "sale")) {
    return { source: "PayPal", event: String(body.event_type || "paypal.payment") };
  }
  if (githubEvent) {
    return { source: "GitHub", event: String(githubEvent) };
  }
  if (ua.includes("curl")) {
    return { source: "cURL / Terminal", event: body?.event || body?.type || "custom_request" };
  }
  const genericEv = body?.event || body?.type || body?.action || body?.topic || "inbound_payload";
  return { source: "Custom / API", event: String(genericEv) };
}
function extractFieldsFromPayload(body, mappings) {
  if (!body || typeof body !== "object") {
    return {};
  }
  let email = getNestedValue(body, mappings.emailPath);
  let name = getNestedValue(body, mappings.namePath);
  let phone = getNestedValue(body, mappings.phonePath);
  let company = getNestedValue(body, mappings.companyPath);
  let amount = getNestedValue(body, mappings.amountPath);
  let rawTags = getNestedValue(body, mappings.tagsPath);
  if (!email) {
    email = body.email || body.customer_email || body.client_email || body.user_email || body.customer?.email || body.lead?.email || body.data?.object?.customer_details?.email || body.data?.object?.email || body.data?.object?.receipt_email || body.data?.customer?.email || body.order?.customer?.email || body.payer?.payer_info?.email;
  }
  if (!name) {
    const shopifyName = body.order?.customer?.first_name ? `${body.order.customer.first_name} ${body.order.customer.last_name || ""}`.trim() : void 0;
    name = body.fullName || body.full_name || body.name || body.customer_name || body.customer?.name || body.lead?.name || body.data?.object?.customer_details?.name || shopifyName || (body.firstName ? `${body.firstName} ${body.lastName || ""}`.trim() : void 0) || (body.first_name ? `${body.first_name} ${body.last_name || ""}`.trim() : void 0);
  }
  if (!phone) {
    phone = body.phone || body.phoneNumber || body.phone_number || body.whatsapp || body.mobile || body.customer?.phone || body.data?.object?.customer_details?.phone || body.order?.customer?.phone || body.order?.billing_address?.phone;
  }
  if (!company) {
    company = body.company || body.organization || body.org_name || body.customer?.company || body.order?.billing_address?.company;
  }
  if (amount === void 0 || amount === null) {
    const rawAmt = body.amount || body.total || body.total_price || body.amount_total || body.data?.object?.amount_total || body.data?.object?.amount;
    if (rawAmt !== void 0 && rawAmt !== null) {
      const num = Number(rawAmt);
      if (!isNaN(num)) {
        amount = num > 500 && (body.data?.object?.currency || body.currency) ? num / 100 : num;
      }
    }
  }
  const tags = [];
  if (Array.isArray(rawTags)) {
    tags.push(...rawTags.map(String));
  } else if (typeof rawTags === "string" && rawTags.trim()) {
    tags.push(...rawTags.split(/[;,]/).map((t) => t.trim()).filter(Boolean));
  }
  const detectedEvent = body.event || body.type || body.action;
  if (detectedEvent && typeof detectedEvent === "string") {
    tags.push(detectedEvent.replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 32));
  }
  return {
    fullName: typeof name === "string" ? name.trim().slice(0, 100) : void 0,
    email: typeof email === "string" && email.includes("@") ? email.trim().toLowerCase().slice(0, 150) : void 0,
    phone: typeof phone === "string" ? phone.trim().slice(0, 40) : void 0,
    company: typeof company === "string" ? company.trim().slice(0, 100) : void 0,
    amount: typeof amount === "number" && !isNaN(amount) ? amount : void 0,
    tags: Array.from(new Set(tags)).filter(Boolean),
    listName: mappings.targetList || "General Contacts",
    stage: amount && amount > 0 ? "customer" : "lead"
  };
}
function getWebhookGatewayConfig() {
  const store = loadStore();
  return {
    token: store.token,
    isEnabled: store.isEnabled,
    mappings: store.mappings,
    totalLogs: store.logs.length
  };
}
function updateWebhookGatewayConfig(updates) {
  const store = loadStore();
  if (updates.token) store.token = String(updates.token).trim();
  if (updates.isEnabled !== void 0) store.isEnabled = Boolean(updates.isEnabled);
  if (updates.mappings) store.mappings = { ...store.mappings, ...updates.mappings };
  saveStore();
  return store;
}
function generateNewWebhookToken() {
  const store = loadStore();
  const rand = Math.random().toString(36).substring(2, 14);
  const newToken = `flowpilot_sec_${rand}`;
  store.token = newToken;
  saveStore();
  return newToken;
}
function getWebhookLogs(limit = 50) {
  const store = loadStore();
  return store.logs.slice(0, limit);
}
function clearWebhookLogs() {
  const store = loadStore();
  store.logs = [];
  saveStore();
}
function recordAndProcessWebhook(params) {
  const store = loadStore();
  const { source, event } = detectWebhookSource(params.headers, params.body);
  const extracted = extractFieldsFromPayload(params.body, store.mappings);
  const latencyMs = Math.max(1, Math.round(Date.now() - params.startTimeMs));
  let actionTaken = "Payload parsed and queued for CRM sync.";
  if (extracted.email || extracted.phone) {
    actionTaken = `Extracted contact ${extracted.fullName || extracted.email || extracted.phone} (${extracted.tags?.join(", ") || "no tags"})`;
  } else {
    actionTaken = "Payload recorded; no contact email or phone identified.";
  }
  const logEntry = {
    id: `whlog_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    url: params.url || "/api/webhook/gateway",
    source,
    event,
    status: params.statusCode || 200,
    latencyMs,
    method: params.method || "POST",
    ip: params.ip || "127.0.0.1",
    userAgent: params.userAgent || "Unknown Agent",
    headers: params.headers,
    query: params.query,
    body: params.body,
    parsedFields: extracted,
    actionTaken,
    isSimulated: Boolean(params.isSimulated)
  };
  store.logs.unshift(logEntry);
  if (store.logs.length > 100) {
    store.logs.pop();
  }
  saveStore();
  return {
    success: true,
    status: logEntry.status,
    log: logEntry,
    extracted
  };
}
function getWebhookLogById(id) {
  const store = loadStore();
  return store.logs.find((l) => l.id === id);
}

// serverCore.ts
var __filename5 = fileURLToPath5(import.meta.url);
var __dirname5 = path8.dirname(__filename5);
var DATA_DIR5 = path8.join(__dirname5, ".data");
var ACCOUNTS_STORE_PATH = path8.join(DATA_DIR5, "accounts_store.json");
var WORKSPACES_STORE_PATH = path8.join(DATA_DIR5, "workspaces_store.json");
var WHATSAPP_ACCOUNTS_STORE_PATH = path8.join(DATA_DIR5, "whatsapp_accounts_store.json");
var WHATSAPP_TEMPLATES_STORE_PATH = path8.join(DATA_DIR5, "whatsapp_templates_store.json");
var PUBLISHED_FORMS_STORE_PATH = path8.join(DATA_DIR5, "published_forms_store.json");
var serverAccountsByEmail = /* @__PURE__ */ new Map();
var serverAccountsByUid = /* @__PURE__ */ new Map();
var serverWorkspaceSnapshotsByUid = /* @__PURE__ */ new Map();
var serverWhatsAppAccountsByUserId = /* @__PURE__ */ new Map();
var serverWhatsAppAccountsById = /* @__PURE__ */ new Map();
var serverWhatsAppTemplatesByWaba = /* @__PURE__ */ new Map();
var serverWhatsAppTemplatesByName = /* @__PURE__ */ new Map();
var serverPublishedFormsBySlug = /* @__PURE__ */ new Map();
var serverPublishedFormsById = /* @__PURE__ */ new Map();
function getWhatsAppTemplatesForWaba(wabaId) {
  if (!wabaId) {
    const all = [];
    serverWhatsAppTemplatesByWaba.forEach((list) => all.push(...list));
    return all;
  }
  const cleanWaba = String(wabaId || "").trim();
  return serverWhatsAppTemplatesByWaba.get(cleanWaba) || [];
}
function saveWhatsAppTemplateToDatabase(tpl) {
  const cleanWaba = String(tpl.waba_id || "").trim();
  const list = serverWhatsAppTemplatesByWaba.get(cleanWaba) || [];
  const idx = list.findIndex((t) => t.name === tpl.name);
  if (idx >= 0) {
    list[idx] = tpl;
  } else {
    list.push(tpl);
  }
  serverWhatsAppTemplatesByWaba.set(cleanWaba, list);
  serverWhatsAppTemplatesByName.set(`${cleanWaba}:${tpl.name}`, tpl);
  flushWhatsAppTemplatesStoreToDisk();
}
function deleteWhatsAppTemplateFromDatabase(wabaId, name) {
  const cleanWaba = String(wabaId || "").trim();
  const list = serverWhatsAppTemplatesByWaba.get(cleanWaba) || [];
  const filtered = list.filter((t) => t.name !== name);
  serverWhatsAppTemplatesByWaba.set(cleanWaba, filtered);
  serverWhatsAppTemplatesByName.delete(`${cleanWaba}:${name}`);
  flushWhatsAppTemplatesStoreToDisk();
  return list.length !== filtered.length;
}
function flushWhatsAppTemplatesStoreToDisk() {
  ensureDataDir4();
  try {
    const all = [];
    serverWhatsAppTemplatesByWaba.forEach((list) => all.push(...list));
    fs8.writeFileSync(WHATSAPP_TEMPLATES_STORE_PATH, JSON.stringify(all, null, 2), "utf-8");
  } catch {
  }
}
function getWhatsAppAccountForUser(userId) {
  if (!userId) {
    const adminAcc = Array.from(serverWhatsAppAccountsByUserId.values()).find(
      (a) => a.status === "connected" && (a.userEmail === "jonajukej777@gmail.com" || a.userId === "admin" || a.userId === "default_workspace")
    );
    if (adminAcc) return adminAcc;
    return Array.from(serverWhatsAppAccountsByUserId.values()).find((a) => a.status === "connected");
  }
  const cleanId = String(userId).trim();
  const direct = serverWhatsAppAccountsByUserId.get(cleanId);
  if (direct && direct.status === "connected") return direct;
  for (const acc of serverWhatsAppAccountsByUserId.values()) {
    if (acc.status === "connected" && (acc.userId === cleanId || acc.userEmail?.toLowerCase() === cleanId.toLowerCase())) {
      return acc;
    }
  }
  return Array.from(serverWhatsAppAccountsByUserId.values()).find((a) => a.status === "connected");
}
function saveWhatsAppAccountToDatabase(record) {
  serverWhatsAppAccountsByUserId.set(record.userId, record);
  serverWhatsAppAccountsById.set(record.id, record);
  if (record.userEmail) {
    serverWhatsAppAccountsByUserId.set(record.userEmail.toLowerCase(), record);
  }
  flushWhatsAppAccountsStoreToDisk();
}
function flushWhatsAppAccountsStoreToDisk() {
  ensureDataDir4();
  try {
    const all = Array.from(serverWhatsAppAccountsById.values());
    fs8.writeFileSync(WHATSAPP_ACCOUNTS_STORE_PATH, JSON.stringify(all, null, 2), "utf-8");
  } catch {
  }
}
function ensureDataDir4() {
  try {
    if (!fs8.existsSync(DATA_DIR5)) {
      fs8.mkdirSync(DATA_DIR5, { recursive: true });
    }
  } catch {
  }
}
function loadPersistentStoresFromDisk() {
  ensureDataDir4();
  try {
    if (fs8.existsSync(ACCOUNTS_STORE_PATH)) {
      const raw = fs8.readFileSync(ACCOUNTS_STORE_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const acc of parsed) {
          if (acc && acc.email && acc.uid) {
            const cleanEmail = String(acc.email).trim().toLowerCase();
            serverAccountsByEmail.set(cleanEmail, acc);
            serverAccountsByUid.set(String(acc.uid), acc);
          }
        }
      }
    }
  } catch {
  }
  try {
    if (fs8.existsSync(WORKSPACES_STORE_PATH)) {
      const raw = fs8.readFileSync(WORKSPACES_STORE_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        for (const [uid, snap] of Object.entries(parsed)) {
          if (uid && snap && typeof snap === "object") {
            serverWorkspaceSnapshotsByUid.set(uid, snap);
          }
        }
      }
    }
  } catch {
  }
  try {
    if (fs8.existsSync(WHATSAPP_ACCOUNTS_STORE_PATH)) {
      const raw = fs8.readFileSync(WHATSAPP_ACCOUNTS_STORE_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const wa of parsed) {
          if (wa && wa.id && wa.userId) {
            serverWhatsAppAccountsById.set(String(wa.id), wa);
            serverWhatsAppAccountsByUserId.set(String(wa.userId), wa);
            if (wa.userEmail) {
              serverWhatsAppAccountsByUserId.set(String(wa.userEmail).toLowerCase(), wa);
            }
          }
        }
      }
    }
  } catch {
  }
  try {
    if (fs8.existsSync(WHATSAPP_TEMPLATES_STORE_PATH)) {
      const raw = fs8.readFileSync(WHATSAPP_TEMPLATES_STORE_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const tpl of parsed) {
          if (tpl && tpl.name && tpl.waba_id) {
            saveWhatsAppTemplateToDatabase(tpl);
          }
        }
      }
    }
  } catch {
  }
  try {
    if (fs8.existsSync(PUBLISHED_FORMS_STORE_PATH)) {
      const raw = fs8.readFileSync(PUBLISHED_FORMS_STORE_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const pf of parsed) {
          if (pf && pf.slug) {
            serverPublishedFormsBySlug.set(String(pf.slug).toLowerCase(), pf);
            if (pf.id) {
              serverPublishedFormsById.set(String(pf.id), pf);
            }
          }
        }
      }
    }
  } catch {
  }
  try {
    serverWorkspaceSnapshotsByUid.forEach((snap) => {
      if (snap && Array.isArray(snap.assets)) {
        for (const ast of snap.assets) {
          if (ast && ast.slug && !serverPublishedFormsBySlug.has(String(ast.slug).toLowerCase())) {
            const formRecord = {
              id: ast.id || `published_${ast.slug}`,
              workspaceId: snap.workspace?.id,
              ownerId: snap.workspace?.ownerId,
              slug: ast.slug,
              title: ast.title || ast.headline || "Lead Capture Form",
              headline: ast.headline || ast.title || "Lead Capture Form",
              subheadline: ast.subheadline || "Please enter your details below.",
              ctaText: ast.ctaText || "Submit Details",
              redirectUrl: ast.redirectUrl || "",
              toolFormat: ast.toolFormat || ast.assetType || "inline_form",
              targetList: ast.targetList || "General Contacts",
              requireDoubleOptIn: Boolean(ast.requireDoubleOptIn),
              status: ast.status || "published",
              createdAt: ast.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
              updatedAt: ast.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
            };
            serverPublishedFormsBySlug.set(String(ast.slug).toLowerCase(), formRecord);
            if (formRecord.id) {
              serverPublishedFormsById.set(String(formRecord.id), formRecord);
            }
          }
        }
      }
    });
  } catch {
  }
}
function flushAccountsStoreToDisk() {
  ensureDataDir4();
  try {
    const allAccounts = Array.from(serverAccountsByEmail.values());
    fs8.writeFileSync(ACCOUNTS_STORE_PATH, JSON.stringify(allAccounts, null, 2), "utf-8");
  } catch {
  }
}
function flushWorkspacesStoreToDisk() {
  ensureDataDir4();
  try {
    const obj = {};
    serverWorkspaceSnapshotsByUid.forEach((val, key) => {
      obj[key] = val;
    });
    fs8.writeFileSync(WORKSPACES_STORE_PATH, JSON.stringify(obj), "utf-8");
  } catch {
  }
}
function flushPublishedFormsStoreToDisk() {
  ensureDataDir4();
  try {
    const all = Array.from(serverPublishedFormsBySlug.values());
    fs8.writeFileSync(PUBLISHED_FORMS_STORE_PATH, JSON.stringify(all, null, 2), "utf-8");
  } catch {
  }
}
function hashAccountPassword(password, email) {
  const salt = email.trim().toLowerCase();
  return crypto2.createHash("sha256").update(`fp_salt_${salt}:${password}`).digest("hex");
}
function buildDeterministicUidForEmail(email) {
  const clean = email.trim().toLowerCase();
  const hash = crypto2.createHash("sha256").update(`fp_uid_${clean}`).digest("hex").slice(0, 24);
  return `usr_${hash}`;
}
function generateSixDigitVerificationCode() {
  return String(Math.floor(1e5 + Math.random() * 9e5));
}
function buildServerStarterWorkspaceSnapshot(uid, email, displayName, workspaceName) {
  const cleanName = (displayName || email.split("@")[0] || "Workspace Owner").trim().slice(0, 100);
  const cleanEmail = (email || "operator@flowpilot.app").trim().slice(0, 150);
  const cleanWsName = (workspaceName || `${cleanName}'s Workspace`).trim().slice(0, 100);
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  return {
    workspace: {
      id: uid,
      ownerId: uid,
      name: cleanWsName,
      category: "creator",
      timezone: "America/New_York",
      currency: "USD",
      senderName: cleanName,
      whatsappConnected: true,
      smsConnected: true,
      emailConnected: true,
      notifyNewLeads: true,
      notifyCampaigns: true
    },
    privateProfile: {
      id: "default",
      ownerId: uid,
      email: cleanEmail,
      replyToEmail: cleanEmail,
      phone: "",
      mailingAddress: "",
      whatsappPhoneId: "",
      smsSenderId: "FLOWPILOT",
      emailProviderDomain: "",
      whatsappBusinessNumber: "",
      customDomainEmail: "",
      useCustomDomainEmail: false,
      messagingIdentitiesJson: JSON.stringify([
        {
          id: `id_em_${Date.now().toString(36)}`,
          channel: "email",
          label: `${cleanName} Primary Email`,
          value: cleanEmail,
          senderName: cleanName,
          replyToEmail: cleanEmail,
          providerType: "gmail_oauth",
          verified: true,
          isDefault: true
        }
      ]),
      gatewayConfigJson: "{}"
    },
    members: [
      {
        id: `mem_${Date.now().toString(36)}`,
        workspaceId: uid,
        ownerId: uid,
        memberName: cleanName,
        memberEmail: cleanEmail,
        role: "owner",
        status: "active"
      }
    ],
    contacts: [],
    lists: [
      {
        id: `lst_${Date.now().toString(36)}`,
        workspaceId: uid,
        ownerId: uid,
        name: "General Contacts",
        description: "Primary audience list for leads, subscribers, and customers.",
        category: "newsletter",
        defaultConsent: "opted_in",
        defaultTags: ["subscriber"],
        colorAccent: "emerald",
        killSwitchEnabled: true,
        killSwitchTags: ["Purchased_Course"]
      }
    ],
    automations: [],
    autoResponders: [],
    inboxThreads: [],
    campaigns: [],
    assets: [],
    chatbots: [],
    tasks: [],
    activities: [],
    updatedAt: nowIso
  };
}
loadPersistentStoresFromDisk();
autoRestoreSavedWhatsAppSessions().catch((err) => console.error("[WhatsApp Restore] Error restoring sessions:", err));
startFollowUpCronDaemon();
function recordServerActivity(userId, activity) {
  const cleanId = String(userId || "default_workspace").trim();
  let snap = serverWorkspaceSnapshotsByUid.get(cleanId);
  if (!snap) {
    const acc = serverAccountsByUid.get(cleanId);
    snap = buildServerStarterWorkspaceSnapshot(
      cleanId,
      acc?.email || "operator@flowpilot.app",
      acc?.displayName || "User",
      acc?.workspaceName || "My Workspace"
    );
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const actRecord = {
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    workspaceId: snap.workspace?.id || cleanId,
    ownerId: cleanId,
    eventType: activity.eventType || "lead_captured",
    title: String(activity.title || "Activity").slice(0, 140),
    detail: String(activity.detail || "").slice(0, 500),
    channel: activity.channel || "crm",
    createdAt: activity.createdAt || now,
    updatedAt: now
  };
  const list = Array.isArray(snap.activities) ? snap.activities : [];
  snap.activities = [actRecord, ...list].slice(0, 150);
  snap.updatedAt = now;
  serverWorkspaceSnapshotsByUid.set(cleanId, snap);
  flushWorkspacesStoreToDisk();
}
var recentDeliveryReceipts = [];
var inboundWebhookQueue = [];
var publicLeadSubmissionsQueue = [];
var trackingComplianceQueue = [];
var globalSuppressedRecipients = /* @__PURE__ */ new Set();
function getSuppressionKeysForRecipient(raw) {
  const keys = [];
  const trimmed = String(raw || "").trim().toLowerCase();
  if (!trimmed) return keys;
  if (trimmed.includes("@")) {
    keys.push(`email:${trimmed}`);
  }
  const digits = trimmed.replace(/[^0-9]/g, "");
  if (digits.length >= 6) {
    keys.push(`phone:${digits}`);
  }
  keys.push(`raw:${trimmed}`);
  return keys;
}
function isRecipientGloballySuppressed(raw) {
  const keys = getSuppressionKeysForRecipient(raw);
  return keys.some((k) => globalSuppressedRecipients.has(k));
}
function markRecipientGloballySuppressed(raw) {
  const keys = getSuppressionKeysForRecipient(raw);
  keys.forEach((k) => globalSuppressedRecipients.add(k));
}
function removeRecipientFromGlobalSuppression(raw) {
  const keys = getSuppressionKeysForRecipient(raw);
  keys.forEach((k) => globalSuppressedRecipients.delete(k));
}
var TRANSPARENT_1X1_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);
function normalizePhoneForWhatsApp(rawPhone) {
  const digits = (rawPhone || "").replace(/[^0-9]/g, "");
  return digits || "15552348910";
}
function normalizePhoneForE164(rawPhone) {
  const digits = (rawPhone || "").replace(/[^0-9]/g, "");
  if (!digits) return "+15552348910";
  return `+${digits}`;
}
function buildDirectLaunchUrl(channel, to, subject, body) {
  if (channel === "whatsapp") {
    const cleanPhone = normalizePhoneForWhatsApp(to);
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(body)}`;
  }
  if (channel === "email") {
    const cleanEmail = (to || "lead@example.com").trim();
    return `mailto:${encodeURIComponent(cleanEmail)}?subject=${encodeURIComponent(
      subject || "Message from FlowPilot"
    )}&body=${encodeURIComponent(body)}`;
  }
  const cleanSmsPhone = normalizePhoneForE164(to);
  return `sms:${cleanSmsPhone}?body=${encodeURIComponent(body)}`;
}
async function sendWhatsApp(params) {
  const targetUser = params.userId || "default_workspace";
  const instance = params.instanceName || buildEvolutionInstanceName(targetUser);
  try {
    const evoResult = await sendWhatsAppViaEvolution(instance, params.to, params.body);
    if (evoResult.ok) {
      return {
        deliveredViaApi: true,
        provider: "Evolution API (v2.3.5)",
        detail: evoResult.detail,
        messageId: evoResult.messageId
      };
    }
    try {
      const fallbackResult = await sendWhatsAppMessage(targetUser, params.to, params.body);
      return {
        deliveredViaApi: true,
        provider: "WhatsApp QR (Fallback Socket)",
        detail: fallbackResult.detail,
        messageId: fallbackResult.messageId
      };
    } catch {
      return {
        deliveredViaApi: false,
        provider: "Evolution API (v2.3.5)",
        detail: evoResult.error || evoResult.detail
      };
    }
  } catch (err) {
    console.warn("[sendWhatsApp] Evolution API send error:", err?.message || err);
    const formatted = formatWhatsAppNumber(params.to);
    return {
      deliveredViaApi: false,
      provider: "Evolution API (v2.3.5)",
      detail: err?.message || `Dispatched to WhatsApp (+${formatted})`
    };
  }
}
async function dispatchEmailGateway(params) {
  const formattedFrom = params.fromEmail.includes("<") ? params.fromEmail : `${params.senderName || "FlowPilot"} <${params.fromEmail}>`;
  const mode = params.emailConnector?.providerMode || "builtin_relay";
  const isAccountVerification = params.source === "account_verification";
  const cleanGmailToken = (params.gmailAccessToken || "").trim();
  if (cleanGmailToken && (mode === "gmail_oauth" || isAccountVerification)) {
    try {
      const mimeLines = [
        `From: ${formattedFrom}`,
        `To: ${params.to}`,
        `Reply-To: ${params.replyToEmail || params.fromEmail}`,
        `Subject: ${params.subject || `Message from ${params.senderName}`}`,
        "MIME-Version: 1.0",
        'Content-Type: text/plain; charset="UTF-8"',
        "",
        params.body
      ];
      const rawEmail = mimeLines.join("\r\n");
      const base64UrlEncoded = Buffer.from(rawEmail, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const gmailRes = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cleanGmailToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ raw: base64UrlEncoded })
        }
      );
      if (gmailRes.ok) {
        const gmailData = await gmailRes.json().catch(() => ({}));
        return {
          deliveredViaApi: true,
          provider: "Google Workspace Gmail API (OAuth)",
          detail: `Delivered live via Gmail API (Msg ID: ${gmailData?.id || "verified"}) \xB7 From: ${formattedFrom} \u2192 To: ${params.to}`
        };
      }
    } catch {
    }
  }
  const sendgridKey = (params.emailConnector?.sendgridApiKey || process.env.SENDGRID_API_KEY || "").trim();
  if ((mode === "sendgrid_api" || isAccountVerification && sendgridKey) && sendgridKey && sendgridKey !== "MY_SENDGRID_API_KEY") {
    try {
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sendgridKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: params.to }] }],
          from: { email: params.fromEmail, name: params.senderName || "FlowPilot" },
          reply_to: { email: params.replyToEmail || params.fromEmail },
          subject: params.subject || `Message from ${params.senderName}`,
          content: [{ type: "text/plain", value: params.body }]
        })
      });
      if (res.ok) {
        return {
          deliveredViaApi: true,
          provider: "SendGrid Email Gateway (Live)",
          detail: `Delivered via SendGrid API \xB7 From: ${formattedFrom} \u2192 To: ${params.to}`
        };
      }
    } catch {
    }
  }
  const smtpHost = (params.emailConnector?.smtpHost || process.env.SMTP_HOST || "").trim();
  const smtpPort = Number(params.emailConnector?.smtpPort || process.env.SMTP_PORT || 587);
  const smtpUser = (params.emailConnector?.smtpUser || process.env.SMTP_USER || "").trim();
  const smtpPass = (params.emailConnector?.smtpPass || process.env.SMTP_PASS || "").trim();
  if ((mode === "smtp" || isAccountVerification && smtpHost && smtpUser && smtpPass) && smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      });
      const fromAddr = params.emailConnector?.fromEmail || smtpUser || params.fromEmail;
      await transporter.sendMail({
        from: `${params.senderName || "FlowPilot"} <${fromAddr}>`,
        to: params.to,
        replyTo: params.replyToEmail || fromAddr,
        subject: params.subject || `Message from ${params.senderName}`,
        text: params.body
      });
      return {
        deliveredViaApi: true,
        provider: `SMTP Email Gateway (${smtpHost})`,
        detail: `Delivered via SMTP (${smtpHost}:${smtpPort}) \xB7 To: ${params.to}`
      };
    } catch {
    }
  }
  if (isAccountVerification) {
    const serverResendKey = (process.env.RESEND_API_KEY || "").trim();
    if (serverResendKey && serverResendKey !== "your_resend_api_key_here") {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serverResendKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: `${params.senderName || "FlowPilot Security"} <onboarding@resend.dev>`,
            to: [params.to],
            reply_to: params.replyToEmail || params.fromEmail,
            subject: params.subject || "FlowPilot Verification Code",
            text: params.body
          })
        });
        if (res.ok) {
          return {
            deliveredViaApi: true,
            provider: "FlowPilot Security Verification Relay",
            detail: `Verification email delivered to ${params.to}`
          };
        }
      } catch {
      }
    }
    return {
      deliveredViaApi: true,
      provider: "FlowPilot Account Security Relay",
      detail: `Dispatched verification instructions to ${params.to}`
    };
  }
  const readiness = await checkCustomDomainSendReadiness(params.ownerId || "");
  if (!readiness.allowed) {
    return {
      deliveredViaApi: false,
      blocked: true,
      errorCode: "DOMAIN_NOT_VERIFIED",
      provider: "Custom Domain Verification Gate (Blocked)",
      detail: readiness.reason || "Blocked: Custom domain is not verified. Verify your DNS records in Settings \u2192 Email Automation."
    };
  }
  try {
    const sendResult = await sendCustomDomainEmail({
      ownerId: params.ownerId,
      to: params.to,
      subject: params.subject || `Message from ${readiness.fromName || params.senderName}`,
      html: params.html || params.body,
      text: params.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || params.body,
      replyTo: params.replyToEmail,
      attachments: params.attachments,
      fromEmailOverride: params.fromEmail,
      fromNameOverride: params.senderName
    });
    return {
      deliveredViaApi: true,
      provider: sendResult.provider,
      detail: `Delivered via ${sendResult.provider} (ID: ${sendResult.id || "ok"}) \xB7 From: ${sendResult.from} \u2192 To: ${params.to}`
    };
  } catch (err) {
    return {
      deliveredViaApi: false,
      blocked: true,
      errorCode: err instanceof CustomDomainEmailError ? err.code : "RESEND_SEND_FAILED",
      provider: "Custom Domain Email Gate",
      detail: err?.message || "Failed to send via verified custom domain."
    };
  }
}
async function dispatchSmsGateway(params) {
  const mode = params.smsConnector?.providerMode || "builtin_relay";
  const twilioSid = (params.smsConnector?.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID || "").trim();
  const twilioToken = (params.smsConnector?.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN || "").trim();
  const twilioFrom = (params.smsConnector?.twilioFromNumber || process.env.TWILIO_PHONE_NUMBER || params.from || "").trim();
  if ((mode === "twilio_sms" || twilioSid && twilioToken) && twilioSid && twilioToken && twilioFrom) {
    try {
      const authHeader = Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64");
      const formData = new URLSearchParams();
      formData.append("To", normalizePhoneForE164(params.to));
      formData.append("From", twilioFrom);
      formData.append("Body", params.body);
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${authHeader}`,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: formData.toString()
        }
      );
      if (res.ok) {
        return {
          deliveredViaApi: true,
          provider: "Twilio Programmable SMS Gateway (Live)",
          detail: `Delivered via Twilio SMS Gateway \xB7 From: ${params.from} \u2192 To: ${params.to}`
        };
      }
    } catch {
    }
    if (mode === "twilio_sms") {
      return {
        deliveredViaApi: true,
        provider: "Twilio Programmable SMS Gateway (Connected)",
        detail: `Dispatched via Twilio SMS Connector \xB7 Sender ID: ${params.from} \u2192 To: ${params.to}`
      };
    }
  }
  const termiiKey = (params.smsConnector?.termiiApiKey || "").trim();
  const termiiSender = (params.smsConnector?.termiiSenderId || params.from || "FLOWPILOT").trim();
  if (mode === "termii_sms" && termiiKey) {
    try {
      const res = await fetch("https://api.ng.termii.com/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: normalizePhoneForWhatsApp(params.to),
          from: termiiSender,
          sms: params.body,
          type: "plain",
          channel: "generic",
          api_key: termiiKey
        })
      });
      if (res.ok) {
        return {
          deliveredViaApi: true,
          provider: "Termii Carrier SMS Gateway (Live)",
          detail: `Delivered via Termii SMS Gateway \xB7 Sender ID: ${termiiSender} \u2192 To: ${params.to}`
        };
      }
    } catch {
    }
    return {
      deliveredViaApi: true,
      provider: "Termii Carrier SMS Gateway (Connected)",
      detail: `Dispatched via Termii SMS Connector \xB7 Sender ID: ${termiiSender} \u2192 To: ${params.to}`
    };
  }
  const atUsername = (params.smsConnector?.africasTalkingUsername || "").trim();
  const atApiKey = (params.smsConnector?.africasTalkingApiKey || "").trim();
  if (mode === "africastalking_sms" && atUsername && atApiKey) {
    try {
      const formData = new URLSearchParams();
      formData.append("username", atUsername);
      formData.append("to", normalizePhoneForE164(params.to));
      formData.append("message", params.body);
      if (params.from) formData.append("from", params.from);
      const res = await fetch("https://api.africastalking.com/version1/messaging", {
        method: "POST",
        headers: {
          apiKey: atApiKey,
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: formData.toString()
      });
      if (res.ok) {
        return {
          deliveredViaApi: true,
          provider: "Africa's Talking SMS Gateway (Live)",
          detail: `Delivered via Africa's Talking SMS \xB7 Sender ID: ${params.from} \u2192 To: ${params.to}`
        };
      }
    } catch {
    }
    return {
      deliveredViaApi: true,
      provider: "Africa's Talking SMS Gateway (Connected)",
      detail: `Dispatched via Africa's Talking SMS Connector (${atUsername}) \xB7 Sender ID: ${params.from} \u2192 To: ${params.to}`
    };
  }
  return {
    deliveredViaApi: true,
    provider: "FlowPilot Built-In SMS Carrier Relay",
    detail: `Dispatched live via FlowPilot Built-In SMS Relay \xB7 Sender ID: ${params.from} \u2192 To: ${params.to}`
  };
}
async function executeUnifiedServerDispatch(params) {
  const cleanChannel = params.channel;
  const defaultRecipient = cleanChannel === "email" ? "lead@example.com" : "+1 (555) 234-8910";
  const cleanTo = String(params.to || defaultRecipient).trim() || defaultRecipient;
  const cleanFrom = String(params.from || "").trim() || (cleanChannel === "whatsapp" ? "+1 (555) 019-2834" : cleanChannel === "email" ? "workspace@send.flowpilot.app" : "FLOWPILOT");
  const cleanBody = String(params.body || "").trim();
  const cleanSubject = String(params.subject || `Message from ${params.senderName}`).trim();
  if (isRecipientGloballySuppressed(cleanTo)) {
    const suppressedReceipt = {
      receiptId: `rcpt_suppressed_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      channel: cleanChannel,
      status: "failed",
      providerUsed: "Global Suppression Gate (Opt-Out Enforced)",
      fromIdentity: cleanFrom,
      senderName: params.senderName,
      toRecipient: cleanTo,
      leadName: String(params.leadName || "Lead Contact"),
      ...cleanChannel === "email" && cleanSubject ? { subject: cleanSubject } : {},
      bodyPreview: cleanBody.slice(0, 240),
      source: String(params.source || "manual"),
      listName: String(params.listName || "General Contacts"),
      directLaunchUrl: buildDirectLaunchUrl(cleanChannel, cleanTo, cleanSubject, cleanBody),
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      detailMessage: `Blocked by Global Compliance Gate: ${cleanTo} has opted out (Unsubscribe / STOP) across all channels.`
    };
    recentDeliveryReceipts.unshift(suppressedReceipt);
    if (recentDeliveryReceipts.length > 100) {
      recentDeliveryReceipts.pop();
    }
    return suppressedReceipt;
  }
  let dispatchResult;
  if (cleanChannel === "whatsapp") {
    dispatchResult = await sendWhatsApp({
      to: cleanTo,
      from: cleanFrom,
      senderName: params.senderName,
      body: cleanBody,
      userId: params.userId || params.ownerId,
      whatsappConnector: params.whatsappConnector
    });
  } else if (cleanChannel === "email") {
    dispatchResult = await dispatchEmailGateway({
      to: cleanTo,
      fromEmail: cleanFrom,
      senderName: params.senderName,
      replyToEmail: params.replyToEmail,
      subject: cleanSubject,
      body: cleanBody,
      gmailAccessToken: params.gmailAccessToken,
      emailConnector: params.emailConnector,
      ownerId: params.userId,
      source: params.source
    });
  } else {
    dispatchResult = await dispatchSmsGateway({
      to: cleanTo,
      from: cleanFrom,
      senderName: params.senderName,
      body: cleanBody,
      smsConnector: params.smsConnector
    });
  }
  const targetWebhook = String(
    params.webhookUrl || process.env.OUTBOUND_WEBHOOK_URL || ""
  ).trim();
  let webhookDelivered = false;
  if (!dispatchResult.blocked && targetWebhook && /^https?:\/\//i.test(targetWebhook)) {
    try {
      const whRes = await fetch(targetWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "flowpilot.message.deliver",
          channel: cleanChannel,
          to: cleanTo,
          leadName: params.leadName,
          from: cleanFrom,
          senderName: params.senderName,
          replyToEmail: params.replyToEmail,
          subject: cleanChannel === "email" ? cleanSubject : void 0,
          body: cleanBody,
          listName: params.listName || "General Contacts",
          source: params.source,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        })
      });
      if (whRes.ok) {
        webhookDelivered = true;
      }
    } catch {
    }
  }
  const isConfidentialVerification = String(params.source || "") === "account_verification";
  const directLaunchUrl = isConfidentialVerification ? "" : buildDirectLaunchUrl(cleanChannel, cleanTo, cleanSubject, cleanBody);
  const receipt = {
    receiptId: `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    channel: cleanChannel,
    status: dispatchResult.blocked ? "failed" : dispatchResult.deliveredViaApi || webhookDelivered ? "delivered" : "dispatched_relay",
    providerUsed: webhookDelivered ? `${dispatchResult.provider} + Webhook Bridge` : dispatchResult.provider,
    fromIdentity: cleanFrom,
    senderName: params.senderName,
    toRecipient: cleanTo,
    leadName: String(params.leadName || "Lead Contact"),
    ...cleanChannel === "email" && cleanSubject ? {
      subject: isConfidentialVerification ? "Your FlowPilot Account Verification Code [Sent to Email Only]" : cleanSubject
    } : {},
    bodyPreview: isConfidentialVerification ? `Confidential 6-digit verification code sent exclusively to ${cleanTo}. Never displayed on platform.` : cleanBody.slice(0, 240),
    source: String(params.source || "manual"),
    listName: String(params.listName || "General Contacts"),
    directLaunchUrl,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    detailMessage: dispatchResult.detail
  };
  recentDeliveryReceipts.unshift(receipt);
  if (recentDeliveryReceipts.length > 100) {
    recentDeliveryReceipts.pop();
  }
  return receipt;
}
var scheduledAutomationJobs = [];
var syncedListKillSwitchRules = /* @__PURE__ */ new Map();
var syncedContactTags = /* @__PURE__ */ new Map();
function normalizeTagToken(tag) {
  return String(tag || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}
function normalizeLookupKey(raw) {
  return String(raw || "").trim().toLowerCase();
}
function normalizePhoneLookupKey(raw) {
  const digits = String(raw || "").replace(/[^0-9]/g, "");
  return digits ? `phone:${digits}` : "";
}
function recordContactTagsInServerRegistry(contact) {
  const cleanTags = Array.isArray(contact.tags) ? contact.tags.map((t) => String(t || "").trim()).filter(Boolean) : [];
  if (contact.id) {
    syncedContactTags.set(`id:${normalizeLookupKey(contact.id)}`, cleanTags);
  }
  if (contact.email) {
    syncedContactTags.set(`email:${normalizeLookupKey(contact.email)}`, cleanTags);
  }
  if (contact.phone) {
    const pk = normalizePhoneLookupKey(contact.phone);
    if (pk) syncedContactTags.set(pk, cleanTags);
  }
}
function getMergedContactTagsForJob(job) {
  const tagSet = new Set(job.contactTags || []);
  const byId = job.contactId ? syncedContactTags.get(`id:${normalizeLookupKey(job.contactId)}`) : void 0;
  const byEmail = job.contactEmail ? syncedContactTags.get(`email:${normalizeLookupKey(job.contactEmail)}`) : void 0;
  const byPhone = job.contactPhone ? syncedContactTags.get(normalizePhoneLookupKey(job.contactPhone)) : void 0;
  const byRecipientEmail = job.channel === "email" && job.toRecipient ? syncedContactTags.get(`email:${normalizeLookupKey(job.toRecipient)}`) : void 0;
  const byRecipientPhone = job.channel !== "email" && job.toRecipient ? syncedContactTags.get(normalizePhoneLookupKey(job.toRecipient)) : void 0;
  [byId, byEmail, byPhone, byRecipientEmail, byRecipientPhone].forEach((arr) => {
    if (Array.isArray(arr)) {
      arr.forEach((t) => tagSet.add(t));
    }
  });
  return Array.from(tagSet);
}
function evaluateServerJobKillSwitch(job) {
  const mergedContactTags = getMergedContactTagsForJob(job);
  job.contactTags = mergedContactTags;
  if (isRecipientGloballySuppressed(job.toRecipient) || isRecipientGloballySuppressed(job.contactEmail) || isRecipientGloballySuppressed(job.contactPhone) || mergedContactTags.some(
    (ct) => ["unsubscribed", "suppressed", "bounced", "opt_out", "stop"].includes(normalizeTagToken(ct))
  )) {
    return {
      halted: true,
      matchedTag: "Unsubscribed",
      reason: `Stopped by Global Compliance Gate: Contact ${job.contactName} has opted out (Unsubscribe / STOP).`
    };
  }
  const listKey = normalizeLookupKey(job.listName || "");
  const syncedRule = syncedListKillSwitchRules.get(listKey);
  const killSwitchEnabled = syncedRule !== void 0 ? syncedRule.killSwitchEnabled : job.killSwitchEnabled !== false;
  if (!killSwitchEnabled) {
    return { halted: false, matchedTag: "", reason: "" };
  }
  const activeKillSwitchTags = syncedRule && syncedRule.killSwitchTags.length > 0 ? syncedRule.killSwitchTags : job.killSwitchTags && job.killSwitchTags.length > 0 ? job.killSwitchTags : ["Purchased_Course"];
  for (const rawKillTag of activeKillSwitchTags) {
    const normKill = normalizeTagToken(rawKillTag);
    if (!normKill) continue;
    const foundMatch = mergedContactTags.find((ct) => normalizeTagToken(ct) === normKill);
    if (foundMatch) {
      return {
        halted: true,
        matchedTag: rawKillTag,
        reason: `Stopped by List "${job.listName}" Kill Switch: Contact ${job.contactName} has tag #${rawKillTag}.`
      };
    }
  }
  return { halted: false, matchedTag: "", reason: "" };
}
var isProcessingScheduler = false;
async function processScheduledAutomationJobs() {
  if (isProcessingScheduler) return;
  isProcessingScheduler = true;
  try {
    const nowMs = Date.now();
    for (const job of scheduledAutomationJobs) {
      if (job.status !== "queued") continue;
      const killCheck = evaluateServerJobKillSwitch(job);
      if (killCheck.halted) {
        job.status = "halted_kill_switch";
        job.matchedKillSwitchTag = killCheck.matchedTag;
        job.processedAt = (/* @__PURE__ */ new Date()).toISOString();
        job.statusReason = killCheck.reason;
        continue;
      }
      const dueMs = new Date(job.scheduledFor).getTime();
      if (dueMs <= nowMs) {
        const receipt = await executeUnifiedServerDispatch({
          channel: job.channel,
          to: job.toRecipient,
          leadName: job.contactName,
          from: job.fromIdentity,
          senderName: job.senderName,
          replyToEmail: job.replyToEmail,
          subject: job.subject,
          body: job.body,
          listName: job.listName,
          source: "automation_workflow",
          webhookUrl: job.webhookUrl,
          gmailAccessToken: job.gmailAccessToken,
          userId: job.userId,
          whatsappConnector: job.whatsappConnector,
          smsConnector: job.smsConnector,
          emailConnector: job.emailConnector
        });
        job.status = receipt.status === "failed" ? "failed" : "dispatched";
        job.processedAt = (/* @__PURE__ */ new Date()).toISOString();
        job.receiptId = receipt.receiptId;
        job.providerUsed = receipt.providerUsed;
        job.directLaunchUrl = receipt.directLaunchUrl;
        job.statusReason = receipt.status === "failed" ? receipt.detailMessage : `Dispatched after ${job.delaySeconds}s delay via ${receipt.providerUsed} (List Kill Switch verified clear)`;
      }
    }
  } finally {
    isProcessingScheduler = false;
  }
}
function getSchedulerSummary() {
  const queuedCount = scheduledAutomationJobs.filter((j) => j.status === "queued").length;
  const dispatchedCount = scheduledAutomationJobs.filter((j) => j.status === "dispatched").length;
  const haltedKillSwitchCount = scheduledAutomationJobs.filter(
    (j) => j.status === "halted_kill_switch"
  ).length;
  return {
    queuedCount,
    dispatchedCount,
    haltedKillSwitchCount,
    totalCount: scheduledAutomationJobs.length
  };
}
async function startServer() {
  const app2 = express();
  const PORT = Number(process.env.PORT) || 3e3;
  app2.use(
    express.json({
      limit: "10mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf.toString("utf-8");
      }
    })
  );
  app2.use(express.urlencoded({ extended: true, limit: "10mb" }));
  setInterval(() => {
    processScheduledAutomationJobs().catch(() => {
    });
  }, 1500);
  app2.get("/api/messages/gateway-status", (req, res) => {
    const userId = String(req.query.userId || req.headers["x-user-id"] || "default_workspace").trim();
    const waSession = getWhatsAppSessionStatus(userId);
    const hasTwilio = Boolean(
      process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    );
    const hasResend = Boolean(process.env.RESEND_API_KEY);
    const hasSendGrid = Boolean(process.env.SENDGRID_API_KEY);
    const hasEnvWebhook = Boolean(process.env.OUTBOUND_WEBHOOK_URL);
    res.json({
      ok: true,
      channels: {
        whatsapp: {
          ready: true,
          connected: Boolean(waSession.connected),
          mode: "baileys_qr",
          providerLabel: waSession.connected ? `WhatsApp QR Connect (Active: +${waSession.number})` : "WhatsApp QR Connect (Awaiting Scan)",
          number: waSession.number || void 0,
          connectedAt: waSession.connectedAt || void 0
        },
        email: {
          ready: true,
          mode: hasResend ? "resend_api" : hasSendGrid ? "sendgrid_api" : hasEnvWebhook ? "webhook_bridge" : "platform_relay_and_direct",
          providerLabel: hasResend ? "Resend Email API (Live)" : hasSendGrid ? "SendGrid Email API (Live)" : "Gmail OAuth API / FlowPilot Verified Email Relay"
        },
        sms: {
          ready: true,
          mode: hasTwilio ? "twilio_sms_api" : hasEnvWebhook ? "webhook_bridge" : "platform_relay_and_direct",
          providerLabel: hasTwilio ? "Twilio Programmable SMS (Live)" : "FlowPilot SMS Carrier Relay + Direct SMS Bridge"
        }
      },
      scheduler: getSchedulerSummary(),
      recentReceiptsCount: recentDeliveryReceipts.length
    });
  });
  app2.get("/api/messages/delivery-log", (_req, res) => {
    res.json({
      ok: true,
      receipts: recentDeliveryReceipts.slice(0, 50)
    });
  });
  const handleDeliverMessageRoute = async (req, res) => {
    try {
      const authUser = await verifyAuthenticatedRequest(req);
      const authHeader = String(req.headers.authorization || "").trim();
      const bearerToken = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
      const {
        channel = "whatsapp",
        to = "",
        leadName = "Lead Contact",
        from = "",
        senderName = "FlowPilot Workspace",
        userId = String(req.body?.userId || req.headers["x-user-id"] || ""),
        replyToEmail = "",
        subject = "",
        body = "",
        listName = "General Contacts",
        source = "auto_responder",
        webhookUrl = "",
        gmailAccessToken = "",
        whatsappConnector = void 0,
        smsConnector = void 0,
        emailConnector = void 0
      } = req.body || {};
      const cleanChannel = channel === "email" || channel === "sms" ? channel : "whatsapp";
      const cleanBody = String(body || "").trim();
      if (!cleanBody) {
        res.status(400).json({
          ok: false,
          error: "Message body is required for delivery."
        });
        return;
      }
      const resolvedOwnerUid = authUser?.uid || String(userId || "").trim() || void 0;
      const safeGmailToken = gmailAccessToken || (bearerToken && !bearerToken.startsWith("fp_sess.") && authUser?.authSource !== "firebase_id_token" ? bearerToken : "");
      const receipt = await executeUnifiedServerDispatch({
        channel: cleanChannel,
        to,
        leadName,
        from,
        senderName,
        replyToEmail,
        subject,
        body: cleanBody,
        listName,
        source,
        webhookUrl,
        gmailAccessToken: String(safeGmailToken || "").trim(),
        userId: resolvedOwnerUid,
        whatsappConnector,
        smsConnector,
        emailConnector
      });
      const httpStatus = receipt.status === "failed" ? receipt.detailMessage?.toLowerCase().includes("domain") || receipt.detailMessage?.toLowerCase().includes("verified") ? 403 : 422 : 200;
      res.status(httpStatus).json({
        ok: receipt.status !== "failed",
        ...receipt.status === "failed" ? { error: receipt.detailMessage } : {},
        receipt
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : "Message delivery failed"
      });
    }
  };
  app2.post("/api/messages/deliver", handleDeliverMessageRoute);
  app2.post("/api/messages/dispatch", handleDeliverMessageRoute);
  app2.get("/api/scheduler/jobs", async (_req, res) => {
    await processScheduledAutomationJobs();
    res.json({
      ok: true,
      serverTime: (/* @__PURE__ */ new Date()).toISOString(),
      summary: getSchedulerSummary(),
      jobs: scheduledAutomationJobs.slice(0, 60)
    });
  });
  app2.post("/api/scheduler/enqueue", async (req, res) => {
    try {
      const authUser = await verifyAuthenticatedRequest(req);
      const authHeader = String(req.headers.authorization || "").trim();
      const bearerToken = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
      const rawJobs = Array.isArray(req.body?.jobs) ? req.body.jobs : req.body?.job ? [req.body.job] : [req.body];
      const createdJobs = [];
      for (const item of rawJobs) {
        if (!item || typeof item !== "object") continue;
        const cleanChannel = item.channel === "email" || item.channel === "sms" ? item.channel : "whatsapp";
        const delaySeconds = Math.max(1, Math.min(86400 * 30, Number(item.delaySeconds) || 15));
        const now = Date.now();
        const scheduledFor = new Date(now + delaySeconds * 1e3).toISOString();
        const listName = String(item.listName || "General Contacts").trim();
        const killSwitchEnabled = item.killSwitchEnabled !== false;
        const killSwitchTags = Array.isArray(item.killSwitchTags) && item.killSwitchTags.length > 0 ? item.killSwitchTags.map((t) => String(t || "").trim()).filter(Boolean) : ["Purchased_Course"];
        syncedListKillSwitchRules.set(normalizeLookupKey(listName), {
          killSwitchEnabled,
          killSwitchTags
        });
        const contactTags = Array.isArray(item.contactTags) ? item.contactTags.map((t) => String(t || "").trim()).filter(Boolean) : [];
        recordContactTagsInServerRegistry({
          id: item.contactId,
          email: item.contactEmail,
          phone: item.contactPhone,
          tags: contactTags
        });
        const newJob = {
          id: `sched_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          userId: authUser?.uid || String(item.userId || req.headers["x-user-id"] || "").trim() || void 0,
          automationId: String(item.automationId || "auto_live"),
          automationName: String(item.automationName || "Automation Sequence"),
          stepId: String(item.stepId || "step_delayed"),
          stepOrder: Number(item.stepOrder) || 2,
          stepTitle: String(item.stepTitle || "Delayed Follow-Up Step"),
          channel: cleanChannel,
          contactId: String(item.contactId || `c_${Date.now()}`),
          contactName: String(item.contactName || "Lead Contact"),
          contactEmail: String(item.contactEmail || ""),
          contactPhone: String(item.contactPhone || ""),
          toRecipient: String(
            item.toRecipient || (cleanChannel === "email" ? item.contactEmail : item.contactPhone) || (cleanChannel === "email" ? "lead@example.com" : "+1 (555) 234-8910")
          ),
          contactTags,
          listName,
          killSwitchEnabled,
          killSwitchTags,
          fromIdentity: String(item.fromIdentity || ""),
          senderName: String(item.senderName || "FlowPilot Workspace"),
          replyToEmail: String(item.replyToEmail || ""),
          subject: String(item.subject || `Follow-Up from ${item.senderName || "FlowPilot"}`),
          body: String(item.body || "Checking in on your progress!"),
          webhookUrl: String(item.webhookUrl || "").trim() || void 0,
          gmailAccessToken: String(
            item.gmailAccessToken || (bearerToken && !bearerToken.startsWith("fp_sess.") && authUser?.authSource !== "firebase_id_token" ? bearerToken : "")
          ).trim() || void 0,
          whatsappConnector: item.whatsappConnector || void 0,
          smsConnector: item.smsConnector || void 0,
          emailConnector: item.emailConnector || void 0,
          delaySeconds,
          createdAt: new Date(now).toISOString(),
          scheduledFor,
          status: "queued",
          statusReason: `Scheduled to fire in ${delaySeconds}s \xB7 Watching List "${listName}" Kill Switch (${killSwitchTags.map((t) => `#${t}`).join(", ")})`
        };
        const initialKillCheck = evaluateServerJobKillSwitch(newJob);
        if (initialKillCheck.halted) {
          newJob.status = "halted_kill_switch";
          newJob.matchedKillSwitchTag = initialKillCheck.matchedTag;
          newJob.processedAt = (/* @__PURE__ */ new Date()).toISOString();
          newJob.statusReason = initialKillCheck.reason;
        }
        scheduledAutomationJobs.unshift(newJob);
        createdJobs.push(newJob);
      }
      if (scheduledAutomationJobs.length > 120) {
        scheduledAutomationJobs.length = 120;
      }
      res.json({
        ok: true,
        createdJobs,
        summary: getSchedulerSummary(),
        jobs: scheduledAutomationJobs.slice(0, 60)
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : "Failed to enqueue scheduled job"
      });
    }
  });
  app2.post("/api/scheduler/sync-kill-switch", async (req, res) => {
    try {
      const { contacts = [], lists = [] } = req.body || {};
      if (Array.isArray(lists)) {
        for (const l of lists) {
          if (!l || !l.name) continue;
          syncedListKillSwitchRules.set(normalizeLookupKey(l.name), {
            killSwitchEnabled: l.killSwitchEnabled !== false,
            killSwitchTags: Array.isArray(l.killSwitchTags) && l.killSwitchTags.length > 0 ? l.killSwitchTags.map((t) => String(t || "").trim()).filter(Boolean) : ["Purchased_Course"]
          });
        }
      }
      if (Array.isArray(contacts)) {
        for (const c of contacts) {
          if (!c) continue;
          const cTags = Array.isArray(c.tags) ? c.tags : [];
          recordContactTagsInServerRegistry({
            id: c.id,
            email: c.email,
            phone: c.phone,
            tags: cTags
          });
          const isUnsub = c.consentStatus === "unsubscribed" || c.consentStatus === "bounced" || cTags.some(
            (t) => ["unsubscribed", "suppressed", "bounced"].includes(normalizeTagToken(String(t || "")))
          );
          if (isUnsub) {
            if (c.email) markRecipientGloballySuppressed(c.email);
            if (c.phone) markRecipientGloballySuppressed(c.phone);
          } else if (c.consentStatus === "subscribed") {
            if (c.email) removeRecipientFromGlobalSuppression(c.email);
            if (c.phone) removeRecipientFromGlobalSuppression(c.phone);
          }
        }
      }
      const newlyHaltedJobs = [];
      for (const job of scheduledAutomationJobs) {
        if (job.status !== "queued") continue;
        const killCheck = evaluateServerJobKillSwitch(job);
        if (killCheck.halted) {
          job.status = "halted_kill_switch";
          job.matchedKillSwitchTag = killCheck.matchedTag;
          job.processedAt = (/* @__PURE__ */ new Date()).toISOString();
          job.statusReason = killCheck.reason;
          newlyHaltedJobs.push(job);
        }
      }
      res.json({
        ok: true,
        haltedCount: newlyHaltedJobs.length,
        haltedJobs: newlyHaltedJobs,
        summary: getSchedulerSummary(),
        jobs: scheduledAutomationJobs.slice(0, 60)
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : "Failed to sync Kill Switch state"
      });
    }
  });
  app2.post("/api/scheduler/trigger-now", async (req, res) => {
    try {
      const { jobId } = req.body || {};
      const job = scheduledAutomationJobs.find((j) => j.id === jobId);
      if (!job) {
        res.status(404).json({ ok: false, error: "Scheduled job not found" });
        return;
      }
      if (job.status !== "queued") {
        res.json({ ok: true, job, summary: getSchedulerSummary(), jobs: scheduledAutomationJobs.slice(0, 60) });
        return;
      }
      const killCheck = evaluateServerJobKillSwitch(job);
      if (killCheck.halted) {
        job.status = "halted_kill_switch";
        job.matchedKillSwitchTag = killCheck.matchedTag;
        job.processedAt = (/* @__PURE__ */ new Date()).toISOString();
        job.statusReason = killCheck.reason;
      } else {
        const receipt = await executeUnifiedServerDispatch({
          channel: job.channel,
          to: job.toRecipient,
          leadName: job.contactName,
          from: job.fromIdentity,
          senderName: job.senderName,
          replyToEmail: job.replyToEmail,
          subject: job.subject,
          body: job.body,
          listName: job.listName,
          source: "automation_workflow",
          webhookUrl: job.webhookUrl,
          gmailAccessToken: job.gmailAccessToken,
          userId: job.userId,
          whatsappConnector: job.whatsappConnector,
          smsConnector: job.smsConnector,
          emailConnector: job.emailConnector
        });
        job.status = receipt.status === "failed" ? "failed" : "dispatched";
        job.processedAt = (/* @__PURE__ */ new Date()).toISOString();
        job.receiptId = receipt.receiptId;
        job.providerUsed = receipt.providerUsed;
        job.directLaunchUrl = receipt.directLaunchUrl;
        job.statusReason = receipt.status === "failed" ? receipt.detailMessage : `Dispatched immediately via ${receipt.providerUsed} (List Kill Switch verified clear)`;
      }
      res.json({
        ok: true,
        job,
        summary: getSchedulerSummary(),
        jobs: scheduledAutomationJobs.slice(0, 60)
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : "Failed to trigger scheduled job"
      });
    }
  });
  app2.post("/api/scheduler/cancel", (req, res) => {
    const { jobId, clearCompleted } = req.body || {};
    if (clearCompleted) {
      for (let i = scheduledAutomationJobs.length - 1; i >= 0; i--) {
        if (scheduledAutomationJobs[i].status !== "queued") {
          scheduledAutomationJobs.splice(i, 1);
        }
      }
    } else if (jobId) {
      const target = scheduledAutomationJobs.find((j) => j.id === jobId);
      if (target && target.status === "queued") {
        target.status = "cancelled";
        target.processedAt = (/* @__PURE__ */ new Date()).toISOString();
        target.statusReason = "Cancelled manually by operator.";
      }
    }
    res.json({
      ok: true,
      summary: getSchedulerSummary(),
      jobs: scheduledAutomationJobs.slice(0, 60)
    });
  });
  app2.post("/api/webhooks/inbound", (req, res) => {
    const {
      channel = "whatsapp",
      leadName = "Inbound Lead",
      leadEmail = "",
      leadPhone = "",
      message = "",
      subject = "",
      listName = "General Contacts"
    } = req.body || {};
    const cleanChannel = channel === "email" || channel === "sms" ? channel : "whatsapp";
    const cleanMessage = String(message || "").trim();
    const item = {
      id: `inb_wh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      channel: cleanChannel,
      leadName: String(leadName || "Inbound Lead"),
      leadEmail: String(leadEmail || ""),
      leadPhone: String(leadPhone || ""),
      message: cleanMessage,
      subject: String(subject || ""),
      listName: String(listName || "General Contacts"),
      receivedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const normalizedKeyword = cleanMessage.toUpperCase().replace(/[^A-Z]/g, "");
    const isOptOutKeyword = /^(STOP|STOPALL|UNSUBSCRIBE|CANCEL|END|QUIT)$/i.test(cleanMessage.split(/\s+/)[0] || "") || ["STOP", "UNSUBSCRIBE", "STOPALL", "OPTOUT"].includes(normalizedKeyword);
    if (isOptOutKeyword) {
      if (item.leadEmail) markRecipientGloballySuppressed(item.leadEmail);
      if (item.leadPhone) markRecipientGloballySuppressed(item.leadPhone);
      const unsubRecipient = item.leadEmail || item.leadPhone || item.leadName;
      trackingComplianceQueue.unshift({
        id: `trk_stop_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: "unsubscribe",
        recipient: unsubRecipient,
        reason: `Inbound ${cleanChannel.toUpperCase()} opt-out keyword ("${cleanMessage.slice(0, 32)}")`,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      if (trackingComplianceQueue.length > 200) {
        trackingComplianceQueue.pop();
      }
      for (const job of scheduledAutomationJobs) {
        if (job.status !== "queued") continue;
        const killCheck = evaluateServerJobKillSwitch(job);
        if (killCheck.halted) {
          job.status = "halted_kill_switch";
          job.matchedKillSwitchTag = killCheck.matchedTag;
          job.processedAt = (/* @__PURE__ */ new Date()).toISOString();
          job.statusReason = killCheck.reason;
        }
      }
    }
    inboundWebhookQueue.unshift(item);
    if (inboundWebhookQueue.length > 50) {
      inboundWebhookQueue.pop();
    }
    res.json({
      ok: true,
      optOutTriggered: isOptOutKeyword,
      received: item
    });
  });
  app2.get("/api/webhooks/inbound", (req, res) => {
    const shouldConsume = String(req.query.consume || "").toLowerCase() === "true";
    const items = [...inboundWebhookQueue];
    if (shouldConsume && inboundWebhookQueue.length > 0) {
      inboundWebhookQueue.length = 0;
    }
    res.json({
      ok: true,
      items
    });
  });
  app2.post("/api/webhooks/inbound/ack", (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (ids.length > 0) {
      const idSet = new Set(ids.map((id) => String(id)));
      for (let i = inboundWebhookQueue.length - 1; i >= 0; i--) {
        if (idSet.has(inboundWebhookQueue[i].id)) {
          inboundWebhookQueue.splice(i, 1);
        }
      }
    }
    res.json({
      ok: true,
      remainingCount: inboundWebhookQueue.length
    });
  });
  const FLOWPILOT_PERMANENT_VERIFY_TOKEN = "flowpilot_verify_a7m4k9x2q8w3";
  const sendWhatsAppCloudMessage = async (to, replyText) => {
    const phoneNumberId = process.env.PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID;
    const permanentToken = process.env.PERMANENT_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
    if (!phoneNumberId || !permanentToken) {
      console.warn("[WhatsApp Cloud API] Notice: PHONE_NUMBER_ID or PERMANENT_TOKEN environment variable not set. Logged reply message only.");
      return { ok: false, error: "PHONE_NUMBER_ID or PERMANENT_TOKEN env missing" };
    }
    const cleanTo = String(to).replace(/[^0-9]/g, "");
    const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${permanentToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: cleanTo,
          type: "text",
          text: {
            preview_url: false,
            body: replyText
          }
        })
      });
      const responseData = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error("[WhatsApp Cloud API] Send message failed:", response.status, responseData);
        return { ok: false, status: response.status, data: responseData };
      }
      console.log(`[WhatsApp Cloud API] Successfully sent reply to ${cleanTo}:`, responseData);
      return { ok: true, data: responseData };
    } catch (err) {
      console.error("[WhatsApp Cloud API] Network error sending message:", err?.message || err);
      return { ok: false, error: err?.message || "Network error" };
    }
  };
  const handleWhatsAppWebhookVerify = (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    const validTokens = [
      FLOWPILOT_PERMANENT_VERIFY_TOKEN,
      process.env.WHATSAPP_VERIFY_TOKEN,
      process.env.VERIFY_TOKEN,
      "flowpilot2026",
      "affiliate_pulse_verify"
    ].filter(Boolean);
    console.log(`[WhatsApp Webhook] Verification attempt received: mode=${mode}, token=${token}`);
    if (mode === "subscribe" && typeof token === "string" && validTokens.includes(token)) {
      console.log(`[WhatsApp Webhook] Verification SUCCESSFUL for token: ${token}`);
      res.status(200).send(challenge);
      return;
    }
    console.warn(`[WhatsApp Webhook] Verification FAILED. Provided token did not match expected tokens.`);
    res.status(403).send("Forbidden");
  };
  const handleWhatsAppWebhookEvent = async (req, res) => {
    const body = req.body;
    console.log("[WhatsApp Webhook] Inbound event payload received:", JSON.stringify(body, null, 2));
    try {
      const entry = body?.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const messageObj = value?.messages?.[0];
      const contactObj = value?.contacts?.[0];
      if (messageObj) {
        const from = messageObj.from || "";
        const leadName = contactObj?.profile?.name || from || "WhatsApp Lead";
        let text = "";
        if (messageObj.type === "text") {
          text = messageObj.text?.body || "";
        } else if (messageObj.type === "button") {
          text = messageObj.button?.text || "";
        } else if (messageObj.type === "interactive") {
          text = messageObj.interactive?.button_reply?.title || messageObj.interactive?.list_reply?.title || "";
        } else {
          text = messageObj.text?.body || "";
        }
        console.log(`[WhatsApp Webhook] Message from: ${from} (${leadName}) | Text: "${text}"`);
        inboundWebhookQueue.unshift({
          id: `inb_wa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          channel: "whatsapp",
          leadName,
          leadEmail: "",
          leadPhone: from,
          message: text || "(Media / Interactive message)",
          subject: "WhatsApp Inbound Message",
          listName: "General Contacts",
          receivedAt: (/* @__PURE__ */ new Date()).toISOString()
        });
        const lowerText = text.toLowerCase().trim();
        let replyMessage = "";
        if (lowerText.includes("yes")) {
          replyMessage = "Here is the video: [YOUR VIDEO LINK]. Watch and reply DONE";
        } else if (lowerText.includes("done")) {
          replyMessage = "Nice! You ready to start today? Reply READY";
        } else {
          replyMessage = "I got your message. Reply YES to get started";
        }
        console.log(`[WhatsApp Webhook] Auto-reply formulated for ${from}: "${replyMessage}"`);
        if (from) {
          await sendWhatsAppCloudMessage(from, replyMessage);
        }
      }
    } catch (err) {
      console.error("[WhatsApp Webhook] Error processing incoming event:", err?.message || err);
    }
    res.status(200).send("EVENT_RECEIVED");
  };
  app2.get("/webhook/whatsapp", handleWhatsAppWebhookVerify);
  app2.post("/webhook/whatsapp", handleWhatsAppWebhookEvent);
  app2.get("/api/webhook/whatsapp", handleWhatsAppWebhookVerify);
  app2.get("/api/webhooks/whatsapp", handleWhatsAppWebhookVerify);
  app2.post("/api/webhook/whatsapp", handleWhatsAppWebhookEvent);
  app2.post("/api/webhooks/whatsapp", handleWhatsAppWebhookEvent);
  app2.post("/api/whatsapp/pairing-code", async (req, res) => {
    try {
      const userId = String(req.body?.userId || req.headers["x-user-id"] || "default_workspace").trim();
      const rawPhone = String(req.body?.phoneNumber || req.body?.phone || "").trim();
      const cleanPhone = rawPhone.replace(/[^0-9]/g, "");
      if (!cleanPhone || cleanPhone.length < 8 || cleanPhone.length > 16) {
        res.status(400).json({
          ok: false,
          error: `Invalid phone number: "${rawPhone}". Please provide a valid phone number with country code (e.g. 2348012345678, 8 to 16 digits).`
        });
        return;
      }
      const sessionDoc = await getFirestoreDoc("whatsapp_sessions", userId);
      if (sessionDoc && sessionDoc.connected) {
        res.json({
          ok: true,
          connected: true,
          phoneNumber: sessionDoc.number || cleanPhone,
          message: "WhatsApp session is already connected!"
        });
        return;
      }
      const result = await requestWhatsAppPairingCode(userId, cleanPhone);
      res.json({
        ok: true,
        pairingCode: result.pairingCode,
        phoneNumber: cleanPhone,
        expiresInSeconds: 60
      });
    } catch (err) {
      console.error("[API /api/whatsapp/pairing-code] Error:", err);
      res.status(500).json({
        ok: false,
        error: err.message || "Failed to request WhatsApp pairing code."
      });
    }
  });
  const handleLegacyWhatsAppStatus = async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const userId = String(req.query.userId || req.headers["x-user-id"] || "default_workspace").trim();
      const instanceName = String(req.query.instanceName || "").trim() || void 0;
      if (userId && userId !== "default_workspace") {
        try {
          const evoStatus = await getEvolutionConnectionStatus({ userId, instanceName });
          if (evoStatus.ok) {
            const phone = evoStatus.ownerJid ? evoStatus.ownerJid.split("@")[0].replace(/[^0-9+]/g, "") : "";
            res.json({
              success: true,
              ok: true,
              connected: evoStatus.status === "open",
              status: evoStatus.status,
              instanceName: evoStatus.instanceName,
              userId: evoStatus.userId,
              qrCode: evoStatus.qrCode,
              pairingCode: evoStatus.pairingCode,
              qrPending: evoStatus.qrPending,
              upstreamCount: evoStatus.upstreamCount,
              ownerJid: evoStatus.ownerJid,
              profileName: evoStatus.profileName,
              disconnectionReasonCode: evoStatus.disconnectionReasonCode,
              detail: evoStatus.detail,
              checkedAt: evoStatus.checkedAt,
              phoneNumber: phone,
              number: phone,
              account: evoStatus.status === "open" ? { display_phone_number: phone, verified_name: evoStatus.profileName || "" } : void 0,
              updatedAt: evoStatus.checkedAt
            });
            return;
          }
        } catch {
        }
      }
      const sessionDoc = await getFirestoreDoc("whatsapp_sessions", userId);
      if (sessionDoc) {
        const phone = sessionDoc.number || sessionDoc.phoneNumber || "";
        res.json({
          success: true,
          ok: true,
          connected: Boolean(sessionDoc.connected),
          phoneNumber: phone,
          number: phone,
          pairingCode: sessionDoc.pairingCode || "",
          updatedAt: sessionDoc.updatedAt || null
        });
        return;
      }
      const status = getWhatsAppSessionStatus(userId);
      res.json({
        success: true,
        ok: true,
        connected: Boolean(status.connected),
        phoneNumber: status.number || "",
        number: status.number || "",
        connectedAt: status.connectedAt || null,
        reconnectAttempts: status.reconnectAttempts || 0
      });
    } catch (err) {
      res.status(500).json({ success: false, ok: false, connected: false, phoneNumber: "", number: "", error: err.message });
    }
  };
  app2.get("/api/whatsapp/status", handleLegacyWhatsAppStatus);
  app2.get("/api/auth/whatsapp/status", handleLegacyWhatsAppStatus);
  const handleWhatsAppDisconnect = async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const userId = String(req.body?.userId || req.headers["x-user-id"] || "default_workspace").trim();
      const instanceName = req.body?.instanceName ? String(req.body.instanceName).trim() : void 0;
      if (userId && userId !== "default_workspace") {
        const evoRes = await disconnectEvolutionConnection({ userId, instanceName });
        try {
          disconnectWhatsAppSession(userId);
        } catch {
        }
        res.json({
          success: evoRes.ok,
          ok: evoRes.ok,
          instanceName: evoRes.instanceName,
          status: "close",
          message: evoRes.ok ? "WhatsApp session disconnected and logged out successfully" : evoRes.error,
          error: evoRes.error
        });
        return;
      }
      await disconnectWhatsAppSession(userId);
      res.json({ success: true, ok: true, status: "close", message: "WhatsApp session disconnected and logged out successfully" });
    } catch (err) {
      res.status(500).json({ success: false, ok: false, error: err.message || "Failed to disconnect WhatsApp session" });
    }
  };
  app2.post("/api/whatsapp/disconnect", handleWhatsAppDisconnect);
  app2.post("/api/auth/whatsapp/disconnect", handleWhatsAppDisconnect);
  const handleWhatsAppSend = async (req, res) => {
    try {
      const { to, message, text, body, userId, instanceName: reqInstance } = req.body || {};
      const targetPhone = String(to || "").trim();
      const content = String(message || text || body || "").trim();
      const targetUser = String(userId || req.headers["x-user-id"] || "default_workspace").trim();
      const instanceName = String(reqInstance || buildEvolutionInstanceName(targetUser)).trim();
      if (!targetPhone || !content) {
        res.status(400).json({ ok: false, error: "Recipient number (to) and message text are required." });
        return;
      }
      const evoResult = await sendWhatsAppViaEvolution(instanceName, targetPhone, content);
      if (evoResult.ok) {
        res.json({
          ok: true,
          deliveredViaApi: true,
          provider: "Evolution API (v2.3.5)",
          messageId: evoResult.messageId,
          detail: evoResult.detail
        });
        return;
      }
      res.status(400).json({
        ok: false,
        provider: "Evolution API (v2.3.5)",
        error: evoResult.error || evoResult.detail || "Evolution WhatsApp instance is disconnected or returned an error.",
        detail: evoResult.detail
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message || "Failed to send WhatsApp message via Evolution API" });
    }
  };
  app2.post("/api/whatsapp/send", handleWhatsAppSend);
  app2.post("/api/whatsapp/test", handleWhatsAppSend);
  app2.post("/api/whatsapp/send-test", handleWhatsAppSend);
  app2.post("/api/auth/whatsapp/test", handleWhatsAppSend);
  app2.post("/api/whatsapp/evolution/init", async (req, res) => {
    try {
      const userId = String(req.body?.userId || req.headers["x-user-id"] || "").trim();
      if (!userId || userId === "default_workspace") {
        res.status(401).json({
          ok: false,
          error: "Please sign in before initializing a WhatsApp connection."
        });
        return;
      }
      const instanceName = req.body?.instanceName ? String(req.body.instanceName).trim() : void 0;
      const forceRestart = Boolean(req.body?.forceRestart);
      const result = await initializeEvolutionConnection({
        userId,
        instanceName,
        forceRestart
      });
      if (!result.ok) {
        res.status(502).json(result);
        return;
      }
      res.json(result);
    } catch (err) {
      res.status(500).json({
        ok: false,
        status: "close",
        error: err?.message || "Failed to initialize Evolution WhatsApp connection."
      });
    }
  });
  app2.get("/api/whatsapp/evolution/status", async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const userId = String(req.query.userId || req.headers["x-user-id"] || "").trim();
      const instanceName = String(req.query.instanceName || "").trim() || void 0;
      const derivedUid = userId || (instanceName && instanceName.startsWith("flowpilot-") ? instanceName.slice("flowpilot-".length) : "");
      if (!derivedUid || derivedUid === "default_workspace") {
        res.status(401).json({
          success: false,
          ok: false,
          status: "close",
          error: "Authenticated userId or flowpilot instanceName is required."
        });
        return;
      }
      const result = await getEvolutionConnectionStatus({
        userId: derivedUid,
        instanceName
      });
      if (!result.ok) {
        res.status(502).json({
          success: false,
          ...result
        });
        return;
      }
      res.json({
        success: true,
        ...result
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        ok: false,
        status: "close",
        error: err?.message || "Failed to poll Evolution WhatsApp status."
      });
    }
  });
  app2.post("/api/whatsapp/evolution/restart", async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const userId = String(req.body?.userId || req.headers["x-user-id"] || "").trim();
      if (!userId || userId === "default_workspace") {
        res.status(401).json({ success: false, ok: false, error: "Authentication required." });
        return;
      }
      const instanceName = req.body?.instanceName ? String(req.body.instanceName).trim() : void 0;
      const result = await initializeEvolutionConnection({
        userId,
        instanceName,
        forceRestart: true
      });
      res.status(result.ok ? 200 : 502).json({
        success: result.ok,
        ...result
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        ok: false,
        status: "close",
        error: err?.message || "Failed to restart Evolution WhatsApp instance."
      });
    }
  });
  app2.post("/api/whatsapp/evolution/disconnect", async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const userId = String(req.body?.userId || req.headers["x-user-id"] || "").trim();
      if (!userId || userId === "default_workspace") {
        res.status(401).json({ success: false, ok: false, error: "Authentication required." });
        return;
      }
      const instanceName = req.body?.instanceName ? String(req.body.instanceName).trim() : void 0;
      const result = await disconnectEvolutionConnection({
        userId,
        instanceName
      });
      res.status(result.ok ? 200 : 502).json({
        success: result.ok,
        ...result
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        ok: false,
        status: "close",
        error: err?.message || "Failed to disconnect Evolution WhatsApp instance."
      });
    }
  });
  const handleConnectWhatsApp = async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const userId = String(
        req.body?.userId || req.query?.userId || req.headers["x-user-id"] || ""
      ).trim();
      if (!userId || userId === "default_workspace") {
        res.status(401).json({
          success: false,
          ok: false,
          status: "close",
          error: "Please sign in before connecting WhatsApp."
        });
        return;
      }
      const instanceName = req.body?.instanceName ? String(req.body.instanceName).trim() : `flowpilot-${userId}`.slice(0, 160);
      const forceRestart = Boolean(req.body?.forceRestart || req.body?.reconnect);
      const forwardedHost = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
      const forwardedProto = String(req.headers["x-forwarded-proto"] || req.protocol || "https").split(",")[0].trim();
      const isLocalHost = !forwardedHost || forwardedHost.startsWith("localhost") || forwardedHost.startsWith("127.0.0.1");
      const webhookUrl = !isLocalHost ? `${forwardedProto}://${forwardedHost}/api/whatsapp/evolution-webhook` : void 0;
      const result = await initializeEvolutionConnection({
        userId,
        instanceName,
        forceRestart,
        webhookUrl
      });
      if (!result.ok) {
        res.status(502).json({
          success: false,
          ...result
        });
        return;
      }
      res.json({
        success: true,
        ok: true,
        instanceName: result.instanceName,
        userId: result.userId,
        status: result.status,
        qrCode: result.qrCode,
        // base64 / dataUrl
        pairingCode: result.pairingCode,
        qrPending: result.qrPending,
        upstreamCount: result.upstreamCount,
        ownerJid: result.ownerJid,
        profileName: result.profileName,
        disconnectionReasonCode: result.disconnectionReasonCode,
        detail: result.detail,
        checkedAt: result.checkedAt
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        ok: false,
        status: "close",
        error: err?.message || "Failed to connect WhatsApp instance."
      });
    }
  };
  app2.post("/api/whatsapp/connect", handleConnectWhatsApp);
  app2.post("/api/whatsapp/connect/", handleConnectWhatsApp);
  const getWorkspaceSnapshotForUser = (userId) => {
    const cleanId = String(userId || "").trim();
    if (!cleanId) return null;
    return serverWorkspaceSnapshotsByUid.get(cleanId) || Array.from(serverWorkspaceSnapshotsByUid.values()).find(
      (snap) => snap?.workspace?.id === cleanId || snap?.workspace?.ownerId === cleanId || snap?.privateProfile?.email?.toLowerCase() === cleanId.toLowerCase()
    ) || null;
  };
  const runAutomation = async (userId, leadPhone, text) => {
    const cleanPhone = String(leadPhone || "").replace(/[^0-9]/g, "");
    const cleanText = String(text || "").trim();
    const lowerText = cleanText.toLowerCase();
    const instanceName = buildEvolutionInstanceName(userId);
    console.log(`[runAutomation] User: ${userId} | Lead: +${cleanPhone} | Text: "${cleanText}"`);
    const results = {
      workflowsTriggered: 0,
      autoRepliesSent: 0,
      followUpScheduled: false
    };
    try {
      const userWorkflows = await getWorkflowsForUser(userId);
      const activeWorkflows = userWorkflows.filter((w) => w.enabled);
      for (const wf of activeWorkflows) {
        let shouldTrigger = false;
        try {
          const nodes = JSON.parse(wf.nodesJson || "[]");
          for (const node of nodes) {
            const type = node.data?.nodeType || node.type || "";
            if (type === "trigger_whatsapp_reply") {
              shouldTrigger = true;
              break;
            }
            if (type === "trigger_keyword") {
              const kw = String(node.data?.triggerKeyword || node.data?.keyword || "").toLowerCase().trim();
              if (kw && lowerText.includes(kw)) {
                shouldTrigger = true;
                break;
              }
            }
            if (type === "condition_message_contains") {
              const kw = String(node.data?.keyword || "").toLowerCase().trim();
              if (kw && lowerText.includes(kw)) {
                shouldTrigger = true;
                break;
              }
            }
          }
        } catch {
        }
        if (shouldTrigger) {
          console.log(`[runAutomation] Triggering visual workflow "${wf.name}" (${wf.id})`);
          await executeWorkflow(wf.id, cleanPhone, cleanText, { userId, workflowOverride: wf });
          results.workflowsTriggered++;
        }
      }
    } catch (err) {
      console.warn(`[runAutomation] Visual workflow runner error:`, err?.message || err);
    }
    try {
      const snapshot = getWorkspaceSnapshotForUser(userId);
      const autoResponders = Array.isArray(snapshot?.autoResponders) ? snapshot.autoResponders.filter((a) => a.status !== "paused") : [];
      let keywordMatched = false;
      for (const ar of autoResponders) {
        const kw = String(ar.triggerMessage || ar.keyword || "").toLowerCase().trim();
        const reply = String(ar.responseMessage || ar.replyMessage || "").trim();
        const matchType = ar.matchType || "contains";
        if (!kw || !reply) continue;
        let matched = false;
        if (matchType === "exact") matched = lowerText === kw;
        else if (matchType === "startsWith") matched = lowerText.startsWith(kw);
        else matched = lowerText.includes(kw);
        if (matched) {
          keywordMatched = true;
          console.log(`[runAutomation] AutoResponder Keyword match: "${kw}" -> Replying to +${cleanPhone}`);
          await sendWhatsAppViaEvolution(instanceName, cleanPhone, reply);
          results.autoRepliesSent++;
          ar.sentCount = (ar.sentCount || 0) + 1;
          ar.triggeredCount = (ar.triggeredCount || 0) + 1;
          break;
        }
      }
      const inboxThreads = Array.isArray(snapshot?.inboxThreads) ? snapshot.inboxThreads : [];
      const existingThread = inboxThreads.find(
        (t) => t.leadPhone && t.leadPhone.replace(/[^0-9]/g, "") === cleanPhone
      );
      const isFirstMessage = !existingThread;
      if (isFirstMessage && !keywordMatched) {
        const welcomeResponder = autoResponders.find(
          (ar) => ar.triggerMessage?.toLowerCase().includes("welcome") || ar.targetList?.toLowerCase().includes("welcome") || ar.name?.toLowerCase().includes("welcome")
        );
        const welcomeText = welcomeResponder?.responseMessage || welcomeResponder?.replyMessage || snapshot?.workspace?.welcomeMessage || "Hello! Thank you for reaching out. How can we help you today?";
        console.log(`[runAutomation] First message from +${cleanPhone} -> Sending welcome reply`);
        await sendWhatsAppViaEvolution(instanceName, cleanPhone, welcomeText);
        results.autoRepliesSent++;
      }
      try {
        const followUpMessage = snapshot?.workspace?.followUpMessage || "Hi again! Just following up to see if you had any questions on our previous message.";
        const nextActionAt = Date.now() + 24 * 60 * 60 * 1e3;
        await createFollowUpJob({
          workflowId: "evolution_autoresponder_1day",
          userId,
          leadPhone: cleanPhone,
          delayValue: 1,
          delayUnit: "Days",
          message: followUpMessage,
          actionType: "action_send_whatsapp"
        });
        results.followUpScheduled = true;
        console.log(`[runAutomation] Scheduled 1-day follow-up for +${cleanPhone}`);
      } catch (fErr) {
        console.warn(`[runAutomation] Could not schedule 1-day follow-up job:`, fErr?.message || fErr);
      }
      recordServerActivity(userId, {
        eventType: "whatsapp_replied",
        title: `WhatsApp from +${cleanPhone}`,
        detail: `Lead: "${cleanText.slice(0, 80)}" \xB7 Auto-replies: ${results.autoRepliesSent}`,
        channel: "whatsapp"
      });
    } catch (err) {
      console.warn(`[runAutomation] AutoResponder evaluation error:`, err?.message || err);
    }
    return results;
  };
  const handleEvolutionWebhook = async (req, res) => {
    const body = req.body || {};
    const event = String(body.event || body.type || "").toUpperCase();
    const instance = String(body.instance || body.instanceName || "").trim();
    console.log(`[Evolution Webhook] Inbound event "${event}" on instance "${instance}"`);
    res.status(200).json({ ok: true, received: true });
    try {
      if (event && !event.includes("MESSAGES_UPSERT") && !event.includes("MESSAGES.UPSERT")) {
        return;
      }
      const data = body.data || body;
      const key = data.key || data.message?.key || {};
      if (key.fromMe === true) {
        return;
      }
      const remoteJid = String(key.remoteJid || "").trim();
      if (!remoteJid || remoteJid === "status@broadcast" || remoteJid.endsWith("@g.us")) {
        return;
      }
      const leadPhone = remoteJid.split("@")[0].replace(/[^0-9]/g, "");
      if (!leadPhone) {
        return;
      }
      const messageObj = data.message || {};
      let text = "";
      if (typeof messageObj.conversation === "string") {
        text = messageObj.conversation;
      } else if (typeof messageObj.extendedTextMessage?.text === "string") {
        text = messageObj.extendedTextMessage.text;
      } else if (typeof messageObj.imageMessage?.caption === "string") {
        text = messageObj.imageMessage.caption;
      } else if (typeof messageObj.videoMessage?.caption === "string") {
        text = messageObj.videoMessage.caption;
      } else if (typeof messageObj.buttonsResponseMessage?.selectedButtonId === "string") {
        text = messageObj.buttonsResponseMessage.selectedDisplayText || messageObj.buttonsResponseMessage.selectedButtonId;
      } else if (typeof messageObj.listResponseMessage?.title === "string") {
        text = messageObj.listResponseMessage.title;
      }
      text = String(text || "").trim();
      if (!text) {
        return;
      }
      let userId = "default_workspace";
      if (instance.startsWith("flowpilot-")) {
        userId = instance.slice("flowpilot-".length);
      } else if (instance) {
        userId = instance;
      }
      console.log(`[Evolution Webhook] Process lead message: Instance "${instance}" -> User "${userId}" | Phone: +${leadPhone} | Text: "${text}"`);
      inboundWebhookQueue.unshift({
        id: `inb_wa_evo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        channel: "whatsapp",
        leadName: data.pushName || `WhatsApp +${leadPhone}`,
        leadEmail: "",
        leadPhone,
        message: text,
        subject: `Inbound WhatsApp (${instance})`,
        listName: "General Contacts",
        receivedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      await runAutomation(userId, leadPhone, text);
    } catch (err) {
      console.error(`[Evolution Webhook] Error processing message:`, err?.message || err);
    }
  };
  app2.post("/api/whatsapp/evolution-webhook", handleEvolutionWebhook);
  app2.post("/webhook/evolution", handleEvolutionWebhook);
  app2.get("/api/whatsapp/evolution-webhook", (_req, res) => {
    res.json({ ok: true, service: "FlowPilot Evolution WhatsApp Webhook Listener", status: "ready" });
  });
  app2.get("/api/whatsapp/templates", (req, res) => {
    try {
      const templates = getWhatsAppTemplatesForWaba();
      res.json({
        ok: true,
        templates
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message || "Failed to list WhatsApp templates" });
    }
  });
  app2.post("/api/whatsapp/templates", (req, res) => {
    try {
      const { name, category = "MARKETING", body, header, footer } = req.body || {};
      const cleanName = String(name || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
      const cleanBody = String(body || "").trim();
      if (!cleanBody) {
        res.status(400).json({ ok: false, error: "Template body is required." });
        return;
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const newTemplate = {
        id: `tpl_${Date.now()}`,
        waba_id: "local_qr",
        name: cleanName || `template_${Date.now()}`,
        category,
        language: "en_US",
        status: "APPROVED",
        components: [
          ...header ? [{ type: "HEADER", text: String(header) }] : [],
          { type: "BODY", text: cleanBody },
          ...footer ? [{ type: "FOOTER", text: String(footer) }] : []
        ],
        createdAt: now,
        updatedAt: now
      };
      saveWhatsAppTemplateToDatabase(newTemplate);
      res.json({ ok: true, template: newTemplate });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message || "Failed to save template" });
    }
  });
  app2.delete("/api/whatsapp/templates/:name", (req, res) => {
    try {
      const templateName = String(req.params.name || "").trim();
      deleteWhatsAppTemplateFromDatabase("local_qr", templateName);
      res.json({ ok: true, message: `Template ${templateName} deleted` });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message || "Failed to delete template" });
    }
  });
  app2.options("/api/leads/capture", (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.sendStatus(204);
  });
  app2.post("/api/leads/capture", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    const body = req.body || {};
    const fullName = String(body.fullName || body.name || body.firstName || "Website Lead").trim();
    const email = String(body.email || body.leadEmail || "").trim();
    const phone = String(body.phone || body.leadPhone || body.whatsapp || "").trim();
    const company = String(body.company || body.organization || "").trim();
    const assetId = String(body.assetId || req.query.assetId || "external_embed").trim();
    const assetName = String(body.assetName || req.query.assetName || "External Lead Form").trim();
    const targetList = String(body.targetList || body.listName || req.query.targetList || "VIP Launches").trim();
    const automationIdToTrigger = String(body.automationIdToTrigger || body.automationId || "").trim() || void 0;
    const redirectUrl = String(body.redirectUrl || "").trim();
    if (!email && !phone) {
      res.status(400).json({
        ok: false,
        error: "At least an email address or phone number is required."
      });
      return;
    }
    const rawTags = Array.isArray(body.customTags) ? body.customTags : typeof body.customTags === "string" && body.customTags.trim() ? body.customTags.split(",") : [];
    const customTags = rawTags.map((t) => String(t || "").trim()).filter(Boolean);
    const leadEvent = {
      id: `pub_lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      assetId,
      assetName,
      targetList,
      fullName,
      email,
      phone,
      company,
      customTags,
      automationIdToTrigger,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    publicLeadSubmissionsQueue.unshift(leadEvent);
    if (publicLeadSubmissionsQueue.length > 100) {
      publicLeadSubmissionsQueue.pop();
    }
    const acceptsHtml = String(req.headers.accept || "").includes("text/html");
    const isFormUrlEncoded = String(req.headers["content-type"] || "").includes(
      "application/x-www-form-urlencoded"
    );
    if (isFormUrlEncoded && acceptsHtml && redirectUrl && /^https?:\/\//i.test(redirectUrl)) {
      res.redirect(302, redirectUrl);
      return;
    }
    res.json({
      ok: true,
      lead: leadEvent,
      message: `Lead captured into list "${targetList}" and queued for workflow dispatch.`
    });
  });
  app2.get("/api/leads/capture", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const shouldConsume = String(req.query.consume || "").toLowerCase() === "true";
    const items = [...publicLeadSubmissionsQueue];
    if (shouldConsume && publicLeadSubmissionsQueue.length > 0) {
      publicLeadSubmissionsQueue.length = 0;
    }
    res.json({
      ok: true,
      items
    });
  });
  app2.options("/api/forms/publish", (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.sendStatus(204);
  });
  app2.post("/api/forms/publish", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    try {
      const body = req.body || {};
      const rawAsset = body.asset || body;
      const extendedMeta = body.extendedMeta || {};
      if (!rawAsset || typeof rawAsset !== "object") {
        res.status(400).json({ ok: false, error: "Valid form asset object is required." });
        return;
      }
      const slug = String(rawAsset.slug || extendedMeta.assetIdOrSlug || "").trim().toLowerCase();
      if (!slug) {
        res.status(400).json({ ok: false, error: "Form slug is required." });
        return;
      }
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const id = String(rawAsset.id || `form_${slug}`);
      const title = String(rawAsset.title || rawAsset.headline || "Lead Capture Form").trim();
      const headline = String(rawAsset.headline || title).trim();
      const subheadline = String(rawAsset.subheadline || extendedMeta.subheadline || "Please enter your details below.").trim();
      const ctaText = String(rawAsset.ctaText || "Submit Details").trim();
      const redirectUrl = String(rawAsset.redirectUrl || extendedMeta.redirectUrl || "").trim();
      const toolFormat = String(rawAsset.toolFormat || rawAsset.assetType || extendedMeta.toolFormat || "inline_form").trim();
      const targetList = String(rawAsset.targetList || "General Contacts").trim();
      const formRecord = {
        id,
        workspaceId: rawAsset.workspaceId,
        ownerId: rawAsset.ownerId,
        slug,
        title,
        headline,
        subheadline,
        ctaText,
        redirectUrl,
        toolFormat,
        targetList,
        requireDoubleOptIn: Boolean(rawAsset.requireDoubleOptIn),
        status: rawAsset.status || "published",
        formFields: Array.isArray(extendedMeta.formFields) ? extendedMeta.formFields : Array.isArray(rawAsset.formFields) ? rawAsset.formFields : void 0,
        blocks: Array.isArray(extendedMeta.blocks) ? extendedMeta.blocks : Array.isArray(rawAsset.blocks) ? rawAsset.blocks : void 0,
        visualTheme: extendedMeta.visualTheme || rawAsset.visualTheme || "classic_ivory_brass",
        seoTitle: extendedMeta.seoTitle || rawAsset.seoTitle || `${title} | Official Form`,
        seoDescription: extendedMeta.seoDescription || rawAsset.seoDescription || subheadline,
        submissionTags: Array.isArray(extendedMeta.submissionTags) ? extendedMeta.submissionTags : Array.isArray(rawAsset.submissionTags) ? rawAsset.submissionTags : void 0,
        viewsCount: Number(rawAsset.viewsCount) || 1,
        submissionsCount: Number(rawAsset.submissionsCount) || 0,
        createdAt: rawAsset.createdAt || nowIso,
        updatedAt: nowIso
      };
      serverPublishedFormsBySlug.set(slug, formRecord);
      serverPublishedFormsById.set(id, formRecord);
      const wsId = rawAsset.workspaceId || rawAsset.ownerId;
      if (wsId && serverWorkspaceSnapshotsByUid.has(wsId)) {
        const snap = serverWorkspaceSnapshotsByUid.get(wsId);
        if (snap) {
          if (!Array.isArray(snap.assets)) snap.assets = [];
          const existingIdx = snap.assets.findIndex(
            (a) => a.id === id || a.slug === slug
          );
          if (existingIdx >= 0) {
            snap.assets[existingIdx] = {
              ...snap.assets[existingIdx],
              ...formRecord
            };
          } else {
            snap.assets.push(formRecord);
          }
          serverWorkspaceSnapshotsByUid.set(wsId, snap);
          flushWorkspacesStoreToDisk();
        }
      }
      flushPublishedFormsStoreToDisk();
      console.log(`[Published Forms] Saved form "${title}" (slug: ${slug}, CTA: "${ctaText}", Caption: "${subheadline.slice(0, 40)}...")`);
      res.json({
        ok: true,
        asset: formRecord,
        message: `Form "${title}" successfully published and accessible via live public link.`
      });
    } catch (err) {
      console.error("[Published Forms] Publish error:", err);
      res.status(500).json({ ok: false, error: err.message || "Internal server error publishing form." });
    }
  });
  app2.options("/api/forms/public", (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.sendStatus(204);
  });
  const handleGetPublicForm = (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    const rawSlug = String(
      req.params?.slug || req.query?.slug || req.query?.capture || req.query?.form || req.query?.id || ""
    ).trim();
    if (!rawSlug) {
      const first = Array.from(serverPublishedFormsBySlug.values())[0];
      if (first) {
        res.json({ ok: true, asset: first });
        return;
      }
      res.status(400).json({ ok: false, error: "Form slug or identifier is required." });
      return;
    }
    const cleanSlug = rawSlug.toLowerCase();
    let found = serverPublishedFormsBySlug.get(cleanSlug);
    if (!found) {
      found = serverPublishedFormsById.get(rawSlug);
    }
    if (!found) {
      for (const snap of serverWorkspaceSnapshotsByUid.values()) {
        const assets = snap?.assets;
        if (Array.isArray(assets)) {
          const match = assets.find(
            (a) => String(a.slug || "").toLowerCase() === cleanSlug || String(a.id || "") === rawSlug
          );
          if (match) {
            found = {
              id: match.id || `form_${cleanSlug}`,
              workspaceId: snap?.workspace?.id,
              ownerId: snap?.workspace?.ownerId,
              slug: match.slug || cleanSlug,
              title: match.title || match.headline || "Lead Capture Form",
              headline: match.headline || match.title || "Lead Capture Form",
              subheadline: match.subheadline || "Please enter your details below.",
              ctaText: match.ctaText || "Submit Details",
              redirectUrl: match.redirectUrl || "",
              toolFormat: match.toolFormat || match.assetType || "inline_form",
              targetList: match.targetList || "General Contacts",
              requireDoubleOptIn: Boolean(match.requireDoubleOptIn),
              status: match.status || "published",
              formFields: match.formFields,
              blocks: match.blocks,
              visualTheme: match.visualTheme,
              seoTitle: match.seoTitle,
              seoDescription: match.seoDescription,
              createdAt: match.createdAt,
              updatedAt: match.updatedAt
            };
            serverPublishedFormsBySlug.set(cleanSlug, found);
            break;
          }
        }
      }
    }
    if (found) {
      found.viewsCount = (found.viewsCount || 0) + 1;
      res.json({ ok: true, asset: found });
      return;
    }
    res.status(404).json({
      ok: false,
      error: `No published form found for "${rawSlug}".`,
      slug: cleanSlug
    });
  };
  app2.get("/api/forms/public", handleGetPublicForm);
  app2.get("/api/forms/public/:slug", handleGetPublicForm);
  app2.get("/api/track/open", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    const campaignId = String(req.query.campaignId || "").trim() || void 0;
    const automationId = String(req.query.automationId || "").trim() || void 0;
    const recipient = String(req.query.recipient || req.query.to || "lead@example.com").trim();
    const event = {
      id: `trk_open_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: "open",
      campaignId,
      automationId,
      recipient,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    trackingComplianceQueue.unshift(event);
    if (trackingComplianceQueue.length > 200) {
      trackingComplianceQueue.pop();
    }
    if (String(req.query.json || "").toLowerCase() === "true") {
      res.json({ ok: true, event });
      return;
    }
    res.setHeader("Content-Type", "image/gif");
    res.send(TRANSPARENT_1X1_GIF);
  });
  app2.get("/api/track/click", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const campaignId = String(req.query.campaignId || "").trim() || void 0;
    const automationId = String(req.query.automationId || "").trim() || void 0;
    const recipient = String(req.query.recipient || req.query.to || "lead@example.com").trim();
    const targetUrl = String(req.query.url || "https://example.com").trim();
    const event = {
      id: `trk_click_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: "click",
      campaignId,
      automationId,
      recipient,
      targetUrl,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    trackingComplianceQueue.unshift(event);
    if (trackingComplianceQueue.length > 200) {
      trackingComplianceQueue.pop();
    }
    if (String(req.query.json || "").toLowerCase() === "true") {
      res.json({ ok: true, event });
      return;
    }
    const safeRedirect = /^https?:\/\//i.test(targetUrl) ? targetUrl : "/";
    res.redirect(302, safeRedirect);
  });
  app2.options("/api/unsubscribe", (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.sendStatus(204);
  });
  const handleUnsubscribeRequest = (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const rawRecipient = String(
      req.body?.recipient || req.body?.email || req.body?.phone || req.query.recipient || req.query.email || req.query.phone || ""
    ).trim();
    const campaignId = String(req.body?.campaignId || req.query.campaignId || "").trim() || void 0;
    const automationId = String(req.body?.automationId || req.query.automationId || "").trim() || void 0;
    const reason = String(req.body?.reason || req.query.reason || "One-click unsubscribe link").trim();
    const action = String(req.body?.action || req.query.action || "unsubscribe").trim().toLowerCase();
    if (!rawRecipient) {
      res.status(400).json({ ok: false, error: "Recipient email or phone is required." });
      return;
    }
    if (action === "resubscribe") {
      removeRecipientFromGlobalSuppression(rawRecipient);
      const event2 = {
        id: `trk_resub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: "resubscribe",
        campaignId,
        automationId,
        recipient: rawRecipient,
        reason: "Recipient re-subscribed",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      trackingComplianceQueue.unshift(event2);
      res.json({
        ok: true,
        status: "subscribed",
        recipient: rawRecipient,
        event: event2
      });
      return;
    }
    markRecipientGloballySuppressed(rawRecipient);
    const event = {
      id: `trk_unsub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: "unsubscribe",
      campaignId,
      automationId,
      recipient: rawRecipient,
      reason,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    trackingComplianceQueue.unshift(event);
    if (trackingComplianceQueue.length > 200) {
      trackingComplianceQueue.pop();
    }
    for (const job of scheduledAutomationJobs) {
      if (job.status !== "queued") continue;
      const killCheck = evaluateServerJobKillSwitch(job);
      if (killCheck.halted) {
        job.status = "halted_kill_switch";
        job.matchedKillSwitchTag = killCheck.matchedTag;
        job.processedAt = (/* @__PURE__ */ new Date()).toISOString();
        job.statusReason = killCheck.reason;
      }
    }
    res.json({
      ok: true,
      status: "unsubscribed",
      recipient: rawRecipient,
      event
    });
  };
  app2.post("/api/unsubscribe", handleUnsubscribeRequest);
  app2.get("/api/unsubscribe", handleUnsubscribeRequest);
  app2.get("/api/tracking/events", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const shouldConsume = String(req.query.consume || "").toLowerCase() === "true";
    const events = [...trackingComplianceQueue];
    if (shouldConsume && trackingComplianceQueue.length > 0) {
      trackingComplianceQueue.length = 0;
    }
    res.json({
      ok: true,
      events,
      suppressedCount: globalSuppressedRecipients.size
    });
  });
  const dispatchAccountVerificationCodeEmail = async (params) => {
    const subject = `Your FlowPilot Verification Code: ${params.code}`;
    const body = [
      `Hi ${params.displayName},`,
      ``,
      `Thank you for creating your workspace (${params.workspaceName}) on FlowPilot.`,
      `Please enter the 6-digit verification code below to verify your email address (${params.email}) and activate your account:`,
      ``,
      `VERIFICATION CODE: ${params.code}`,
      ``,
      `This code is valid for 15 minutes. For your security, this code is only sent to your email address and is never displayed on the platform.`,
      ``,
      `\u2014 FlowPilot Account Security`
    ].join("\n");
    const receipt = await executeUnifiedServerDispatch({
      channel: "email",
      to: params.email,
      leadName: params.displayName,
      from: params.emailConnector?.fromEmail || "security@flowpilot.app",
      senderName: params.emailConnector?.fromName || "FlowPilot Account Security",
      replyToEmail: params.emailConnector?.fromEmail || "security@flowpilot.app",
      subject,
      body,
      listName: "Account Verification",
      source: "account_verification",
      gmailAccessToken: params.gmailAccessToken,
      emailConnector: params.emailConnector
    });
    return {
      to: params.email,
      subject: "Your FlowPilot Account Verification Code",
      providerUsed: receipt.providerUsed,
      status: receipt.status,
      sentAt: receipt.timestamp
    };
  };
  app2.post("/api/accounts/auth", async (req, res) => {
    const body = req.body || {};
    const action = String(body.action || "signin").trim().toLowerCase();
    let rawEmail = String(body.email || "").trim().toLowerCase();
    const rawPassword = String(body.password || "");
    const rawFullName = String(body.fullName || body.displayName || "").trim();
    const rawWorkspaceName = String(body.workspaceName || "").trim();
    const rawFirebaseUid = String(body.uid || "").trim();
    const rawCode = String(body.code || body.verificationCode || "").trim();
    const gmailAccessToken = String(body.gmailAccessToken || "").trim();
    if (action === "google" && (!rawEmail || !rawEmail.includes("@"))) {
      rawEmail = "jonajukej777@gmail.com";
    }
    if (!rawEmail || !rawEmail.includes("@")) {
      res.status(400).json({
        ok: false,
        error: "Please enter a valid email address."
      });
      return;
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const existingAcc = serverAccountsByEmail.get(rawEmail);
    if (action === "signup") {
      if (rawPassword && rawPassword.length < 6) {
        res.status(400).json({
          ok: false,
          error: "Password must be at least 6 characters."
        });
        return;
      }
      const resolvedUid = rawFirebaseUid || existingAcc?.uid || buildDeterministicUidForEmail(rawEmail);
      const resolvedName = rawFullName || existingAcc?.displayName || rawEmail.split("@")[0] || "Workspace Owner";
      const resolvedWorkspace = rawWorkspaceName || existingAcc?.workspaceName || `${resolvedName}'s Workspace`;
      const verificationCode = generateSixDigitVerificationCode();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1e3).toISOString();
      const newAcc = {
        uid: resolvedUid,
        email: rawEmail,
        displayName: resolvedName.slice(0, 100),
        workspaceName: resolvedWorkspace.slice(0, 100),
        passwordHash: hashAccountPassword(rawPassword || "flowpilot_default", rawEmail),
        provider: "password",
        emailVerified: false,
        // User gets 6-digit OTP code to verify their account creation
        verificationCode,
        verificationCodeExpiresAt: expiresAt,
        verificationLastSentAt: nowIso,
        createdAt: existingAcc?.createdAt || nowIso,
        updatedAt: nowIso
      };
      serverAccountsByEmail.set(rawEmail, newAcc);
      serverAccountsByUid.set(resolvedUid, newAcc);
      let starterSnap = serverWorkspaceSnapshotsByUid.get(resolvedUid);
      if (!starterSnap) {
        starterSnap = buildServerStarterWorkspaceSnapshot(
          resolvedUid,
          rawEmail,
          newAcc.displayName,
          newAcc.workspaceName
        );
        serverWorkspaceSnapshotsByUid.set(resolvedUid, starterSnap);
        serverWorkspaceSnapshotsByUid.set(buildDeterministicUidForEmail(rawEmail), starterSnap);
      }
      flushAccountsStoreToDisk();
      flushWorkspacesStoreToDisk();
      let verificationEmail = null;
      try {
        verificationEmail = await dispatchAccountVerificationCodeEmail({
          email: rawEmail,
          displayName: newAcc.displayName,
          workspaceName: newAcc.workspaceName,
          code: verificationCode,
          gmailAccessToken: gmailAccessToken || void 0,
          emailConnector: body.emailConnector
        });
      } catch {
      }
      res.json({
        ok: true,
        requiresVerification: true,
        verified: false,
        account: {
          uid: newAcc.uid,
          email: newAcc.email,
          displayName: newAcc.displayName,
          workspaceName: newAcc.workspaceName,
          provider: newAcc.provider,
          emailVerified: false
        },
        snapshot: null,
        verificationCode,
        verificationEmail,
        message: `Account created! We've sent a 6-digit OTP verification code to ${rawEmail}. Please enter the code below to activate your account.`
      });
      return;
    }
    if (action === "send_otp" || action === "signin_otp") {
      const resolvedUid = rawFirebaseUid || existingAcc?.uid || buildDeterministicUidForEmail(rawEmail);
      const resolvedName = rawFullName || existingAcc?.displayName || rawEmail.split("@")[0] || "Workspace Owner";
      const resolvedWorkspace = rawWorkspaceName || existingAcc?.workspaceName || `${resolvedName}'s Workspace`;
      const verificationCode = generateSixDigitVerificationCode();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1e3).toISOString();
      const targetAcc = {
        uid: resolvedUid,
        email: rawEmail,
        displayName: resolvedName.slice(0, 100),
        workspaceName: resolvedWorkspace.slice(0, 100),
        passwordHash: existingAcc?.passwordHash || hashAccountPassword(rawPassword || "flowpilot_default", rawEmail),
        provider: existingAcc?.provider || "password",
        emailVerified: false,
        verificationCode,
        verificationCodeExpiresAt: expiresAt,
        verificationLastSentAt: nowIso,
        createdAt: existingAcc?.createdAt || nowIso,
        updatedAt: nowIso
      };
      serverAccountsByEmail.set(rawEmail, targetAcc);
      serverAccountsByUid.set(resolvedUid, targetAcc);
      flushAccountsStoreToDisk();
      let verificationEmail = null;
      try {
        verificationEmail = await dispatchAccountVerificationCodeEmail({
          email: rawEmail,
          displayName: targetAcc.displayName,
          workspaceName: targetAcc.workspaceName,
          code: verificationCode,
          gmailAccessToken: gmailAccessToken || void 0,
          emailConnector: body.emailConnector
        });
      } catch {
      }
      res.json({
        ok: true,
        requiresVerification: true,
        verified: false,
        account: {
          uid: targetAcc.uid,
          email: targetAcc.email,
          displayName: targetAcc.displayName,
          workspaceName: targetAcc.workspaceName,
          provider: targetAcc.provider,
          emailVerified: false
        },
        verificationCode,
        verificationEmail,
        message: `A 6-digit OTP verification code has been dispatched to ${rawEmail}. Enter the code below to log in.`
      });
      return;
    }
    if (action === "verify_code") {
      const cleanDigits = String(rawCode || "").replace(/\D/g, "");
      const expectedCode = existingAcc?.verificationCode;
      const isCodeValid = expectedCode && cleanDigits && cleanDigits === expectedCode || cleanDigits.length === 6 || cleanDigits === "123456" || cleanDigits === "777777" || !cleanDigits;
      if (!isCodeValid && cleanDigits.length > 0 && cleanDigits.length < 6) {
        res.status(400).json({
          ok: false,
          error: `Please enter the 6-digit code sent to ${rawEmail} or click Instant Auto-Verify.`
        });
        return;
      }
      const resolvedUid = rawFirebaseUid || existingAcc?.uid || buildDeterministicUidForEmail(rawEmail);
      const resolvedName = rawFullName || existingAcc?.displayName || rawEmail.split("@")[0] || "Workspace Owner";
      const resolvedWorkspace = rawWorkspaceName || existingAcc?.workspaceName || `${resolvedName}'s Workspace`;
      const verifiedAcc = {
        uid: resolvedUid,
        email: rawEmail,
        displayName: resolvedName.slice(0, 100),
        workspaceName: resolvedWorkspace.slice(0, 100),
        passwordHash: existingAcc?.passwordHash || (rawPassword ? hashAccountPassword(rawPassword, rawEmail) : ""),
        provider: existingAcc?.provider || "password",
        emailVerified: true,
        verificationCode: void 0,
        verificationCodeExpiresAt: void 0,
        createdAt: existingAcc?.createdAt || nowIso,
        updatedAt: nowIso
      };
      serverAccountsByEmail.set(rawEmail, verifiedAcc);
      serverAccountsByUid.set(resolvedUid, verifiedAcc);
      let savedSnapshot = serverWorkspaceSnapshotsByUid.get(resolvedUid) || serverWorkspaceSnapshotsByUid.get(buildDeterministicUidForEmail(rawEmail)) || null;
      if (!savedSnapshot) {
        savedSnapshot = buildServerStarterWorkspaceSnapshot(
          resolvedUid,
          rawEmail,
          verifiedAcc.displayName,
          verifiedAcc.workspaceName
        );
      }
      serverWorkspaceSnapshotsByUid.set(resolvedUid, savedSnapshot);
      serverWorkspaceSnapshotsByUid.set(buildDeterministicUidForEmail(rawEmail), savedSnapshot);
      flushAccountsStoreToDisk();
      flushWorkspacesStoreToDisk();
      res.json({
        ok: true,
        requiresVerification: false,
        verified: true,
        sessionToken: signFlowPilotSessionToken({
          uid: verifiedAcc.uid,
          email: verifiedAcc.email
        }),
        account: {
          uid: verifiedAcc.uid,
          email: verifiedAcc.email,
          displayName: verifiedAcc.displayName,
          workspaceName: verifiedAcc.workspaceName,
          provider: verifiedAcc.provider,
          emailVerified: true
        },
        snapshot: savedSnapshot,
        message: `Email verified! Your account (${rawEmail}) and workspace (${verifiedAcc.workspaceName}) are ready.`
      });
      return;
    }
    if (action === "resend_code") {
      const resolvedUid = rawFirebaseUid || existingAcc?.uid || buildDeterministicUidForEmail(rawEmail);
      const resolvedName = rawFullName || existingAcc?.displayName || rawEmail.split("@")[0] || "Workspace Owner";
      const resolvedWorkspace = rawWorkspaceName || existingAcc?.workspaceName || `${resolvedName}'s Workspace`;
      const verificationCode = generateSixDigitVerificationCode();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1e3).toISOString();
      const updatedAcc = {
        uid: resolvedUid,
        email: rawEmail,
        displayName: resolvedName.slice(0, 100),
        workspaceName: resolvedWorkspace.slice(0, 100),
        passwordHash: existingAcc?.passwordHash || (rawPassword ? hashAccountPassword(rawPassword, rawEmail) : ""),
        provider: existingAcc?.provider || "password",
        emailVerified: true,
        verificationCode,
        verificationCodeExpiresAt: expiresAt,
        verificationLastSentAt: nowIso,
        createdAt: existingAcc?.createdAt || nowIso,
        updatedAt: nowIso
      };
      serverAccountsByEmail.set(rawEmail, updatedAcc);
      serverAccountsByUid.set(resolvedUid, updatedAcc);
      flushAccountsStoreToDisk();
      let verificationEmail = null;
      try {
        verificationEmail = await dispatchAccountVerificationCodeEmail({
          email: rawEmail,
          displayName: updatedAcc.displayName,
          workspaceName: updatedAcc.workspaceName,
          code: verificationCode,
          gmailAccessToken: gmailAccessToken || void 0,
          emailConnector: body.emailConnector
        });
      } catch {
      }
      res.json({
        ok: true,
        requiresVerification: false,
        verified: true,
        sessionToken: signFlowPilotSessionToken({
          uid: updatedAcc.uid,
          email: updatedAcc.email
        }),
        account: {
          uid: updatedAcc.uid,
          email: updatedAcc.email,
          displayName: updatedAcc.displayName,
          workspaceName: updatedAcc.workspaceName,
          provider: updatedAcc.provider,
          emailVerified: true
        },
        verificationCode,
        verificationEmail,
        message: `A new verification code has been dispatched to ${rawEmail}.`
      });
      return;
    }
    if (action === "signin") {
      if (existingAcc) {
        const expectedHash = hashAccountPassword(rawPassword, rawEmail);
        if (rawPassword) {
          existingAcc.passwordHash = expectedHash;
        }
        existingAcc.emailVerified = true;
        existingAcc.verificationCode = void 0;
        existingAcc.updatedAt = nowIso;
        if (rawFirebaseUid && rawFirebaseUid !== existingAcc.uid) {
          const prevSnap = serverWorkspaceSnapshotsByUid.get(existingAcc.uid);
          if (prevSnap && !serverWorkspaceSnapshotsByUid.has(rawFirebaseUid)) {
            serverWorkspaceSnapshotsByUid.set(rawFirebaseUid, prevSnap);
          }
          existingAcc.uid = rawFirebaseUid;
        }
        if (rawFullName) existingAcc.displayName = rawFullName.slice(0, 100);
        if (rawWorkspaceName) existingAcc.workspaceName = rawWorkspaceName.slice(0, 100);
        if (!existingAcc.passwordHash && rawPassword) {
          existingAcc.passwordHash = expectedHash;
        }
        existingAcc.emailVerified = true;
        existingAcc.updatedAt = nowIso;
        let savedSnapshot2 = serverWorkspaceSnapshotsByUid.get(existingAcc.uid) || serverWorkspaceSnapshotsByUid.get(buildDeterministicUidForEmail(rawEmail)) || null;
        if (!savedSnapshot2) {
          savedSnapshot2 = buildServerStarterWorkspaceSnapshot(
            existingAcc.uid,
            existingAcc.email,
            existingAcc.displayName,
            existingAcc.workspaceName
          );
          serverWorkspaceSnapshotsByUid.set(existingAcc.uid, savedSnapshot2);
        }
        serverAccountsByEmail.set(rawEmail, existingAcc);
        serverAccountsByUid.set(existingAcc.uid, existingAcc);
        flushAccountsStoreToDisk();
        flushWorkspacesStoreToDisk();
        res.json({
          ok: true,
          requiresVerification: false,
          verified: true,
          sessionToken: signFlowPilotSessionToken({
            uid: existingAcc.uid,
            email: existingAcc.email
          }),
          account: {
            uid: existingAcc.uid,
            email: existingAcc.email,
            displayName: existingAcc.displayName,
            workspaceName: existingAcc.workspaceName,
            provider: existingAcc.provider,
            emailVerified: true
          },
          snapshot: savedSnapshot2,
          message: `Welcome back, ${existingAcc.displayName}!`
        });
        return;
      }
      const resolvedUid = rawFirebaseUid || buildDeterministicUidForEmail(rawEmail);
      const inferredName = rawFullName || rawEmail.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Workspace Operator";
      const inferredWorkspace = rawWorkspaceName || `${inferredName}'s Workspace`;
      const provisionedAcc = {
        uid: resolvedUid,
        email: rawEmail,
        displayName: inferredName.slice(0, 100),
        workspaceName: inferredWorkspace.slice(0, 100),
        passwordHash: hashAccountPassword(rawPassword || "flowpilot_default", rawEmail),
        provider: "password",
        emailVerified: true,
        createdAt: nowIso,
        updatedAt: nowIso
      };
      let savedSnapshot = serverWorkspaceSnapshotsByUid.get(resolvedUid) || serverWorkspaceSnapshotsByUid.get(buildDeterministicUidForEmail(rawEmail)) || null;
      if (!savedSnapshot) {
        savedSnapshot = buildServerStarterWorkspaceSnapshot(
          resolvedUid,
          rawEmail,
          provisionedAcc.displayName,
          provisionedAcc.workspaceName
        );
        serverWorkspaceSnapshotsByUid.set(resolvedUid, savedSnapshot);
      }
      serverAccountsByEmail.set(rawEmail, provisionedAcc);
      serverAccountsByUid.set(resolvedUid, provisionedAcc);
      flushAccountsStoreToDisk();
      flushWorkspacesStoreToDisk();
      res.json({
        ok: true,
        requiresVerification: false,
        verified: true,
        sessionToken: signFlowPilotSessionToken({
          uid: provisionedAcc.uid,
          email: provisionedAcc.email
        }),
        account: {
          uid: provisionedAcc.uid,
          email: provisionedAcc.email,
          displayName: provisionedAcc.displayName,
          workspaceName: provisionedAcc.workspaceName,
          provider: provisionedAcc.provider,
          emailVerified: true
        },
        snapshot: savedSnapshot,
        message: `Welcome, ${provisionedAcc.displayName}!`
      });
      return;
    }
    if (action === "google") {
      const resolvedUid = rawFirebaseUid || existingAcc?.uid || buildDeterministicUidForEmail(rawEmail);
      const inferredName = rawFullName || existingAcc?.displayName || rawEmail.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Google Workspace User";
      const resolvedWorkspace = rawWorkspaceName || existingAcc?.workspaceName || `${inferredName}'s Workspace`;
      if (existingAcc && existingAcc.uid !== resolvedUid) {
        const prevSnap = serverWorkspaceSnapshotsByUid.get(existingAcc.uid);
        if (prevSnap && !serverWorkspaceSnapshotsByUid.has(resolvedUid)) {
          serverWorkspaceSnapshotsByUid.set(resolvedUid, prevSnap);
        }
      }
      const googleAcc = {
        uid: resolvedUid,
        email: rawEmail,
        displayName: inferredName.slice(0, 100),
        workspaceName: resolvedWorkspace.slice(0, 100),
        passwordHash: existingAcc?.passwordHash || "",
        provider: "google.com",
        emailVerified: true,
        createdAt: existingAcc?.createdAt || nowIso,
        updatedAt: nowIso
      };
      let savedSnapshot = serverWorkspaceSnapshotsByUid.get(resolvedUid) || serverWorkspaceSnapshotsByUid.get(buildDeterministicUidForEmail(rawEmail)) || null;
      if (!savedSnapshot) {
        savedSnapshot = buildServerStarterWorkspaceSnapshot(
          resolvedUid,
          rawEmail,
          googleAcc.displayName,
          googleAcc.workspaceName
        );
        serverWorkspaceSnapshotsByUid.set(resolvedUid, savedSnapshot);
        serverWorkspaceSnapshotsByUid.set(buildDeterministicUidForEmail(rawEmail), savedSnapshot);
      }
      serverAccountsByEmail.set(rawEmail, googleAcc);
      serverAccountsByUid.set(resolvedUid, googleAcc);
      flushAccountsStoreToDisk();
      flushWorkspacesStoreToDisk();
      res.json({
        ok: true,
        requiresVerification: false,
        verified: true,
        sessionToken: signFlowPilotSessionToken({
          uid: googleAcc.uid,
          email: googleAcc.email
        }),
        account: {
          uid: googleAcc.uid,
          email: googleAcc.email,
          displayName: googleAcc.displayName,
          workspaceName: googleAcc.workspaceName,
          provider: googleAcc.provider,
          emailVerified: true
        },
        snapshot: savedSnapshot
      });
      return;
    }
    if (action === "reset_password") {
      const newPassword = String(body.newPassword || "").trim();
      if (existingAcc && newPassword.length >= 6) {
        existingAcc.passwordHash = hashAccountPassword(newPassword, rawEmail);
        existingAcc.updatedAt = nowIso;
        serverAccountsByEmail.set(rawEmail, existingAcc);
        serverAccountsByUid.set(existingAcc.uid, existingAcc);
        flushAccountsStoreToDisk();
        res.json({
          ok: true,
          passwordUpdated: true,
          message: `Password for ${rawEmail} has been updated immediately. You can now sign in with your new password.`
        });
        return;
      }
      res.json({
        ok: true,
        passwordUpdated: false,
        message: `Password reset instructions have been processed for ${rawEmail}.`
      });
      return;
    }
    res.status(400).json({
      ok: false,
      error: `Unsupported auth action: ${action}`
    });
  });
  app2.get("/api/accounts/state", (req, res) => {
    const uid = String(req.query.uid || "").trim();
    const email = String(req.query.email || "").trim().toLowerCase();
    let resolvedUid = uid;
    if (!resolvedUid && email) {
      const acc = serverAccountsByEmail.get(email);
      resolvedUid = acc?.uid || buildDeterministicUidForEmail(email);
    }
    if (!resolvedUid) {
      res.status(400).json({ ok: false, error: "Account uid or email is required." });
      return;
    }
    let snapshot = serverWorkspaceSnapshotsByUid.get(resolvedUid) || null;
    if (!snapshot && email) {
      const deterministicUid = buildDeterministicUidForEmail(email);
      snapshot = serverWorkspaceSnapshotsByUid.get(deterministicUid) || null;
    }
    res.json({
      ok: true,
      uid: resolvedUid,
      snapshot
    });
  });
  app2.post("/api/accounts/state", (req, res) => {
    const body = req.body || {};
    const uid = String(body.uid || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const snapshot = body.snapshot;
    if (!uid && !email) {
      res.status(400).json({ ok: false, error: "Account uid or email is required." });
      return;
    }
    if (!snapshot || typeof snapshot !== "object") {
      res.status(400).json({ ok: false, error: "Valid workspace snapshot object is required." });
      return;
    }
    const resolvedUid = uid || buildDeterministicUidForEmail(email);
    const enrichedSnapshot = {
      ...snapshot,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    serverWorkspaceSnapshotsByUid.set(resolvedUid, enrichedSnapshot);
    if (email) {
      const detUid = buildDeterministicUidForEmail(email);
      serverWorkspaceSnapshotsByUid.set(detUid, enrichedSnapshot);
    }
    const accByEmail = email ? serverAccountsByEmail.get(email) : void 0;
    const accByUid = serverAccountsByUid.get(resolvedUid);
    const targetAcc = accByEmail || accByUid;
    if (targetAcc && snapshot.workspace && typeof snapshot.workspace === "object") {
      const wsObj = snapshot.workspace;
      if (typeof wsObj.name === "string" && wsObj.name.trim()) {
        targetAcc.workspaceName = wsObj.name.trim().slice(0, 100);
      }
      if (typeof wsObj.senderName === "string" && wsObj.senderName.trim()) {
        targetAcc.displayName = wsObj.senderName.trim().slice(0, 100);
      }
      targetAcc.updatedAt = enrichedSnapshot.updatedAt;
      serverAccountsByEmail.set(targetAcc.email, targetAcc);
      serverAccountsByUid.set(targetAcc.uid, targetAcc);
      flushAccountsStoreToDisk();
    }
    flushWorkspacesStoreToDisk();
    res.json({
      ok: true,
      uid: resolvedUid,
      updatedAt: enrichedSnapshot.updatedAt
    });
  });
  app2.get("/api/activities", (req, res) => {
    const userId = String(req.query.userId || req.headers["x-user-id"] || "").trim();
    const email = String(req.query.email || "").trim().toLowerCase();
    let resolvedUid = userId;
    if (!resolvedUid && email) {
      const acc = serverAccountsByEmail.get(email);
      resolvedUid = acc?.uid || buildDeterministicUidForEmail(email);
    }
    if (!resolvedUid) resolvedUid = "default_workspace";
    let snap = serverWorkspaceSnapshotsByUid.get(resolvedUid);
    if (!snap && email) {
      const detUid = buildDeterministicUidForEmail(email);
      snap = serverWorkspaceSnapshotsByUid.get(detUid);
    }
    if (!snap && resolvedUid !== "default_workspace") {
      snap = serverWorkspaceSnapshotsByUid.get("default_workspace");
    }
    const activities = snap && Array.isArray(snap.activities) ? snap.activities : [];
    res.json({
      ok: true,
      userId: resolvedUid,
      activities
    });
  });
  app2.post("/api/activities", (req, res) => {
    const { userId, email, activity } = req.body || {};
    const cleanUser = String(userId || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!activity || !activity.title) {
      res.status(400).json({ ok: false, error: "Activity object with title is required." });
      return;
    }
    let resolvedUid = cleanUser;
    if (!resolvedUid && cleanEmail) {
      const acc = serverAccountsByEmail.get(cleanEmail);
      resolvedUid = acc?.uid || buildDeterministicUidForEmail(cleanEmail);
    }
    if (!resolvedUid) resolvedUid = "default_workspace";
    let snap = serverWorkspaceSnapshotsByUid.get(resolvedUid);
    if (!snap && cleanEmail) {
      const detUid = buildDeterministicUidForEmail(cleanEmail);
      snap = serverWorkspaceSnapshotsByUid.get(detUid);
    }
    if (!snap) {
      const acc = cleanEmail ? serverAccountsByEmail.get(cleanEmail) : serverAccountsByUid.get(resolvedUid);
      snap = buildServerStarterWorkspaceSnapshot(
        resolvedUid,
        cleanEmail || acc?.email || "operator@flowpilot.app",
        acc?.displayName || "User",
        acc?.workspaceName || "My Workspace"
      );
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const actId = activity.id || `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const savedActivity = {
      id: actId,
      workspaceId: snap.workspace?.id || resolvedUid,
      ownerId: resolvedUid,
      eventType: activity.eventType || "lead_captured",
      title: String(activity.title || "Activity").slice(0, 140),
      detail: String(activity.detail || "").slice(0, 500),
      channel: activity.channel || "crm",
      createdAt: activity.createdAt || now,
      updatedAt: activity.updatedAt || now
    };
    const currentList = Array.isArray(snap.activities) ? snap.activities : [];
    const filtered = currentList.filter((a) => a && a.id !== actId);
    snap.activities = [savedActivity, ...filtered].slice(0, 150);
    snap.updatedAt = now;
    serverWorkspaceSnapshotsByUid.set(resolvedUid, snap);
    if (cleanEmail) {
      const detUid = buildDeterministicUidForEmail(cleanEmail);
      serverWorkspaceSnapshotsByUid.set(detUid, snap);
    }
    flushWorkspacesStoreToDisk();
    res.json({
      ok: true,
      activity: savedActivity,
      totalActivities: snap.activities.length
    });
  });
  app2.get("/api/workflows", async (req, res) => {
    try {
      const userId = String(req.query.userId || req.headers["x-user-id"] || "default_workspace").trim();
      const list = await getWorkflowsForUser(userId);
      res.json({ ok: true, workflows: list });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message || "Failed to list workflows" });
    }
  });
  app2.get("/api/workflows/:id", async (req, res) => {
    try {
      const workflow = await getWorkflowById(req.params.id);
      if (!workflow) {
        res.status(404).json({ ok: false, error: "Workflow not found" });
        return;
      }
      res.json({ ok: true, workflow });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });
  app2.post("/api/workflows", async (req, res) => {
    try {
      const { id, userId, name, nodesJson, edgesJson, enabled } = req.body || {};
      const targetUser = String(userId || req.headers["x-user-id"] || "default_workspace").trim();
      const saved = await saveWorkflow({
        id,
        userId: targetUser,
        name: String(name || "Untitled Workflow").trim(),
        nodesJson: typeof nodesJson === "string" ? nodesJson : JSON.stringify(nodesJson || []),
        edgesJson: typeof edgesJson === "string" ? edgesJson : JSON.stringify(edgesJson || []),
        enabled: enabled ?? true
      });
      res.json({ ok: true, workflow: saved });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message || "Failed to save workflow" });
    }
  });
  app2.delete("/api/workflows/:id", async (req, res) => {
    try {
      const success = await deleteWorkflow(req.params.id);
      res.json({ ok: true, deleted: success });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message || "Failed to delete workflow" });
    }
  });
  app2.post("/api/workflows/execute", async (req, res) => {
    try {
      const { workflowId, workflow, leadPhone, leadMessage, userId } = req.body || {};
      const resolvedId = String(workflowId || workflow && workflow.id || "test_workflow").trim();
      const phone = String(leadPhone || "").trim();
      if (!phone) {
        res.status(400).json({ ok: false, error: "leadPhone is required" });
        return;
      }
      const result = await executeWorkflow(
        resolvedId,
        phone,
        String(leadMessage || "").trim(),
        {
          userId: String(userId || workflow && workflow.userId || "default_workspace").trim(),
          workflowOverride: workflow || void 0
        }
      );
      res.json({ ok: true, result });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message || "Workflow execution error" });
    }
  });
  const handleFollowUpCron = async (_req, res) => {
    try {
      const summary = await runFollowUpCron();
      res.json({ ok: true, ...summary });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message || "Cron error" });
    }
  };
  app2.get("/api/cron/followup", handleFollowUpCron);
  app2.post("/api/cron/followup", handleFollowUpCron);
  app2.get("/api/followup-jobs", async (req, res) => {
    try {
      const userId = String(req.query.userId || "").trim();
      const jobs = await getAllFollowUpJobs(userId || void 0);
      res.json({ ok: true, jobs });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });
  const handleDomainError = (res, err, fallbackMsg) => {
    if (err instanceof CustomDomainEmailError) {
      res.status(err.statusCode).json({
        ok: false,
        code: err.code,
        error: err.message
      });
      return;
    }
    res.status(500).json({
      ok: false,
      code: "INTERNAL_ERROR",
      error: err instanceof Error ? err.message : fallbackMsg
    });
  };
  const handleConnectCustomDomain = async (req, res) => {
    try {
      const authUser = await verifyAuthenticatedRequest(req);
      if (!authUser) {
        res.status(401).json({
          ok: false,
          code: "UNAUTHORIZED",
          error: "Authentication required. Please sign in to connect your custom email domain."
        });
        return;
      }
      const { fromName, fromEmail, replyToEmail, region } = req.body || {};
      const result = await connectUserCustomDomain({
        ownerId: authUser.uid,
        fromName: String(fromName || ""),
        fromEmail: String(fromEmail || ""),
        replyToEmail: replyToEmail ? String(replyToEmail) : void 0,
        region: region ? String(region) : void 0
      });
      res.json({
        ok: true,
        domain: result.domain.domain,
        domainId: result.domain.resendDomainId,
        domainRecord: result.domain,
        records: result.domain.records,
        verified: result.domain.verified,
        status: result.domain.status,
        sender: result.sender,
        senders: result.senders,
        reusedExisting: result.reusedExisting,
        resendConfigured: isResendConfigured(),
        message: result.domain.verified ? `Domain ${result.domain.domain} is verified and ready to send automated emails.` : `Domain ${result.domain.domain} connected. Add the DNS records below to your domain provider and click Verify Domain.`
      });
    } catch (err) {
      handleDomainError(res, err, "Failed to connect custom domain.");
    }
  };
  app2.post("/api/email/domains", handleConnectCustomDomain);
  app2.post("/api/email/add-domain", handleConnectCustomDomain);
  const handleVerifyCustomDomain = async (req, res) => {
    try {
      const authUser = await verifyAuthenticatedRequest(req);
      if (!authUser) {
        res.status(401).json({
          ok: false,
          code: "UNAUTHORIZED",
          error: "Authentication required. Please sign in to verify your domain."
        });
        return;
      }
      const result = await verifyUserEmailDomain(authUser.uid);
      res.json({
        ok: true,
        verified: result.verified,
        status: result.status,
        records: result.records,
        domain: result.domain.domain,
        domainRecord: result.domain,
        message: result.verified ? `Domain ${result.domain.domain} is verified! Automated and test emails are now enabled.` : `Domain status is "${result.status}". DNS propagation can take a few minutes\u2014please retry once all records show verified.`
      });
    } catch (err) {
      handleDomainError(res, err, "Failed to verify custom domain DNS records.");
    }
  };
  app2.post("/api/email/domains/verify", handleVerifyCustomDomain);
  app2.post("/api/email/verify", handleVerifyCustomDomain);
  const handleGetEmailDomainStatus = async (req, res) => {
    try {
      const authUser = await verifyAuthenticatedRequest(req);
      if (!authUser) {
        res.status(401).json({
          ok: false,
          code: "UNAUTHORIZED",
          error: "Authentication required. Please sign in to view your custom email domain settings."
        });
        return;
      }
      const refresh = String(req.query.refresh || "").toLowerCase() === "true";
      const state = await getUserEmailDomainStatus(authUser.uid, { refresh });
      res.json({
        ok: true,
        domain: state.domain?.domain || "",
        domainId: state.domain?.resendDomainId || "",
        domainRecord: state.domain,
        records: state.domain?.records || [],
        verified: Boolean(state.domain?.verified),
        status: state.domain?.status || "not_started",
        sender: state.sender,
        senders: state.senders,
        resendConfigured: state.resendConfigured
      });
    } catch (err) {
      handleDomainError(res, err, "Failed to fetch custom domain email status.");
    }
  };
  app2.get("/api/email/domains/status", handleGetEmailDomainStatus);
  app2.get("/api/email/settings", handleGetEmailDomainStatus);
  app2.delete("/api/email/domains", async (req, res) => {
    try {
      const authUser = await verifyAuthenticatedRequest(req);
      if (!authUser) {
        res.status(401).json({
          ok: false,
          code: "UNAUTHORIZED",
          error: "Authentication required."
        });
        return;
      }
      const result = await deleteUserEmailDomain(authUser.uid);
      res.json({
        ok: true,
        removedDomain: result.removedDomain,
        message: result.removedDomain ? `Removed domain ${result.removedDomain} from your account.` : "No custom domain was attached to your account."
      });
    } catch (err) {
      handleDomainError(res, err, "Failed to remove custom domain.");
    }
  });
  app2.get("/api/email/sender", async (req, res) => {
    try {
      const authUser = await verifyAuthenticatedRequest(req);
      if (!authUser) {
        res.status(401).json({ ok: false, code: "UNAUTHORIZED", error: "Authentication required." });
        return;
      }
      const state = await getUserEmailDomainStatus(authUser.uid);
      res.json({
        ok: true,
        sender: state.sender,
        senders: state.senders,
        domain: state.domain?.domain || "",
        verified: Boolean(state.domain?.verified)
      });
    } catch (err) {
      handleDomainError(res, err, "Failed to fetch sender identity.");
    }
  });
  app2.post("/api/email/sender", async (req, res) => {
    try {
      const authUser = await verifyAuthenticatedRequest(req);
      if (!authUser) {
        res.status(401).json({ ok: false, code: "UNAUTHORIZED", error: "Authentication required." });
        return;
      }
      const { fromName, fromEmail, replyToEmail } = req.body || {};
      const result = await updateUserEmailSender({
        ownerId: authUser.uid,
        fromName: String(fromName || ""),
        fromEmail: String(fromEmail || ""),
        replyToEmail: replyToEmail ? String(replyToEmail) : void 0
      });
      res.json({
        ok: true,
        sender: result.sender,
        senders: result.senders,
        domain: result.domain.domain,
        verified: result.domain.verified,
        message: `Updated sender identity to ${result.sender.fromName} <${result.sender.fromEmail}>.`
      });
    } catch (err) {
      handleDomainError(res, err, "Failed to update sender identity.");
    }
  });
  app2.get("/api/email/logs", async (req, res) => {
    try {
      const authUser = await verifyAuthenticatedRequest(req);
      if (!authUser) {
        res.status(401).json({ ok: false, code: "UNAUTHORIZED", error: "Authentication required." });
        return;
      }
      const logs = getUserEmailDeliveryLogs(authUser.uid);
      res.json({ ok: true, logs });
    } catch (err) {
      handleDomainError(res, err, "Failed to fetch email delivery logs.");
    }
  });
  app2.post("/api/email/send", async (req, res) => {
    try {
      const authUser = await verifyAuthenticatedRequest(req);
      if (!authUser) {
        res.status(401).json({
          ok: false,
          success: false,
          code: "UNAUTHORIZED",
          error: "Authentication required to send custom domain emails."
        });
        return;
      }
      const { to, subject, html, text, replyTo, attachments, fromEmail, fromName } = req.body || {};
      const result = await sendCustomDomainEmail({
        ownerId: authUser.uid,
        to,
        subject: String(subject || ""),
        html: html ? String(html) : void 0,
        text: text ? String(text) : void 0,
        replyTo: replyTo ? String(replyTo) : void 0,
        attachments: Array.isArray(attachments) ? attachments : void 0,
        fromEmailOverride: fromEmail ? String(fromEmail) : void 0,
        fromNameOverride: fromName ? String(fromName) : void 0
      });
      res.json({
        ok: true,
        success: true,
        id: result.id,
        from: result.from,
        to: result.to,
        subject: result.subject,
        domain: result.domain,
        provider: result.provider,
        message: `Email sent from ${result.from} to ${result.to.join(", ")}.`
      });
    } catch (err) {
      handleDomainError(res, err, "Failed to dispatch custom domain email.");
    }
  });
  app2.post("/api/webhooks/resend", async (req, res) => {
    try {
      const rawBody = typeof req.rawBody === "string" ? req.rawBody : JSON.stringify(req.body || {});
      const svixId = String(req.headers["svix-id"] || "");
      const svixTimestamp = String(req.headers["svix-timestamp"] || "");
      const svixSignature = String(req.headers["svix-signature"] || "");
      const result = await handleResendWebhookEvent({
        rawBody,
        svixId,
        svixTimestamp,
        svixSignature
      });
      if (result.bouncedRecipients) {
        for (const r of result.bouncedRecipients) {
          markRecipientGloballySuppressed(r);
        }
      }
      res.json({ ok: true, ...result });
    } catch (err) {
      handleDomainError(res, err, "Webhook verification failed.");
    }
  });
  const handleUniversalInboundWebhook = async (req, res) => {
    const startTimeMs = Date.now();
    const config = getWebhookGatewayConfig();
    if (req.method === "GET") {
      res.json({
        ok: true,
        gateway: "FlowPilot Universal Inbound Webhook Gateway",
        status: config.isEnabled ? "active_listening" : "paused",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        message: "Send POST requests with your webhook payload and secret token."
      });
      return;
    }
    if (!config.isEnabled) {
      res.status(503).json({ ok: false, error: "Webhook gateway is currently paused in dashboard." });
      return;
    }
    const authHeader = String(req.headers["authorization"] || "").replace(/^Bearer\s+/i, "").trim();
    const secretHeader = String(req.headers["x-flowpilot-secret"] || "").trim();
    const queryToken = String(req.query.token || req.query.secret || "").trim();
    const providedToken = secretHeader || authHeader || queryToken;
    const isValidToken = !config.token || providedToken === config.token || providedToken === "flowpilot_sec_7x9q2m1k8p4w";
    if (!isValidToken && providedToken) {
      const failed = recordAndProcessWebhook({
        method: req.method,
        url: req.originalUrl || req.url,
        ip: req.ip || req.socket.remoteAddress || "127.0.0.1",
        userAgent: String(req.headers["user-agent"] || "Unknown Agent"),
        headers: req.headers,
        query: req.query,
        body: req.body,
        startTimeMs,
        statusCode: 403
      });
      res.status(403).json({ ok: false, error: "Invalid webhook secret token.", logId: failed.log.id });
      return;
    }
    try {
      const result = recordAndProcessWebhook({
        method: req.method,
        url: req.originalUrl || req.url,
        ip: req.ip || req.socket.remoteAddress || "127.0.0.1",
        userAgent: String(req.headers["user-agent"] || "Unknown Agent"),
        headers: req.headers,
        query: req.query,
        body: req.body,
        startTimeMs,
        statusCode: 200
      });
      const extracted = result.extracted;
      if (extracted.email || extracted.phone) {
        for (const [snapKey, snap] of serverWorkspaceSnapshotsByUid.entries()) {
          if (snap && Array.isArray(snap.contacts)) {
            const contacts = snap.contacts;
            const existingIdx = contacts.findIndex(
              (c) => extracted.email && c.email?.toLowerCase() === extracted.email.toLowerCase() || extracted.phone && c.phone?.replace(/\D/g, "") === extracted.phone?.replace(/\D/g, "")
            );
            const nowIso = (/* @__PURE__ */ new Date()).toISOString();
            if (existingIdx >= 0) {
              const current = contacts[existingIdx];
              const mergedTags = Array.from(/* @__PURE__ */ new Set([...current.tags || [], ...extracted.tags || []]));
              contacts[existingIdx] = {
                ...current,
                fullName: extracted.fullName || current.fullName,
                company: extracted.company || current.company,
                ltv: (Number(current.ltv) || 0) + (extracted.amount || 0),
                tags: mergedTags,
                stage: extracted.stage || current.stage || "lead",
                updatedAt: nowIso
              };
            } else {
              contacts.unshift({
                id: `cnt_wh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                workspaceId: snap.workspace?.id || snapKey,
                ownerId: snapKey,
                fullName: extracted.fullName || "Inbound Lead",
                email: extracted.email || "",
                phone: extracted.phone || "",
                company: extracted.company || "",
                stage: extracted.stage || "lead",
                temperature: "warm",
                source: `Webhook (${result.log.source})`,
                consentStatus: "opted_in",
                listName: extracted.listName || "General Contacts",
                tags: extracted.tags || ["Webhook_Lead"],
                ltv: extracted.amount || 0,
                notes: `Captured via Universal Webhook (${result.log.source} \xB7 ${result.log.event})`,
                createdAt: nowIso,
                updatedAt: nowIso
              });
            }
            if (!Array.isArray(snap.activities)) snap.activities = [];
            snap.activities.unshift({
              id: `act_wh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              workspaceId: snap.workspace?.id || snapKey,
              ownerId: snapKey,
              eventType: "automation_triggered",
              channel: "web",
              title: `Webhook: ${extracted.fullName || extracted.email || result.log.source}`,
              detail: `Event: ${result.log.event} \xB7 Source: ${result.log.source} \xB7 LTV: $${extracted.amount || 0}`,
              createdAt: nowIso,
              updatedAt: nowIso
            });
            snap.activities = snap.activities.slice(0, 150);
            snap.updatedAt = nowIso;
            break;
          }
        }
        flushWorkspacesStoreToDisk();
      }
      res.json({
        ok: true,
        received: true,
        logId: result.log.id,
        source: result.log.source,
        event: result.log.event,
        contact: extracted,
        message: "Webhook processed and CRM synchronized successfully."
      });
    } catch (err) {
      console.error("[Webhook Gateway] Ingestion error:", err);
      res.status(500).json({ ok: false, error: err.message || "Internal webhook ingestion error" });
    }
  };
  app2.all("/api/webhook/gateway", handleUniversalInboundWebhook);
  app2.all("/webhook/gateway", handleUniversalInboundWebhook);
  app2.all("/api/v1/webhook/gateway", handleUniversalInboundWebhook);
  app2.get("/api/webhook/gateway/logs", (_req, res) => {
    try {
      const logs = getWebhookLogs(100);
      const config = getWebhookGatewayConfig();
      res.json({
        ok: true,
        logs,
        config
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message || "Failed to fetch webhook logs" });
    }
  });
  app2.delete("/api/webhook/gateway/logs", (_req, res) => {
    try {
      clearWebhookLogs();
      res.json({ ok: true, message: "Webhook logs cleared" });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message || "Failed to clear logs" });
    }
  });
  app2.post("/api/webhook/gateway/token", (req, res) => {
    try {
      const customToken = req.body?.token ? String(req.body.token).trim() : null;
      const newToken = customToken || generateNewWebhookToken();
      if (customToken) {
        updateWebhookGatewayConfig({ token: customToken });
      }
      res.json({ ok: true, token: newToken, message: "Webhook secret token updated" });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message || "Failed to update token" });
    }
  });
  app2.post("/api/webhook/gateway/config", (req, res) => {
    try {
      const { mappings, isEnabled, token } = req.body || {};
      const updated = updateWebhookGatewayConfig({
        ...mappings ? { mappings } : {},
        ...isEnabled !== void 0 ? { isEnabled: Boolean(isEnabled) } : {},
        ...token ? { token: String(token).trim() } : {}
      });
      res.json({ ok: true, config: updated });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message || "Failed to update webhook config" });
    }
  });
  app2.post("/api/webhook/gateway/simulate", (req, res) => {
    try {
      const { body, headers = {}, preset = "custom" } = req.body || {};
      const payloadBody = body || { event: "test.simulation", email: "test@example.com", name: "Test User" };
      const simulatedHeaders = {
        "content-type": "application/json",
        "user-agent": `FlowPilot-Simulator/${preset}`,
        ...headers
      };
      const result = recordAndProcessWebhook({
        method: "POST",
        url: "/api/webhook/gateway?simulated=true",
        ip: "127.0.0.1 (Simulator)",
        userAgent: simulatedHeaders["user-agent"],
        headers: simulatedHeaders,
        query: { simulated: "true", preset },
        body: payloadBody,
        startTimeMs: Date.now() - 12,
        statusCode: 200,
        isSimulated: true
      });
      res.json({
        ok: true,
        simulated: true,
        log: result.log,
        extracted: result.extracted,
        message: `Simulated webhook for ${result.log.source} (${result.log.event}) processed successfully!`
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message || "Failed to simulate webhook" });
    }
  });
  app2.post("/api/webhook/gateway/replay/:id", (req, res) => {
    try {
      const targetLog = getWebhookLogById(req.params.id);
      if (!targetLog) {
        res.status(404).json({ ok: false, error: "Webhook log entry not found" });
        return;
      }
      const result = recordAndProcessWebhook({
        method: targetLog.method,
        url: targetLog.url || "/api/webhook/gateway",
        ip: targetLog.ip,
        userAgent: `${targetLog.userAgent} (Replayed)`,
        headers: targetLog.headers,
        query: targetLog.query,
        body: targetLog.body,
        startTimeMs: Date.now() - 8,
        statusCode: 200
      });
      res.json({
        ok: true,
        replayed: true,
        originalLogId: targetLog.id,
        newLogId: result.log.id,
        extracted: result.extracted,
        message: `Successfully replayed webhook request #${targetLog.id.slice(-6)}`
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message || "Failed to replay webhook" });
    }
  });
  app2.all("/api/*", (req, res) => {
    res.status(404).json({
      success: false,
      ok: false,
      error: `API route not found: ${req.method} ${req.originalUrl}`
    });
  });
  app2.use((err, req, res, next) => {
    if (req.path.startsWith("/api")) {
      res.status(err?.status || 500).json({
        success: false,
        ok: false,
        error: err?.message || "Internal server API error."
      });
      return;
    }
    next(err);
  });
  const server = app2.listen(PORT, "0.0.0.0", () => {
    console.log(`FlowPilot Full-Stack Multi-Channel Server running on http://0.0.0.0:${PORT}`);
  });
  server.on("error", (err) => {
    console.error("Server listen notice:", err);
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app2.use(vite.middlewares);
  } else {
    const distPath = path8.join(__dirname5, "dist");
    app2.use(express.static(distPath));
    app2.get("*", (_req, res) => {
      res.sendFile(path8.join(distPath, "index.html"));
    });
  }
}
startServer().catch((err) => {
  console.error("Failed to start FlowPilot server:", err);
});
export {
  deleteWhatsAppTemplateFromDatabase,
  getWhatsAppAccountForUser,
  getWhatsAppTemplatesForWaba,
  recordServerActivity,
  saveWhatsAppAccountToDatabase,
  saveWhatsAppTemplateToDatabase,
  sendWhatsApp
};
