'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function PartnerRegisterPage() {
  const router = useRouter()
  const user = null, loading = false // Temp
  const [formData, setFormData] = useState({
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
      setFormData(prev => ({ ...prev, storeSlug: slug }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // 유효성 검사
    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다')
      setLoading(false)
      return
    }

    if (formData.password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다')
      setLoading(false)
      return
    }

    try {
      // AuthContext의 register 함수 사용 (자동 로그인 포함)
      await register({
        email: formData.email,
        password: formData.password,
        name: formData.name,
        phone: formData.phone,
        role: 'PARTNER'
      })
      // register 함수에서 자동으로 /partner/dashboard로 리다이렉션됨
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            파트너 등록
          </h1>
          <p className="text-gray-600">
            라이브 커머스 플랫폼 파트너로 등록하고 수익을 창출하세요
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {/* 기본 정보 */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">
                기본 정보
              </h2>

              <div>
                <label className="label">이메일 *</label>
                <input
                  type="email"
                  name="email"
                  className="input"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="your@email.com"
                  required
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="label">비밀번호 *</label>
                  <input
                    type="password"
                    name="password"
                    className="input"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="최소 6자 이상"
                    required
                  />
                </div>

                <div>
                  <label className="label">비밀번호 확인 *</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    className="input"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="비밀번호 재입력"
                    required
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="label">이름 *</label>
                  <input
                    type="text"
                    name="name"
                    className="input"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="홍길동"
                    required
                  />
                </div>

                <div>
                  <label className="label">연락처 *</label>
                  <input
                    type="tel"
                    name="phone"
                    className="input"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="010-1234-5678"
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
                <label className="label">상점 이름 *</label>
                <input
                  type="text"
                  name="storeName"
                  className="input"
                  value={formData.storeName}
                  onChange={handleChange}
                  placeholder="김스트리머의 라이브샵"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  고객에게 표시될 상점 이름입니다
                </p>
              </div>

              <div>
                <label className="label">상점 URL *</label>
                <div className="flex items-center">
                  <span className="bg-gray-100 px-3 py-2 rounded-l-lg border border-r-0 text-gray-600 text-sm">
                    /store/
                  </span>
                  <input
                    type="text"
                    name="storeSlug"
                    className="input rounded-l-none"
                    value={formData.storeSlug}
                    onChange={handleChange}
                    placeholder="kimstreamer"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  고객이 접속할 URL입니다. 영문, 숫자, 하이픈만 사용 가능합니다.
                </p>
              </div>

              <div>
                <label className="label">상점 소개</label>
                <textarea
                  name="description"
                  className="input min-h-[100px]"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="상점에 대한 간단한 소개를 작성해주세요"
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
                  <label className="label">📺 유튜브 채널</label>
                  <input
                    type="url"
                    name="youtubeUrl"
                    className="input"
                    value={formData.youtubeUrl}
                    onChange={handleChange}
                    placeholder="https://youtube.com/@yourhandle"
                  />
                </div>

                <div>
                  <label className="label">🎬 아프리카TV</label>
                  <input
                    type="url"
                    name="africaTvUrl"
                    className="input"
                    value={formData.africaTvUrl}
                    onChange={handleChange}
                    placeholder="https://afreecatv.com/yourhandle"
                  />
                </div>

                <div>
                  <label className="label">📸 인스타그램</label>
                  <input
                    type="url"
                    name="instagramUrl"
                    className="input"
                    value={formData.instagramUrl}
                    onChange={handleChange}
                    placeholder="https://instagram.com/yourhandle"
                  />
                </div>

                <div>
                  <label className="label">🎵 틱톡 (TikTok)</label>
                  <input
                    type="url"
                    name="tiktokUrl"
                    className="input"
                    value={formData.tiktokUrl}
                    onChange={handleChange}
                    placeholder="https://tiktok.com/@yourhandle"
                  />
                </div>

                <div>
                  <label className="label">🛒 네이버 쇼핑 라이브</label>
                  <input
                    type="url"
                    name="naverShoppingUrl"
                    className="input"
                    value={formData.naverShoppingUrl}
                    onChange={handleChange}
                    placeholder="https://shopping.naver.com/..."
                  />
                </div>

                <div>
                  <label className="label">📦 쿠팡 라이브</label>
                  <input
                    type="url"
                    name="coupangUrl"
                    className="input"
                    value={formData.coupangUrl}
                    onChange={handleChange}
                    placeholder="https://www.coupang.com/..."
                  />
                </div>
              </div>
            </div>

            {/* 약관 동의 */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <label className="flex items-start space-x-2">
                <input type="checkbox" required className="mt-1" />
                <span className="text-sm text-gray-700">
                  <Link href="/terms" className="text-blue-600 hover:underline">이용약관</Link> 및{' '}
                  <Link href="/privacy" className="text-blue-600 hover:underline">개인정보처리방침</Link>에 동의합니다 *
                </span>
              </label>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full text-lg py-3"
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
