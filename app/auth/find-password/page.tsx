'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function FindPasswordPage() {
  const [formData, setFormData] = useState({
    securetQrUrl: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!formData.securetQrUrl || !formData.newPassword || !formData.confirmPassword) {
      setError('모든 필드를 입력해주세요.');
      return;
    }

    if (formData.newPassword.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          securetQrUrl: formData.securetQrUrl,
          newPassword: formData.newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '비밀번호 재설정에 실패했습니다.');
      }

      if (data.success) {
        setSuccess(true);
        setFormData({
          securetQrUrl: '',
          newPassword: '',
          confirmPassword: '',
        });
      }
    } catch (err: any) {
      setError(err.message || '비밀번호 재설정에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-block">
            <div className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              QRLIVE
            </div>
          </Link>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            비밀번호 찾기
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            시큐릿 QR 주소를 확인하여 새 비밀번호를 설정합니다
          </p>
        </div>

        <form className="mt-8 space-y-6 bg-white p-8 rounded-xl shadow-lg" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
              <p className="font-semibold mb-2">비밀번호가 성공적으로 변경되었습니다!</p>
              <Link href="/login" className="text-blue-600 hover:text-blue-500 underline">
                로그인 페이지로 이동
              </Link>
            </div>
          )}

          <div className="space-y-4">
            {/* Securet QR URL */}
            <div>
              <label htmlFor="securetQrUrl" className="block text-sm font-medium text-gray-700 mb-1">
                시큐릿 QR 주소
              </label>
              <input
                id="securetQrUrl"
                name="securetQrUrl"
                type="text"
                required
                placeholder="https://securet.kr/securet.php?key=idcard&nick=..."
                className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={formData.securetQrUrl}
                onChange={(e) => setFormData({ ...formData, securetQrUrl: e.target.value })}
              />
              <p className="mt-1 text-xs text-gray-500">
                회원가입 시 입력한 시큐릿 QR 주소를 입력해주세요
              </p>
            </div>

            {/* New Password */}
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                새 비밀번호
              </label>
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                required
                placeholder="최소 6자 이상"
                className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={formData.newPassword}
                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                비밀번호 확인
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                placeholder="비밀번호를 다시 입력하세요"
                className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? '처리 중...' : '비밀번호 재설정'}
            </button>
          </div>

          <div className="flex items-center justify-between text-sm pt-4 border-t border-gray-200">
            <Link href="/auth/find-nickname" className="text-blue-600 hover:text-blue-500">
              닉네임 찾기
            </Link>
            <Link href="/login" className="text-blue-600 hover:text-blue-500">
              로그인
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
