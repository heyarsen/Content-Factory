import React, { useEffect, useState } from 'react';
import { Loader, CheckCircle, AlertCircle } from 'lucide-react';

// Request reset form (no token)
export const RequestResetForm = () => {
  const [email, setEmail] = useState(new URLSearchParams(window.location.search).get('email') || '');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/auth/request-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (data.success) {
        setMessage("If an account exists, we've sent password reset instructions.");
      } else {
        setError(data.error || 'Failed to request password reset');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md w-full mx-auto bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      <h1 className="text-xl font-semibold text-gray-900">Reset your password</h1>
      <p className="text-sm text-gray-600 mt-1">Enter your email and we'll send you a reset link.</p>

      {message && (
        <div className="mt-4 flex items-start bg-green-50 text-green-800 border border-green-200 rounded p-3 text-sm">
          <CheckCircle className="w-4 h-4 mt-0.5 mr-2" />
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="mt-4 flex items-start bg-red-50 text-red-700 border border-red-200 rounded p-3 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 mr-2" />
          <span>{error}</span>
        </div>
      )}

      <form className="mt-4 space-y-4" onSubmit={handleSubmit} noValidate>
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !email.includes('@')}
          className="w-full inline-flex items-center justify-center px-4 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? (<><Loader className="w-4 h-4 mr-2 animate-spin" />Sending...</>) : 'Send reset link'}
        </button>
      </form>
    </div>
  );
};

// New password form (with token)
export const NewPasswordForm = () => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || '';
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setError('Missing reset token');
        setVerifying(false);
        return;
      }
      try {
        const res = await fetch(`/api/auth/verify-token/${token}`);
        const data = await res.json();
        if (data.success) {
          setVerified(true);
        } else {
          setError(data.error || 'Invalid or expired token');
        }
      } catch (err) {
        setError('Failed to verify token');
      } finally {
        setVerifying(false);
      }
    };
    verify();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirmPassword })
      });
      const data = await res.json();
      if (data.success) {
        setMessage('Password updated. You can now sign in.');
        setTimeout(() => { window.location.href = '/login'; }, 1200);
      } else {
        setError(data.error || 'Failed to reset password');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="max-w-md w-full mx-auto bg-white border border-gray-200 rounded-lg p-6 shadow-sm flex items-center text-gray-700">
        <Loader className="w-5 h-5 mr-2 animate-spin" /> Verifying token...
      </div>
    );
  }

  if (!verified) {
    return (
      <div className="max-w-md w-full mx-auto bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-start text-red-700 bg-red-50 border border-red-200 rounded p-3">
          <AlertCircle className="w-4 h-4 mt-0.5 mr-2" />
          <div>
            <p className="font-medium">Invalid or expired link</p>
            <p className="text-sm">Request a new password reset link.</p>
          </div>
        </div>
        <button
          className="mt-4 w-full px-4 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700"
          onClick={() => { window.location.href = '/reset-password'; }}
        >
          Request new link
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md w-full mx-auto bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      <h1 className="text-xl font-semibold text-gray-900">Set a new password</h1>
      <p className="text-sm text-gray-600 mt-1">Enter and confirm your new password.</p>

      {message && (
        <div className="mt-4 flex items-start bg-green-50 text-green-800 border border-green-200 rounded p-3 text-sm">
          <CheckCircle className="w-4 h-4 mt-0.5 mr-2" />
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="mt-4 flex items-start bg-red-50 text-red-700 border border-red-200 rounded p-3 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 mr-2" />
          <span>{error}</span>
        </div>
      )}

      <form className="mt-4 space-y-4" onSubmit={handleSubmit} noValidate>
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="password">New password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="confirm">Confirm password</label>
          <input
            id="confirm"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Repeat password"
            autoComplete="new-password"
          />
        </div>
        <button
          type="submit"
          disabled={loading || password.length < 8 || password !== confirmPassword}
          className="w-full inline-flex items-center justify-center px-4 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? (<><Loader className="w-4 h-4 mr-2 animate-spin" />Updating...</>) : 'Update password'}
        </button>
      </form>
    </div>
  );
};

// Page wrapper that decides which form to show by presence of token
const ResetPasswordPage = () => {
  const token = new URLSearchParams(window.location.search).get('token');
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      {token ? <NewPasswordForm /> : <RequestResetForm />}
    </div>
  );
};

export default ResetPasswordPage;
