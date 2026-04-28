'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { IOKRPage, IObjective, IKeyResult, OKRStatus } from '@/types';
import { computePageScore } from '@/types';
import { ObjectiveCard } from './ObjectiveCard';
import { RingGauge } from '@/components/ui/RingGauge';
import { IconUpload } from '@/components/ui/IconUpload';
import { PeriodNav } from '@/components/nav/PeriodNav';
import { computeTrackingTo } from '@/lib/trackingTo';

const AUTOSAVE_INTERVAL_MS = 3000;
const DRAFT_LOCALSTORAGE_KEY = (pageId: string) => `okr_draft_${pageId}`;

interface OKRPageEditorProps {
  initialPage: IOKRPage;
  canEdit: boolean;
  teamId: string;
  teamIconUrl?: string;
  doneHref?: string;
}

export function OKRPageEditor({ initialPage, canEdit, teamId, teamIconUrl: initialTeamIconUrl, doneHref }: OKRPageEditorProps) {
  const [teamIconUrl, setTeamIconUrl] = useState<string | undefined>(initialTeamIconUrl);
  const router = useRouter();
  const [page, setPage] = useState<IOKRPage>(() => {
    // Restore from localStorage draft if available
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(DRAFT_LOCALSTORAGE_KEY(initialPage._id));
      if (raw) {
        try {
          return JSON.parse(raw) as IOKRPage;
        } catch {}
      }
    }
    return initialPage;
  });

  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const saveTeamIcon = async (dataUrl: string) => {
    const res = await fetch(`/api/teams/${teamId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ iconUrl: dataUrl }),
    });
    if (!res.ok) throw new Error('Failed');
    setTeamIconUrl(dataUrl);
  };
  const dirtyRef = useRef(false);

  // ── Persist draft to localStorage ──────────────────────────────────────────
  useEffect(() => {
    if (!dirtyRef.current) return;
    localStorage.setItem(DRAFT_LOCALSTORAGE_KEY(page._id), JSON.stringify(page));
  });

  // ── Autosave to DB every 3 seconds when dirty ─────────────────────────────
  const persistToDB = useCallback(async (currentPage: IOKRPage) => {
    setSaving('saving');
    try {
      // Persist each objective and its KRs
      for (const obj of currentPage.objectives) {
        if (obj._id.startsWith('local_')) continue; // not yet created server-side

        await fetch(`/api/objectives/${obj._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: obj.title,
            owners: obj.owners,
            priority: obj.priority,
            comments: obj.comments,
            sortOrder: obj.sortOrder,
          }),
        });

        for (const kr of obj.keyResults) {
          if (kr._id.startsWith('local_')) continue;
          await fetch(`/api/key-results/${kr._id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: kr.title,
              owners: kr.owners,
              metric: kr.metric,
              startValue: kr.startValue,
              targetValue: kr.targetValue,
              currentValue: kr.currentValue,
              confidence: kr.confidence,
              comments: kr.comments,
              score: kr.score,
            }),
          });
        }
      }
      setSaving('saved');
      dirtyRef.current = false;
      // Clear localStorage on successful DB save
      localStorage.removeItem(DRAFT_LOCALSTORAGE_KEY(currentPage._id));
    } catch {
      setSaving('error');
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (dirtyRef.current) persistToDB(page);
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [page, persistToDB]);

  // ── Local state mutation helpers ──────────────────────────────────────────

  const markDirty = () => { dirtyRef.current = true; setSaving('idle'); };

  const updateObjective = (objId: string, updated: Partial<IObjective>) => {
    setPage((p) => ({
      ...p,
      objectives: p.objectives.map((o) => (o._id === objId ? { ...o, ...updated } : o)),
    }));
    markDirty();
  };

  const updateKR = (objId: string, krId: string, updated: Partial<IKeyResult>) => {
    setPage((p) => ({
      ...p,
      objectives: p.objectives.map((o) => {
        if (o._id !== objId) return o;
        const updatedKRs = o.keyResults.map((kr) =>
          kr._id === krId ? { ...kr, ...updated } : kr
        );
        // Recompute objective score from KRs
        const score = computePageScore(updatedKRs.map((kr) => ({ score: kr.score })));
        return { ...o, keyResults: updatedKRs, score };
      }),
    }));
    markDirty();
  };

  const addObjective = async () => {
    const res = await fetch('/api/objectives', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        okrPageId: page._id,
        title: '',
        owners: [],
        sortOrder: page.objectives.length,
      }),
    });
    if (!res.ok) return;
    const json = await res.json();
    const newObj: IObjective = { ...json.data, keyResults: [] };

    // Auto-add one KR so the editor is ready to fill in immediately
    const krRes = await fetch('/api/key-results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ objectiveId: newObj._id, title: '', owners: [], sortOrder: 0 }),
    });
    if (krRes.ok) {
      const krJson = await krRes.json();
      newObj.keyResults = [{ ...krJson.data, owners: krJson.data.owners ?? [] }];
    }

    setPage((p) => ({ ...p, objectives: [...p.objectives, newObj] }));
  };

  const deleteObjective = async (objId: string) => {
    if (!objId.startsWith('local_')) {
      await fetch(`/api/objectives/${objId}`, { method: 'DELETE' });
    }
    setPage((p) => ({ ...p, objectives: p.objectives.filter((o) => o._id !== objId) }));
  };

  const addKR = async (objId: string) => {
    await addKRMany(objId, 1);
  };

  const addKRMany = async (objId: string, count: number) => {
    const obj = page.objectives.find((o) => o._id === objId);
    if (!obj) return;
    const newKRs: IKeyResult[] = [];
    for (let i = 0; i < count; i++) {
      const res = await fetch('/api/key-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objectiveId: objId,
          title: '',
          owners: [],
          sortOrder: obj.keyResults.length + i,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        newKRs.push({ ...json.data, owners: json.data.owners ?? [] });
      }
    }
    if (newKRs.length > 0) {
      setPage((p) => ({
        ...p,
        objectives: p.objectives.map((o) =>
          o._id === objId ? { ...o, keyResults: [...o.keyResults, ...newKRs] } : o
        ),
      }));
    }
  };

  const deleteKR = async (objId: string, krId: string) => {
    if (!krId.startsWith('local_')) {
      await fetch(`/api/key-results/${krId}`, { method: 'DELETE' });
    }
    setPage((p) => ({
      ...p,
      objectives: p.objectives.map((o) =>
        o._id === objId
          ? { ...o, keyResults: o.keyResults.filter((kr) => kr._id !== krId) }
          : o
      ),
    }));
  };

  const setPageStatus = async (status: OKRStatus) => {
    setPublishing(true);
    setPublishError('');
    const res = await fetch(`/api/okr-pages/${page._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (res.ok) {
      setPage((p) => ({ ...p, status }));
    } else {
      setPublishError(json.error ?? `Failed to ${status === 'published' ? 'publish' : 'revert to draft'}`);
    }
    setPublishing(false);
  };

  const deletePage = async () => {
    const res = await fetch(`/api/okr-pages/${page._id}`, { method: 'DELETE' });
    if (res.ok) {
      router.push(`/teams/${teamId}`);
      router.refresh();
    }
  };

  const pageScore = computePageScore(page.objectives);
  const pageTrackingTo = computeTrackingTo(pageScore, page.period);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          {canEdit && (
            <IconUpload
              iconUrl={teamIconUrl}
              size={44}
              label={teamId.charAt(0).toUpperCase()}
              onSave={saveTeamIcon}
            />
          )}
          {!canEdit && teamIconUrl && (
            <img src={teamIconUrl} alt="team icon" className="w-11 h-11 rounded-xl object-cover border border-gray-200" />
          )}
          <div>
          <PeriodNav teamId={teamId} current={page.period} />
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">OKRs</h1>
            <RingGauge score={pageScore ?? null} trackingTo={pageTrackingTo} size={48} />
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                page.status === 'published'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              {page.status === 'published' ? 'Published' : 'Draft'}
            </span>
            {canEdit && !confirmDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 transition"
                title="Delete this OKR page"
              >
                Delete page
              </button>
            )}
            {canEdit && confirmDelete && (
              <span className="flex items-center gap-2 text-xs">
                <span className="text-gray-600 dark:text-gray-300">Delete this page and all its OKRs?</span>
                <button
                  onClick={deletePage}
                  className="text-red-600 font-medium hover:text-red-800 transition"
                >
                  Yes, delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition"
                >
                  Cancel
                </button>
              </span>
            )}
          </div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm flex-wrap w-full sm:w-auto justify-start sm:justify-end">
          {doneHref && (
            <Link
              href={doneHref}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              ← Done editing
            </Link>
          )}

          {/* Autosave indicator */}
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {saving === 'saving' && 'Saving…'}
            {saving === 'saved' && 'Saved'}
            {saving === 'error' && (
              <span className="text-red-400">Save failed</span>
            )}
          </span>

          {publishError && (
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 max-w-xs text-right">
              {publishError}
            </span>
          )}

          {canEdit && page.status === 'draft' && (
            <button
              onClick={() => setPageStatus('published')}
              disabled={publishing}
              className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {publishing ? 'Publishing…' : 'Publish'}
            </button>
          )}
          {canEdit && page.status === 'published' && (
            <button
              onClick={() => setPageStatus('draft')}
              disabled={publishing}
              className="px-4 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition"
            >
              {publishing ? 'Reverting…' : 'Revert to Draft'}
            </button>
          )}
        </div>
      </div>

      {/* Objectives */}
      <div className="space-y-4">
        {page.objectives.length === 0 && (
          <p className="text-center text-gray-400 py-12 text-sm">
            No objectives yet.{canEdit && ' Add one below.'}
          </p>
        )}

        {page.objectives.map((obj) => (
          <ObjectiveCard
            key={obj._id}
            objective={obj}
            canEdit={canEdit && page.status === 'draft'}
            trackingTo={computeTrackingTo(obj.score, page.period)}
            onObjectiveChange={(updated) => updateObjective(obj._id, updated)}
            onObjectiveDelete={() => deleteObjective(obj._id)}
            onKRAdd={() => addKR(obj._id)}
            onKRAddMany={(count) => addKRMany(obj._id, count)}
            onKRChange={(krId, updated) => updateKR(obj._id, krId, updated)}
            onKRDelete={(krId) => deleteKR(obj._id, krId)}
          />
        ))}
      </div>

      {canEdit && page.status === 'draft' && (
        <button
          onClick={addObjective}
          className="mt-6 w-full border-2 border-dashed border-gray-200 rounded-xl py-3 text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 transition font-medium"
        >
          + Add Objective
        </button>
      )}

      {/* AI stub placeholder */}
      {/* TODO Phase 2: AI suggest objectives button — <AIObjectiveSuggestor pageId={page._id} /> */}
    </div>
  );
}
