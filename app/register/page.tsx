'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';

interface AvailableProviders {
  providers: string[];
  email: boolean;
}

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [availableProviders, setAvailableProviders] = useState<AvailableProviders | null>(null);

  // 활성화된 OAuth 제공자 확인
  useEffect(() => {
    fetch('/api/auth/providers')
      .then(res => res.json())
      .then(data => setAvailableProviders(data))
      .catch(err => console.error('Failed to fetch providers:', err));
  }, []);

  // 소셜 로그인 핸들러
  const handleSocialLogin = async (provider: 'google' | 'naver' | 'kakao') => {
    setLoading(provider);
    setError('');
    
    try {
      // NextAuth 소셜 로그인 (자동 회원가입 포함)
      const result = await signIn(provider, {
        callbackUrl: '/',
        redirect: true,
      });
      
      if (result?.error) {
        setError('로그인에 실패했습니다. 다시 시도해주세요.');
      }
    } catch (err: any) {
      console.error('Social login error:', err);
      setError(err.message || '로그인에 실패했습니다.');
    } finally {
      setLoading(null);
    }
  };

  // OAuth 버튼 비활성화 안내 메시지
  const getDisabledMessage = (provider: string) => {
    return `${provider} 로그인은 관리자가 OAuth 설정을 완료한 후 사용할 수 있습니다.`;
  };

  const isProviderEnabled = (provider: string) => {
    return availableProviders?.providers.includes(provider) ?? false;
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
            간편하게 시작하기
          </h2>
          <p className="text-sm sm:text-base text-gray-600">
            {availableProviders && availableProviders.providers.length > 0 
              ? 'SNS 계정으로 3초만에 가입하세요'
              : '이메일로 간편하게 가입하세요'
            }
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
          {isProviderEnabled('google') && (
            <button
              onClick={() => handleSocialLogin('google')}
              disabled={loading !== null}
              className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-white border-2 border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group"
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
          )}

          {/* 네이버 로그인 */}
          {isProviderEnabled('naver') && (
            <button
              onClick={() => handleSocialLogin('naver')}
              disabled={loading !== null}
              className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-[#03C75A] hover:bg-[#02B350] rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading === 'naver' ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
                    <path d="M16.273 12.845L7.376 0H0v24h7.726V11.156L16.624 24H24V0h-7.727v12.845z"/>
                  </svg>
                  <span className="text-white font-semibold text-sm sm:text-base">
                    네이버로 계속하기
                  </span>
                </>
              )}
            </button>
          )}

          {/* 카카오 로그인 */}
          {isProviderEnabled('kakao') && (
            <button
              onClick={() => handleSocialLogin('kakao')}
              disabled={loading !== null}
              className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-[#FEE500] hover:bg-[#FDD835] rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading === 'kakao' ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#000000" d="M12 3c5.799 0 10.5 3.664 10.5 8.185 0 4.52-4.701 8.184-10.5 8.184a13.5 13.5 0 0 1-1.727-.11l-4.408 2.883c-.501.265-.678.236-.472-.413l.892-3.678c-2.88-1.46-4.785-3.99-4.785-6.866C1.5 6.665 6.201 3 12 3z"/>
                  </svg>
                  <span className="text-gray-800 font-semibold text-sm sm:text-base">
                    카카오로 계속하기
                  </span>
                </>
              )}
            </button>
          )}

          {/* OAuth 설정 안내 (소셜 로그인이 하나도 없을 때) */}
          {availableProviders && availableProviders.providers.length === 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800 text-sm font-medium mb-2">
                ℹ️ 소셜 로그인 준비 중
              </p>
              <p className="text-blue-600 text-xs">
                관리자가 Google, Naver, Kakao OAuth 설정을 완료하면 소셜 로그인을 사용할 수 있습니다.
              </p>
            </div>
          )}

          {/* 구분선 */}
          {(availableProviders && availableProviders.providers.length > 0) && (
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500">또는</span>
              </div>
            </div>
          )}

          {/* 이메일 회원가입 버튼 */}
          <Link
            href="/register/email"
            className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] font-semibold text-sm sm:text-base"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            이메일로 가입하기
          </Link>

          {/* 로그인 링크 */}
          <div className="text-center pt-4">
            <p className="text-sm text-gray-600">
              이미 계정이 있으신가요?{' '}
              <Link 
                href="/login" 
                className="font-semibold text-purple-600 hover:text-purple-700 transition-colors"
              >
                로그인
              </Link>
            </p>
          </div>

          {/* 파트너 가입 안내 */}
          <div className="text-center pt-4 border-t border-gray-100">
            <p className="text-xs sm:text-sm text-gray-600 mb-2">
              🎥 라이브 방송으로 상품을 판매하고 싶으신가요?
            </p>
            <Link
              href="/partner/register"
              className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-pink-600 hover:text-pink-700 transition-colors"
            >
              <span>파트너 가입하기</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>

        {/* 약관 안내 */}
        <p className="mt-6 text-center text-xs text-gray-500 px-4">
          가입하시면 QRLIVE의{' '}
          <Link href="/terms" className="underline hover:text-gray-700">이용약관</Link>
          {' '}및{' '}
          <Link href="/privacy" className="underline hover:text-gray-700">개인정보처리방침</Link>
          에 동의하는 것으로 간주됩니다.
        </p>
      </div>
    </div>
  );
}
