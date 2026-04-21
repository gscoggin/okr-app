'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { SearchResult } from '@/app/api/search/route';

export function SearchBox() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [loading, setLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch on query change with 220ms debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setOpen(false);
      setActiveIdx(-1);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        const json = await res.json();
        setResults(json.data ?? []);
        setOpen(true);
        setActiveIdx(-1);
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIdx(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const navigate = (href: string) => {
    setOpen(false);
    setQuery('');
    setResults([]);
    inputRef.current?.blur();
    router.push(href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      setActiveIdx(-1);
      inputRef.current?.blur();
      return;
    }
    if (!open || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = activeIdx >= 0 ? results[activeIdx] : results[0];
      if (target) navigate(target.href);
    }
  };

  const groups = (
    [
      { label: 'Organizations', type: 'org' as const, items: results.filter((r) => r.type === 'org') },
      { label: 'Teams', type: 'team' as const, items: results.filter((r) => r.type === 'team') },
      { label: 'OKR Pages', type: 'page' as const, items: results.filter((r) => r.type === 'page') },
      { label: 'Objectives', type: 'objective' as const, items: results.filter((r) => r.type === 'objective') },
    ] as const
  ).filter((g) => g.items.length > 0);

  // Build a flat ordered list so keyboard nav has a stable global index
  const flat = groups.flatMap((g) => g.items);

  return (
    <div ref={containerRef} className="relative flex-1 max-w-sm">
      <div className="relative">
        <SearchIcon />
        <input
          ref={inputRef}
          type="search"
          placeholder="Search orgs, teams, quarters, owners…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          className="w-full text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 pl-8 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
        />
        {loading && <SpinnerIcon />}
      </div>

      {/* Dropdown */}
      <div
        className={`absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden z-50 transition-all duration-150 origin-top ${
          open && flat.length > 0
            ? 'opacity-100 scale-y-100 translate-y-0'
            : 'opacity-0 scale-y-95 -translate-y-1 pointer-events-none'
        }`}
      >
        {groups.map((group) => {
          const offset = flat.indexOf(group.items[0]);
          return (
            <div key={group.label}>
              <div className="px-3 pt-2.5 pb-1 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                {group.label}
              </div>
              {group.items.map((r, i) => (
                <ResultRow
                  key={r._id}
                  result={r}
                  active={activeIdx === offset + i}
                  onMouseEnter={() => setActiveIdx(offset + i)}
                  onSelect={() => navigate(r.href)}
                />
              ))}
            </div>
          );
        })}
        <div className="h-1.5" />
      </div>
    </div>
  );
}

function ResultRow({
  result,
  active,
  onMouseEnter,
  onSelect,
}: {
  result: SearchResult;
  active: boolean;
  onMouseEnter: () => void;
  onSelect: () => void;
}) {
  return (
    <Link
      href={result.href}
      onClick={(e) => { e.preventDefault(); onSelect(); }}
      onMouseEnter={onMouseEnter}
      className={`flex items-center gap-3 px-3 py-2 transition-colors ${
        active
          ? 'bg-blue-50 dark:bg-blue-950/60'
          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
      }`}
    >
      <TypeIcon type={result.type} />
      <div className="min-w-0">
        <p className={`text-sm font-medium truncate ${active ? 'text-blue-700 dark:text-blue-300' : 'text-gray-800 dark:text-gray-200'}`}>
          {result.name}
        </p>
        {result.subtitle && (
          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{result.subtitle}</p>
        )}
      </div>
    </Link>
  );
}

const TYPE_STYLES: Record<SearchResult['type'], { bg: string; icon: React.ReactNode }> = {
  org: {
    bg: 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
      </svg>
    ),
  },
  team: {
    bg: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
  page: {
    bg: 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3h10.5a.75.75 0 01.75.75v16.5a.75.75 0 01-.75.75H6.75a.75.75 0 01-.75-.75V3.75A.75.75 0 016.75 3zM9 7.5h6M9 12h6M9 16.5h3" />
      </svg>
    ),
  },
  objective: {
    bg: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18M3 6h18M3 18h18" />
      </svg>
    ),
  },
};

function TypeIcon({ type }: { type: SearchResult['type'] }) {
  const { bg, icon } = TYPE_STYLES[type];
  return (
    <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${bg}`}>
      {icon}
    </span>
  );
}

function SearchIcon() {
  return (
    <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
