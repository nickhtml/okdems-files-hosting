/**
 * @file src/App.tsx
 * @description Main client routing application for OKDEMS PDF Host.
 * Determines render target based on window pathname: root '/', admin portal '/admin', or document slug '/:slug'.
 */

import React, { useState, useEffect } from 'react';
import { PublicLanding } from './components/PublicLanding';
import { PdfViewerPage } from './components/PdfViewerPage';
import { AdminLogin } from './components/AdminLogin';
import { AdminDashboard } from './components/AdminDashboard';
import { UserSession } from './types';

export default function App() {
  const [pathname, setPathname] = useState<string>(window.location.pathname);
  const [session, setSession] = useState<UserSession | null>(() => {
    try {
      const saved = localStorage.getItem('okdems_admin_session');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      // Ensure session has a valid okdemocrats.org email and is not a default placeholder
      if (parsed && parsed.email && parsed.email.toLowerCase().endsWith('@okdemocrats.org') && parsed.isOkDemsVerified) {
        return parsed;
      }
      localStorage.removeItem('okdems_admin_session');
      return null;
    } catch (_e) {
      return null;
    }
  });

  useEffect(() => {
    const handlePopState = () => {
      setPathname(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (pathname === '/' || pathname === '') {
      document.title = 'OKDEMS File Hosting';
    } else if (pathname === '/admin' || pathname === '/admin/') {
      if (session && session.isOkDemsVerified) {
        document.title = 'Admin Dashboard | OKDEMS File Hosting';
      } else {
        document.title = 'Admin Login | OKDEMS File Hosting';
      }
    }
  }, [pathname, session]);

  const handleLoginSuccess = (newSession: UserSession) => {
    setSession(newSession);
    try {
      localStorage.setItem('okdems_admin_session', JSON.stringify(newSession));
    } catch (_e) {
      // Storage fallback
    }
  };

  const handleLogout = () => {
    setSession(null);
    try {
      localStorage.removeItem('okdems_admin_session');
    } catch (_e) {
      // Storage fallback
    }
  };

  // Route 1: Root Path '/' -> Public Landing Page
  if (pathname === '/' || pathname === '') {
    return <PublicLanding />;
  }

  // Route 2: Admin Portal '/admin' or '/admin/'
  if (pathname === '/admin' || pathname === '/admin/') {
    if (session && session.isOkDemsVerified) {
      return <AdminDashboard session={session} onLogout={handleLogout} />;
    }
    return <AdminLogin onLoginSuccess={handleLoginSuccess} />;
  }

  // Route 3: File Slug Route '/:slug'
  const slug = pathname.replace(/^\//, '').trim();
  return <PdfViewerPage slug={slug} />;
}
