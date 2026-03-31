'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/contexts/AuthContext'

export default function PartnerRegisterPage() {
  const router = useRouter()
  const { register: authRegister } = useAuth()
  const [formData, setFormData] = useState({
    securetQrUrl: '',
    nickname: '',
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    phone: '',
    storeName: '',
    storeSlug: '',
    description: '',
    youtubeUrl: '',
    africaTvUrl: '',
    instagramUrl: '',
    tiktokUrl: '',
    naverShoppingUrl: '',
    coupangUrl: ''
  })
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))

    // 상점 이름 입력 시 자동으로 slug 생성
    if (name === 'storeName') {
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9가-힣]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
      setFormData(prev => ({ ...prev, [name]: value, storeSlug: slug }))
    }
  }

  // Securet QR URL 형식 검증
  const validateSecuretUrl = (url: string): boolean => {
    const pattern = /^https:\/\/securet\.kr\/securet\.php\?key=idcard&nick=.+&token=.+&voip=.+&os=.+$/
    return pattern.test(url)
  }

  // 이메일 형식 검증
  const validateEmail = (email: string): boolean => {
    if (!email) return true // 이메일은 선택
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // 유효성 검사
    if (!formData.securetQrUrl) {
      setError('시큐릿 QR 주소를 입력해주세요.')
      setLoading(false)
      return
    }

    if (!validateSecuretUrl(formData.securetQrUrl)) {
      setError('올바른 시큐릿 QR 주소 형식이 아닙니다.\n형식: https://securet.kr/securet.php?key=idcard&nick=...&token=...&voip=...&os=...')
      setLoading(false)
      return
    }

    if (!formData.nickname) {
      setError('닉네임을 입력해주세요.')
      setLoading(false)
      return
    }

    if (formData.email && !validateEmail(formData.email)) {
      setError('올바른 이메일 형식이 아닙니다.')
      setLoading(false)
      return
    }

    if (formData.password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.')
      setLoading(false)
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.')
      setLoading(false)
      return
    }

    if (!formData.storeName || !formData.storeSlug) {
      setError('상점 이름을 입력해주세요.')
      setLoading(false)
      return
    }

    if (!agreeTerms) {
      setError('이용약관 및 개인정보처리방침에 동의해주세요.')
      setLoading(false)
      return
    }

    try {
      // AuthContext의 register 사용 - 자동으로 상태 업데이트 + 쿠키 설정 + 리다이렉트
      await authRegister({
        nickname: formData.nickname,
        password: formData.password,
        securetQrUrl: formData.securetQrUrl,
        email: formData.email || undefined,
        name: formData.name || formData.nickname,
        phone: formData.phone || undefined,
        role: 'PARTNER',
        storeName: formData.storeName,
        storeSlug: formData.storeSlug,
        description: formData.description || undefined,
      })
      // authRegister 성공 시 자동으로 /partner/dashboard로 리다이렉트됨
    } catch (err: any) {
      setError(err.message || '파트너 등록 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 py-8 sm:py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-4">
            <div className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              QRLIVE
            </div>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            파트너 등록
          </h1>
          <p className="text-gray-600">
            큐라이브 플랫폼 파트너로 등록하고 수익을 창출하세요
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm whitespace-pre-line">
                {error}
              </div>
            )}

            {/* 인증 정보 */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">
                인증 정보
              </h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">시큐릿 QR 주소 *</label>
                <input
                  type="text"
                  name="securetQrUrl"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  value={formData.securetQrUrl}
                  onChange={handleChange}
                  autoComplete="off"
                  data-lpignore="true"
                  data-form-type="other"
                  placeholder=""
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  시큐릿 메신저의 QR 주소를 입력해주세요
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">닉네임 *</label>
                <input
                  type="text"
                  name="nickname"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  value={formData.nickname}
                  onChange={handleChange}
                  autoComplete="off"
                  data-lpignore="true"
                  data-form-type="other"
                  placeholder=""
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이메일 (선택)</label>
                <input
                  type="email"
                  name="email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  value={formData.email}
                  onChange={handleChange}
                  autoComplete="off"
                  data-lpignore="true"
                  data-form-type="other"
                  placeholder=""
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호 *</label>
                  <input
                    type="password"
                    name="new-pw"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-form-type="other"
                    placeholder=""
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호 확인 *</label>
                  <input
                    type="password"
                    name="confirm-pw"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-form-type="other"
                    placeholder=""
                    required
                  />
                </div>
              </div>
            </div>

            {/* 기본 정보 */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">
                기본 정보
              </h2>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">이름 *</label>
                  <input
                    type="text"
                    name="name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    value={formData.name}
                    onChange={handleChange}
                    autoComplete="off"
                    data-lpignore="true"
                    data-form-type="other"
                    placeholder=""
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">연락처 *</label>
                  <input
                    type="tel"
                    name="phone"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    value={formData.phone}
                    onChange={handleChange}
                    autoComplete="off"
                    data-lpignore="true"
                    data-form-type="other"
                    placeholder=""
                    required
                  />
                </div>
              </div>
            </div>

            {/* 쇼핑몰 정보 */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">
                쇼핑몰 정보
              </h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">상점 이름 *</label>
                <input
                  type="text"
                  name="storeName"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  value={formData.storeName}
                  onChange={handleChange}
                  placeholder=""
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  고객에게 표시될 상점 이름입니다
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">상점 URL *</label>
                <div className="flex items-center">
                  <span className="bg-gray-100 px-3 py-2 rounded-l-lg border border-r-0 text-gray-600 text-sm">
                    /store/
                  </span>
                  <input
                    type="text"
                    name="storeSlug"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    value={formData.storeSlug}
                    onChange={handleChange}
                    placeholder=""
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  고객이 접속할 URL입니다. 영문, 숫자, 하이픈만 사용 가능합니다.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">상점 소개</label>
                <textarea
                  name="description"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 min-h-[100px]"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder=""
                />
              </div>
            </div>

            {/* 소셜 미디어 & 라이브 쇼핑 플랫폼 */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">
                라이브 쇼핑 플랫폼 (선택)
              </h2>
              <p className="text-sm text-gray-600 -mt-2">
                라이브 방송을 진행하는 플랫폼을 연결하세요
              </p>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">유튜브 채널</label>
                  <input
                    type="url"
                    name="youtubeUrl"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    value={formData.youtubeUrl}
                    onChange={handleChange}
                    placeholder=""
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">아프리카TV</label>
                  <input
                    type="url"
                    name="africaTvUrl"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    value={formData.africaTvUrl}
                    onChange={handleChange}
                    placeholder=""
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">인스타그램</label>
                  <input
                    type="url"
                    name="instagramUrl"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    value={formData.instagramUrl}
                    onChange={handleChange}
                    placeholder=""
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">틱톡 (TikTok)</label>
                  <input
                    type="url"
                    name="tiktokUrl"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    value={formData.tiktokUrl}
                    onChange={handleChange}
                    placeholder=""
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">네이버 쇼핑 라이브</label>
                  <input
                    type="url"
                    name="naverShoppingUrl"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    value={formData.naverShoppingUrl}
                    onChange={handleChange}
                    placeholder=""
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">쿠팡 라이브</label>
                  <input
                    type="url"
                    name="coupangUrl"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    value={formData.coupangUrl}
                    onChange={handleChange}
                    placeholder=""
                  />
                </div>
              </div>
            </div>

            {/* 약관 동의 */}
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

            <button
              type="submit"
              className="w-full py-3 px-4 border border-transparent text-lg font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              disabled={loading}
            >
              {loading ? '등록 중...' : '파트너 등록하기'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            이미 계정이 있으신가요?{' '}
            <Link href="/partner/login" className="text-blue-600 hover:underline font-medium">
              로그인하기
            </Link>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
            ← 홈으로 돌아가기
          </Link>
        </div>

        {/* 혜택 안내 */}
        <div className="mt-8 grid md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-sm text-center">
            <div className="text-3xl mb-2">💰</div>
            <h3 className="font-semibold text-gray-900 mb-1">수익 분배</h3>
            <p className="text-sm text-gray-600">판매액의 30%가 파트너 수익</p>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm text-center">
            <div className="text-3xl mb-2">🏪</div>
            <h3 className="font-semibold text-gray-900 mb-1">독립 쇼핑몰</h3>
            <p className="text-sm text-gray-600">나만의 브랜드로 운영</p>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm text-center">
            <div className="text-3xl mb-2">📦</div>
            <h3 className="font-semibold text-gray-900 mb-1">제품 공급</h3>
            <p className="text-sm text-gray-600">다양한 제품 무료 제공</p>
          </div>
        </div>
      </div>
    </div>
  )
}
