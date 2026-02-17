import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl font-bold mb-6">
              🎥 라이브 커머스 플랫폼
            </h1>
            <p className="text-xl mb-8 text-blue-100">
              스트리머를 위한 분양형 쇼핑몰 - 당신의 구독자를 고객으로!
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link href="/admin/login" className="btn btn-primary bg-white text-blue-600 hover:bg-gray-100 px-8 py-3 text-lg">
                관리자 로그인
              </Link>
              <Link href="/partner/login" className="btn px-8 py-3 text-lg bg-blue-700 hover:bg-blue-800 text-white">
                파트너 로그인
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">왜 우리 플랫폼인가요?</h2>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Feature 1 */}
            <div className="text-center p-6">
              <div className="text-5xl mb-4">🏪</div>
              <h3 className="text-xl font-bold mb-3">나만의 쇼핑몰</h3>
              <p className="text-gray-600">
                독립된 쇼핑몰 주소를 제공받아 당신의 브랜드로 운영하세요
              </p>
            </div>

            {/* Feature 2 */}
            <div className="text-center p-6">
              <div className="text-5xl mb-4">📦</div>
              <h3 className="text-xl font-bold mb-3">제품 공급</h3>
              <p className="text-gray-600">
                우리가 보유한 다양한 제품을 선택해서 판매하세요
              </p>
            </div>

            {/* Feature 3 */}
            <div className="text-center p-6">
              <div className="text-5xl mb-4">💰</div>
              <h3 className="text-xl font-bold mb-3">수익 분배</h3>
              <p className="text-gray-600">
                판매 즉시 자동 정산 - 투명한 수익 분배 시스템
              </p>
            </div>

            {/* Feature 4 */}
            <div className="text-center p-6">
              <div className="text-5xl mb-4">📺</div>
              <h3 className="text-xl font-bold mb-3">라이브 연동</h3>
              <p className="text-gray-600">
                유튜브, 아프리카TV 라이브 방송과 연동 가능
              </p>
            </div>

            {/* Feature 5 */}
            <div className="text-center p-6">
              <div className="text-5xl mb-4">📱</div>
              <h3 className="text-xl font-bold mb-3">모바일 최적화</h3>
              <p className="text-gray-600">
                PC와 모바일 어디서든 판매 현황 확인
              </p>
            </div>

            {/* Feature 6 */}
            <div className="text-center p-6">
              <div className="text-5xl mb-4">📊</div>
              <h3 className="text-xl font-bold mb-3">실시간 통계</h3>
              <p className="text-gray-600">
                판매, 수익, 고객 데이터를 한눈에 파악
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">어떻게 작동하나요?</h2>
          
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Step 1 */}
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xl">
                1
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">파트너 가입</h3>
                <p className="text-gray-600">
                  간단한 정보만 입력하면 바로 당신만의 쇼핑몰이 생성됩니다
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xl">
                2
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">제품 선택</h3>
                <p className="text-gray-600">
                  플랫폼에서 제공하는 다양한 제품 중 당신이 판매할 제품을 선택하세요
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xl">
                3
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">라이브 방송</h3>
                <p className="text-gray-600">
                  유튜브, 아프리카TV에서 라이브 방송하며 당신의 쇼핑몰 링크를 공유하세요
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xl">
                4
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">자동 수익 분배</h3>
                <p className="text-gray-600">
                  주문이 들어오면 자동으로 수익이 분배되고 정산됩니다
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-blue-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6">
            지금 바로 시작하세요!
          </h2>
          <p className="text-xl mb-8 text-blue-100">
            당신의 구독자들을 고객으로 만들 수 있는 최고의 기회
          </p>
          <Link href="/partner/register" className="btn bg-white text-blue-600 hover:bg-gray-100 px-8 py-3 text-lg inline-block">
            파트너 등록하기 →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="container mx-auto px-4 text-center">
          <p>© 2024 라이브 커머스 플랫폼. All rights reserved.</p>
          <div className="mt-4 space-x-4">
            <Link href="/terms" className="hover:text-white">이용약관</Link>
            <Link href="/privacy" className="hover:text-white">개인정보처리방침</Link>
            <Link href="/contact" className="hover:text-white">문의하기</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
