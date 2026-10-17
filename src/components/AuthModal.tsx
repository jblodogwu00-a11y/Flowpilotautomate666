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
  AlertCircle,
  Loader2,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import {
  signInWithGooglePopup,
  signInWithEmailPassword,
  signUpWithEmailPassword,
  sendPasswordReset,
  mapFirebaseAuthError,
} from '../firebase';
import { FlowPilotLogo } from './FlowPilotLogo';

export type AuthModalMode = 'signin' | 'signup' | 'forgot';

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
  const [showPassword, setShowPassword] = useState(false);

  const [loadingAction, setLoadingAction] = useState<
    'google' | 'signin' | 'signup' | 'forgot' | null
  >(null);
  const isLoading = loadingAction !== null;

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setErrorMsg(null);
      setSuccessMsg(null);
      setLoadingAction(null);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  // ---------------------------------------------------------------------------
  // 1. GOOGLE AUTHENTICATION
  // ---------------------------------------------------------------------------
  const handleGoogleAuth = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoadingAction('google');

    try {
      const user = await signInWithGooglePopup();
      onAuthSuccess({
        uid: user.uid,
        fullName: user.displayName || user.email?.split('@')[0] || 'User',
        workspaceName: workspaceName.trim() || undefined,
        email: user.email || undefined,
      });
      onClose();
    } catch (err) {
      const msg = mapFirebaseAuthError(err);
      setErrorMsg(msg);
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

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setLoadingAction('signin');
    try {
      const user = await signInWithEmailPassword(cleanEmail, password);
      onAuthSuccess({
        uid: user.uid,
        fullName: user.displayName || user.email?.split('@')[0] || 'User',
        workspaceName: workspaceName.trim() || undefined,
        email: user.email || cleanEmail,
      });
      onClose();
    } catch (err) {
      const msg = mapFirebaseAuthError(err);
      setErrorMsg(msg);
    } finally {
      setLoadingAction(null);
    }
  };

  // ---------------------------------------------------------------------------
  // 3. MANUAL SIGN UP (REGISTRATION) - No email verification blocker for now
  // ---------------------------------------------------------------------------
  const handleManualSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim();
    if (!fullName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be 6+ chars.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoadingAction('signup');
    try {
      const user = await signUpWithEmailPassword(
        cleanEmail,
        password,
        fullName.trim()
      );
      onAuthSuccess({
        uid: user.uid,
        fullName: user.displayName || fullName.trim(),
        workspaceName:
          workspaceName.trim() || `${fullName.trim()}'s Workspace`,
        email: user.email || cleanEmail,
      });
      onClose();
    } catch (err) {
      const msg = mapFirebaseAuthError(err);
      setErrorMsg(msg);
    } finally {
      setLoadingAction(null);
    }
  };

  // ---------------------------------------------------------------------------
  // 4. FORGOT PASSWORD
  // ---------------------------------------------------------------------------
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please enter the email address associated with your account.');
      return;
    }

    setLoadingAction('forgot');
    try {
      await sendPasswordReset(cleanEmail);
      setSuccessMsg(
        `Password reset email sent to ${cleanEmail}. Please check your inbox and follow the link to reset your password.`
      );
    } catch (err) {
      const msg = mapFirebaseAuthError(err);
      setErrorMsg(msg);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Modal Top Header */}
        <div className="px-7 py-4 bg-[#0F172A] text-white flex items-center justify-between">
          <div className="flex items-center">
            <FlowPilotLogo variant="dark" size="md" />
            <span aria-hidden="true" className="mx-2.5 text-slate-500">
              ·
            </span>
            <span className="text-xs sm:text-sm font-semibold text-emerald-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Free SaaS Workspace</span>
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
                Create Account
              </button>
            </div>
          </div>
        )}

        <div className="p-7 space-y-5">
          {/* Headings */}
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-950">
              {mode === 'signin'
                ? 'Sign in to your account'
                : mode === 'signup'
                ? 'Create your free account'
                : 'Reset your password'}
            </h2>
            <p className="text-sm text-slate-600 mt-1.5">
              {mode === 'signin'
                ? 'Welcome back! Sign in to access your dashboard, CRM, and campaigns.'
                : mode === 'signup'
                ? 'Get started in seconds. No credit card required.'
                : 'Enter your email and we will send you a secure link to reset your password.'}
            </p>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-sm text-red-900 animate-in fade-in">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed font-medium">{errorMsg}</div>
            </div>
          )}

          {/* Success Banner */}
          {successMsg && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-sm text-emerald-950 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{successMsg}</div>
            </div>
          )}

          {/* Quick Google Sign In */}
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

          {/* SIGN IN FORM */}
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
                    <span>Signing in...</span>
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

          {/* SIGN UP FORM */}
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
                    Workspace Name
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
                    <span>Creating your account...</span>
                  </>
                ) : (
                  <>
                    <span>Create Free Account</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* FORGOT PASSWORD FORM */}
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

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-6 text-base font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-wait"
              >
                {loadingAction === 'forgot' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Sending password reset email...</span>
                  </>
                ) : (
                  <>
                    <span>Send Password Reset Email</span>
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

          {/* Authorized Domains Help Note */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 leading-relaxed flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span>Protected by Firebase Authentication &amp; Firestore.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
