'use client';

import { useState } from 'react';
import { OKRPageEditor } from '@/components/okr/OKRPageEditor';
import { periodLabel } from '@/types';
import type { IOKRPage, TimePeriod } from '@/types';

interface Props {
  teamId: string;
  period: TimePeriod;
  canEdit: boolean;
  teamName: string;
}

export function CreateOKRPageView({ teamId, period, canEdit, teamName }: Props) {
  const [page, setPage] = useState<IOKRPage | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    const res = await fetch('/api/okr-pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamId,
        periodType: period.type,
        year: period.year,
        quarter: period.quarter,
      }),
    });
    const json = await res.json();
    if (res.ok) {
      const p = json.data;
      setPage({
        _id: p._id.toString(),
        teamId,
        period,
        status: p.status ?? 'draft',
        objectives: [],
        parentOKRPageId: p.parentOKRPageId?.toString(),
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      });
    } else {
      setError(json.error ?? 'Failed to create OKR page');
    }
    setCreating(false);
  };

  if (page) {
    return <OKRPageEditor initialPage={page} canEdit={canEdit} teamId={teamId} />;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center">
      <h1 className="text-xl font-bold text-gray-900 mb-2">{teamName}</h1>
      <p className="text-gray-500 mb-6">No OKRs for {periodLabel(period)} yet.</p>
      {canEdit ? (
        <>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {creating ? 'Creating…' : `Create OKR Page for ${periodLabel(period)}`}
          </button>
          {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
        </>
      ) : (
        <p className="text-sm text-gray-400">You need team owner permissions to create OKRs.</p>
      )}
    </div>
  );
}
