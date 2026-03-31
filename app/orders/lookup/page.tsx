'use client';

import { useState } from 'react';
import Link from 'next/link';
import ShopNavigation from '@/components/ShopNavigation';

interface OrderItem {
  product: { name: string; thumbnail: string; price: number };
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  orderNumber: string;
  total: number;
  subtotal: number;
  shippingFee: number;
  discount: number;
  status: string;
  shippingName: string;
  shippingPhone: string;
  shippingAddress: string;
  createdAt: string;
  paidAt: string | null;
  items: OrderItem[];
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING: { label: '결제 대기', color: 'bg-yellow-100 text-yellow-800' },
  CONFIRMED: { label: '결제 완료', color: 'bg-blue-100 text-blue-800' },
  SHIPPING: { label: '배송 중', color: 'bg-purple-100 text-purple-800' },
  DELIVERED: { label: '배송 완료', color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: '취소됨', color: 'bg-red-100 text-red-800' },
  REFUNDED: { label: '환불됨', color: 'bg-gray-100 text-gray-800' },
};

export default function OrderLookupPage() {
  const [orderNumber, setOrderNumber] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [lookupType, setLookupType] = useState<'phone' | 'email'>('phone');
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  // 저장된 비회원 토큰으로 자동 조회 시도
  const handleAutoLookup = async () => {
    const token = localStorage.getItem('guestOrderToken');
    const savedOrderNumber = localStorage.getItem('guestOrderNumber');
    
    if (token && savedOrderNumber) {
      setOrderNumber(savedOrderNumber);
      try {
        setLoading(true);
        setError('');
        const res = await fetch(`/api/orders?guestToken=${token}&orderNumber=${savedOrderNumber}`);
        const data = await res.json();
        
        if (data.success && data.data?.length > 0) {
          setOrder(data.data[0]);
          setSearched(true);
        }
      } catch (err) {
        console.error('Auto lookup failed:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!orderNumber.trim()) {
      setError('주문번호를 입력해주세요');
      return;
    }
    if (!contactInfo.trim()) {
      setError('연락처 또는 이메일을 입력해주세요');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setOrder(null);
      setSearched(true);

      const params = new URLSearchParams({ orderNumber: orderNumber.trim() });
      if (lookupType === 'phone') {
        params.set('guestPhone', contactInfo.trim());
      } else {
        params.set('guestEmail', contactInfo.trim());
      }

      const res = await fetch(`/api/orders?${params.toString()}`);
      const data = await res.json();

      if (data.success && data.data?.length > 0) {
        setOrder(data.data[0]);
      } else {
        setError(data.error || '주문을 찾을 수 없습니다. 주문번호와 연락처를 확인해주세요.');
      }
    } catch (err) {
      setError('조회 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-16 md:pb-0">
      <ShopNavigation />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">비회원 주문 조회</h1>
          <p className="text-gray-600">주문번호와 연락처로 주문 상태를 확인하세요</p>
        </div>

        {/* 자동 조회 버튼 */}
        {typeof window !== 'undefined' && localStorage.getItem('guestOrderToken') && !searched && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-center">
            <p className="text-sm text-blue-700 mb-3">최근 비회원 주문이 있습니다</p>
            <button
              onClick={handleAutoLookup}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition text-sm"
            >
              최근 주문 자동 조회
            </button>
          </div>
        )}

        {/* 검색 폼 */}
        {!order && (
          <form onSubmit={handleSearch} className="bg-white rounded-xl shadow-sm border p-6 mb-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">주문번호</label>
                <input
                  type="text"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="ORD-1234567890123"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">조회 방법</label>
                <div className="flex gap-3 mb-3">
                  <button
                    type="button"
                    onClick={() => { setLookupType('phone'); setContactInfo(''); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                      lookupType === 'phone' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    연락처로 조회
                  </button>
                  <button
                    type="button"
                    onClick={() => { setLookupType('email'); setContactInfo(''); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                      lookupType === 'email' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    이메일로 조회
                  </button>
                </div>
                <input
                  type={lookupType === 'email' ? 'email' : 'tel'}
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                  placeholder={lookupType === 'phone' ? '010-0000-0000' : 'example@email.com'}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  required
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 transition"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    조회 중...
                  </span>
                ) : (
                  '주문 조회하기'
                )}
              </button>
            </div>
          </form>
        )}

        {/* 주문 결과 */}
        {order && (
          <div className="space-y-4">
            {/* 주문 상태 */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-500">주문번호</p>
                  <p className="font-bold text-gray-900 text-lg">{order.orderNumber}</p>
                </div>
                <span className={`px-4 py-2 rounded-full text-sm font-bold ${STATUS_MAP[order.status]?.color || 'bg-gray-100 text-gray-800'}`}>
                  {STATUS_MAP[order.status]?.label || order.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">주문일시</p>
                  <p className="font-medium text-gray-900">{new Date(order.createdAt).toLocaleString('ko-KR')}</p>
                </div>
                {order.paidAt && (
                  <div>
                    <p className="text-gray-500">결제일시</p>
                    <p className="font-medium text-gray-900">{new Date(order.paidAt).toLocaleString('ko-KR')}</p>
                  </div>
                )}
              </div>
            </div>

            {/* 주문 상품 */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="font-bold text-gray-900 mb-4">주문 상품</h3>
              <div className="space-y-3">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex gap-3">
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                      <img
                        src={item.product.thumbnail}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 line-clamp-1">{item.product.name}</p>
                      <p className="text-sm text-gray-500">₩{item.price.toLocaleString()} x {item.quantity}개</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-gray-900">₩{(item.price * item.quantity).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t mt-4 pt-4 space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>상품 금액</span>
                  <span>₩{order.subtotal.toLocaleString()}</span>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>할인</span>
                    <span>-₩{order.discount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-600">
                  <span>배송비</span>
                  <span>{order.shippingFee === 0 ? '무료' : `₩${order.shippingFee.toLocaleString()}`}</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t">
                  <span>총 결제금액</span>
                  <span className="text-blue-600">₩{order.total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* 배송 정보 */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="font-bold text-gray-900 mb-4">배송 정보</h3>
              <div className="space-y-2 text-sm">
                <div className="flex">
                  <span className="w-20 text-gray-500 flex-shrink-0">받는 분</span>
                  <span className="text-gray-900">{order.shippingName}</span>
                </div>
                <div className="flex">
                  <span className="w-20 text-gray-500 flex-shrink-0">연락처</span>
                  <span className="text-gray-900">{order.shippingPhone}</span>
                </div>
                <div className="flex">
                  <span className="w-20 text-gray-500 flex-shrink-0">주소</span>
                  <span className="text-gray-900">{order.shippingAddress}</span>
                </div>
              </div>
            </div>

            {/* 다시 검색 */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => { setOrder(null); setSearched(false); setError(''); }}
                className="flex-1 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50 transition"
              >
                다른 주문 조회
              </button>
              <Link
                href="/products"
                className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold text-center hover:bg-blue-700 transition"
              >
                쇼핑 계속하기
              </Link>
            </div>
          </div>
        )}

        {/* 회원 안내 */}
        <div className="mt-8 bg-gray-100 rounded-xl p-6 text-center">
          <p className="text-gray-600 mb-3">회원가입하면 주문 내역을 더 편리하게 관리할 수 있어요</p>
          <div className="flex justify-center gap-3">
            <Link 
              href="/login" 
              className="px-6 py-2 bg-white border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 transition"
            >
              로그인
            </Link>
            <Link 
              href="/register" 
              className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition"
            >
              회원가입
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
