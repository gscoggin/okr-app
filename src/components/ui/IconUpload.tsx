'use client';

import { useRef, useState } from 'react';

interface IconUploadProps {
  /** Current icon URL (base64 or empty) */
  iconUrl?: string;
  /** Display size in px */
  size?: number;
  /** Called with the new base64 data URL after a successful save */
  onSave: (dataUrl: string) => Promise<void>;
  /** Short label shown in the placeholder (e.g. org/team initials) */
  label?: string;
}

const MAX_BYTES = 1_500_000; // ~1.5 MB before base64 expansion

export function IconUpload({ iconUrl, size = 48, onSave, label }: IconUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Image must be under 1.5 MB.');
      return;
    }

    setError('');
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setSaving(true);
      try {
        await onSave(dataUrl);
      } catch {
        setError('Failed to save icon.');
      } finally {
        setSaving(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={saving}
        title="Click to upload icon"
        style={{ width: size, height: size }}
        className="relative group rounded-xl overflow-hidden border-2 border-dashed border-gray-300 hover:border-blue-400 transition flex items-center justify-center bg-gray-50 disabled:opacity-60"
      >
        {iconUrl ? (
          <>
            <img
              src={iconUrl}
              alt="icon"
              className="w-full h-full object-cover"
            />
            <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-medium">
              {saving ? '…' : 'Change'}
            </span>
          </>
        ) : (
          <span className="text-gray-400 text-xs font-semibold select-none">
            {saving ? '…' : (label ?? '+')}
          </span>
        )}
      </button>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
