'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'

// 호스트 프로필 데이터 (20개)
const hostProfiles = [
  { name: '김민지', category: '패션', emoji: '👩‍💼', viewers: 8900, chats: 1520, likes: 4200, product: '👗' },
  { name: '박준혁', category: '전자기기', emoji: '👨‍💼', viewers: 5200, chats: 890, likes: 2300, product: '📱' },
  { name: '이수진', category: '뷰티', emoji: '👩‍🦰', viewers: 7800, chats: 1340, likes: 3900, product: '💄' },
  { name: '최동욱', category: '홈인테리어', emoji: '👨‍🦱', viewers: 3400, chats: 560, likes: 1800, product: '🛋️' },
  { name: '정예린', category: '키친웨어', emoji: '👩‍🦱', viewers: 4100, chats: 720, likes: 2100, product: '🍳' },
  { name: '강태우', category: '스포츠', emoji: '👨‍🦰', viewers: 6300, chats: 1100, likes: 3200, product: '⚽' },
  { name: '윤서아', category: '악세서리', emoji: '👩‍💻', viewers: 5900, chats: 980, likes: 2800, product: '💍' },
  { name: '임준서', category: '가전', emoji: '👨‍💻', viewers: 4800, chats: 810, likes: 2400, product: '🎧' },
  { name: '한지우', category: '아동용품', emoji: '👩', viewers: 3900, chats: 670, likes: 1900, product: '🧸' },
  { name: '송민호', category: '식품', emoji: '👨', viewers: 7200, chats: 1280, likes: 3600, product: '🍔' },
  { name: '조유나', category: '헬스케어', emoji: '👩‍⚕️', viewers: 4500, chats: 760, likes: 2200, product: '💊' },
  { name: '배성준', category: '자동차용품', emoji: '👨‍🔧', viewers: 5600, chats: 920, likes: 2700, product: '🚗' },
  { name: '신하은', category: '반려동물', emoji: '👩‍🎨', viewers: 6700, chats: 1150, likes: 3400, product: '🐶' },
  { name: '오재현', category: '문구/완구', emoji: '👨‍🎨', viewers: 3200, chats: 540, likes: 1600, product: '🎨' },
  { name: '황서연', category: '여행용품', emoji: '👩‍✈️', viewers: 5100, chats: 860, likes: 2500, product: '✈️' },
  { name: '전수민', category: '도서', emoji: '👩‍🏫', viewers: 2800, chats: 480, likes: 1400, product: '📚' },
  { name: '남궁민', category: '게임/취미', emoji: '👨‍🎮', viewers: 8500, chats: 1480, likes: 4100, product: '🎮' },
  { name: '서지안', category: '명품', emoji: '👩‍💼', viewers: 9200, chats: 1680, likes: 4600, product: '👜' },
  { name: '권도윤', category: '음향기기', emoji: '👨‍🎤', viewers: 4200, chats: 710, likes: 2000, product: '🎵' },
  { name: '안유진', category: '화장품', emoji: '👩‍🎤', viewers: 8100, chats: 1420, likes: 4000, product: '💅' }
]

