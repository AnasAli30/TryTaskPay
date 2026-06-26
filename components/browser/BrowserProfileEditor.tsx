'use client';

import { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faCamera, faCheck } from '@fortawesome/free-solid-svg-icons';
import axios from 'axios';
import Image from 'next/image';
import { useBrowserAuth } from '@/components/hooks/useUserIdentity';

export function BrowserProfileEditor() {
  const { displayName, username, pfpUrl, walletAddress, refresh } = useBrowserAuth();
  const [name, setName] = useState(displayName || '');
  const [handle, setHandle] = useState(username || '');
  const [email, setEmail] = useState('');
  const [avatar, setAvatar] = useState(pfpUrl || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    axios.get('/api/profile/me', { withCredentials: true }).then((res) => {
      setName(res.data.displayName || '');
      setHandle(res.data.username || '');
      setEmail(res.data.email || '');
      setAvatar(res.data.pfpUrl || '');
    }).catch(() => {});
  }, []);

  const handleAvatar = async (file: File) => {
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await axios.post('/api/profile/avatar', fd, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAvatar(res.data.pfpUrl);
      await refresh();
    } catch {
      setError('Avatar upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await axios.patch(
        '/api/profile/me',
        { displayName: name, username: handle, email },
        { withCredentials: true },
      );
      setMessage('Profile saved');
      await refresh();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-4 mt-4 p-4 rounded-2xl border border-gray-100 bg-white shadow-sm space-y-4">
      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Edit Profile</h3>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative w-16 h-16 rounded-full bg-gray-100 overflow-hidden ring-2 ring-gray-200"
        >
          {avatar ? (
            <Image src={avatar} alt="Avatar" fill className="object-cover" unoptimized />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <FontAwesomeIcon icon={faCamera} />
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <FontAwesomeIcon icon={faSpinner} spin className="text-white" />
            </div>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleAvatar(f);
          }}
        />
        <div className="text-xs text-gray-400 truncate">{walletAddress}</div>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500">Display name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
          placeholder="Your name"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500">Username</label>
        <div className="mt-1 flex items-center rounded-xl border border-gray-200 overflow-hidden">
          <span className="pl-3 text-gray-400 text-sm">@</span>
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            maxLength={20}
            className="flex-1 px-2 py-2 text-sm outline-none"
            placeholder="username"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
          placeholder="you@example.com"
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {message && (
        <p className="text-xs text-green-600 flex items-center gap-1">
          <FontAwesomeIcon icon={faCheck} /> {message}
        </p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full py-2.5 rounded-xl bg-black text-white text-sm font-bold disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save profile'}
      </button>
    </div>
  );
}
