'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function DemoPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');

  useEffect(() => {
    fetch('/api/demo/session')
      .then((res) => {
        if (res.ok) {
          router.replace('/');
        } else {
          setStatus('error');
        }
      })
      .catch(() => setStatus('error'));
  }, [router]);

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">The demo isn&apos;t available right now.</p>
          <Link href="/login" className="text-sm text-blue-600 hover:underline">Sign in instead</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="flex items-center gap-3 text-gray-400">
        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <span className="text-sm">Loading demo…</span>
      </div>
    </div>
  );
}
