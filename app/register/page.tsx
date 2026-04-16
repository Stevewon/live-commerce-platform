'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import LanguageSelector from '@/components/LanguageSelector';

export default function RegisterPage() {
  const router = useRouter();
  const { register: authRegister } = useAuth();
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    securetQrUrl: '',
    nickname: '',
    password: '',
    confirmPassword: '',
  });
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Validate Securet QR URL format
  const validateSecuretUrl = (url: string): boolean => {
    const pattern = /^https:\/\/securet\.kr\/securet\.php\?key=idcard&nick=.+&token=.+&voip=.+&os=.+$/;
    return pattern.test(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.securetQrUrl || !formData.nickname || !formData.password || !formData.confirmPassword) {
      setError(t.register.errorAllFields);
      return;
    }

    if (!validateSecuretUrl(formData.securetQrUrl)) {
      setError(t.register.errorInvalidQr);
      return;
    }

    if (formData.password.length < 6) {
      setError(t.register.errorPasswordLength);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError(t.register.errorPasswordMatch);
      return;
    }

    if (!agreeTerms) {
      setError(t.register.errorAgreeTerms);
      return;
    }

    setIsLoading(true);

    try {
      await authRegister({
        nickname: formData.nickname,
        password: formData.password,
        securetQrUrl: formData.securetQrUrl,
        name: formData.nickname,
        role: 'CUSTOMER',
      });
    } catch (err: any) {
      setError(err.message || t.register.errorFailed);
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
            {t.register.title}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {t.register.subtitle}
          </p>
        </div>

        <form className="mt-6 sm:mt-8 space-y-5 sm:space-y-6 bg-white p-6 sm:p-8 rounded-xl shadow-lg" onSubmit={handleSubmit} autoComplete="off">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm whitespace-pre-line">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Securet QR URL */}
            <div>
              <label htmlFor="securetQrUrl" className="block text-sm font-medium text-gray-700 mb-1">
                {t.register.securetQrUrl} *
              </label>
              <input
                id="securetQrUrl"
                name="securetQrUrl"
                type="text"
                required
                autoComplete="off"
                data-lpignore="true"
                data-form-type="other"
                placeholder=""
                className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={formData.securetQrUrl}
                onChange={(e) => setFormData({ ...formData, securetQrUrl: e.target.value })}
              />
              <p className="mt-1 text-xs text-gray-500">
                {t.register.securetQrUrlHelp}
              </p>
            </div>

            {/* Nickname */}
            <div>
              <label htmlFor="nickname" className="block text-sm font-medium text-gray-700 mb-1">
                {t.register.nickname} *
              </label>
              <input
                id="nickname"
                name="nickname"
                type="text"
                required
                autoComplete="off"
                data-lpignore="true"
                data-form-type="other"
                placeholder=""
                className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={formData.nickname}
                onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                {t.register.password} *
              </label>
              <input
                id="password"
                name="new-password"
                type="password"
                required
                autoComplete="new-password"
                data-lpignore="true"
                data-form-type="other"
                placeholder=""
                className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                {t.register.confirmPassword} *
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                autoComplete="new-password"
                data-lpignore="true"
                data-form-type="other"
                placeholder=""
                className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              />
            </div>
          </div>

          {/* Terms Agreement */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <label className="flex items-start space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                <Link href="/terms" target="_blank" className="text-blue-600 hover:underline font-medium">{t.register.termsLink}</Link> {t.register.and}{' '}
                <Link href="/privacy" target="_blank" className="text-blue-600 hover:underline font-medium">{t.register.privacyLink}</Link>{t.register.agreeTerms} *
              </span>
            </label>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? t.register.registering : t.register.registerButton}
            </button>
          </div>

          <div className="text-center text-sm">
            <span className="text-gray-600">{t.register.haveAccount} </span>
            <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
              {t.register.goLogin}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
