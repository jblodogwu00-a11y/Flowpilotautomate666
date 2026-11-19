import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Database,
  LogOut,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  AlertCircle,
  KeyRound,
  Lock,
  Send,
  XCircle,
} from 'lucide-react';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
} from '../firebase';

import {
  EVOLUTION_URL,
  EvolutionConnectionStatus,
  EvolutionClientSessionResult,
  buildEvolutionInstanceName,
  sanitizeEvolutionId,
  createAndConnectEvolutionInstance,
  checkEvolutionConnectionState,
  disconnectEvolutionInstance,
  sendEvolutionTextMessage,
} from '../lib/evolutionClient';

export type { EvolutionConnectionStatus };

interface ConnectWhatsAppPageProps {
  onBackToDashboard?: () => void;
  onNavigateToPhonePairing?: () => void;
  onOpenAuth?: () => void;
  onAccountConnected?: (details: {
    instanceName: string;
    status: EvolutionConnectionStatus;
    ownerJid?: string | null;
    profileName?: string | null;
  }) => void;
  onAccountDisconnected?: () => void;
}

type FirestoreSyncState = 'idle' | 'saving' | 'synced' | 'local_only' | 'error';

function sanitizeIdForFirestore(raw: string): string {
  return sanitizeEvolutionId(raw, 'user');
}

