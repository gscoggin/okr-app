'use client';

import { useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import 'driver.js/dist/driver.css';

const TOUR_KEY = 'demo-tour-seen';

const STEPS = [
  {
    element: '[data-tour="dashboard-header"]',
    popover: {
      title: 'Company dashboard',
      description: 'This is the command centre. Every org and team\'s live OKR score, all in one place.',
      side: 'bottom' as const,
    },
  },
  {
    element: '[data-tour="org-section"]',
    popover: {
      title: 'Organizations',
      description: 'Teams are grouped under organizations. You can structure these to match your company.',
      side: 'right' as const,
    },
  },
  {
    element: '[data-tour="team-row"]',
    popover: {
      title: 'Teams',
      description: 'Each team has OKR pages for the year and each quarter. Click a team to explore their objectives.',
      side: 'bottom' as const,
    },
  },
  {
    element: '[data-tour="score-ring"]',
    popover: {
      title: 'Score rings',
      description: 'Scores roll up automatically from Key Results. Red is below 0.4, amber is 0.4–0.7, green is above 0.7.',
      side: 'left' as const,
    },
  },
  {
    element: '[data-tour="sidebar"]',
    popover: {
      title: 'Sidebar navigation',
      description: 'Navigate between teams and switch between annual and quarterly views. Your whole company\'s OKRs are a click away.',
      side: 'right' as const,
    },
  },
];

export function DemoTour({ autoStart }: { autoStart: boolean }) {
  const pathname = usePathname();

  const startTour = useCallback(async () => {
    const { driver } = await import('driver.js');

    // Only run on the dashboard — some anchors only exist there
    const missing = STEPS.some((s) => !document.querySelector(s.element));
    if (missing) return;

    const d = driver({
      showProgress: true,
      steps: STEPS,
      onDestroyStarted: () => {
        localStorage.setItem(TOUR_KEY, '1');
        d.destroy();
      },
    });
    d.drive();
  }, []);

  // Auto-start on the dashboard on first demo visit
  useEffect(() => {
    if (!autoStart) return;
    if (pathname !== '/') return;
    if (localStorage.getItem(TOUR_KEY)) return;

    // Small delay so DOM settles after navigation
    const t = setTimeout(startTour, 800);
    return () => clearTimeout(t);
  }, [autoStart, pathname, startTour]);

  // Expose startTour globally so DemoContext can call it
  useEffect(() => {
    (window as Window & { __startDemoTour?: () => void }).__startDemoTour = startTour;
    return () => { delete (window as Window & { __startDemoTour?: () => void }).__startDemoTour; };
  }, [startTour]);

  return null;
}