// HostCard 컴포넌트
function HostCard({ host, index }: { host: typeof hostProfiles[0], index: number }) {
  const [currentViewers, setCurrentViewers] = useState(host.viewers)
  const [currentChats, setCurrentChats] = useState(host.chats)
  const [currentLikes, setCurrentLikes] = useState(host.likes)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentViewers(prev => prev + Math.floor(Math.random() * 20) - 5)
      setCurrentChats(prev => prev + Math.floor(Math.random() * 10))
      setCurrentLikes(prev => prev + Math.floor(Math.random() * 30))
    }, 2000 + index * 100) // 각 카드마다 다른 업데이트 주기

    return () => clearInterval(interval)
  }, [index])

  const gradients = [
    'from-pink-600/50 via-purple-600/50 to-blue-600/50',
    'from-blue-600/50 via-cyan-600/50 to-teal-600/50',
    'from-orange-600/50 via-red-600/50 to-pink-600/50',
    'from-purple-600/50 via-indigo-600/50 to-blue-600/50',
    'from-green-600/50 via-emerald-600/50 to-teal-600/50'
  ]

  return (
    <div
      className="relative aspect-[9/16] overflow-hidden rounded-lg group"
      style={{
        animation: `floating ${5 + (index % 3)}s ease-in-out infinite`,
        animationDelay: `${index * 0.1}s`
      }}
    >
      {/* Gradient Background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradients[index % 5]}`}></div>
      
      {/* Host Emoji */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-5xl sm:text-6xl md:text-7xl opacity-30 transform scale-150 group-hover:scale-175 transition-transform duration-500">
          {host.emoji}
        </div>
      </div>

      {/* Product Floating */}
      <div className="absolute top-2 right-2 sm:top-3 sm:right-3 text-xl sm:text-2xl animate-bounce-slow opacity-70">
        {host.product}
      </div>

      {/* LIVE Badge */}
      {index % 3 === 0 && (
        <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 flex items-center space-x-1 bg-red-600/90 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-[10px] sm:text-xs font-bold text-white backdrop-blur-sm">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
          </span>
          <span>LIVE</span>
        </div>
      )}

      {/* Host Info */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-2 sm:p-3 pt-6 sm:pt-8">
        <div className="text-white">
          <div className="font-bold text-xs sm:text-sm mb-0.5 sm:mb-1">{host.name}</div>
          <div className="text-[10px] sm:text-xs text-gray-300 mb-1 sm:mb-2">{host.category}</div>
          
          {/* Live Stats */}
          <div className="flex items-center justify-between text-[10px] sm:text-xs">
            <div className="flex items-center space-x-0.5 sm:space-x-1">
              <span>👁️</span>
              <span className="font-mono tabular-nums">{currentViewers.toLocaleString()}</span>
            </div>
            <div className="flex items-center space-x-0.5 sm:space-x-1">
              <span>💬</span>
              <span className="font-mono tabular-nums">{currentChats.toLocaleString()}</span>
            </div>
            <div className="flex items-center space-x-0.5 sm:space-x-1">
              <span>❤️</span>
              <span className="font-mono tabular-nums">{currentLikes.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Scan Line Effect */}
      <div 
        className="absolute inset-0 bg-gradient-to-b from-transparent via-white/10 to-transparent pointer-events-none"
        style={{
          animation: `scan ${4 + (index % 2)}s linear infinite`,
          animationDelay: `${index * 0.15}s`
        }}
      ></div>
    </div>
  )
}

export default function HomePage() {
  const user = null, loading = false // Temp
  const [scrollY, setScrollY] = useState(0)
  // 실시간 카운터 상태
  const [liveStats, setLiveStats] = useState({
    totalViewers: 112000,
    totalOrders: 847,
    totalRevenue: 28500000
  })

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // 실시간 통계 업데이트
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveStats(prev => ({
        totalViewers: prev.totalViewers + Math.floor(Math.random() * 50) + 10,
        totalOrders: prev.totalOrders + Math.floor(Math.random() * 3),
        totalRevenue: prev.totalRevenue + (Math.floor(Math.random() * 50) + 10) * 1000
      }))
    }, 3000) // 3초마다 업데이트

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Navigation */}
      <nav className={`fixed w-full z-50 transition-all duration-300 ${
        scrollY > 50 ? 'bg-gray-900/95 backdrop-blur-lg shadow-lg' : 'bg-transparent'
      }`}>
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg sm:text-xl">L</span>
              </div>
              <span className="text-white text-lg sm:text-xl font-bold hidden xs:inline">Live Commerce</span>
            </Link>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-6 lg:space-x-8">
              <Link href="#features" className="text-gray-300 hover:text-white transition text-sm font-semibold">
                주요 기능
              </Link>
              <Link href="#how" className="text-gray-300 hover:text-white transition text-sm font-semibold">
                시작하기
              </Link>
              <Link href="#platforms" className="text-gray-300 hover:text-white transition text-sm font-semibold">
                플랫폼
              </Link>
              <Link href="/products" className="text-gray-300 hover:text-white transition text-sm font-semibold">
                🛍️ 쇼핑몰
              </Link>
              {user ? (
                <>
                  <span className="text-white text-sm font-semibold">
                    {user.name}님
                  </span>
                  <button
                    onClick={logout}
                    className="px-4 lg:px-6 py-2 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white rounded-lg transition text-sm font-semibold"
                  >
                    로그아웃
                  </button>
                </>
              ) : (
                <>
                  <Link href="/register" className="text-gray-300 hover:text-white transition text-sm font-semibold">
                    회원가입
                  </Link>
                  <Link 
                    href="/login" 
                    className="px-4 lg:px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition text-sm font-semibold"
                  >
                    로그인
                  </Link>
                </>
              )}
            </div>

            {/* Mobile Navigation */}
            <div className="flex md:hidden items-center space-x-2">
              <Link href="/products" className="text-2xl">
                🛍️
              </Link>
              {user ? (
                <>
                  <span className="text-white text-xs font-semibold truncate max-w-[80px]">
                    {user.name}님
                  </span>
                  <button
                    onClick={logout}
                    className="px-3 py-1.5 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-lg text-xs font-semibold"
                  >
                    로그아웃
                  </button>
                </>
              ) : (
                <>
                  <Link href="/register" className="text-gray-300 hover:text-white transition text-xs font-semibold">
                    가입
                  </Link>
                  <Link 
                    href="/login" 
                    className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg text-xs font-semibold"
                  >
                    로그인
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* 깔끔한 그라데이션 배경 (모든 화면) */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-purple-900/30 to-blue-900/30"></div>

        <div className="relative container mx-auto px-4 py-12 sm:py-16 text-center">
          <div className="max-w-5xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center space-x-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 lg:px-6 py-2 lg:py-3 mb-8">
              <span className="relative flex h-2 w-2 lg:h-3 lg:w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 lg:h-3 lg:w-3 bg-blue-500"></span>
              </span>
              <span className="text-blue-400 text-sm lg:text-xl font-medium">6개 라이브 플랫폼 지원</span>
            </div>

            {/* Main Heading */}
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-7xl xl:text-8xl font-extrabold text-white mb-3 sm:mb-4 lg:mb-8 leading-tight px-4">
              라이브 방송으로
              <br />
              <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                수익을 창출
              </span>
              하세요
            </h1>

            <p className="text-sm sm:text-base md:text-lg lg:text-2xl xl:text-3xl text-gray-300 mb-6 sm:mb-8 lg:mb-12 max-w-4xl mx-auto leading-relaxed px-4">
              스트리머를 위한 분양형 쇼핑몰. 구독자를 고객으로 전환하고,
              <br className="hidden md:block" />
              실시간으로 수익을 확인하세요.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 lg:gap-6 justify-center items-center mb-6 sm:mb-8 lg:mb-16 px-4">
              <Link 
                href="/products"
                className="w-full sm:w-auto group relative px-4 sm:px-6 lg:px-10 py-2 sm:py-3 lg:py-5 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm sm:text-base lg:text-2xl font-semibold rounded-lg lg:rounded-2xl hover:shadow-2xl hover:shadow-blue-500/50 transition-all duration-300 transform hover:-translate-y-1 text-center"
              >
                <span className="relative z-10">🛍️ 쇼핑 시작하기</span>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity blur"></div>
              </Link>
              <Link 
                href="/partner/register"
                className="w-full sm:w-auto px-4 sm:px-6 lg:px-10 py-2 sm:py-3 lg:py-5 bg-white/10 backdrop-blur-lg text-white text-sm sm:text-base lg:text-2xl font-semibold rounded-lg lg:rounded-2xl border border-white/20 hover:bg-white/20 transition-all duration-300 text-center"
              >
                🎥 파트너 가입
              </Link>
            </div>

            {/* Stats - Real-time Counter */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 lg:gap-8 max-w-xl lg:max-w-4xl mx-auto px-4">
              <div className="text-center">
                <div className="text-lg sm:text-2xl lg:text-5xl xl:text-6xl font-bold text-white mb-0.5 sm:mb-1 lg:mb-3 tabular-nums">
                  {liveStats.totalViewers.toLocaleString()}
                </div>
                <div className="text-gray-400 text-xs sm:text-sm lg:text-xl">실시간 시청자</div>
              </div>
              <div className="text-center">
                <div className="text-lg sm:text-2xl lg:text-5xl xl:text-6xl font-bold text-white mb-0.5 sm:mb-1 lg:mb-3 tabular-nums">
                  {liveStats.totalOrders.toLocaleString()}
                </div>
                <div className="text-gray-400 text-xs sm:text-sm lg:text-xl">오늘의 주문</div>
              </div>
              <div className="text-center">
                <div className="text-lg sm:text-2xl lg:text-5xl xl:text-6xl font-bold text-white mb-0.5 sm:mb-1 lg:mb-3 tabular-nums">
                  ₩{(liveStats.totalRevenue / 1000000).toFixed(1)}M
                </div>
                <div className="text-gray-400 text-xs sm:text-sm lg:text-xl">실시간 매출</div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <svg className="w-6 h-6 text-white/50" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
          </svg>
        </div>
      </section>

      {/* Supported Platforms */}
      <section id="platforms" className="py-20 bg-gray-800">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">지원하는 라이브 플랫폼</h2>
            <p className="text-gray-400 text-lg">6개의 주요 라이브 스트리밍 플랫폼과 연동 가능</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 max-w-6xl mx-auto">
            {[
              { 
                name: 'YouTube', 
                logo: '/logos/youtube.svg',
                bgColor: 'bg-red-600/5',
                borderColor: 'hover:border-red-500'
              },
              { 
                name: 'AfreecaTV', 
                icon: '📺',
                bgColor: 'bg-blue-600/5',
                borderColor: 'hover:border-blue-500'
              },
              { 
                name: 'Instagram', 
                logo: '/logos/instagram.svg',
                bgColor: 'bg-pink-600/5',
                borderColor: 'hover:border-pink-500'
              },
              { 
                name: 'TikTok', 
                logo: '/logos/tiktok.svg',
                bgColor: 'bg-gray-900/5',
                borderColor: 'hover:border-gray-500'
              },
              { 
                name: 'Naver Shopping', 
                logo: '/logos/naver.svg',
                bgColor: 'bg-green-600/5',
                borderColor: 'hover:border-green-500'
              },
              { 
                name: 'Coupang', 
                icon: '🛍️',
                bgColor: 'bg-orange-600/5',
                borderColor: 'hover:border-orange-500'
              }
            ].map((platform) => (
              <div key={platform.name} className="group">
                <div className={`${platform.bgColor} bg-gray-700/30 backdrop-blur-lg p-6 rounded-2xl border border-gray-600 ${platform.borderColor} transition-all duration-300 transform hover:-translate-y-2 hover:shadow-xl`}>
                  <div className="h-20 flex items-center justify-center mb-4">
                    {'logo' in platform ? (
                      <img 
                        src={platform.logo} 
                        alt={`${platform.name} 로고`}
                        className="max-h-14 max-w-full object-contain transform group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : (
                      <div className="text-5xl transform group-hover:scale-110 transition-transform">
                        {platform.icon}
                      </div>
                    )}
                  </div>
                  <div className="text-white text-center font-semibold text-sm">{platform.name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-32 bg-gradient-to-b from-gray-900 to-gray-800">
        <div className="container mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6">
              왜 Live Commerce인가?
            </h2>
            <p className="text-2xl sm:text-3xl text-gray-400 max-w-3xl mx-auto">
              스트리머를 위한 올인원 커머스 솔루션
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {[
              {
                icon: '🏪',
                title: '독립 쇼핑몰',
                description: '당신만의 브랜드로 운영하는 전용 쇼핑몰 URL을 제공합니다',
                gradient: 'from-blue-500 to-cyan-500'
              },
              {
                icon: '📦',
                title: '무한한 제품',
                description: '100+ 검증된 제품을 자유롭게 선택해서 판매하세요',
                gradient: 'from-purple-500 to-pink-500'
              },
              {
                icon: '💰',
                title: '투명한 정산',
                description: '실시간 수익 확인과 자동 정산 시스템으로 투명하게 관리',
                gradient: 'from-green-500 to-emerald-500'
              },
              {
                icon: '📺',
                title: '라이브 연동',
                description: '모든 주요 라이브 플랫폼과 완벽하게 연동됩니다',
                gradient: 'from-orange-500 to-red-500'
              },
              {
                icon: '📊',
                title: '실시간 분석',
                description: '판매, 수익, 고객 데이터를 한눈에 파악할 수 있습니다',
                gradient: 'from-indigo-500 to-purple-500'
              },
              {
                icon: '🔒',
                title: '안전한 결제',
                description: '토스페이먼츠로 안전하고 빠른 결제를 지원합니다',
                gradient: 'from-pink-500 to-rose-500'
              }
            ].map((feature, index) => (
              <div
                key={index}
                className="group relative bg-gray-700/30 backdrop-blur-lg p-8 rounded-2xl border border-gray-600 hover:border-transparent transition-all duration-300 transform hover:-translate-y-2"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-10 rounded-2xl transition-opacity`}></div>
                <div className="relative">
                  <div className="text-7xl sm:text-8xl mb-6 transform group-hover:scale-110 transition-transform">
                    {feature.icon}
                  </div>
                  <h3 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                    {feature.title}
                  </h3>
                  <p className="text-lg sm:text-xl text-gray-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how" className="py-32 bg-gray-800">
        <div className="container mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6">
              시작하는 방법
            </h2>
            <p className="text-2xl sm:text-3xl text-gray-400">
              단 4단계로 바로 시작할 수 있습니다
            </p>
          </div>

          <div className="max-w-5xl mx-auto">
            <div className="relative">
              {/* Connection Line */}
              <div className="hidden lg:block absolute top-0 bottom-0 left-1/2 w-0.5 bg-gradient-to-b from-blue-500 via-purple-500 to-pink-500 transform -translate-x-1/2"></div>

              {[
                {
                  step: '01',
                  title: '파트너 가입',
                  description: '간단한 정보만 입력하면 즉시 당신만의 쇼핑몰이 생성됩니다',
                  icon: '👤'
                },
                {
                  step: '02',
                  title: '제품 선택',
                  description: '100+ 검증된 제품 중 당신의 채널에 맞는 제품을 자유롭게 선택',
                  icon: '🛒'
                },
                {
                  step: '03',
                  title: '라이브 방송',
                  description: '유튜브, 아프리카TV 등에서 방송하며 쇼핑몰 링크를 공유',
                  icon: '📡'
                },
                {
                  step: '04',
                  title: '수익 창출',
                  description: '주문이 들어오면 자동으로 수익이 분배되고 투명하게 정산',
                  icon: '💎'
                }
              ].map((item, index) => (
                <div key={index} className={`relative flex items-center mb-24 last:mb-0 ${
                  index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'
                }`}>
                  {/* Content */}
                  <div className={`w-full lg:w-5/12 ${index % 2 === 0 ? 'lg:pr-16 lg:text-right' : 'lg:pl-16'}`}>
                    <div className="bg-gray-700/50 backdrop-blur-lg p-8 rounded-2xl border border-gray-600 hover:border-blue-500 transition-all duration-300 transform hover:-translate-y-2">
                      <div className="text-5xl mb-4">{item.icon}</div>
                      <div className="text-blue-400 font-bold text-sm mb-2">STEP {item.step}</div>
                      <h3 className="text-2xl font-bold text-white mb-4">{item.title}</h3>
                      <p className="text-gray-400 leading-relaxed">{item.description}</p>
                    </div>
                  </div>

                  {/* Circle */}
                  <div className="hidden lg:flex absolute left-1/2 transform -translate-x-1/2 w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full items-center justify-center border-4 border-gray-800">
                    <span className="text-white font-bold text-xl">{index + 1}</span>
                  </div>

                  {/* Spacer */}
                  <div className="hidden lg:block w-5/12"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600"></div>
        <div className="absolute inset-0 bg-black/30"></div>
        
        <div className="relative container mx-auto px-6 text-center">
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-6">
            지금 바로 시작하세요
          </h2>
          <p className="text-xl text-white/90 mb-12 max-w-2xl mx-auto">
            당신의 구독자를 고객으로 만들 수 있는 최고의 기회.
            <br />
            설치비, 유지비 없이 무료로 시작하세요.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/partner/register"
              className="group relative px-10 py-5 bg-white text-gray-900 text-lg font-bold rounded-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1"
            >
              <span className="relative z-10">무료로 시작하기 →</span>
            </Link>
            <Link 
              href="/admin/login"
              className="px-10 py-5 bg-white/20 backdrop-blur-lg text-white text-lg font-bold rounded-xl border-2 border-white hover:bg-white/30 transition-all duration-300"
            >
              관리자 로그인
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-800 py-16">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xl">L</span>
                </div>
                <span className="text-white text-xl font-bold">Live Commerce</span>
              </div>
              <p className="text-gray-400 text-sm">
                스트리머를 위한 분양형 쇼핑몰 플랫폼
              </p>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">플랫폼</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="#features" className="hover:text-white transition">기능</a></li>
                <li><a href="#how" className="hover:text-white transition">시작하기</a></li>
                <li><a href="#platforms" className="hover:text-white transition">지원 플랫폼</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">빠른 링크</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><Link href="/products" className="hover:text-white transition">🛍️ 쇼핑몰</Link></li>
                <li><Link href="/register" className="hover:text-white transition">회원가입</Link></li>
                <li><Link href="/login" className="hover:text-white transition">로그인</Link></li>
                <li><Link href="/partner/register" className="hover:text-white transition">파트너 가입</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">법률</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><Link href="/terms" className="hover:text-white transition">이용약관</Link></li>
                <li><Link href="/privacy" className="hover:text-white transition">개인정보처리방침</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-gray-500 text-sm">
            <p>© 2024 LiveCommerce Platform. All rights reserved. Built with ❤️ by Stevewon</p>
          </div>
        </div>
      </footer>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes fadeInOut {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.7; }
        }
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        @keyframes floating {
          0%, 100% { 
            transform: translateY(0px) scale(1); 
          }
          50% { 
            transform: translateY(-15px) scale(1.02); 
          }
        }
        @keyframes infiniteScroll {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          50% { transform: translateY(-30px) translateX(10px); }
        }
        @keyframes float-up {
          0% { 
            transform: translateY(0px) scale(1);
            opacity: 1;
          }
          100% { 
            transform: translateY(-200px) scale(1.5);
            opacity: 0;
          }
        }
        @keyframes slide-left {
          0% { transform: translateX(100%); opacity: 0; }
          10% { transform: translateX(0); opacity: 1; }
          90% { transform: translateX(0); opacity: 1; }
          100% { transform: translateX(-100%); opacity: 0; }
        }
        @keyframes slide-up {
          0% { transform: translateY(100%); opacity: 0; }
          10% { transform: translateY(0); opacity: 1; }
          90% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(-100%); opacity: 0; }
        }
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        .animate-floating {
          animation: floating 5s ease-in-out infinite;
        }
        .animate-float-slow {
          animation: float-slow 4s ease-in-out infinite;
        }
        .animate-float-up {
          animation: float-up 4s ease-out infinite;
        }
        .animate-slide-left {
          animation: slide-left 8s ease-in-out infinite;
        }
        .animate-slide-up {
          animation: slide-up 6s ease-in-out infinite;
        }
        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
