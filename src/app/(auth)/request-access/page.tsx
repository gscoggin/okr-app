'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function RequestAccessPage() {
  const [form, setForm] = useState({ name: '', email: '', useCase: '', _trap: '' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const set = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');

    const res = await fetch('/api/demo/request-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    const json = await res.json();

    if (!res.ok) {
      setStatus('error');
      setErrorMsg(json.error ?? 'Something went wrong');
      return;
    }

    setStatus('done');
  };

  if (status === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
        <div className="w-full max-w-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-8 text-center">
          <div className="text-3xl mb-4">✓</div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Request received</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Thanks! We'll review your request and send you an invite code soon.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-8">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">Request access</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          We're in private beta. Tell us a bit about yourself and we'll send you an invite code.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Honeypot — hidden from real users */}
          <input
            type="text"
            name="_trap"
            value={form._trap}
            onChange={set('_trap')}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="hidden"
          />

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name
            </label>
            <input
              id="name"
              type="text"
              required
              value={form.name}
              onChange={set('name')}
              placeholder="Jane Smith"
              className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={set('email')}
              placeholder="jane@company.com"
              className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="useCase" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              What will you use it for?{' '}
              <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span>
            </label>
            <textarea
              id="useCase"
              value={form.useCase}
              onChange={set('useCase')}
              placeholder="e.g. tracking OKRs for a 20-person engineering team"
              rows={3}
              className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {status === 'error' && (
            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/50 px-3 py-2 rounded-lg">{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {status === 'loading' ? 'Sending…' : 'Request access'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          Already have a code?{' '}
          <Link href="/register" className="text-blue-600 hover:underline font-medium">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
