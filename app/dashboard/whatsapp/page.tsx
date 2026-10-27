'use client';

import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

export interface WhatsAppQrResponse {
  ok?: boolean;
  connected?: boolean;
  number?: string;
  qr?: string;
  qrExpiresAt?: number;
  error?: string;
}

export default function WhatsAppDashboardPage() {
  const [userId] = useState<string>('default_workspace');
  const [connected, setConnected] = useState<boolean>(false);
  const [connectedNumber, setConnectedNumber] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [testTo, setTestTo] = useState<string>('');
  const [testMsg, setTestMsg] = useState<string>('Hello! Testing WhatsApp flow via FlowPilot QR.');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendFeedback, setSendFeedback] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastRenderedQrRef = useRef<string>('');

  const renderQrToCanvas = async (qrString: string) => {
    if (!qrString) return;
    if (lastRenderedQrRef.current === qrString && canvasRef.current) return;

    if (canvasRef.current) {
      try {
        await QRCode.toCanvas(canvasRef.current, qrString, {
          width: 280,
          margin: 2,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
        });
        lastRenderedQrRef.current = qrString;
      } catch (err: any) {
        console.error('[WhatsApp QR] QRCode.toCanvas failed:', err);
      }
    }
  };

  const fetchQrAndStatus = async (forceRefresh: boolean = false) => {
    if (forceRefresh) setIsRefreshing(true);
    try {
      const url = forceRefresh
        ? `/api/whatsapp/qr?userId=${encodeURIComponent(userId)}&refresh=true`
        : `/api/whatsapp/qr?userId=${encodeURIComponent(userId)}`;

      const res = await fetch(url);
      if (!res.ok) {
        // Fallback: query status endpoint directly
        const statusRes = await fetch(`/api/whatsapp/status?userId=${encodeURIComponent(userId)}`);
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData.connected) {
            setConnected(true);
            setConnectedNumber(statusData.number || '');
            setErrorNotice(null);
            setLoading(false);
            return;
          }
        }
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data: WhatsAppQrResponse = await res.json();

      if (data.connected) {
        setConnected(true);
        setConnectedNumber(data.number || '');
        setErrorNotice(null);
      } else {
        setConnected(false);
        if (data.qr) {
          setErrorNotice(null);
          // Convert QR string to image using qrcode library QRCode.toCanvas
          await renderQrToCanvas(data.qr);
        }
      }
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err: any) {
      console.warn('[WhatsApp QR] Polling check:', err.message);
      // Soft notice, do not block polling
      setErrorNotice('Connecting to WhatsApp QR service... will auto-retry in 3s');
    } finally {
      setLoading(false);
      if (forceRefresh) setIsRefreshing(false);
    }
  };

  // Poll every 3 seconds fetch /api/whatsapp/qr
  useEffect(() => {
    fetchQrAndStatus(false);

    const interval = setInterval(() => {
      fetchQrAndStatus(false);
    }, 3000);

    return () => clearInterval(interval);
  }, [userId]);

  const handleManualRefresh = () => {
    lastRenderedQrRef.current = '';
    fetchQrAndStatus(true);
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to unlink this WhatsApp session?')) return;
    try {
      await fetch('/api/whatsapp/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      setConnected(false);
      setConnectedNumber('');
      lastRenderedQrRef.current = '';
      fetchQrAndStatus(true);
    } catch (err: any) {
      alert(`Disconnect failed: ${err.message}`);
    }
  };

  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testTo.trim() || !testMsg.trim()) return;

    setIsSending(true);
    setSendFeedback(null);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          to: testTo.trim(),
          message: testMsg.trim(),
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.ok) {
        throw new Error(result.error || 'Failed to dispatch WhatsApp message');
      }
      setSendFeedback(`Message delivered successfully to +${result.to}!`);
    } catch (err: any) {
      setSendFeedback(`Error: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.031 2C6.49 2 2 6.49 2 12.031c0 1.769.458 3.498 1.332 5.016L2 22l5.127-1.312A10.02 10.02 0 0 0 12.031 22c5.54 0 10.031-4.49 10.031-10.031S17.571 2 12.031 2zm0 18.281c-1.554 0-3.07-.406-4.402-1.176l-.316-.184-3.262.834.87-3.178-.204-.33A8.25 8.25 0 0 1 3.75 12.03c0-4.567 3.714-8.281 8.281-8.281 4.567 0 8.281 3.714 8.281 8.281 0 4.567-3.714 8.281-8.281 8.281z"/>
                </svg>
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
                  WhatsApp QR Connect
                </h1>
                <p className="text-xs text-slate-400">
                  Baileys Multi-Device Engine with Firebase Firestore Persistence
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 hidden sm:inline-block">
              {lastUpdated ? `Polled at ${lastUpdated}` : 'Polling every 3s...'}
            </span>
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              <svg className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh QR
            </button>
          </div>
        </div>

        {errorNotice && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center justify-between">
            <span>{errorNotice}</span>
            <span className="text-[10px] opacity-75">Auto-polling active</span>
          </div>
        )}

        {/* Status Card */}
        {connected ? (
          <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 md:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xl border border-emerald-500/30">
                  ✓
                </div>
                <div>
                  <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Connected & Ready
                  </div>
                  <h3 className="text-lg font-semibold text-white mt-1">
                    +{connectedNumber || 'WhatsApp Phone'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Session credentials safely persisted in Firestore <code className="text-slate-300 bg-slate-800 px-1 py-0.5 rounded">whatsapp_sessions/{userId}</code>
                  </p>
                </div>
              </div>

              <button
                onClick={handleDisconnect}
                className="px-4 py-2 rounded-xl text-xs font-medium text-rose-300 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition self-start sm:self-auto"
              >
                Disconnect Session
              </button>
            </div>

            {/* Test Send Form */}
            <div className="pt-6 border-t border-slate-800">
              <h4 className="text-sm font-semibold text-slate-200 mb-2">Test WhatsApp Message Dispatch</h4>
              <p className="text-xs text-slate-400 mb-4">
                Verifies that Baileys loads credentials from Firestore, sends the message, and closes ephemeral socket.
              </p>
              <form onSubmit={handleSendTestMessage} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={testTo}
                    onChange={(e) => setTestTo(e.target.value)}
                    placeholder="Recipient phone e.g. 08012345678 or 2348012345678"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    required
                  />
                  <input
                    type="text"
                    value={testMsg}
                    onChange={(e) => setTestMsg(e.target.value)}
                    placeholder="Message text"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSending}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold transition disabled:opacity-50"
                >
                  {isSending ? 'Sending via Baileys...' : 'Send Test WhatsApp Message'}
                </button>
              </form>
              {sendFeedback && (
                <p className={`mt-3 text-xs ${sendFeedback.startsWith('Error') ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {sendFeedback}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Left: QR Canvas */}
              <div className="lg:col-span-5 flex flex-col items-center text-center">
                <div className="p-4 bg-white rounded-2xl shadow-xl inline-block relative min-h-[300px] min-w-[300px] flex items-center justify-center">
                  <canvas ref={canvasRef} className="rounded-lg max-w-full" />
                  {loading && !lastRenderedQrRef.current && (
                    <div className="absolute inset-0 bg-white/90 rounded-2xl flex flex-col items-center justify-center p-4">
                      <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2" />
                      <span className="text-xs text-slate-600 font-medium">Generating Baileys QR...</span>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2 text-slate-400 text-xs">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span>Polling /api/whatsapp/qr every 3 seconds</span>
                </div>
              </div>

              {/* Right: Step by Step Instructions */}
              <div className="lg:col-span-7 space-y-4">
                <h3 className="text-lg font-semibold text-white">How to connect your WhatsApp</h3>
                <ol className="space-y-3 text-xs text-slate-300">
                  <li className="flex items-start gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 font-bold flex items-center justify-center shrink-0 border border-emerald-500/20">
                      1
                    </span>
                    <span>Open <strong>WhatsApp</strong> on your phone.</span>
                  </li>
                  <li className="flex items-start gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 font-bold flex items-center justify-center shrink-0 border border-emerald-500/20">
                      2
                    </span>
                    <span>
                      Tap <strong>Menu</strong> (three dots on Android) or <strong>Settings</strong> (gear on iPhone) and select <strong>Linked Devices</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 font-bold flex items-center justify-center shrink-0 border border-emerald-500/20">
                      3
                    </span>
                    <span>Tap <strong>Link a Device</strong> and point your camera at this QR code.</span>
                  </li>
                </ol>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-1">
                  <p className="font-medium text-slate-200">Firebase Firestore Integration:</p>
                  <p className="text-[11px]">
                    Credentials are saved directly to Firestore collection <code className="text-emerald-400">whatsapp_sessions</code>. Even if Vercel serverless functions shut down or spin down, your session stays valid and auto-responds!
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
