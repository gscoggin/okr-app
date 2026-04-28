'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useAuth } from '@/components/AuthProvider';
import { SearchBox } from '@/components/nav/SearchBox';
import { useMobileSidebar } from '@/components/nav/MobileSidebarContext';

export function Topbar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { setOpen: openMobileSidebar } = useMobileSidebar();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };
  const themeLabel = theme === 'light' ? 'Switch to dark mode' : theme === 'dark' ? 'Switch to system default' : 'Switch to light mode';
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    if (process.env.NEXT_PUBLIC_IS_DEMO_DEPLOYMENT === 'true') {
      window.location.href = '/demo';
    } else {
      router.push('/login');
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 flex items-center h-14 gap-4">
        {/* Hamburger — mobile only */}
        <button
          className="md:hidden p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition shrink-0"
          onClick={() => openMobileSidebar(true)}
          aria-label="Open menu"
        >
          <HamburgerIcon />
        </button>

        {/* Logo / Home */}
        <Link href="/" className="font-semibold text-gray-900 dark:text-gray-100 text-sm shrink-0 tracking-tight">
          OKRs
        </Link>

        {/* Search */}
        <SearchBox />

        <div className="flex-1" />

        {/* Theme cycle: light → dark → system */}
        <button
          onClick={cycleTheme}
          className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          title={mounted ? themeLabel : ''}
          aria-label={mounted ? themeLabel : 'Toggle theme'}
        >
          {!mounted ? <SunIcon /> : theme === 'light' ? <MoonIcon /> : theme === 'dark' ? <SystemIcon /> : <SunIcon />}
        </button>

        {user && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-tight">{user.name}</p>
                <p className="text-xs text-gray-400 leading-tight">{user.role}</p>
              </div>
              <span className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center justify-center font-semibold text-sm uppercase shrink-0">
                {user.name?.[0] ?? user.email[0]}
              </span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-50">
                <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 sm:hidden">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{user.name}</p>
                  <p className="text-xs text-gray-400">{user.email}</p>
                </div>
                {user.role === 'admin' && (
                  <Link
                    href="/admin"
                    className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    onClick={() => setMenuOpen(false)}
                  >
                    Admin
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

function HamburgerIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="5" />
      <path strokeLinecap="round" d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="2" y="3" width="20" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8M12 17v4" />
    </svg>
  );
}
