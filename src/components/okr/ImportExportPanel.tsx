'use client';

import { useRef, useState } from 'react';

interface Props {
  teamId: string;
  year: number;
  period: string;
  teamName: string;
}

export function ImportExportPanel({ teamId, year, period, teamName }: Props) {
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [confirmOverwrite, setConfirmOverwrite] = useState<{ objectiveCount: number } | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const periodLabel = period === 'annual' ? 'Annual' : period.toUpperCase();

  const handleExport = (format: 'csv' | 'md') => {
    window.location.href = `/api/teams/${teamId}/export?year=${year}&period=${period}&format=${format}`;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);

    // Check if page already has content
    const res = await fetch(`/api/teams/${teamId}/import?year=${year}&period=${period}`);
    const json = await res.json();
    const { exists, objectiveCount } = json.data ?? {};

    if (exists && objectiveCount > 0) {
      setPendingFile(file);
      setConfirmOverwrite({ objectiveCount });
    } else {
      await runImport(file);
    }

    // Reset file input
    if (fileRef.current) fileRef.current.value = '';
  };

  const runImport = async (file: File) => {
    setImporting(true);
    setConfirmOverwrite(null);
    setPendingFile(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/teams/${teamId}/import`, {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (res.ok) {
        const { objectivesCreated, keyResultsCreated } = json.data;
        setResult({
          ok: true,
          message: `Imported ${objectivesCreated} objective${objectivesCreated !== 1 ? 's' : ''} and ${keyResultsCreated} key result${keyResultsCreated !== 1 ? 's' : ''}.`,
        });
        // Reload to show new content
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setResult({ ok: false, message: json.error ?? 'Import failed' });
      }
    } catch {
      setResult({ ok: false, message: 'Network error during import' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen((o) => !o); setResult(null); }}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
      >
        <ArrowsIcon />
        Import / Export
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-20 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            {teamName} — {periodLabel} {year}
          </p>

          {/* Export */}
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Export</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleExport('csv')}
                className="flex-1 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                CSV
              </button>
              <button
                onClick={() => handleExport('md')}
                className="flex-1 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                Markdown
              </button>
            </div>
          </div>

          {/* Import */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Import CSV</p>
              <a
                href="/api/import/template"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                download
              >
                Download template
              </a>
            </div>
            <label className={`flex items-center justify-center gap-2 w-full py-2 text-xs border-2 border-dashed rounded-lg cursor-pointer transition ${
              importing
                ? 'border-gray-200 dark:border-gray-700 text-gray-400 cursor-not-allowed'
                : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400'
            }`}>
              <UploadIcon />
              {importing ? 'Importing…' : 'Choose CSV file'}
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                disabled={importing}
                onChange={handleFileChange}
              />
            </label>
          </div>

          {/* Overwrite confirmation */}
          {confirmOverwrite && (
            <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
              <p className="text-xs font-medium text-yellow-800 dark:text-yellow-300 mb-1">⚠ Overwrite existing OKRs?</p>
              <p className="text-xs text-yellow-700 dark:text-yellow-400 mb-3">
                This will permanently replace {confirmOverwrite.objectiveCount} existing objective{confirmOverwrite.objectiveCount !== 1 ? 's' : ''} and all their key results for {periodLabel} {year}.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => pendingFile && runImport(pendingFile)}
                  className="flex-1 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
                >
                  Yes, overwrite
                </button>
                <button
                  onClick={() => { setConfirmOverwrite(null); setPendingFile(null); }}
                  className="flex-1 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <p className={`mt-2 text-xs ${result.ok ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
              {result.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ArrowsIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}
