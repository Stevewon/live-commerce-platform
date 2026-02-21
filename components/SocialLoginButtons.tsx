'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'

interface SocialLoginButtonsProps {
  callbackUrl?: string
}

export default function SocialLoginButtons({ callbackUrl = '/' }: SocialLoginButtonsProps) {
  const [loading, setLoading] = useState<string | null>(null)

  const handleSocialLogin = async (provider: 'google' | 'kakao') => {
    try {
      setLoading(provider)
      await signIn(provider, { callbackUrl })
    } catch (error) {
      console.error(`${provider} login error:`, error)
      alert('로그인에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-3">
      {/* 구분선 */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">또는</span>
        </div>
      </div>

      {/* Google 로그인 */}
      <button
        type="button"
        onClick={() => handleSocialLogin('google')}
        disabled={loading !== null}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading === 'google' ? (
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
        ) : (
          <>
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span className="text-gray-700 font-medium">Google로 로그인</span>
          </>
        )}
      </button>

      {/* Kakao 로그인 */}
      <button
        type="button"
        onClick={() => handleSocialLogin('kakao')}
        disabled={loading !== null}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ backgroundColor: '#FEE500' }}
      >
        {loading === 'kakao' ? (
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
        ) : (
          <>
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#000000"
                d="M12 3C6.477 3 2 6.477 2 10.5c0 2.376 1.408 4.5 3.563 5.813-.179.647-.646 2.344-.735 2.719-.101.438.161.433.344.314.139-.09 2.25-1.5 3.094-2.063C9.052 17.594 10.494 17.813 12 17.813c5.523 0 10-3.313 10-7.313S17.523 3 12 3z"
              />
            </svg>
            <span className="text-gray-900 font-medium">카카오로 로그인</span>
          </>
        )}
      </button>
    </div>
  )
}
