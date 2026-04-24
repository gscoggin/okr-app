'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type CodeType = 'workspace_create' | 'workspace_join' | null;

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ companyName: '', name: '', email: '', password: '', inviteCode: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeType, setCodeType] = useState<CodeType>(null);
  const [joinTenantName, setJoinTenantName] = useState<string | null>(null);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleCodeBlur = async () => {
    const code = form.inviteCode.trim().toUpperCase();
    if (code.length < 8) {
      setCodeType(null);
      setJoinTenantName(null);
      return;
    }
    try {
      const res = await fetch(`/api/invite-codes/${code}`);
      if (res.ok) {
        const { data } = await res.json();
        setCodeType(data.type);
        setJoinTenantName(data.tenantName ?? null);
      } else {
        setCodeType(null);
        setJoinTenantName(null);
      }
    } catch {
      setCodeType(null);
      setJoinTenantName(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(json.error ?? 'Registration failed');
      return;
    }

    router.push('/login?registered=1');
  };

  const isJoin = codeType === 'workspace_join';

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-8">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
          {isJoin ? 'Join your team' : 'Create your workspace'}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          {isJoin && joinTenantName
            ? `You've been invited to join ${joinTenantName}.`
            : 'Set up your company\'s OKR space in seconds.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isJoin && (
            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Company name
              </label>
              <input
                id="companyName"
                type="text"
                required={!isJoin}
                value={form.companyName}
                onChange={set('companyName')}
                placeholder="Acme Corp"
                className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3 font-medium uppercase tracking-wide">Your account</p>
            {(['name', 'email', 'password'] as const).map((field) => (
              <div key={field} className="mb-3 last:mb-0">
                <label htmlFor={field} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 capitalize">
                  {field}
                </label>
                <input
                  id={field}
                  type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
                  required
                  value={form[field]}
                  onChange={set(field)}
                  className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="inviteCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Invite code
              </label>
              <Link href="/request-access" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                Don&apos;t have one?
              </Link>
            </div>
            <input
              id="inviteCode"
              type="text"
              required
              value={form.inviteCode}
              onChange={(e) => setForm((f) => ({ ...f, inviteCode: e.target.value.toUpperCase() }))}
              onBlur={handleCodeBlur}
              placeholder="e.g. XK4T9WPQ"
              autoComplete="off"
              className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono tracking-widest"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {loading
              ? isJoin ? 'Joining…' : 'Creating workspace…'
              : isJoin ? 'Join workspace' : 'Create workspace'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          Already have a workspace?{' '}
          <Link href="/login" className="text-blue-600 hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
