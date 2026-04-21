'use client';

import { useState } from 'react';
import type { IKeyResult, ConfidenceLevel } from '@/types';
import { ConfidenceBadge } from '@/components/ui/ScoreBadge';
import { RingGauge } from '@/components/ui/RingGauge';
import { OwnerPicker } from '@/components/ui/OwnerPicker';

interface KeyResultRowProps {
  kr: IKeyResult;
  canEdit: boolean;
  onChange: (updated: Partial<IKeyResult>) => void;
  onDelete: () => void;
}

function computeKRScore(kr: IKeyResult): number | undefined {
  const { startValue, targetValue, currentValue } = kr;
  if (startValue == null || targetValue == null || currentValue == null) return undefined;
  const range = targetValue - startValue;
  if (range === 0) return undefined;
  return Math.max(0, Math.min(1, (currentValue - startValue) / range));
}

export function KeyResultRow({ kr, canEdit, onChange, onDelete }: KeyResultRowProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="border border-gray-100 rounded-lg bg-white">
      {/* Main row */}
      <div className="flex items-start gap-3 px-4 py-3">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="mt-0.5 text-gray-300 hover:text-gray-500 transition shrink-0"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          <svg
            className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          {canEdit ? (
            <input
              type="text"
              value={kr.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="Key result title…"
              className="w-full text-sm text-gray-800 bg-transparent border-0 border-b border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none py-0.5 transition"
            />
          ) : (
            <p className="text-sm text-gray-800">{kr.title}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!expanded && <ConfidenceBadge level={kr.confidence} />}
          {!expanded && <RingGauge score={kr.score ?? null} size={32} />}
          {canEdit && (
            <button
              onClick={onDelete}
              className="text-gray-300 hover:text-red-400 transition"
              aria-label="Delete key result"
              title="Delete key result"
            >
              <TrashIcon />
            </button>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 rounded-b-lg">
          {/* Owners */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Owners {canEdit && <span className="text-red-400">*</span>}
            </label>
            {canEdit ? (
              <OwnerPicker
                value={kr.owners}
                onChange={(owners) => onChange({ owners })}
                required
              />
            ) : kr.owners.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {kr.owners.map((o) => (
                  <span key={o.id} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                    {o.displayName}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-gray-400">No owners</span>
            )}
          </div>

          {/* Metric */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Metric</label>
            {canEdit ? (
              <input
                type="text"
                value={kr.metric ?? ''}
                onChange={(e) => onChange({ metric: e.target.value })}
                placeholder="e.g. Monthly active users"
                className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              />
            ) : (
              <p className="text-sm text-gray-700">{kr.metric ?? '—'}</p>
            )}
          </div>

          {/* Values */}
          {(['startValue', 'targetValue', 'currentValue'] as const).map((field) => (
            <div key={field}>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {field === 'startValue' ? 'Start' : field === 'targetValue' ? 'Target' : 'Current'}
              </label>
              {canEdit ? (
                <input
                  type="number"
                  value={kr[field] ?? ''}
                  onChange={(e) => {
                    const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                    const updated = { ...kr, [field]: val };
                    const score = computeKRScore(updated);
                    onChange({ [field]: val, ...(score !== undefined ? { score } : {}) });
                  }}
                  placeholder="0"
                  className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                />
              ) : (
                <p className="text-sm text-gray-700">{kr[field] ?? '—'}</p>
              )}
            </div>
          ))}

          {/* Confidence */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Confidence</label>
            {canEdit ? (
              <select
                value={kr.confidence ?? ''}
                onChange={(e) =>
                  onChange({ confidence: (e.target.value || undefined) as ConfidenceLevel | undefined })
                }
                className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              >
                <option value="">— Select —</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            ) : (
              <ConfidenceBadge level={kr.confidence} />
            )}
          </div>

          {/* Score — auto-computed from values */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Score</label>
            <RingGauge score={kr.score ?? null} size={48} />
            {canEdit && kr.score == null && (
              <p className="text-xs text-gray-400 mt-1">Set start, target &amp; current to compute</p>
            )}
          </div>

          {/* Comments */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Comments</label>
            {canEdit ? (
              <textarea
                value={kr.comments ?? ''}
                onChange={(e) => onChange({ comments: e.target.value })}
                placeholder="Optional notes…"
                rows={2}
                className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white resize-none"
              />
            ) : (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{kr.comments || '—'}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}
