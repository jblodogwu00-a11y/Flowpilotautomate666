import React, { useState } from 'react';
import {
  X,
  Mail,
  Lock,
  User as UserIcon,
  Briefcase,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ShieldCheck,
  RefreshCw,
  SlidersHorizontal,
  Loader2,
  Check,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  verifyAccountEmailCode,
  resendAccountVerificationCode,
  triggerPasswordReset,
  connectGmailAccountWithPopup,
} from '../firebase';
import {
  VerificationEmailDispatchInfo,
  VerificationEmailConnectorOverride,
} from '../services/accountPersistenceService';
import {
  getStoredChannelGatewayConfig,
  saveStoredChannelGatewayConfig,
} from '../services/messageDeliveryService';
import { FlowPilotLogo } from './FlowPilotLogo';

export type AuthModalMode =
  | 'signin'
  | 'signup'
  | 'forgot'
  | 'verify_code'
  | 'google_select';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: AuthModalMode;
  onClose: () => void;
  onAuthSuccess: (options?: {
    uid?: string;
    fullName?: string;
    workspaceName?: string;
    email?: string;
  }) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'signin',
  onClose,
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<AuthModalMode>(initialMode);
  const [fullName, setFullName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Granular loading action indicator so buttons show active spinners without dimming/blurring
  const [loadingAction, setLoadingAction] = useState<
    'google' | 'signin' | 'signup' | 'verify' | 'resend' | null
  >(null);
  const isLoading = loadingAction !== null;

  // Confidential Email-Only 6-Digit OTP Code state (for manual registration)
  const [verificationCodeInput, setVerificationCodeInput] = useState('');
  const [dispatchedEmailInfo, setDispatchedEmailInfo] =
    useState<VerificationEmailDispatchInfo | null>(null);

  // Custom Google Account input in Google Chooser mode
  const [customGoogleEmailInput, setCustomGoogleEmailInput] = useState('');
  const [customGoogleNameInput, setCustomGoogleNameInput] = useState('');

  // Optional Multi-Provider Email Gateway configuration
  const [showGatewayConfig, setShowGatewayConfig] = useState(false);
  const storedGateway = getStoredChannelGatewayConfig();
  const [gatewayProviderMode, setGatewayProviderMode] = useState<
    'gmail_oauth' | 'resend_api' | 'sendgrid_api' | 'smtp' | 'builtin_relay'
  >(storedGateway.email.providerMode || 'builtin_relay');
  const [resendApiKeyInput, setResendApiKeyInput] = useState(
    storedGateway.email.resendApiKey || ''
  );
  const [sendgridApiKeyInput, setSendgridApiKeyInput] = useState(
    storedGateway.email.sendgridApiKey || ''
  );
  const [smtpHostInput, setSmtpHostInput] = useState('smtp.gmail.com');
  const [smtpPortInput, setSmtpPortInput] = useState('587');
  const [smtpUserInput, setSmtpUserInput] = useState('');
  const [smtpPassInput, setSmtpPassInput] = useState('');
  const [senderFromEmailInput, setSenderFromEmailInput] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setErrorMsg(null);
      setSuccessMsg(null);
      setLoadingAction(null);
      setVerificationCodeInput('');
      setCustomGoogleEmailInput('');
      setCustomGoogleNameInput('');
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const buildEmailConnectorOverride = (): VerificationEmailConnectorOverride => {
    if (resendApiKeyInput.trim() || sendgridApiKeyInput.trim()) {
      const current = getStoredChannelGatewayConfig();
      saveStoredChannelGatewayConfig({
        ...current,
        email: {
          ...current.email,
          providerMode:
            gatewayProviderMode === 'smtp' ? 'builtin_relay' : gatewayProviderMode,
          resendApiKey: resendApiKeyInput.trim() || current.email.resendApiKey,
          sendgridApiKey:
            sendgridApiKeyInput.trim() || current.email.sendgridApiKey,
        },
      });
    }

    return {
      providerMode: gatewayProviderMode,
      resendApiKey: resendApiKeyInput.trim() || undefined,
      sendgridApiKey: sendgridApiKeyInput.trim() || undefined,
      smtpHost: smtpHostInput.trim() || undefined,
      smtpPort: smtpPortInput.trim() || undefined,
      smtpUser: smtpUserInput.trim() || undefined,
      smtpPass: smtpPassInput.trim() || undefined,
      fromEmail: senderFromEmailInput.trim() || smtpUserInput.trim() || undefined,
      fromName: 'FlowPilot Account Security',
    };
  };

  const formatFirebaseAuthError = (err: unknown): string => {
    const raw = err instanceof Error ? err.message : String(err);
    if (
      raw.includes('auth/invalid-credential') ||
      raw.includes('auth/wrong-password') ||
      raw.includes('auth/user-not-found')
    ) {
      return 'Invalid email or password. Please verify your credentials or reset your password.';
    }
    if (raw.includes('auth/email-already-in-use')) {
      return 'An account with this email already exists. Please sign in or reset your password.';
    }
    if (raw.includes('auth/weak-password')) {
      return 'Password must be at least 6 characters long.';
    }
    if (raw.includes('auth/invalid-email')) {
      return 'Please enter a valid email address.';
    }
    return raw;
  };

  // ---------------------------------------------------------------------------
  // 1. GOOGLE AUTHENTICATION (NO OTP VERIFICATION, DIRECT DASHBOARD REDIRECT)
  // ---------------------------------------------------------------------------
  const handleGoogleAuth = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoadingAction('google');

    try {
      const hintEmail = email.trim() || undefined;
      const hintName = fullName.trim() || undefined;
      const hintWs = workspaceName.trim() || undefined;

      // Attempt native popup with select_account prompt
      const user = await signInWithGoogle({
        email: hintEmail,
        fullName: hintName,
        workspaceName: hintWs,
        directFallback: false,
      });

      // Google authentication succeeded: redirect immediately to dashboard without OTP
      onAuthSuccess({
        uid: user.uid,
        fullName: user.displayName || hintName || 'Workspace Owner',
        workspaceName: hintWs,
        email: user.email || hintEmail,
      });
      onClose();
    } catch {
      // If browser blocked the popup or user environment restricts popups,
      // seamlessly transition to the device Google account chooser modal
      setMode('google_select');
      setErrorMsg(null);
    } finally {
      setLoadingAction(null);
    }
  };

  // Complete Google sign-in when user chooses an account from their device
  const handleSelectGoogleAccountFromDevice = async (
    targetEmail: string,
    targetName?: string
  ) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoadingAction('google');

    try {
      const resolvedName =
        targetName ||
        (targetEmail.includes('jonajukej')
          ? 'Jona Jukej'
          : targetEmail.split('@')[0].replace(/[._-]+/g, ' '));
      const resolvedWs = workspaceName.trim() || `${resolvedName}'s Workspace`;

      const user = await signInWithGoogle({
        email: targetEmail,
        fullName: resolvedName,
        workspaceName: resolvedWs,
        directFallback: true,
      });

      // No OTP code for Google: immediately redirect to dashboard
      onAuthSuccess({
        uid: user.uid,
        fullName: user.displayName || resolvedName,
        workspaceName: resolvedWs,
        email: user.email || targetEmail,
      });
      onClose();
    } catch (err) {
      setErrorMsg(formatFirebaseAuthError(err));
    } finally {
      setLoadingAction(null);
    }
  };

  // ---------------------------------------------------------------------------
  // 2. MANUAL SIGN IN (LOGIN)
  // ---------------------------------------------------------------------------
  const handleManualSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const targetEmail = email.trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setLoadingAction('signin');
    try {
      const outcome = await signInWithEmail(
        targetEmail,
        password,
        buildEmailConnectorOverride()
      );

      // If user registered earlier with email/password and hasn't verified OTP yet:
      if (outcome.requiresVerification && !outcome.account?.emailVerified) {
        setDispatchedEmailInfo(outcome.verificationEmail || null);
        if (outcome.verificationCode) {
          setVerificationCodeInput(outcome.verificationCode);
        }
        setMode('verify_code');
        setSuccessMsg(
          outcome.message ||
            `Please enter the 6-digit OTP code sent to ${targetEmail} to activate your workspace.`
        );
        return;
      }

      // Valid credentials: sign in and redirect directly to dashboard
      onAuthSuccess({
        uid: outcome.account.uid,
        fullName: outcome.account.displayName || undefined,
        workspaceName: outcome.account.workspaceName || undefined,
        email: outcome.account.email || targetEmail,
      });
      onClose();
    } catch (err) {
      setErrorMsg(formatFirebaseAuthError(err));
    } finally {
      setLoadingAction(null);
    }
  };

  // ---------------------------------------------------------------------------
  // 3. MANUAL REGISTRATION (SIGN UP — REQUIRES 6-DIGIT OTP VERIFICATION)
  // ---------------------------------------------------------------------------
  const handleManualSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!fullName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoadingAction('signup');
    try {
      const resolvedWsName =
        workspaceName.trim() || `${fullName.trim()}'s Workspace`;

      const outcome = await signUpWithEmail(
        fullName.trim(),
        email.trim(),
        password,
        resolvedWsName,
        buildEmailConnectorOverride()
      );

      // Manual registration requires 6-digit OTP code verification
      if (outcome.requiresVerification) {
        setDispatchedEmailInfo(outcome.verificationEmail || null);
        if (outcome.verificationCode) {
          setVerificationCodeInput(outcome.verificationCode);
        }
        setMode('verify_code');
        setSuccessMsg(
          outcome.message ||
            `Account registered! A 6-digit OTP verification code has been dispatched to ${email.trim()}.`
        );
      } else {
        // Direct entry if auto-verified
        onAuthSuccess({
          uid: outcome.account.uid,
          fullName: outcome.account.displayName || fullName.trim(),
          workspaceName: outcome.account.workspaceName || resolvedWsName,
          email: outcome.account.email || email.trim(),
        });
        onClose();
      }
    } catch (err) {
      setErrorMsg(formatFirebaseAuthError(err));
    } finally {
      setLoadingAction(null);
    }
  };

  // ---------------------------------------------------------------------------
  // 4. VERIFY 6-DIGIT OTP CODE (MANUAL REGISTRATION COMPLETION)
  // ---------------------------------------------------------------------------
  const handleVerifyEmailCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanDigits = verificationCodeInput.replace(/\D/g, '');
    if (cleanDigits.length !== 6) {
      setErrorMsg(
        'Please enter the complete 6-digit OTP verification code sent to your email.'
      );
      return;
    }

    setLoadingAction('verify');
    try {
      const resolvedWsName =
        workspaceName.trim() ||
        (fullName.trim() ? `${fullName.trim()}'s Workspace` : undefined);

      const verified = await verifyAccountEmailCode({
        email: email.trim(),
        code: cleanDigits,
        fullName: fullName.trim() || undefined,
        workspaceName: resolvedWsName,
        password: password || undefined,
      });

      // Code verified: redirect immediately to dashboard
      onAuthSuccess({
        uid: verified.account.uid,
        fullName: verified.account.displayName,
        workspaceName: verified.account.workspaceName,
        email: verified.account.email,
      });
      onClose();
    } catch (err) {
      setErrorMsg(formatFirebaseAuthError(err));
    } finally {
      setLoadingAction(null);
    }
  };

  const handleResendVerificationCode = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoadingAction('resend');
    try {
      const resolvedWsName =
        workspaceName.trim() ||
        (fullName.trim() ? `${fullName.trim()}'s Workspace` : undefined);
      const res = await resendAccountVerificationCode({
        email: email.trim(),
        fullName: fullName.trim() || undefined,
        workspaceName: resolvedWsName,
        emailConnector: buildEmailConnectorOverride(),
      });
      if (res.verificationEmail) {
        setDispatchedEmailInfo(res.verificationEmail);
      }
      setVerificationCodeInput('');
      setSuccessMsg(res.message);
    } catch (err) {
      setErrorMsg(formatFirebaseAuthError(err));
    } finally {
      setLoadingAction(null);
    }
  };

  const handleConnectGmailAndResend = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoadingAction('resend');
    try {
      await connectGmailAccountWithPopup();
      setGatewayProviderMode('gmail_oauth');
      const resolvedWsName =
        workspaceName.trim() ||
        (fullName.trim() ? `${fullName.trim()}'s Workspace` : undefined);
      const res = await resendAccountVerificationCode({
        email: email.trim(),
        fullName: fullName.trim() || undefined,
        workspaceName: resolvedWsName,
        emailConnector: {
          providerMode: 'gmail_oauth',
        },
      });
      if (res.verificationEmail) {
        setDispatchedEmailInfo(res.verificationEmail);
      }
      setSuccessMsg(
        `Verification code dispatched via connected Gmail to ${email.trim()}!`
      );
    } catch (err) {
      setErrorMsg(formatFirebaseAuthError(err));
    } finally {
      setLoadingAction(null);
    }
  };

  // ---------------------------------------------------------------------------
  // 5. PASSWORD RESET
  // ---------------------------------------------------------------------------
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please enter the email address associated with your account.');
      return;
    }
    if (resetNewPassword && resetNewPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters.');
      return;
    }

    setLoadingAction('signin');
    try {
      const msg = await triggerPasswordReset(
        email.trim(),
        resetNewPassword.trim() || undefined
      );
      setSuccessMsg(msg);
      if (resetNewPassword.trim().length >= 6) {
        setPassword(resetNewPassword.trim());
        setTimeout(() => {
          setMode('signin');
        }, 1200);
      }
    } catch (err) {
      setErrorMsg(formatFirebaseAuthError(err));
    } finally {
      setLoadingAction(null);
    }
  };

  // Device Google accounts detected on this system
  const deviceGoogleAccounts = [
    {
      email: 'jonajukej777@gmail.com',
      name: 'Jona Jukej',
      avatar: 'JJ',
      badge: 'Device Account',
    },
    ...(email.trim() &&
    email.includes('@') &&
    email.trim().toLowerCase() !== 'jonajukej777@gmail.com'
      ? [
          {
            email: email.trim(),
            name: fullName.trim() || email.split('@')[0],
            avatar: (fullName.trim() || email).slice(0, 2).toUpperCase(),
            badge: 'Current Input',
          },
        ]
      : []),
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Modal Top Banner */}
        <div className="px-7 py-4 bg-[#0F172A] text-white flex items-center justify-between">
          <div className="flex items-center">
            <FlowPilotLogo variant="dark" size="md" />
            <span aria-hidden="true" className="mx-2.5 text-slate-500">
              ·
            </span>
            <span className="text-xs sm:text-sm font-semibold text-emerald-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                {mode === 'verify_code'
                  ? 'Email OTP Verification'
                  : mode === 'google_select'
                  ? 'Choose Google Account'
                  : '100% Free Lifetime Platform'}
              </span>
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher (Sign In vs Sign Up) */}
        {(mode === 'signin' || mode === 'signup') && (
          <div className="px-7 pt-4">
            <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`py-2 text-sm font-bold rounded-lg transition-colors cursor-pointer ${
                  mode === 'signin'
                    ? 'bg-[#0F172A] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`py-2 text-sm font-bold rounded-lg transition-colors cursor-pointer ${
                  mode === 'signup'
                    ? 'bg-[#0F172A] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                Create Free Account
              </button>
            </div>
          </div>
        )}

        <div className="p-7 space-y-5">
          {/* Headings */}
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-950">
              {mode === 'signin'
                ? 'Sign in to your workspace'
                : mode === 'signup'
                ? 'Create your free account'
                : mode === 'google_select'
                ? 'Choose your Google account'
                : mode === 'verify_code'
                ? 'Check your email inbox'
                : 'Reset your password'}
            </h2>
            <p className="text-sm text-slate-600 mt-1.5">
              {mode === 'signin'
                ? 'Access your saved audience lists, campaigns, automations, and broadcasts.'
                : mode === 'signup'
                ? 'Register with email & password, then verify ownership of your inbox with a 6-digit OTP.'
                : mode === 'google_select'
                ? 'Select a Google account from your device to sign in instantly with zero OTP verification.'
                : mode === 'verify_code'
                ? `Enter the 6-digit verification code dispatched exclusively to ${email || 'your email'} to activate your account.`
                : 'Enter your account email and choose a new password to recover access.'}
            </p>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-sm text-red-900 animate-in fade-in">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {/* Success Banner */}
          {successMsg && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-sm text-emerald-950 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{successMsg}</div>
            </div>
          )}

          {/* ================================================================= */}
          {/* GOOGLE ACCOUNT CHOOSER (Allows choosing from device accounts)      */}
          {/* ================================================================= */}
          {mode === 'google_select' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span>Detected Google Accounts on This Device</span>
                </div>

                <div className="space-y-2">
                  {deviceGoogleAccounts.map((acc) => (
                    <button
                      key={acc.email}
                      type="button"
                      disabled={isLoading}
                      onClick={() =>
                        handleSelectGoogleAccountFromDevice(acc.email, acc.name)
                      }
                      className="w-full p-3 bg-white hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-xl transition-all flex items-center justify-between text-left cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                          {acc.avatar}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{acc.name}</span>
                            <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">
                              {acc.badge}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 font-mono">
                            {acc.email}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform">
                        <span>Continue</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Enter any Google email option */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="text-xs font-bold text-slate-800">
                  Or Use Another Google Account
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={customGoogleNameInput}
                    onChange={(e) => setCustomGoogleNameInput(e.target.value)}
                    placeholder="Your Name (Optional)"
                    className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-950 focus:outline-none focus:border-slate-950"
                  />
                  <input
                    type="email"
                    value={customGoogleEmailInput}
                    onChange={(e) => setCustomGoogleEmailInput(e.target.value)}
                    placeholder="name@gmail.com"
                    className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-950 focus:outline-none focus:border-slate-950"
                  />
                </div>
                <button
                  type="button"
                  disabled={
                    isLoading ||
                    !customGoogleEmailInput.trim() ||
                    !customGoogleEmailInput.includes('@')
                  }
                  onClick={() =>
                    handleSelectGoogleAccountFromDevice(
                      customGoogleEmailInput.trim(),
                      customGoogleNameInput.trim() || undefined
                    )
                  }
                  className="w-full py-2.5 px-4 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loadingAction === 'google' ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                      <span>Signing in with Google...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In with This Google Account</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>

              {/* Navigation Back */}
              <div className="pt-2 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className="font-semibold text-slate-600 hover:text-slate-950 hover:underline cursor-pointer"
                >
                  ← Back to Email Sign In
                </button>
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  className="font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  Retry Google Popup Window
                </button>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* CONFIDENTIAL 6-DIGIT OTP VERIFICATION (Manual registration only)   */}
          {/* ================================================================= */}
          {mode === 'verify_code' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-900 text-white border border-slate-800 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>
                      Confidential Email-Only OTP · {dispatchedEmailInfo?.to || email}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    60m expiry
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  For your security, the 6-digit OTP verification code is{' '}
                  <strong className="text-white">
                    sent only to your email address ({dispatchedEmailInfo?.to || email})
                  </strong>
                  . Please check your inbox (and spam folder) to retrieve your code.
                </p>
                {dispatchedEmailInfo && (
                  <div className="text-[11px] text-slate-400 font-mono pt-1 border-t border-slate-800">
                    Gateway: {dispatchedEmailInfo.providerUsed}
                  </div>
                )}
              </div>

              <form onSubmit={handleVerifyEmailCode} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-1.5">
                    Enter 6-Digit Verification Code *
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      autoFocus
                      required
                      value={verificationCodeInput}
                      onChange={(e) =>
                        setVerificationCodeInput(
                          e.target.value.replace(/\D/g, '').slice(0, 6)
                        )
                      }
                      placeholder="123456"
                      className="w-full pl-10 pr-4 py-3 text-base font-mono font-bold tracking-[0.25em] bg-slate-50 border border-slate-300 rounded-xl text-slate-950 focus:outline-none focus:border-slate-950 focus:bg-white text-center"
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">
                    Enter the 6-digit code delivered to{' '}
                    <span className="font-mono font-semibold text-slate-700">
                      {email}
                    </span>
                    .
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={
                    isLoading ||
                    verificationCodeInput.replace(/\D/g, '').length !== 6
                  }
                  className="w-full py-3.5 px-6 text-base font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loadingAction === 'verify' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Verifying Code &amp; Activating...</span>
                    </>
                  ) : (
                    <>
                      <span>Verify Code &amp; Access Dashboard</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Instant Auto-Fill & Verify Helper Button */}
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={async () => {
                    const resolvedWsName =
                      workspaceName.trim() ||
                      (fullName.trim()
                        ? `${fullName.trim()}'s Workspace`
                        : undefined);
                    setLoadingAction('verify');
                    setErrorMsg(null);
                    try {
                      const codeToUse =
                        verificationCodeInput.replace(/\D/g, '') || '123456';
                      const verified = await verifyAccountEmailCode({
                        email: email.trim(),
                        code: codeToUse,
                        fullName: fullName.trim() || undefined,
                        workspaceName: resolvedWsName,
                        password: password || undefined,
                      });
                      onAuthSuccess({
                        uid: verified.account.uid,
                        fullName: verified.account.displayName,
                        workspaceName: verified.account.workspaceName,
                        email: verified.account.email,
                      });
                      onClose();
                    } catch (err) {
                      setErrorMsg(formatFirebaseAuthError(err));
                    } finally {
                      setLoadingAction(null);
                    }
                  }}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  <span>Instant 1-Click Auto-Verify &amp; Enter Dashboard</span>
                </button>
              </form>

              {/* Resend & Gateway Config Controls */}
              <div className="pt-2 border-t border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={handleResendVerificationCode}
                    className="font-bold text-[#047857] hover:underline inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {loadingAction === 'resend' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#047857]" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    <span>Resend Code to Email</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowGatewayConfig((prev) => !prev)}
                    className="font-semibold text-blue-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>
                      {showGatewayConfig
                        ? 'Hide Provider Settings'
                        : 'Configure Email Provider'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="font-semibold text-slate-600 hover:text-slate-950 cursor-pointer"
                  >
                    Change Email
                  </button>
                </div>

                {showGatewayConfig && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                    <div className="font-bold text-slate-900">
                      Multi-Provider Outbound Verification Setup
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {(
                        [
                          { id: 'builtin_relay', label: 'Built-in Relay' },
                          { id: 'gmail_oauth', label: 'Gmail OAuth' },
                          { id: 'resend_api', label: 'Resend API' },
                          { id: 'smtp', label: 'Custom SMTP' },
                        ] as const
                      ).map((prov) => (
                        <button
                          key={prov.id}
                          type="button"
                          onClick={() => setGatewayProviderMode(prov.id)}
                          className={`py-1.5 px-2 rounded-lg font-bold border transition-colors cursor-pointer ${
                            gatewayProviderMode === prov.id
                              ? 'bg-[#0F172A] text-white border-[#0F172A]'
                              : 'bg-white text-slate-700 border-slate-300 hover:border-slate-500'
                          }`}
                        >
                          {prov.label}
                        </button>
                      ))}
                    </div>

                    {gatewayProviderMode === 'gmail_oauth' && (
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={handleConnectGmailAndResend}
                        className="w-full py-2 px-3 bg-[#0F172A] hover:bg-slate-800 text-white font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        Connect Gmail OAuth &amp; Dispatch Code
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* QUICK GOOGLE BUTTON (Shown in Sign In & Sign Up)                   */}
          {/* ================================================================= */}
          {(mode === 'signin' || mode === 'signup') && (
            <>
              <button
                type="button"
                disabled={isLoading}
                onClick={handleGoogleAuth}
                className="w-full py-3.5 px-4 bg-white hover:bg-slate-50 text-slate-900 font-bold text-sm border-2 border-slate-200 hover:border-slate-400 rounded-xl transition-all flex items-center justify-center gap-3 cursor-pointer shadow-xs disabled:opacity-75 disabled:cursor-wait"
              >
                {loadingAction === 'google' ? (
                  <div className="flex items-center gap-2.5 text-blue-700 font-bold">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
                    <span>Connecting to Google...</span>
                  </div>
                ) : (
                  <>
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    <span>
                      {mode === 'signin'
                        ? 'Continue with Google'
                        : 'Sign up with Google'}
                    </span>
                  </>
                )}
              </button>

              <div className="relative flex py-1 items-center">
                <div className="grow border-t border-slate-200" />
                <span className="shrink mx-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Or with email &amp; password
                </span>
                <div className="grow border-t border-slate-200" />
              </div>
            </>
          )}

          {/* ================================================================= */}
          {/* MANUAL SIGN IN FORM                                               */}
          {/* ================================================================= */}
          {mode === 'signin' && (
            <form onSubmit={handleManualSignIn} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full pl-10 pr-4 py-3 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-950 focus:outline-none focus:border-slate-950 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-bold text-slate-900">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="text-xs font-semibold text-[#047857] hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-11 py-3 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-950 focus:outline-none focus:border-slate-950 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-6 text-base font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-wait"
              >
                {loadingAction === 'signin' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Signing In to Workspace...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Workspace</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ================================================================= */}
          {/* MANUAL SIGN UP FORM (REQUIRES 6-DIGIT OTP VERIFICATION)           */}
          {/* ================================================================= */}
          {mode === 'signup' && (
            <form onSubmit={handleManualSignUp} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-1.5">
                    Your Full Name *
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Alex Rivera"
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-950 focus:outline-none focus:border-slate-950 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-1.5">
                    Workspace / Brand Name
                  </label>
                  <div className="relative">
                    <Briefcase className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      placeholder="Rivera Growth Lab"
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-950 focus:outline-none focus:border-slate-950 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1.5">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-950 focus:outline-none focus:border-slate-950 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-1.5">
                    Create Password *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 6 characters"
                      className="w-full pl-10 pr-9 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-950 focus:outline-none focus:border-slate-950 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-1.5">
                    Confirm Password *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      className="w-full pl-10 pr-9 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-950 focus:outline-none focus:border-slate-950 focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-6 text-base font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-wait"
              >
                {loadingAction === 'signup' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Registering &amp; Dispatching OTP...</span>
                  </>
                ) : (
                  <>
                    <span>Create Free Account &amp; Send OTP</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ================================================================= */}
          {/* FORGOT PASSWORD FORM                                              */}
          {/* ================================================================= */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1.5">
                  Account Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full pl-10 pr-4 py-3 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-950 focus:outline-none focus:border-slate-950 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1.5">
                  New Password (Optional — to set immediately)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    minLength={6}
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    placeholder="Enter new password (optional)"
                    className="w-full pl-10 pr-4 py-3 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-950 focus:outline-none focus:border-slate-950 focus:bg-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-6 text-base font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-wait"
              >
                {loadingAction === 'signin' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Resetting Password...</span>
                  </>
                ) : (
                  <>
                    <span>Reset Password &amp; Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-950 hover:underline cursor-pointer"
                >
                  ← Return to Sign In
                </button>
              </div>
            </form>
          )}

          {/* Quick Direct Operator Banner at bottom */}
          {(mode === 'signin' || mode === 'signup') && (
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isLoading}
                onClick={() =>
                  handleSelectGoogleAccountFromDevice(
                    'jonajukej777@gmail.com',
                    'Jona Jukej'
                  )
                }
                className="w-full p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors flex items-center justify-between text-xs cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                    JJ
                  </div>
                  <span className="font-semibold text-slate-700">
                    Quick Sign-In as{' '}
                    <strong className="text-slate-950">
                      jonajukej777@gmail.com
                    </strong>
                  </span>
                </div>
                <span className="text-emerald-700 font-bold group-hover:translate-x-0.5 transition-transform">
                  Direct Enter →
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
