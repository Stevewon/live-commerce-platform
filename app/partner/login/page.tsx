'use client'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import LanguageSelector from '@/components/LanguageSelector'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function PartnerLoginPage() {
  const router = useRouter()
  const { login: authLogin } = useAuth()
  const { t } = useLanguage()
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      await authLogin(nickname, password)
    } catch (err: any) {
      setError(err.message || t.login.errorFailed)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex justify-end mb-4">
            <LanguageSelector />
          </div>
          <div className="flex justify-center mb-4">
            <img 
              src="/logos/qrlive-logo.png" 
              alt="QRLIVE Logo" 
              className="w-16 h-16 sm:w-20 sm:h-20 object-contain"
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            QRLIVE {t.nav.partner}
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            {t.partner.login}
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="label">{t.login.nickname}</label>
              <input
                type="text"
                name="partner-login-nickname"
                className="input"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                autoComplete="off"
                data-lpignore="true"
                data-form-type="other"
                placeholder=""
                required
              />
            </div>

            <div>
              <label className="label">{t.login.password}</label>
              <input
                type="password"
                name="partner-login-pw"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="off"
                data-lpignore="true"
                data-form-type="other"
                placeholder=""
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={isLoading}
            >
              {isLoading ? t.login.loggingIn : t.login.loginButton}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            {t.login.noAccount}{' '}
            <Link href="/partner/register" className="text-blue-600 hover:underline font-medium">
              {t.partner.register}
            </Link>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
            ← {t.nav.home}
          </Link>
        </div>
      </div>
    </div>
  )
}
