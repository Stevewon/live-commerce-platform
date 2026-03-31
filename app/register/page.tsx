'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/contexts/AuthContext';

export default function RegisterPage() {
  const router = useRouter();
  const { register: authRegister } = useAuth();
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
      setError('모든 필드를 입력해주세요.');
      return;
    }

    if (!validateSecuretUrl(formData.securetQrUrl)) {
      setError('올바른 시큐릿 QR 주소 형식이 아닙니다.\n형식: https://securet.kr/securet.php?key=idcard&nick=...&token=...&voip=...&os=...');
      return;
    }

    if (formData.password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (!agreeTerms) {
      setError('이용약관 및 개인정보처리방침에 동의해주세요.');
      return;
    }

    setIsLoading(true);

    try {
      // AuthContext의 register 사용 - 자동으로 상태 업데이트 + 쿠키 설정 + 리다이렉트
      await authRegister({
        nickname: formData.nickname,
        password: formData.password,
        securetQrUrl: formData.securetQrUrl,
        name: formData.nickname,
        role: 'CUSTOMER',
      });
      // authRegister 성공 시 자동으로 리다이렉트됨
    } catch (err: any) {
      setError(err.message || '회원가입에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center py-8 sm:py-12 px-4">
      <div className="max-w-md w-full space-y-6 sm:space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-block">
            <div className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              QRLIVE
            </div>
          </Link>
          <h2 className="mt-4 sm:mt-6 text-2xl sm:text-3xl font-extrabold text-gray-900">
            간편 회원가입
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            시큐릿 QR 주소와 닉네임, 비밀번호만 입력하세요
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
                시큐릿 QR 주소 *
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
                시큐릿 메신저의 QR 주소를 입력해주세요
              </p>
            </div>

            {/* Nickname */}
            <div>
              <label htmlFor="nickname" className="block text-sm font-medium text-gray-700 mb-1">
                닉네임 *
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
                비밀번호 *
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
                비밀번호 확인 *
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

          {/* 이용약관 동의 */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <label className="flex items-start space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                <Link href="/terms" target="_blank" className="text-blue-600 hover:underline font-medium">이용약관</Link> 및{' '}
                <Link href="/privacy" target="_blank" className="text-blue-600 hover:underline font-medium">개인정보처리방침</Link>에 동의합니다 *
              </span>
            </label>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? '회원가입 중...' : '회원가입'}
            </button>
          </div>

          <div className="text-center text-sm">
            <span className="text-gray-600">이미 계정이 있으신가요? </span>
            <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
              로그인
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