export const ConnectWhatsAppPage: React.FC<ConnectWhatsAppPageProps> = ({
  onBackToDashboard,
  onNavigateToPhonePairing,
  onOpenAuth,
  onAccountConnected,
  onAccountDisconnected,
}) => {
  const { user, loading: authLoading } = useAuth();

  const safeUid = user?.uid ? sanitizeIdForFirestore(user.uid) : '';
  const instanceName = safeUid ? buildEvolutionInstanceName(safeUid) : '';

  const [status, setStatus] = useState<EvolutionConnectionStatus>('close');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [upstreamCount, setUpstreamCount] = useState<number | null>(null);
  const [disconnectionReasonCode, setDisconnectionReasonCode] = useState<number | null>(null);
  const [ownerJid, setOwnerJid] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [statusDetail, setStatusDetail] = useState<string>(
    'Connecting to Evolution WhatsApp gateway session...'
  );

  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [isDisconnecting, setIsDisconnecting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [pollCountdown, setPollCountdown] = useState<number>(5);

  // Test Message Box State
  const [testRecipientPhone, setTestRecipientPhone] = useState<string>('');
  const [testMessageText, setTestMessageText] = useState<string>(
    'Hello! This is a test message from FlowPilot WhatsApp Engine.'
  );
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);
  const [testResultNotice, setTestResultNotice] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [firestoreState, setFirestoreState] = useState<FirestoreSyncState>('idle');
  const [firestoreMessage, setFirestoreMessage] = useState<string>('Pending sync');
  const [persistedSnapshot, setPersistedSnapshot] = useState<{
    userId: string;
    instanceName: string;
    status: EvolutionConnectionStatus;
  } | null>(null);

  const lastPersistedKeyRef = useRef<string | null>(null);
  const pollInFlightRef = useRef<boolean>(false);
  const notifiedConnectedRef = useRef<boolean>(false);

  const saveConnectionToFirestore = useCallback(
    async (
      targetUid: string,
      targetInstance: string,
      targetStatus: EvolutionConnectionStatus
    ) => {
      const dedupeKey = `${targetUid}:${targetInstance}:${targetStatus}`;
      if (lastPersistedKeyRef.current === dedupeKey) {
        return;
      }

      setPersistedSnapshot({
        userId: targetUid,
        instanceName: targetInstance,
        status: targetStatus,
      });

      const currentFbUser = auth.currentUser;
      if (!currentFbUser || currentFbUser.uid !== targetUid) {
        lastPersistedKeyRef.current = dedupeKey;
        setFirestoreState('local_only');
        setFirestoreMessage(
          'Local session active (sign in with Google or Firebase Auth for direct Firestore cloud sync)'
        );
        return;
      }

      const docPath = `whatsapp_connections/${targetUid}`;
      const connectionRef = doc(db, 'whatsapp_connections', targetUid);
      setFirestoreState('saving');

      let exists = false;
      try {
        const snap = await getDoc(connectionRef);
        exists = snap.exists();
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Failed to inspect Firestore record';
        setFirestoreState('error');
        setFirestoreMessage(msg);
        try {
          handleFirestoreError(err, OperationType.GET, docPath);
        } catch {
          // Structured Firestore Error already logged by handleFirestoreError
        }
        return;
      }

      try {
        if (!exists) {
          await setDoc(connectionRef, {
            userId: targetUid,
            instanceName: targetInstance,
            status: targetStatus,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(connectionRef, {
            instanceName: targetInstance,
            status: targetStatus,
            updatedAt: serverTimestamp(),
          });
        }
        lastPersistedKeyRef.current = dedupeKey;
        setFirestoreState('synced');
        setFirestoreMessage('Saved to Firestore');
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Failed to save connection status';
        setFirestoreState('error');
        setFirestoreMessage(msg);
        try {
          handleFirestoreError(
            err,
            exists ? OperationType.UPDATE : OperationType.CREATE,
            docPath
          );
        } catch {
          // Structured Firestore Error already logged by handleFirestoreError
        }
      }
    },
    []
  );

  const applyEvolutionResponse = useCallback(
    async (data: EvolutionClientSessionResult) => {
      setStatus(data.status);
      setQrCode(data.qrCode || null);
      setPairingCode(data.pairingCode || null);
      setUpstreamCount(data.upstreamCount ?? null);
      setDisconnectionReasonCode(data.disconnectionReasonCode ?? null);
      setOwnerJid(data.ownerJid || null);
      setProfileName(data.profileName || null);
      setStatusDetail(data.detail || '');
      setLastCheckedAt(data.checkedAt || new Date().toISOString());

      await saveConnectionToFirestore(data.userId, data.instanceName, data.status);

      if (data.status === 'open' && !notifiedConnectedRef.current) {
        notifiedConnectedRef.current = true;
        onAccountConnected?.({
          instanceName: data.instanceName,
          status: data.status,
          ownerJid: data.ownerJid,
          profileName: data.profileName,
        });
      } else if (data.status !== 'open') {
        notifiedConnectedRef.current = false;
      }
    },
    [onAccountConnected, saveConnectionToFirestore]
  );

  /**
   * Direct Browser -> Evolution API Connect Flow (NO /api routes)
   * Calls POST ${EVOLUTION_URL}/instance/create and GET ${EVOLUTION_URL}/instance/connect/${instanceName}
   */
  const handleConnectWhatsApp = useCallback(
    async (forceRestart = false) => {
      if (!safeUid || !instanceName) return;

      setIsInitializing(true);
      setErrorMessage(null);

      try {
        const result = await createAndConnectEvolutionInstance(safeUid, forceRestart);
        if (!result.ok) {
          throw new Error(
            result.error || result.detail || 'Failed to initialize WhatsApp connection.'
          );
        }

        await applyEvolutionResponse(result);
        setPollCountdown(5);
      } catch (err) {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Unable to connect to Evolution WhatsApp service.'
        );
      } finally {
        setIsInitializing(false);
      }
    },
    [applyEvolutionResponse, instanceName, safeUid]
  );

  /**
   * Poll GET ${EVOLUTION_URL}/instance/connectionState/${instanceName} every 5 seconds until open
   */
  const pollStatus = useCallback(async () => {
    if (!safeUid || !instanceName || pollInFlightRef.current) return;
    pollInFlightRef.current = true;
    setIsPolling(true);

    try {
      const result = await checkEvolutionConnectionState(safeUid, true);
      if (!result.ok) {
        throw new Error(result.error || result.detail || 'Status check failed.');
      }
      setErrorMessage(null);
      await applyEvolutionResponse(result);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to reach Evolution status endpoint.'
      );
    } finally {
      pollInFlightRef.current = false;
      setIsPolling(false);
      setPollCountdown(5);
    }
  }, [applyEvolutionResponse, instanceName, safeUid]);

  const statusRef = useRef<EvolutionConnectionStatus>(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Initial load and 5-second polling interval until open
  useEffect(() => {
    if (!safeUid || !instanceName) {
      lastPersistedKeyRef.current = null;
      return;
    }

    let cancelled = false;
    lastPersistedKeyRef.current = null;
    notifiedConnectedRef.current = false;

    const loadInitialFirestoreDoc = async () => {
      const currentFbUser = auth.currentUser;
      if (!currentFbUser || currentFbUser.uid !== safeUid) {
        return;
      }
      const docPath = `whatsapp_connections/${safeUid}`;
      try {
        const snap = await getDoc(doc(db, 'whatsapp_connections', safeUid));
        if (!cancelled && snap.exists()) {
          const data = snap.data() as {
            userId?: string;
            instanceName?: string;
            status?: EvolutionConnectionStatus;
          };
          if (data.status && data.instanceName) {
            setPersistedSnapshot({
              userId: data.userId || safeUid,
              instanceName: data.instanceName,
              status: data.status,
            });
            setStatus(data.status);
            setFirestoreState('synced');
            setFirestoreMessage('Loaded from Firestore');
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, docPath);
      }
    };

    loadInitialFirestoreDoc();
    handleConnectWhatsApp(false);

    // Poll GET /instance/connectionState/{instanceName} every 5 seconds until open
    const pollInterval = setInterval(() => {
      if (statusRef.current === 'open') {
        clearInterval(pollInterval);
        return;
      }
      pollStatus();
    }, 5000);

    const countdownInterval = setInterval(() => {
      if (statusRef.current === 'open') return;
      setPollCountdown((prev) => (prev <= 1 ? 5 : prev - 1));
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
      clearInterval(countdownInterval);
    };
  }, [handleConnectWhatsApp, instanceName, pollStatus, safeUid]);

  const handleDisconnect = async () => {
    if (!safeUid || !instanceName) return;
    setIsDisconnecting(true);
    setErrorMessage(null);
    try {
      const result = await disconnectEvolutionInstance(safeUid);
      if (!result.ok) {
        throw new Error(result.error || 'Failed to disconnect WhatsApp session.');
      }
      notifiedConnectedRef.current = false;
      setStatus('close');
      setQrCode(null);
      setOwnerJid(null);
      setProfileName(null);
      await saveConnectionToFirestore(safeUid, instanceName, 'close');
      onAccountDisconnected?.();
      await handleConnectWhatsApp(true);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to disconnect WhatsApp.'
      );
    } finally {
      setIsDisconnecting(false);
    }
  };

  /**
   * Test Message Sender: Sends live WhatsApp test message directly via Evolution API
   */
  const handleSendTestMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPhone = testRecipientPhone.replace(/[^0-9]/g, '');
    if (!cleanPhone || cleanPhone.length < 8) {
      setTestResultNotice({
        type: 'error',
        message: 'Please enter a valid phone number with country code (e.g. 2348012345678 or 15552345678).',
      });
      return;
    }

    if (!testMessageText.trim()) {
      setTestResultNotice({
        type: 'error',
        message: 'Please enter message text to send.',
      });
      return;
    }

    setIsSendingTest(true);
    setTestResultNotice(null);

    try {
      const result = await sendEvolutionTextMessage({
        userId: safeUid,
        instanceName,
        to: cleanPhone,
        text: testMessageText.trim(),
      });

      if (!result.ok) {
        throw new Error(result.error || result.detail || 'Failed to dispatch test message.');
      }

      setTestResultNotice({
        type: 'success',
        message: `✓ Test message sent to +${cleanPhone} via ${result.provider}! (ID: ${result.messageId || 'ok'})`,
      });
    } catch (err: any) {
      setTestResultNotice({
        type: 'error',
        message: err?.message || 'Failed to send test message via Evolution API.',
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  if (authLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="h-16 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1322] animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 h-96 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1322] animate-pulse" />
          <div className="lg:col-span-5 h-96 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1322] animate-pulse" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1322] p-8 text-center space-y-5">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/70 flex items-center justify-center mx-auto">
            <Lock className="w-5 h-5 text-[#2563EB]" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Connect WhatsApp
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
              Sign in to generate your dedicated Evolution API QR session and link your WhatsApp account to your workspace.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-1">
            {onOpenAuth && (
              <button
                type="button"
                onClick={onOpenAuth}
                className="px-4 py-2.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                Sign In to Connect
              </button>
            )}
            {onBackToDashboard && (
              <button
                type="button"
                onClick={onBackToDashboard}
                className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium transition-colors cursor-pointer"
              >
                Back to Dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const cleanPhoneFromJid = ownerJid
    ? ownerJid.split('@')[0].replace(/[^0-9+]/g, '')
    : null;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Top Action Header */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1322] px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          {onBackToDashboard && (
            <button
              type="button"
              onClick={onBackToDashboard}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors cursor-pointer shrink-0"
              title="Back to Command Center"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2.5">
              <QrCode className="w-5 h-5 text-[#2563EB] shrink-0" />
              <h1 className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Connect WhatsApp
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Evolution API Server (v2.3.5) · Instance:{' '}
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {instanceName}
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* TASK 1: Show status Connected green if state is open, Disconnected red if close, with Reconnect button */}
          <div
            className={`px-3 py-1.5 rounded-lg border flex items-center gap-2 text-xs font-semibold ${
              status === 'open'
                ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                : 'border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
            }`}
          >
            {status === 'open' ? (
              <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-[#DC2626] shrink-0" />
            )}
            <span>
              {status === 'open' ? 'Connected' : 'Disconnected'}
            </span>
            {status !== 'open' && (
              <>
                <span className="opacity-50">|</span>
                <span className="font-mono tabular-nums font-normal">
                  {isPolling ? 'Checking...' : `${pollCountdown}s`}
                </span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleConnectWhatsApp(true)}
            disabled={isInitializing}
            className="px-3.5 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white text-xs font-semibold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer shadow-xs shadow-blue-500/20"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isInitializing ? 'animate-spin' : ''}`}
            />
            <span>{isInitializing ? 'Connecting...' : 'Reconnect'}</span>
          </button>
        </div>
      </div>

      {/* Main Content Two-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: QR Code or Connected State + Send Test Message Box */}
        <section className="lg:col-span-7 space-y-5">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1322] p-6">
            {errorMessage && (
              <div className="mb-5 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 p-3.5 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#DC2626]" />
                <div className="space-y-1 min-w-0">
                  <p className="font-semibold">Gateway Notice</p>
                  <p className="break-words">{errorMessage}</p>
                </div>
              </div>
            )}

            {status === 'open' ? (
              <div className="py-6 space-y-6">
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/30 p-6 text-center space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-[#16A34A]/15 border border-[#16A34A]/30 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6 text-[#16A34A]" />
                  </div>
                  <h2 className="font-display text-xl font-bold text-[#16A34A]">
                    WhatsApp Connected
                  </h2>
                  <p className="text-sm text-emerald-800 dark:text-emerald-300 max-w-md mx-auto">
                    Your WhatsApp device session is live and connected via Evolution API. Inbound messages automatically trigger your workflows and Auto Responders.
                  </p>

                  {(profileName || cleanPhoneFromJid) && (
                    <div className="pt-2 flex flex-wrap items-center justify-center gap-4 text-xs font-mono text-emerald-900 dark:text-emerald-200">
                      {profileName && (
                        <span>
                          Account: <strong>{profileName}</strong>
                        </span>
                      )}
                      {cleanPhoneFromJid && (
                        <span>
                          Number: <strong>+{cleanPhoneFromJid}</strong>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Instance{' '}
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      {instanceName}
                    </span>{' '}
                    monitored every{' '}
                    <span className="font-mono tabular-nums">5s</span>.
                  </div>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={isDisconnecting}
                    className="px-3.5 py-2 rounded-lg border border-rose-200 dark:border-rose-900/70 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{isDisconnecting ? 'Disconnecting...' : 'Disconnect WhatsApp'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="text-center space-y-1.5">
                  <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                    Scan with your WhatsApp
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Open WhatsApp on your phone, tap Linked Devices, and scan the QR code below.
                  </p>
                </div>

                {/* QR Code Container (Shows base64 from Evolution API) */}
                <div className="flex flex-col items-center justify-center">
                  <div className="w-72 h-72 rounded-xl border border-slate-200 dark:border-slate-700 bg-white p-4 flex items-center justify-center shadow-xs">
                    {isInitializing && !qrCode ? (
                      <div className="flex flex-col items-center gap-3 text-slate-500">
                        <RefreshCw className="w-7 h-7 animate-spin text-[#2563EB]" />
                        <span className="text-xs font-medium text-slate-600">
                          Calling Evolution API...
                        </span>
                      </div>
                    ) : qrCode ? (
                      <img
                        src={
                          qrCode.startsWith('data:image/')
                            ? qrCode
                            : `data:image/png;base64,${qrCode}`
                        }
                        alt="Scan with your WhatsApp"
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center gap-3 px-4">
                        <QrCode className="w-10 h-10 text-slate-300" />
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-slate-800">
                            Awaiting QR Code from Evolution Server
                          </p>
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            Click Connect WhatsApp to generate your instance QR. Polling automatically every <span className="font-mono tabular-nums">5s</span>.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleConnectWhatsApp(true)}
                          disabled={isInitializing}
                          className="px-3 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isInitializing ? 'animate-spin' : ''}`} />
                          <span>Connect WhatsApp</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {pairingCode && (
                    <div className="mt-4 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-xs">
                      <span className="text-slate-500 dark:text-slate-400 mr-2">
                        Pairing code:
                      </span>
                      <span className="font-mono font-bold tracking-widest text-slate-900 dark:text-white">
                        {pairingCode}
                      </span>
                    </div>
                  )}
                </div>

                {/* 3-Step Scan Instructions */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-3">
                    <p className="font-mono text-[11px] font-semibold text-[#2563EB]">
                      01
                    </p>
                    <p className="text-xs font-semibold text-slate-900 dark:text-white mt-0.5">
                      Open WhatsApp
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Open WhatsApp on your mobile phone.
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-3">
                    <p className="font-mono text-[11px] font-semibold text-[#2563EB]">
                      02
                    </p>
                    <p className="text-xs font-semibold text-slate-900 dark:text-white mt-0.5">
                      Linked Devices
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Tap Settings &gt; Linked Devices &gt; Link a Device.
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-3">
                    <p className="font-mono text-[11px] font-semibold text-[#2563EB]">
                      03
                    </p>
                    <p className="text-xs font-semibold text-slate-900 dark:text-white mt-0.5">
                      Scan QR Code
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Point camera to link. Auto-detects in 5s.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Test WhatsApp Message Card */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1322] p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-[#2563EB]" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Send Test WhatsApp Message
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                POST /message/sendText/{instanceName}
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Verify your Evolution API connection by dispatching an instant test message to any WhatsApp phone number.
            </p>

            <form onSubmit={handleSendTestMessage} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Recipient Phone Number (With Country Code)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2348167386479 or 15552345678"
                  value={testRecipientPhone}
                  onChange={(e) => setTestRecipientPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-mono focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Message Body
                </label>
                <textarea
                  rows={2}
                  value={testMessageText}
                  onChange={(e) => setTestMessageText(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {testResultNotice && (
                <div
                  className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                    testResultNotice.type === 'success'
                      ? 'border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200'
                      : 'border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200'
                  }`}
                >
                  {testResultNotice.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
                  )}
                  <p className="break-words">{testResultNotice.message}</p>
                </div>
              )}

              <div className="flex items-center justify-end pt-1">
                <button
                  type="submit"
                  disabled={isSendingTest}
                  className="px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs shadow-blue-500/20"
                >
                  <Send className={`w-3.5 h-3.5 ${isSendingTest ? 'animate-pulse' : ''}`} />
                  <span>{isSendingTest ? 'Sending via Evolution...' : 'Send Test Message'}</span>
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* Right Column: Session State & Firestore Persistence Details */}
        <aside className="lg:col-span-5 space-y-4">
          {/* Evolution Instance Metadata */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1322] p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[#2563EB]" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Evolution Instance State
                </h3>
              </div>
              <button
                type="button"
                onClick={pollStatus}
                disabled={isPolling}
                className="text-xs font-medium text-[#2563EB] hover:underline inline-flex items-center gap-1 cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3 h-3 ${isPolling ? 'animate-spin' : ''}`} />
                <span>Check Now</span>
              </button>
            </div>

            <dl className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              <div className="py-2.5 flex items-center justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Evolution Server</dt>
                <dd className="font-mono font-medium text-slate-900 dark:text-slate-100 truncate max-w-[200px]">
                  {EVOLUTION_URL}
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Instance Name</dt>
                <dd className="font-mono font-medium text-slate-900 dark:text-slate-100 truncate max-w-[200px]">
                  {instanceName}
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Session Status</dt>
                <dd
                  className={`font-mono font-semibold ${
                    status === 'open'
                      ? 'text-[#16A34A]'
                      : status === 'connecting'
                      ? 'text-[#D97706]'
                      : 'text-[#DC2626]'
                  }`}
                >
                  {status === 'open' ? 'Connected (open)' : status === 'connecting' ? 'Connecting' : 'Disconnected (close)'}
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Connection Mode</dt>
                <dd className="font-mono text-slate-900 dark:text-slate-100 truncate max-w-[200px]">
                  Direct Browser -&gt; Evolution API
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Auto-Poll Cadence</dt>
                <dd className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  Every 5s (next in {pollCountdown}s)
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Last Checked</dt>
                <dd className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                  {lastCheckedAt
                    ? new Date(lastCheckedAt).toLocaleTimeString()
                    : '—'}
                </dd>
              </div>
              {disconnectionReasonCode !== null && status !== 'open' && (
                <div className="py-2.5 flex items-center justify-between gap-3">
                  <dt className="text-slate-500 dark:text-slate-400">Reason Code</dt>
                  <dd className="font-mono tabular-nums text-amber-600 dark:text-amber-400">
                    {disconnectionReasonCode}
                  </dd>
                </div>
              )}
            </dl>

            {statusDetail && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                {statusDetail}
              </p>
            )}
          </div>

          {/* Firestore Connection Sync Card */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1322] p-5 space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-[#2563EB]" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Firestore Persistence
                </h3>
              </div>
              <span
                className={`text-[11px] font-medium ${
                  firestoreState === 'synced'
                    ? 'text-[#16A34A]'
                    : firestoreState === 'error'
                    ? 'text-[#DC2626]'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {firestoreState === 'saving' ? 'Saving...' : firestoreMessage}
              </span>
            </div>

            <dl className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              <div className="py-2 flex items-center justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Collection</dt>
                <dd className="font-mono text-slate-900 dark:text-slate-100">
                  whatsapp_connections
                </dd>
              </div>
              <div className="py-2 flex items-center justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">userId</dt>
                <dd className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-[180px]">
                  {persistedSnapshot?.userId || safeUid}
                </dd>
              </div>
              <div className="py-2 flex items-center justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">instanceName</dt>
                <dd className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-[180px]">
                  {persistedSnapshot?.instanceName || instanceName}
                </dd>
              </div>
              <div className="py-2 flex items-center justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">status</dt>
                <dd className="font-mono font-semibold text-slate-900 dark:text-white">
                  {persistedSnapshot?.status || status}
                </dd>
              </div>
            </dl>
          </div>

          {/* Alternative Phone Pairing Link */}
          {onNavigateToPhonePairing && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1322] p-4 flex items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <ShieldCheck className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">
                    Need Phone Pairing Code?
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Alternative 8-digit pairing mode if phone camera scanning is unavailable.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onNavigateToPhonePairing}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>Phone Pairing</span>
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
