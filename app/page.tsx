'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'

export default function HomePage() {
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Navigation */}
      <nav className={`fixed w-full z-50 transition-all duration-300 ${
        scrollY > 50 ? 'bg-gray-900/95 backdrop-blur-lg shadow-lg' : 'bg-transparent'
      }`}>
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">L</span>
              </div>
              <span className="text-white text-xl font-bold">Live Commerce</span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-300 hover:text-white transition">기능</a>
              <a href="#how" className="text-gray-300 hover:text-white transition">시작하기</a>
              <a href="#platforms" className="text-gray-300 hover:text-white transition">플랫폼</a>
              <Link 
                href="/partner/login" 
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
              >
                로그인
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 -left-4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
            <div className="absolute top-0 -right-4 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-8 left-20 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
          </div>
        </div>

        <div className="relative container mx-auto px-6 py-32 text-center">
          <div className="max-w-5xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center space-x-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-2 mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              <span className="text-blue-400 text-sm font-medium">6개 라이브 플랫폼 지원</span>
            </div>

            {/* Main Heading */}
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-extrabold text-white mb-8 leading-tight">
              라이브 방송으로
              <br />
              <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                수익을 창출
              </span>
              하세요
            </h1>

            <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed">
              스트리머를 위한 분양형 쇼핑몰. 구독자를 고객으로 전환하고,
              <br className="hidden md:block" />
              실시간으로 수익을 확인하세요.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
              <Link 
                href="/partner/register"
                className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-lg font-semibold rounded-xl hover:shadow-2xl hover:shadow-blue-500/50 transition-all duration-300 transform hover:-translate-y-1"
              >
                <span className="relative z-10">무료로 시작하기</span>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity blur"></div>
              </Link>
              <Link 
                href="/partner/login"
                className="px-8 py-4 bg-white/10 backdrop-blur-lg text-white text-lg font-semibold rounded-xl border border-white/20 hover:bg-white/20 transition-all duration-300"
              >
                파트너 로그인
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto">
              <div className="text-center">
                <div className="text-4xl font-bold text-white mb-2">30%</div>
                <div className="text-gray-400 text-sm">파트너 수수료</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-white mb-2">100+</div>
                <div className="text-gray-400 text-sm">판매 가능 제품</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-white mb-2">24/7</div>
                <div className="text-gray-400 text-sm">실시간 지원</div>
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
              { name: 'YouTube', icon: '🎥', color: 'from-red-500 to-red-600' },
              { name: 'AfreecaTV', icon: '📺', color: 'from-blue-500 to-blue-600' },
              { name: 'Instagram', icon: '📷', color: 'from-pink-500 to-purple-600' },
              { name: 'TikTok', icon: '🎵', color: 'from-black to-gray-800' },
              { name: 'Naver', icon: '🟢', color: 'from-green-500 to-green-600' },
              { name: 'Coupang', icon: '🛍️', color: 'from-yellow-500 to-orange-600' }
            ].map((platform) => (
              <div key={platform.name} className="group">
                <div className="bg-gray-700/50 backdrop-blur-lg p-8 rounded-2xl border border-gray-600 hover:border-blue-500 transition-all duration-300 transform hover:-translate-y-2 hover:shadow-xl">
                  <div className="text-5xl mb-4 text-center transform group-hover:scale-110 transition-transform">
                    {platform.icon}
                  </div>
                  <div className="text-white text-center font-semibold">{platform.name}</div>
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
            <h2 className="text-5xl font-bold text-white mb-6">
              왜 Live Commerce인가?
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
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
                  <div className="text-6xl mb-6 transform group-hover:scale-110 transition-transform">
                    {feature.icon}
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4">
                    {feature.title}
                  </h3>
                  <p className="text-gray-400 leading-relaxed">
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
            <h2 className="text-5xl font-bold text-white mb-6">
              시작하는 방법
            </h2>
            <p className="text-xl text-gray-400">
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
              <h4 className="text-white font-bold mb-4">지원</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><Link href="/docs" className="hover:text-white transition">문서</Link></li>
                <li><Link href="/contact" className="hover:text-white transition">문의하기</Link></li>
                <li><Link href="/faq" className="hover:text-white transition">FAQ</Link></li>
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
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  )
}
