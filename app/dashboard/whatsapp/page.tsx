'use client';

import React, { useEffect, useState, useRef } from 'react';

export default function WhatsAppPairingDashboardPage() {
  const [userId] = useState<string>('default_workspace');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [pairingCode, setPairingCode] = useState<string>('');
  const [isLoadingCode, setIsLoadingCode] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Status & Connected State
  const [connected, setConnected] = useState<boolean>(false);
  const [connectedNumber, setConnectedNumber] = useState<string>('');
  const [secondsRemaining, setSecondsRemaining] = useState<number>(60);
  const [timerActive, setTimerActive] = useState<boolean>(false);

  // Test Message State
  const [testTo, setTestTo] = useState<string>('');
  const [testMsg, setTestMsg] = useState<string>('Hello! Testing WhatsApp flow via FlowPilot Pairing Code.');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendFeedback, setSendFeedback] = useState<string | null>(null);

  // Status polling to detect when user enters pairing code on phone
  const checkStatus = async () => {
    try {
      const res = await fetch(`/api/whatsapp/status?userId=${encodeURIComponent(userId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.connected) {
          setConnected(true);
          setConnectedNumber(data.phoneNumber || data.number || phoneNumber);
          setPairingCode('');
          setTimerActive(false);
          setErrorMessage(null);
        } else {
          setConnected(false);
        }
      }
    } catch {
      // background poll silently
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, [userId, phoneNumber]);

  // Countdown timer for pairing code (60 seconds)
  useEffect(() => {
    if (!timerActive || secondsRemaining <= 0) {
      if (secondsRemaining <= 0) {
        setTimerActive(false);
      }
      return;
    }

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timerActive, secondsRemaining]);

  const handleGetPairingCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const clean = phoneNumber.replace(/[^0-9]/g, '');
    if (!clean || clean.length < 8) {
      setErrorMessage('Please enter a valid phone number with country code, e.g. 2348012345678.');
      return;
    }

    setIsLoadingCode(true);
    setErrorMessage(null);
    setCopied(false);

    try {
      const res = await fetch('/api/whatsapp/pairing-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          phoneNumber: clean,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to request pairing code.');
      }

      if (data.connected) {
        setConnected(true);
        setConnectedNumber(data.phoneNumber || clean);
        setPairingCode('');
        return;
      }

      setPairingCode(data.pairingCode);
      setSecondsRemaining(60);
      setTimerActive(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error generating pairing code. Please check the phone number.');
    } finally {
      setIsLoadingCode(false);
    }
  };

  const handleCopyCode = async () => {
    if (!pairingCode) return;
    try {
      await navigator.clipboard.writeText(pairingCode.replace('-', ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
      setCopied(true);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect this WhatsApp session?')) return;
    try {
      await fetch('/api/whatsapp/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      setConnected(false);
      setConnectedNumber('');
      setPairingCode('');
      setTimerActive(false);
    } catch (err: any) {
      alert(`Disconnect failed: ${err.message}`);
    }
  };

  const handleSendTest = async (e: React.FormEvent) => {
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
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to send WhatsApp message.');
      }
      setSendFeedback(`Message delivered successfully to +${data.to}!`);
    } catch (err: any) {
      setSendFeedback(`Error: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="border-b border-slate-800 pb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xl shadow-inner">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.031 2C6.49 2 2 6.49 2 12.031c0 1.769.458 3.498 1.332 5.016L2 22l5.127-1.312A10.02 10.02 0 0 0 12.031 22c5.54 0 10.031-4.49 10.031-10.031S17.571 2 12.031 2zm0 18.281c-1.554 0-3.07-.406-4.402-1.176l-.316-.184-3.262.834.87-3.178-.204-.33A8.25 8.25 0 0 1 3.75 12.03c0-4.567 3.714-8.281 8.281-8.281 4.567 0 8.281 3.714 8.281 8.281 0 4.567-3.714 8.281-8.281 8.281z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
                Connect WhatsApp with Phone Number
              </h1>
              <p className="text-xs text-slate-400">
                Baileys 8-Digit Pairing Code Method — 100% Reliable on Vercel Serverless
              </p>
            </div>
          </div>

          {connected && (
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Connected
            </span>
          )}
        </div>

        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between">
            <span>{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs font-bold text-rose-400 hover:text-white ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* CONNECTED STATE */}
        {connected ? (
          <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-6 md:p-8 space-y-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xl border border-emerald-500/30">
                  ✓
                </div>
                <div>
                  <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Paired & Automation Active
                  </div>
                  <h3 className="text-xl font-bold text-white mt-1">
                    +{connectedNumber || phoneNumber}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Session credentials stored in Firestore <code className="text-slate-300 bg-slate-800 px-1 py-0.5 rounded">whatsapp_sessions/{userId}</code>
                  </p>
                </div>
              </div>

              <button
                onClick={handleDisconnect}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/25 hover:bg-rose-500/20 transition self-start sm:self-auto"
              >
                Disconnect Session
              </button>
            </div>

            {/* Test Send Form */}
            <div className="pt-6 border-t border-slate-800">
              <h4 className="text-sm font-semibold text-slate-200 mb-1">Test WhatsApp Message Dispatch</h4>
              <p className="text-xs text-slate-400 mb-4">
                Sends a live WhatsApp message using Firestore authentication credentials.
              </p>
              <form onSubmit={handleSendTest} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={testTo}
                    onChange={(e) => setTestTo(e.target.value)}
                    placeholder="Recipient phone e.g. 2348012345678"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    required
                  />
                  <input
                    type="text"
                    value={testMsg}
                    onChange={(e) => setTestMsg(e.target.value)}
                    placeholder="Message text"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSending}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition disabled:opacity-50"
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
          /* PAIRING CODE FORM & DISPLAY */
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-8 shadow-xl">
            {/* Input Phone Form */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Phone Number (with country code, no + or spaces)
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="2348012345678"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                  disabled={isLoadingCode}
                />
                <button
                  onClick={handleGetPairingCode}
                  disabled={isLoadingCode || !phoneNumber.trim()}
                  className="px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
                >
                  {isLoadingCode ? (
                    <>
                      <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      Generating Code...
                    </>
                  ) : (
                    'Get Pairing Code'
                  )}
                </button>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                Example: For Nigeria (+234) enter <code>2348012345678</code>. For US (+1) enter <code>12345678901</code>.
              </p>
            </div>

            {/* BIG BOLD 8-DIGIT CODE DISPLAY */}
            {pairingCode && (
              <div className="p-6 rounded-2xl bg-slate-950 border border-emerald-500/30 text-center space-y-4 shadow-2xl">
                <p className="text-xs font-medium text-emerald-400 uppercase tracking-wider">
                  Your WhatsApp Pairing Code
                </p>

                <div className="inline-flex items-center justify-center gap-3">
                  <div className="text-4xl md:text-5xl font-mono font-extrabold tracking-widest text-emerald-400 bg-emerald-500/10 px-6 py-3 rounded-2xl border border-emerald-500/30 select-all">
                    {pairingCode}
                  </div>
                  <button
                    onClick={handleCopyCode}
                    className="p-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                    title="Copy code"
                  >
                    {copied ? (
                      <span className="text-xs font-bold text-emerald-400">Copied!</span>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Countdown & Resend */}
                <div className="flex items-center justify-center gap-3 text-xs text-slate-400">
                  {secondsRemaining > 0 ? (
                    <span>Code expires in <strong className="text-emerald-400 font-mono">{secondsRemaining}s</strong></span>
                  ) : (
                    <span className="text-rose-400 font-medium">Code expired</span>
                  )}
                  <button
                    onClick={() => handleGetPairingCode()}
                    disabled={isLoadingCode}
                    className="text-xs font-semibold text-emerald-400 underline hover:text-emerald-300 ml-1"
                  >
                    Resend Code
                  </button>
                </div>

                <div className="pt-2 flex items-center justify-center gap-2 text-[11px] text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Waiting for you to enter the code on WhatsApp...</span>
                </div>
              </div>
            )}

            {/* Step-by-Step Instructions */}
            <div className="pt-6 border-t border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                How to Link with Phone Number:
              </h3>
              <ol className="space-y-3 text-xs text-slate-300">
                <li className="flex items-start gap-3 bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 border border-emerald-500/30">
                    1
                  </span>
                  <span className="pt-0.5">Open <strong>WhatsApp</strong> on your phone.</span>
                </li>
                <li className="flex items-start gap-3 bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 border border-emerald-500/30">
                    2
                  </span>
                  <span className="pt-0.5">Go to <strong>Settings</strong> &gt; <strong>Linked Devices</strong>.</span>
                </li>
                <li className="flex items-start gap-3 bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 border border-emerald-500/30">
                    3
                  </span>
                  <span className="pt-0.5">Tap <strong>Link a Device</strong> &gt; <strong>Link with phone number instead</strong>.</span>
                </li>
                <li className="flex items-start gap-3 bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 border border-emerald-500/30">
                    4
                  </span>
                  <span className="pt-0.5">Enter the <strong>8-digit code</strong> above into your phone.</span>
                </li>
              </ol>

              <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-[11px] text-slate-400 space-y-1">
                <p className="font-semibold text-emerald-400">Why Pairing Code is better than QR on Vercel:</p>
                <p>
                  QR codes require long-lived WebSocket connections which Vercel serverless functions terminate prematurely. Pairing codes are requested synchronously, entered directly in WhatsApp, and session credentials are saved directly to Firestore.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
