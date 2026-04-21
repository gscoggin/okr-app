'use client';

import { useState } from 'react';
import type { ITenant, TenantBranding } from '@/types';
import { IconUpload } from '@/components/ui/IconUpload';

interface Props {
  tenant: ITenant;
  isTenantOwner: boolean;
}

export function TenantSettingsEditor({ tenant, isTenantOwner }: Props) {
  const [name, setName] = useState(tenant.name);
  const [branding, setBranding] = useState<TenantBranding>(tenant.branding ?? {});
  const [guidePage, setGuidePage] = useState(tenant.guidePage ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const updateBranding = (patch: Partial<TenantBranding>) =>
    setBranding((b) => ({ ...b, ...patch }));

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setError('');
    const res = await fetch('/api/tenant', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, branding, guidePage }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } else {
      const json = await res.json();
      setError(json.error ?? 'Save failed');
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Workspace Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your company workspace, branding, and guide page.
        </p>
      </div>

      <div className="space-y-8">
        {/* Identity */}
        <section className="border border-gray-200 rounded-xl bg-white p-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Identity</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Workspace URL slug</label>
              <p className="text-sm text-gray-400 font-mono bg-gray-50 rounded-lg px-3 py-2">{tenant.slug}</p>
              <p className="text-xs text-gray-400 mt-1">Slug cannot be changed after creation.</p>
            </div>
          </div>
        </section>

        {/* Branding */}
        <section className="border border-gray-200 rounded-xl bg-white p-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Branding</h2>
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Company Logo</label>
                <IconUpload
                  iconUrl={branding.logoUrl}
                  size={64}
                  label={name.charAt(0).toUpperCase()}
                  onSave={async (url) => updateBranding({ logoUrl: url })}
                />
                <p className="text-xs text-gray-400 mt-1">Click to upload. Max 1.5 MB.</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mission / Tagline</label>
              <input
                type="text"
                value={branding.mission ?? ''}
                onChange={(e) => updateBranding({ mission: e.target.value })}
                placeholder="e.g. Making teams great through clarity and focus."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">Shown on the company dashboard.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brand Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={branding.primaryColor ?? '#2563eb'}
                  onChange={(e) => updateBranding({ primaryColor: e.target.value })}
                  className="w-10 h-10 rounded border border-gray-200 cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  value={branding.primaryColor ?? ''}
                  onChange={(e) => updateBranding({ primaryColor: e.target.value })}
                  placeholder="#2563eb"
                  className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Used for accents in the navigation and dashboard.</p>
            </div>
          </div>
        </section>

        {/* Guide Page */}
        <section className="border border-gray-200 rounded-xl bg-white p-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1">Guide Page</h2>
          <p className="text-xs text-gray-400 mb-4">
            Markdown content shown to all users in the Help / Guide section.
            Use this to share OKR best practices, company norms, or links to resources.
          </p>
          <textarea
            value={guidePage}
            onChange={(e) => setGuidePage(e.target.value)}
            rows={12}
            placeholder={'# OKR Guide\n\nAdd your company\'s OKR guidelines here...'}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
        </section>

        {/* Danger Zone — tenant owner only */}
        {isTenantOwner && (
          <section className="border border-red-200 rounded-xl bg-white p-6">
            <h2 className="text-sm font-semibold text-red-600 uppercase tracking-wide mb-3">Danger Zone</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Delete workspace</p>
                <p className="text-xs text-gray-400">Permanently delete this workspace and all data. This cannot be undone.</p>
              </div>
              <button
                disabled
                className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded-lg opacity-50 cursor-not-allowed"
                title="Contact support to delete your workspace"
              >
                Delete workspace
              </button>
            </div>
          </section>
        )}
      </div>

      {/* Save bar */}
      <div className="mt-8 flex items-center justify-between">
        <span className="text-sm">
          {saved && <span className="text-green-600 font-medium">Saved</span>}
          {error && <span className="text-red-500">{error}</span>}
        </span>
        <button
          onClick={save}
          disabled={saving}
          className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
