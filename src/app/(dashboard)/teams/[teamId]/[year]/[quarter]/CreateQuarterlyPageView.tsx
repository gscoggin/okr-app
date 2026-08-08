'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OKRPageEditor } from '@/components/okr/OKRPageEditor';
import type { Crumb } from '@/components/nav/OKRPageStickyHeader';
import type { IOKRPage, Quarter } from '@/types';

interface Props {
  teamId: string;
  year: number;
  quarter: Quarter;
  teamName: string;
  canEdit: boolean;
  breadcrumbs?: Crumb[];
}

export function CreateQuarterlyPageView({ teamId, year, quarter, teamName, canEdit, breadcrumbs }: Props) {
  const [page, setPage] = useState<IOKRPage | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    const res = await fetch('/api/okr-pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId, periodType: 'quarterly', year, quarter }),
    });
    const json = await res.json();
    if (res.ok) {
      // Annual page may have been auto-created — refresh sidebar
      router.refresh();
      setPage({
        _id: json.data._id,
        teamId,
        period: { type: 'quarterly', year, quarter },
        status: 'draft',
        objectives: [],
        parentOKRPageId: json.data.parentOKRPageId,
        createdAt: json.data.createdAt,
        updatedAt: json.data.updatedAt,
      });
    } else {
      setError(json.error ?? 'Failed to create OKR page');
    }
    setCreating(false);
  };

  if (page) {
    return (
      <OKRPageEditor
        initialPage={page}
        canEdit={canEdit}
        teamId={teamId}
        teamName={teamName}
        breadcrumbs={breadcrumbs}
        importPeriod={quarter.toLowerCase()}
        year={year}
        doneHref={`/teams/${teamId}/${year}/${quarter.toLowerCase()}`}
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center">
      <h1 className="text-xl font-bold text-gray-900 mb-2">{teamName}</h1>
      <p className="text-gray-500 mb-6">
        No OKRs for {quarter} {year} yet.
      </p>
      {canEdit ? (
        <>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {creating ? 'Creating…' : `Create ${quarter} ${year} OKR Page`}
          </button>
          {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
        </>
      ) : (
        <p className="text-sm text-gray-400">You need team owner permissions to create OKRs.</p>
      )}
    </div>
  );
}
