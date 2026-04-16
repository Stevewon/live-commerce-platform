'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import LanguageSelector from '@/components/LanguageSelector';

export default function FindNicknamePage() {
  const { t } = useLanguage();
  const [securetQrUrl, setSecuretQrUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [foundNickname, setFoundNickname] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFoundNickname('');

    if (!securetQrUrl) {
      setError(t.findNickname.errorRequired);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/find-nickname', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ securetQrUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t.findNickname.errorNotFound);
      }

      if (data.success) {
        setFoundNickname(data.data.nickname);
      }
    } catch (err: any) {
      setError(err.message || t.findNickname.errorFailed);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-end mb-4">
            <LanguageSelector />
          </div>
          <Link href="/" className="inline-block">
            <div className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              QRLIVE
            </div>
          </Link>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            {t.findNickname.title}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {t.findNickname.subtitle}
          </p>
        </div>

        <form className="mt-8 space-y-6 bg-white p-8 rounded-xl shadow-lg" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {foundNickname && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
              <p className="font-semibold mb-2">{t.findNickname.found}</p>
              <p className="text-lg font-bold">{foundNickname}</p>
            </div>
          )}

          <div>
            <label htmlFor="securetQrUrl" className="block text-sm font-medium text-gray-700 mb-1">
              {t.findNickname.securetQrUrl}
            </label>
            <input
              id="securetQrUrl"
              name="securetQrUrl"
              type="text"
              required
              placeholder="https://securet.kr/securet.php?key=idcard&nick=..."
              className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={securetQrUrl}
              onChange={(e) => setSecuretQrUrl(e.target.value)}
            />
            <p className="mt-1 text-xs text-gray-500">
              {t.findNickname.securetQrUrlHelp}
            </p>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? t.findNickname.searching : t.findNickname.searchButton}
            </button>
          </div>

          <div className="flex items-center justify-between text-sm pt-4 border-t border-gray-200">
            <Link href="/auth/find-password" className="text-blue-600 hover:text-blue-500">
              {t.findNickname.findPassword}
            </Link>
            <Link href="/login" className="text-blue-600 hover:text-blue-500">
              {t.findNickname.login}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
