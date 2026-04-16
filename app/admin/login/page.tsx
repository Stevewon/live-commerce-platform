'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import LanguageSelector from '@/components/LanguageSelector'

export default function AdminLoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const { t } = useLanguage()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await login(identifier, password)
    } catch (err: any) {
      setError(err.message || t.login.errorFailed)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4">
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
            QRLIVE {t.nav.admin}
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            {t.admin.login}
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
                name="admin-id"
                className="input"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
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
                name="admin-pw"
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
              disabled={loading}
            >
              {loading ? t.login.loggingIn : t.login.loginButton}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
            ← {t.nav.home}
          </Link>
        </div>

        {/* Test account info */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800 font-medium mb-2">📋 Admin Account</p>
          <p className="text-xs text-blue-700">
            Nickname: admin<br />
            Password: admin123
          </p>
        </div>
      </div>
    </div>
  )
}
