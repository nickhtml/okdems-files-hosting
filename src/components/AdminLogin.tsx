/**
 * @file src/components/AdminLogin.tsx
 * @description Clean, minimalist Google sign-in page for /admin.
 */

import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { UserSession } from '../types';
import { isValidOkDemsEmail } from '../lib/pdfStore';

interface AdminLoginProps {
  onLoginSuccess: (session: UserSession) => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<boolean>(false);
  const [emailInput, setEmailInput] = useState<string>('');

  const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMessage(null);
    setUnauthorizedDomain(false);

    try {
      // Attempt real Firebase Google Auth Popup
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const email = user.email || '';

      if (!isValidOkDemsEmail(email)) {
        setErrorMessage(`Access Restricted: ${email} is not an authorized @okdemocrats.org account.`);
        setLoading(false);
        return;
      }

      onLoginSuccess({
        email: email,
        name: user.displayName || email.split('@')[0].toUpperCase(),
        isOkDemsVerified: true
      });
    } catch (firebaseErr: any) {
      console.warn('Google Sign-In error:', firebaseErr);
      const code = firebaseErr?.code;
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setErrorMessage(null);
      } else if (code === 'auth/unauthorized-domain') {
        setUnauthorizedDomain(true);
        setErrorMessage(`Firebase Unauthorized Domain: "${currentHost}" is not listed in your Firebase Console under Authentication > Settings > Authorized Domains.`);
      } else if (code === 'auth/popup-blocked') {
        setErrorMessage('Popup blocked by browser. Please allow popups for Google Sign-In.');
      } else if (firebaseErr?.message) {
        setErrorMessage(`Sign-in error: ${firebaseErr.message}`);
      } else {
        setErrorMessage('Failed to sign in with Google. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim();

    if (!cleanEmail) {
      setErrorMessage('Please enter your @okdemocrats.org email address.');
      return;
    }

    if (!isValidOkDemsEmail(cleanEmail)) {
      setErrorMessage(`Access Restricted: "${cleanEmail}" is not a valid @okdemocrats.org email address.`);
      return;
    }

    onLoginSuccess({
      email: cleanEmail,
      name: cleanEmail.split('@')[0].toUpperCase(),
      isOkDemsVerified: true
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center items-center p-6 font-sans">
      <div className="text-center max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        {/* Title */}
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">
          OKDEMS PDF Host Admin
        </h1>
        <p className="text-xs text-slate-500 mb-6">
          Sign in with your official @okdemocrats.org account
        </p>

        {errorMessage && (
          <div className="mb-6 p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium text-left leading-relaxed">
            {errorMessage}
          </div>
        )}

        {/* Sign In with Google Button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full py-3.5 px-6 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-semibold text-sm rounded-xl border border-slate-300 shadow-sm transition-all flex items-center justify-center gap-3 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {/* Google G Logo SVG */}
          <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
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
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>{loading ? 'Connecting to Google...' : 'Sign in with Google'}</span>
        </button>

        {/* Divider / @okdemocrats.org Direct Email Sign-In */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-slate-400 font-medium">Or enter staff email</span>
          </div>
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-3">
          <div>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="yourname@okdemocrats.org"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-900 transition-all placeholder:text-slate-400"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 active:bg-black text-white font-semibold text-sm rounded-xl transition-all"
          >
            Sign In with Email
          </button>
        </form>

        {unauthorizedDomain && (
          <div className="mt-6 p-3 bg-amber-50 border border-amber-200 rounded-xl text-left">
            <p className="text-xs text-amber-800 font-medium mb-1">How to authorize this domain:</p>
            <p className="text-[11px] text-amber-700 leading-normal">
              1. Open Firebase Console &gt; Authentication &gt; Settings.<br />
              2. Under Authorized domains, add: <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold text-[10px]">{currentHost}</code>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};


