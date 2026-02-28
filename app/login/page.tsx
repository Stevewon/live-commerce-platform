'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  // 소셜 로그인 핸들러
  const handleSocialLogin = async (provider: 'google' | 'naver' | 'kakao') => {
    setLoading(true);
    setError('');
    
    try {
      // TODO: NextAuth 소셜 로그인 연동
      alert(`${provider.toUpperCase()} 로그인 기능은 곧 추가됩니다!`);
      
      // 임시: OAuth 설정 후 활성화
      // window.location.href = `/api/auth/signin/${provider}`;
    } catch (err: any) {
      setError(err.message || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 이메일 로그인
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        // 토큰 저장
        localStorage.setItem('token', data.data.token);
        localStorage.setItem('user', JSON.stringify(data.data.user));
        
        // 역할에 따른 리다이렉션
        const role = data.data.user.role;
        if (role === 'ADMIN') {
          router.push('/admin/dashboard');
        } else if (role === 'PARTNER') {
          router.push('/partner/dashboard');
        } else {
          router.push('/products');
        }
      } else {
        setError(data.error || '로그인에 실패했습니다.');
      }
    } catch (err: any) {
      setError('로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-6">
            <div className="flex items-center justify-center space-x-2">
              <img 
                src="/logos/qrlive-logo.png" 
                alt="QRLIVE" 
                className="w-12 h-12 sm:w-14 sm:h-14"
              />
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                QRLIVE
              </h1>
            </div>
          </Link>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            로그인
          </h2>
          <p className="text-sm sm:text-base text-gray-600">
            SNS 계정으로 간편하게 로그인하세요
          </p>
        </div>

        {/* 소셜 로그인 카드 */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-600 text-sm">⚠️ {error}</p>
            </div>
          )}

          {/* 구글 로그인 */}
          <button
            onClick={() => handleSocialLogin('google')}
            disabled={loading !== null}
            className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-white border-2 border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'google' ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="text-gray-700 font-semibold text-sm sm:text-base">
                  Google로 계속하기
                </span>
              </>
            )}
          </button>

          {/* 네이버 로그인 */}
          <button
            onClick={() => handleSocialLogin('naver')}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-[#03C75A] hover:bg-[#02B350] rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
              <path d="M16.273 12.845L7.376 0H0v24h7.726V11.156L16.624 24H24V0h-7.727v12.845z"/>
            </svg>
            <span className="text-white font-semibold text-sm sm:text-base">
              네이버로 계속하기
            </span>
          </button>

          {/* 카카오 로그인 */}
          <button
            onClick={() => handleSocialLogin('kakao')}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-[#FEE500] hover:bg-[#FDD835] rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#000000" d="M12 3c5.799 0 10.5 3.664 10.5 8.185 0 4.52-4.701 8.184-10.5 8.184a13.5 13.5 0 0 1-1.727-.11l-4.408 2.883c-.501.265-.678.236-.472-.413l.892-3.678c-2.88-1.46-4.785-3.99-4.785-6.866C1.5 6.665 6.201 3 12 3z"/>
            </svg>
            <span className="text-gray-800 font-semibold text-sm sm:text-base">
              카카오로 계속하기
            </span>
          </button>

          {/* 구분선 */}
          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">또는</span>
            </div>
          </div>

          {/* 이메일 로그인 폼 */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <input
                type="email"
                placeholder="이메일"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                required
              />
            </div>
            <div>
              <input
                type="password"
                placeholder="비밀번호"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading !== null}
              className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading === 'email' ? '로그인 중...' : '이메일로 로그인'}
            </button>
          </form>

          {/* 회원가입 링크 */}
          <div className="text-center pt-4">
            <p className="text-sm text-gray-600">
              아직 계정이 없으신가요?{' '}
              <Link 
                href="/register" 
                className="font-semibold text-purple-600 hover:text-purple-700 transition-colors"
              >
                회원가입
              </Link>
            </p>
          </div>
        </div>

        {/* 관리자/파트너 로그인 링크 */}
        <div className="mt-6 flex justify-center gap-4 text-sm">
          <Link 
            href="/admin/login"
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            관리자 로그인
          </Link>
          <span className="text-gray-300">|</span>
          <Link 
            href="/partner/login"
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            파트너 로그인
          </Link>
        </div>
      </div>
    </div>
  );
}
