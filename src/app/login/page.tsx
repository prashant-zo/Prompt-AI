'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  const handleEmailPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-950 p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-white dark:bg-slate-900 rounded-xl shadow-2xl">
        <h1 className="text-3xl font-bold text-center text-slate-900 dark:text-slate-100">Login</h1>
        <button
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" viewBox="0 0 48 48" fill="none"><g clipPath="url(#clip0_17_40)"><path d="M47.532 24.552c0-1.636-.146-3.2-.418-4.704H24.48v9.02h12.98c-.56 3.02-2.24 5.58-4.78 7.3v6.06h7.74c4.54-4.18 7.11-10.34 7.11-17.676z" fill="#4285F4"/><path d="M24.48 48c6.48 0 11.92-2.14 15.89-5.82l-7.74-6.06c-2.14 1.44-4.88 2.3-8.15 2.3-6.26 0-11.56-4.22-13.46-9.9H3.5v6.22C7.46 43.34 15.36 48 24.48 48z" fill="#34A853"/><path d="M11.02 28.52c-.48-1.44-.76-2.98-.76-4.52s.28-3.08.76-4.52v-6.22H3.5A23.97 23.97 0 000 24c0 3.98.96 7.76 2.66 11.08l8.36-6.56z" fill="#FBBC05"/><path d="M24.48 9.54c3.54 0 6.68 1.22 9.16 3.62l6.86-6.86C36.4 2.14 30.96 0 24.48 0 15.36 0 7.46 4.66 3.5 11.26l8.36 6.22c1.9-5.68 7.2-9.9 13.46-9.9z" fill="#EA4335"/></g><defs><clipPath id="clip0_17_40"><rect width="48" height="48" fill="white"/></clipPath></defs></svg>
          Sign in with Google
        </button>
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-slate-300 dark:border-slate-700" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white dark:bg-slate-900 px-2 text-slate-500 dark:text-slate-400">Or continue with</span>
          </div>
        </div>
        <form onSubmit={handleEmailPasswordLogin} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email address"
            className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
            required
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
            required
          />
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-medium focus:outline-none focus:ring-2 focus:ring-sky-400 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        {error && <div className="text-red-500 text-sm text-center">{error}</div>}
        <p className="text-center text-sm text-slate-600 dark:text-slate-400">
          Don't have an account?{' '}
          <Link href="/signup" className="font-medium text-sky-600 hover:text-sky-500">Sign up</Link>
        </p>
      </div>
    </div>
  );
} 