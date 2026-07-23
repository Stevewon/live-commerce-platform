'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import ShopNavigation from '@/components/ShopNavigation';
import { authFetch } from '@/lib/auth/clientFetch';
import { proxyImg, thumbUrl } from '@/lib/utils/imgProxy';

interface RecentOrder {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
  items: Array<{
    id: string;
    quantity: number;
    product: { name: string; thumbnail: string };
  }>;
}

export default function MyPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { t, locale } = useLanguage();
  const [orderCount, setOrderCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // [v1.0.22] 잔액 + QTA 적립
  const [balance, setBalance] = useState<{ krwBalance: number; qkeyBalance: number; qtaBalance: number } | null>(null);
  // 퀀타리움 지갑주소
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // 인증 게이트 - 로그인 안 한 사용자는 로그인 페이지로 리다이렉트
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login?redirect=/my');
    }
  }, [user, authLoading, router]);

  // 서버에서 주문/위시리스트 데이터 로드
  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    loadData();
  }, [user, authLoading]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 주문 내역 서버 조회
      const ordersRes = await authFetch('/api/orders');
      if (ordersRes.ok) {
        const data = await ordersRes.json();
        const orders = data.orders || data.data?.orders || [];
        setOrderCount(orders.length);
        setRecentOrders(orders.slice(0, 3));
      }

      // 위시리스트 서버 조회
      const wishlistRes = await authFetch('/api/wishlist');
      if (wishlistRes.ok) {
        const data = await wishlistRes.json();
        const items = data.data || [];
        setWishlistCount(items.length);
      }

      // [v1.0.22] 잔액 조회 (KRW/QKEY/QTA + 퀀타리움 지갑주소)
      const balanceRes = await authFetch('/api/my/balance');
      if (balanceRes.ok) {
        const data = await balanceRes.json();
        if (data.success && data.data) {
          setBalance({
            krwBalance: Number(data.data.krwBalance) || 0,
            qkeyBalance: Number(data.data.qkeyBalance) || 0,
            qtaBalance: Number(data.data.qtaBalance) || 0,
          });
          if (data.data.quantariumWallet) {
            setWalletAddress(String(data.data.quantariumWallet));
          }
        }
      }
    } catch (error) {
      console.error('마이페이지 데이터 로드 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: { [key: string]: string } = {
      PENDING: t.myPage.statusPending,
      CONFIRMED: t.myPage.statusConfirmed,
      SHIPPING: t.myPage.statusShipping,
      SHIPPED: t.myPage.statusShipping,
      DELIVERED: t.myPage.statusDelivered,
      CANCELLED: t.myPage.statusCancelled,
      REFUNDED: t.myPage.statusCancelled,
    };
    return statusMap[status?.toUpperCase()] || status;
  };

  const getStatusColor = (status: string) => {
    const colorMap: { [key: string]: string } = {
      PENDING: 'text-yellow-700 bg-yellow-100',
      CONFIRMED: 'text-blue-700 bg-blue-100',
      SHIPPING: 'text-purple-700 bg-purple-100',
      SHIPPED: 'text-purple-700 bg-purple-100',
      DELIVERED: 'text-green-700 bg-green-100',
      CANCELLED: 'text-red-700 bg-red-100',
      REFUNDED: 'text-red-700 bg-red-100',
    };
    return colorMap[status?.toUpperCase()] || 'text-gray-700 bg-gray-100';
  };

  const getDateLocale = () => {
    const localeMap: Record<string, string> = {
      ko: 'ko-KR', en: 'en-US', vi: 'vi-VN', th: 'th-TH', ja: 'ja-JP', zh: 'zh-CN',
    };
    return localeMap[locale] || 'ko-KR';
  };

  // 퀀타리움 지갑주소 복사
  const handleCopyWallet = async () => {
    if (!walletAddress) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(walletAddress);
      } else {
        // 폴백: 임시 input 사용
        const el = document.createElement('textarea');
        el.value = walletAddress;
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('지갑주소 복사 실패:', e);
    }
  };

  // 인증 로딩 중 또는 인증 안된 상태 → 로딩 스피너 (리다이렉트 진행 중)
  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500 text-base">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16 md:pb-0">
      <ShopNavigation />

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-6xl">
        {/* Page Title */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
            👤 {t.myPage.title}
          </h1>
          <p className="text-gray-500 text-sm sm:text-base lg:text-lg">
            {user.name || user.nickname || ''}{t.myPage.subtitle ? ` · ${t.myPage.subtitle}` : ''}
          </p>
        </div>

        {/* [v1.0.22] 잔액 배너 */}
        <div className="mb-6 sm:mb-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl sm:rounded-2xl p-5 sm:p-7 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl sm:text-3xl">💰</span>
              <h2 className="text-lg sm:text-xl font-bold">내 잔액</h2>
            </div>
            <Link
              href="/my/balance"
              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-white/20 hover:bg-white/30 rounded-lg text-xs sm:text-sm font-semibold transition backdrop-blur"
            >
              충전 / 내역 →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <div className="text-xs sm:text-sm text-blue-100 mb-1">KRW 잔액</div>
              <div className="text-2xl sm:text-3xl font-bold">
                {isLoading ? '...' : `₩${(balance?.krwBalance ?? 0).toLocaleString()}`}
              </div>
            </div>
            <div>
              <div className="text-xs sm:text-sm text-blue-100 mb-1">QKEY 잔액</div>
              <div className="text-2xl sm:text-3xl font-bold">
                {isLoading ? '...' : `${(balance?.qkeyBalance ?? 0).toLocaleString()} QKEY`}
              </div>
              {!isLoading && (
                <div className="text-xs text-blue-100 mt-0.5">≈ ₩{((balance?.qkeyBalance ?? 0) * 10).toLocaleString()}</div>
              )}
            </div>
            <div>
              <div className="text-xs sm:text-sm text-blue-100 mb-1">🎁 QTA 적립</div>
              <div className="text-2xl sm:text-3xl font-bold">
                {isLoading ? '...' : `${(balance?.qtaBalance ?? 0).toLocaleString()} QTA`}
              </div>
              {!isLoading && (
                <div className="text-xs text-blue-100 mt-0.5">≈ ₩{((balance?.qtaBalance ?? 0) * 100).toLocaleString()}</div>
              )}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-white/20 text-xs text-blue-100">
            구매금액의 5%가 QTA로 적립됩니다 (100원 = 1 QTA)
          </div>
        </div>

        {/* 퀀타리움 지갑주소 (항상 표시 + 복사) */}
        <div className="mb-6 sm:mb-8 bg-white border border-gray-200 rounded-xl sm:rounded-2xl p-5 sm:p-7 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl sm:text-2xl">🔐</span>
            <h2 className="text-base sm:text-lg font-bold text-gray-900">퀀타리움 지갑주소</h2>
          </div>
          {walletAddress ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-lg px-3 sm:px-4 py-3 font-mono text-xs sm:text-sm text-gray-800 break-all">
                {walletAddress}
              </div>
              <button
                onClick={handleCopyWallet}
                className={`flex-shrink-0 inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-3 rounded-lg font-semibold text-sm transition ${
                  copied
                    ? 'bg-green-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
                title="지갑주소 복사"
              >
                {copied ? (
                  <>
                    <span>✓</span>
                    <span>복사됨</span>
                  </>
                ) : (
                  <>
                    <span>📋</span>
                    <span>복사</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              {isLoading ? '불러오는 중...' : '등록된 지갑주소가 없습니다.'}
            </div>
          )}
        </div>

        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12">
          {/* Order History */}
          <Link href="/my-orders" className="group">
            <div className="bg-white border border-gray-200 rounded-xl sm:rounded-2xl p-6 sm:p-8 hover:border-blue-500 hover:shadow-lg transition-all">
              <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">📦</div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition">
                {t.myPage.orderHistory}
              </h2>
              <p className="text-gray-500 mb-3 sm:mb-4 text-sm sm:text-base">{t.myPage.orderHistoryDesc}</p>
              <div className="text-3xl sm:text-4xl font-bold text-blue-600">
                {isLoading ? '...' : `${orderCount}${t.common.items}`}
              </div>
            </div>
          </Link>

          {/* Wishlist */}
          <Link href="/wishlist" className="group">
            <div className="bg-white border border-gray-200 rounded-xl sm:rounded-2xl p-6 sm:p-8 hover:border-pink-500 hover:shadow-lg transition-all">
              <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">💖</div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 group-hover:text-pink-600 transition">
                {t.myPage.wishlist}
              </h2>
              <p className="text-gray-500 mb-3 sm:mb-4 text-sm sm:text-base">{t.myPage.wishlistDesc}</p>
              <div className="text-3xl sm:text-4xl font-bold text-pink-600">
                {isLoading ? '...' : `${wishlistCount}${t.common.items}`}
              </div>
            </div>
          </Link>

          {/* Member Info */}
          <Link href="/my/profile" className="group sm:col-span-2 md:col-span-1">
            <div className="bg-white border border-gray-200 rounded-xl sm:rounded-2xl p-6 sm:p-8 hover:border-purple-500 hover:shadow-lg transition-all">
              <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">⚙️</div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 group-hover:text-purple-600 transition">
                {t.myPage.memberInfo}
              </h2>
              <p className="text-gray-500 mb-3 sm:mb-4 text-sm sm:text-base">{t.myPage.memberInfoDesc}</p>
              <div className="text-base sm:text-lg font-semibold text-purple-600">{t.myPage.settings} →</div>
            </div>
          </Link>

          {/* QRChat 지갑 연결 (QKEY 결제) */}
          <Link href="/my/link-qrchat" className="group">
            <div className="bg-white border border-gray-200 rounded-xl sm:rounded-2xl p-6 sm:p-8 hover:border-amber-500 hover:shadow-lg transition-all">
              <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">🍪</div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 group-hover:text-amber-600 transition">
                QRChat 지갑 연결
              </h2>
              <p className="text-gray-500 mb-3 sm:mb-4 text-sm sm:text-base">
                QRChat 쿠키(QKEY)로 결제하기
              </p>
              <div className="text-base sm:text-lg font-semibold text-amber-600">연결하기 →</div>
            </div>
          </Link>
        </div>

        {/* Recent Orders */}
        <div className="mb-8 sm:mb-12">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{t.myPage.recentOrders}</h2>
            <Link href="/my-orders" className="text-blue-600 hover:text-blue-700 transition text-xs sm:text-sm font-semibold">
              {t.myPage.viewAll} →
            </Link>
          </div>

          {isLoading ? (
            <div className="bg-white rounded-xl sm:rounded-2xl p-8 sm:p-12 text-center border border-gray-200">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="bg-white rounded-xl sm:rounded-2xl p-8 sm:p-12 text-center border border-gray-200">
              <div className="text-5xl sm:text-6xl mb-3 sm:mb-4">📦</div>
              <p className="text-gray-500 text-base sm:text-lg mb-3 sm:mb-4">{t.myPage.noOrders}</p>
              <Link
                href="/products"
                className="inline-block px-5 sm:px-6 py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition text-sm sm:text-base"
              >
                {t.myPage.goShopping}
              </Link>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {recentOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/my-orders/${order.id}`}
                  className="block bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-gray-200 hover:border-blue-500 hover:shadow-md transition-all"
                >
                  <div className="flex flex-col sm:flex-row items-start justify-between mb-3 sm:mb-4 gap-2 sm:gap-0">
                    <div>
                      <div className="text-xs sm:text-sm text-gray-500 mb-1">
                        {t.myPage.orderNumber}: {order.orderNumber}
                      </div>
                      <div className="text-xs sm:text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString(getDateLocale(), {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </div>
                    </div>
                    <div className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold ${getStatusColor(order.status)}`}>
                      {getStatusText(order.status)}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4 overflow-x-auto">
                    {(order.items || []).slice(0, 3).map((item, idx: number) => (
                      <div key={item.id || idx} className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                        <img
                          src={thumbUrl(item.product?.thumbnail, 200)}
                          alt={item.product?.name || ''}
                          loading="lazy"
                          width={80}
                          height={80}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center text-2xl">📦</div>';
                          }}
                        />
                      </div>
                    ))}
                    {(order.items?.length || 0) > 3 && (
                      <div className="text-gray-500 text-xs sm:text-sm flex-shrink-0">
                        {t.myPage.andMore} {(order.items?.length || 0) - 3}{t.myPage.moreItems}
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="text-gray-500 text-xs sm:text-sm">{t.myPage.totalPayment}: </span>
                    <span className="text-lg sm:text-xl font-bold text-blue-600">
                      ₩{(order.total || 0).toLocaleString()}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Link
            href="/my-orders"
            className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 text-center hover:border-blue-500 hover:shadow-md transition group"
          >
            <div className="text-3xl sm:text-4xl mb-1 sm:mb-2">📦</div>
            <div className="text-xs sm:text-sm font-semibold text-gray-700 group-hover:text-blue-600 transition">
              {t.myPage.allOrders}
            </div>
          </Link>
          <Link
            href="/wishlist"
            className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 text-center hover:border-pink-500 hover:shadow-md transition group"
          >
            <div className="text-3xl sm:text-4xl mb-1 sm:mb-2">💖</div>
            <div className="text-xs sm:text-sm font-semibold text-gray-700 group-hover:text-pink-600 transition">
              {t.myPage.wishedProducts}
            </div>
          </Link>
          <Link
            href="/my/profile"
            className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 text-center hover:border-purple-500 hover:shadow-md transition group"
          >
            <div className="text-3xl sm:text-4xl mb-1 sm:mb-2">⚙️</div>
            <div className="text-xs sm:text-sm font-semibold text-gray-700 group-hover:text-purple-600 transition">
              {t.myPage.myInfo}
            </div>
          </Link>
          <Link
            href="/products"
            className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 text-center hover:border-green-500 hover:shadow-md transition group"
          >
            <div className="text-3xl sm:text-4xl mb-1 sm:mb-2">🛍️</div>
            <div className="text-xs sm:text-sm font-semibold text-gray-700 group-hover:text-green-600 transition">
              {t.myPage.goShop}
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
