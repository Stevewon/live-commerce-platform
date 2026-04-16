'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import LanguageSelector from '@/components/LanguageSelector';

export default function LoginPage() {
  const router = useRouter();
  const { login: authLogin } = useAuth();
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    nickname: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.nickname || !formData.password) {
      setError(t.login.errorRequired);
      return;
    }

    setIsLoading(true);

    try {
      await authLogin(formData.nickname, formData.password);
    } catch (err: any) {
      setError(err.message || t.login.errorFailed);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center py-8 sm:py-12 px-4">
      <div className="max-w-md w-full space-y-6 sm:space-y-8">
        <div className="text-center">
          <div className="flex justify-end mb-4">
            <LanguageSelector />
          </div>
          <Link href="/" className="inline-block">
            <div className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              QRLIVE
            </div>
          </Link>
          <h2 className="mt-4 sm:mt-6 text-2xl sm:text-3xl font-extrabold text-gray-900">
            {t.login.title}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {t.login.subtitle}
          </p>
        </div>

        <form className="mt-6 sm:mt-8 space-y-5 sm:space-y-6 bg-white p-6 sm:p-8 rounded-xl shadow-lg" onSubmit={handleSubmit} autoComplete="off">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Nickname */}
            <div>
              <label htmlFor="nickname" className="block text-sm font-medium text-gray-700 mb-1">
                {t.login.nickname}
              </label>
              <input
                id="nickname"
                name="nickname"
                type="text"
                required
                placeholder=""
                autoComplete="off"
                data-lpignore="true"
                data-form-type="other"
                className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={formData.nickname}
                onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                {t.login.password}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                placeholder=""
                autoComplete="off"
                data-lpignore="true"
                data-form-type="other"
                className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? t.login.loggingIn : t.login.loginButton}
            </button>
          </div>

          <div className="flex items-center justify-between text-sm">
            <Link href="/auth/find-nickname" className="text-blue-600 hover:text-blue-500">
              {t.login.findNickname}
            </Link>
            <Link href="/auth/find-password" className="text-blue-600 hover:text-blue-500">
              {t.login.findPassword}
            </Link>
          </div>

          <div className="text-center text-sm pt-4 border-t border-gray-200">
            <span className="text-gray-600">{t.login.noAccount} </span>
            <Link href="/register" className="font-medium text-blue-600 hover:text-blue-500">
              {t.login.goRegister}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
