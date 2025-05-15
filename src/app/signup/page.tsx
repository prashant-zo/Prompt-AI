'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import Link from 'next/link';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number';
    }
    return null;
  };

  const handleError = (error: any, context: string) => {
    setError(error.message || `An error occurred during ${context}`);
    if (process.env.NODE_ENV === 'development') {
      console.error(`${context} error:`, error);
    }
  };

  const handleEmailPasswordSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPasswordError(null);

    // Validate password
    const passwordValidationError = validatePassword(password);
    if (passwordValidationError) {
      setPasswordError(passwordValidationError);
      return;
    }

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsCreatingAccount(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;

      if (!newUser) {
        throw new Error("User creation succeeded but no user object returned.");
      }

      setIsSendingVerification(true);
      try {
        await sendEmailVerification(newUser);
        // Redirect to login page with success message and email for pre-filling
        router.push(`/login?verified=false&email=${encodeURIComponent(newUser.email || '')}`);
      } catch (verificationError: any) {
        handleError(verificationError, 'sending verification email');
        // User is created but verification email failed
        router.push(`/login?verified=error&email=${encodeURIComponent(newUser.email || '')}`);
      }
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('This email address is already in use. Please login or use a different email.');
      } else if (err.code === 'auth/weak-password') {
        setError('The password is too weak. Please use a stronger password.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        handleError(err, 'sign up');
      }
    } finally {
      setIsCreatingAccount(false);
      setIsSendingVerification(false);
    }
  };

  const isLoading = isCreatingAccount || isSendingVerification;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-950 p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-white dark:bg-slate-900 rounded-xl shadow-2xl">
        <h1 className="text-3xl font-bold text-center text-slate-900 dark:text-slate-100">Create Account</h1>
        <form onSubmit={handleEmailPasswordSignUp} className="space-y-4">
          <div>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
              required
            />
          </div>
          <div>
            <input
              type="password"
              value={password}
              onChange={e => {
                setPassword(e.target.value);
                setPasswordError(validatePassword(e.target.value));
              }}
              placeholder="Password"
              className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
              required
            />
            {passwordError && (
              <p className="mt-1 text-sm text-red-500">{passwordError}</p>
            )}
          </div>
          <div>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm Password"
              className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !!passwordError}
            className="w-full py-3 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-medium focus:outline-none focus:ring-2 focus:ring-sky-400 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isCreatingAccount ? 'Creating account...' : 
             isSendingVerification ? 'Sending verification email...' : 
             'Sign Up'}
          </button>
        </form>
        {error && <div className="text-red-500 text-sm text-center">{error}</div>}
        <p className="text-center text-sm text-slate-600 dark:text-slate-400">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-sky-600 hover:text-sky-500">Login</Link>
        </p>
      </div>
    </div>
  );
} 