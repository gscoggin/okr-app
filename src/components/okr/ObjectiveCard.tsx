'use client';

import { useRef, useState } from 'react';
import type { IObjective, IKeyResult } from '@/types';
import { RingGauge } from '@/components/ui/RingGauge';
import { Sparkline } from '@/components/ui/Sparkline';
import { OwnerPicker } from '@/components/ui/OwnerPicker';
import { KeyResultRow } from './KeyResultRow';

interface ObjectiveCardProps {
  objective: IObjective;
  canEdit: boolean;
  trackingTo?: number;
  onObjectiveChange: (updated: Partial<IObjective>) => void;
  onObjectiveDelete: () => void;
  onKRAdd: () => void;
  onKRAddMany: (count: number) => void;
  onKRChange: (krId: string, updated: Partial<IKeyResult>) => void;
  onKRDelete: (krId: string) => void;
}

export function ObjectiveCard({
  objective,
  canEdit,
  trackingTo,
  onObjectiveChange,
  onObjectiveDelete,
  onKRAdd,
  onKRAddMany,
  onKRChange,
  onKRDelete,
}: ObjectiveCardProps) {
  const [showDetails, setShowDetails] = useState(true);
  const [bulkCount, setBulkCount] = useState('');
  const [addingKRs, setAddingKRs] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const handleAddKRs = async () => {
    const n = parseInt(bulkCount);
    setAddingKRs(true);
    if (n > 1) {
      await onKRAddMany(n);
    } else {
      await onKRAdd();
    }
    setBulkCount('');
    setAddingKRs(false);
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
      {/* Objective header */}
      <div className="flex items-start gap-3 px-5 py-4 bg-white dark:bg-gray-900">
        <div className="shrink-0 self-center flex items-center gap-2">
          <RingGauge score={objective.score ?? null} trackingTo={trackingTo} size={56} />
          {objective.scoreHistory?.length >= 2 && (
            <Sparkline history={objective.scoreHistory} currentScore={objective.score} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {canEdit ? (
            <input
              ref={titleRef}
              autoFocus
              type="text"
              value={objective.title}
              onChange={(e) => onObjectiveChange({ title: e.target.value })}
              placeholder="Objective title…"
              className="w-full text-base font-semibold text-gray-900 dark:text-gray-100 bg-transparent border-0 border-b border-transparent hover:border-gray-200 dark:hover:border-gray-600 focus:border-blue-400 focus:outline-none py-0.5 transition"
            />
          ) : (
            <p className="text-base font-semibold text-gray-900">{objective.title}</p>
          )}

          <div className="mt-2">
            {canEdit ? (
              <OwnerPicker
                value={objective.owners}
                onChange={(owners) => onObjectiveChange({ owners })}
              />
            ) : objective.owners.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {objective.owners.map((o) => (
                  <span key={o.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {o.displayName}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!showDetails && objective.keyResults.length > 0 && (
            <span className="text-xs text-gray-400 font-medium">
              {objective.keyResults.length} KR{objective.keyResults.length !== 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={() => setShowDetails((s) => !s)}
            className="text-xs text-gray-400 hover:text-gray-600 px-1"
            title="Toggle key results"
          >
            {showDetails ? '▲' : '▼'}
          </button>

          {canEdit && (
            <button
              onClick={onObjectiveDelete}
              className="text-gray-300 hover:text-red-400 transition"
              aria-label="Delete objective"
              title="Delete objective"
            >
              <TrashIcon />
            </button>
          )}
        </div>
      </div>

      {/* Optional details */}
      {showDetails && (
        <div className="border-t border-gray-100 dark:border-gray-700 px-5 py-3 bg-gray-50 dark:bg-gray-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
            {canEdit ? (
              <input
                type="number"
                min={1}
                value={objective.priority ?? ''}
                onChange={(e) =>
                  onObjectiveChange({ priority: e.target.value === '' ? undefined : parseInt(e.target.value) })
                }
                placeholder="1 = highest"
                className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              />
            ) : (
              <p className="text-sm text-gray-700">{objective.priority ?? '—'}</p>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Comments</label>
            {canEdit ? (
              <textarea
                value={objective.comments ?? ''}
                onChange={(e) => onObjectiveChange({ comments: e.target.value })}
                placeholder="Optional notes…"
                rows={2}
                className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white resize-none"
              />
            ) : (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{objective.comments || '—'}</p>
            )}
          </div>
        </div>
      )}

      {showDetails && (
        <div className="border-t border-gray-100 dark:border-gray-700 px-5 py-3 space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Key Results</p>

          {objective.keyResults.length === 0 && (
            <p className="text-sm text-gray-400 italic">No key results yet.</p>
          )}

          {objective.keyResults.map((kr) => (
            <KeyResultRow
              key={kr._id}
              kr={kr}
              canEdit={canEdit}
              onChange={(updated) => onKRChange(kr._id, updated)}
              onDelete={() => onKRDelete(kr._id)}
            />
          ))}

          {canEdit && (
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleAddKRs}
                disabled={addingKRs}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50 transition font-medium"
              >
                <span className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center text-xs font-bold leading-none">+</span>
                {addingKRs ? 'Adding…' : 'Add Key Result'}
              </button>
              <input
                type="number"
                min={2}
                max={20}
                value={bulkCount}
                onChange={(e) => setBulkCount(e.target.value)}
                placeholder="or enter qty"
                className="w-24 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-500"
              />
            </div>
          )}
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
