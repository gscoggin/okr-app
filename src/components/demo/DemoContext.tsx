'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

const DemoTour = dynamic(() => import('./DemoTour').then((m) => ({ default: m.DemoTour })), { ssr: false });

interface DemoContextValue {
  isDemo: boolean;
  triggerNudge: () => void;
}

const DemoContext = createContext<DemoContextValue>({ isDemo: false, triggerNudge: () => {} });

export function DemoProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isDemo = !!user?.isDemo;
  const [nudgeOpen, setNudgeOpen] = useState(false);

  const startTour = () => {
    const w = window as Window & { __startDemoTour?: () => void };
    w.__startDemoTour?.();
  };

  return (
    <DemoContext.Provider value={{ isDemo, triggerNudge: () => setNudgeOpen(true) }}>
      {isDemo && <DemoBanner onRequestAccess={() => setNudgeOpen(true)} onTakeTour={startTour} />}
      {isDemo && <DemoTour autoStart={true} />}
      {children}
      {nudgeOpen && <DemoNudgeModal onClose={() => setNudgeOpen(false)} />}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  return useContext(DemoContext);
}

// ── Banner ────────────────────────────────────────────────────────────────────

function DemoBanner({ onRequestAccess, onTakeTour }: { onRequestAccess: () => void; onTakeTour: () => void }) {
  return (
    <div className="w-full bg-indigo-600 text-white text-sm flex items-center justify-center gap-4 px-4 py-2 shrink-0">
      <span className="text-indigo-200">You&apos;re exploring a demo workspace.</span>
      <button
        onClick={onTakeTour}
        className="font-medium text-white hover:text-indigo-100 underline underline-offset-2 transition"
      >
        Take the tour ▶
      </button>
      <button
        onClick={onRequestAccess}
        className="font-medium text-white hover:text-indigo-100 underline underline-offset-2 transition"
      >
        Request a code →
      </button>
    </div>
  );
}

// ── Nudge modal ───────────────────────────────────────────────────────────────

function DemoNudgeModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl p-8">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Want to edit?</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Request access to create your own workspace and start tracking OKRs for real.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/request-access"
            className="w-full text-center bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 transition"
          >
            Request a code
          </Link>
          <button
            onClick={onClose}
            className="w-full text-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition"
          >
            Keep exploring
          </button>
        </div>
      </div>
    </div>
  );
}
