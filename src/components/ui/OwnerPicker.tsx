'use client';

import { useState, useEffect, useRef } from 'react';
import type { OwnerRef } from '@/types';

interface OwnerPickerProps {
  value: OwnerRef[];
  onChange: (owners: OwnerRef[]) => void;
  required?: boolean;
  placeholder?: string;
}

// TODO Phase 2: replace static fetch with a proper search endpoint
export function OwnerPicker({ value, onChange, required, placeholder }: OwnerPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OwnerRef[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const [usersRes, teamsRes] = await Promise.all([
          fetch(`/api/users?q=${encodeURIComponent(query)}`),
          fetch(`/api/teams?q=${encodeURIComponent(query)}`),
        ]);
        const users = usersRes.ok ? (await usersRes.json()).data ?? [] : [];
        const teams = teamsRes.ok ? (await teamsRes.json()).data ?? [] : [];
        const userRefs: OwnerRef[] = users.map((u: { _id: string; name: string }) => ({
          type: 'user' as const,
          id: u._id,
          displayName: u.name,
        }));
        const teamRefs: OwnerRef[] = teams.map((t: { _id: string; name: string }) => ({
          type: 'team' as const,
          id: t._id,
          displayName: t.name,
        }));
        setResults([...userRefs, ...teamRefs]);
        setOpen(true);
      } catch {
        // silently fail — search is best-effort
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const add = (owner: OwnerRef) => {
    if (!value.some((o) => o.id === owner.id)) onChange([...value, owner]);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const remove = (id: string) => onChange(value.filter((o) => o.id !== id));

  return (
    <div ref={ref} className="relative">
      {/* Selected chips */}
      <div className="flex flex-wrap gap-1 mb-1">
        {value.map((o) => (
          <span
            key={o.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700"
          >
            <span className="opacity-60">{o.type === 'team' ? '👥' : '👤'}</span>
            {o.displayName}
            <button
              type="button"
              onClick={() => remove(o.id)}
              className="ml-0.5 text-blue-400 hover:text-blue-700 leading-none"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder ?? 'Add owner…'}
        className={`w-full text-sm border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 ${
          required && value.length === 0 ? 'border-red-300' : 'border-gray-200'
        }`}
      />

      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto text-sm">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => add(r)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2"
              >
                <span className="text-gray-400">{r.type === 'team' ? '👥' : '👤'}</span>
                {r.displayName}
                <span className="text-gray-400 ml-auto text-xs capitalize">{r.type}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
