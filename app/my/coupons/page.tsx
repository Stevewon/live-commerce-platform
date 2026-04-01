'use client';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Coupon {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: string;
  value: number;
  minAmount: number | null;
  maxDiscount: number | null;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
}

export default function MyCouponsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [couponCode, setCouponCode] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user) fetchCoupons();
  }, [user, authLoading]);

  const fetchCoupons = async () => {
    try {
      const token = localStorage.getItem('auth-token');
      const res = await fetch('/api/coupons', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setCoupons(data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const registerCoupon = async () => {
    if (!couponCode.trim()) return;
    setMessage('');
    try {
      const token = localStorage.getItem('auth-token');
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: couponCode }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage('쿠폰이 등록되었습니다!');
        setCouponCode('');
        fetchCoupons();
      } else {
        setMessage(data.error || '유효하지 않은 쿠폰입니다');
      }
    } catch (e) {
      setMessage('쿠폰 등록에 실패했습니다');
    }
  };

  const formatDiscount = (coupon: Coupon) => {
    if (coupon.type === 'PERCENT') return `${coupon.value}% 할인`;
    if (coupon.type === 'FREE_SHIPPING') return '무료배송';
    return `${coupon.value.toLocaleString()}원 할인`;
  };

  const isExpired = (date: string) => new Date(date) < new Date();

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">내 쿠폰</h1>
        <Link href="/my" className="text-sm text-gray-500 hover:text-gray-700">← 마이페이지</Link>
      </div>

      {/* 쿠폰 등록 */}
      <div className="bg-white border rounded-lg p-4 mb-6 flex gap-2">
        <input
          type="text"
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value)}
          placeholder="쿠폰 코드를 입력하세요"
          className="flex-1 border rounded px-3 py-2 text-sm"
        />
        <button onClick={registerCoupon} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">등록</button>
      </div>
      {message && <p className={`text-sm mb-4 ${message.includes('등록') ? 'text-green-600' : 'text-red-500'}`}>{message}</p>}

      {coupons.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-lg">
          <p className="text-gray-500">보유한 쿠폰이 없습니다</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {coupons.map((coupon) => {
            const expired = isExpired(coupon.validUntil);
            return (
              <div key={coupon.id} className={`border rounded-lg p-4 ${expired ? 'bg-gray-100 opacity-60' : 'bg-white'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-bold text-blue-600">{formatDiscount(coupon)}</span>
                  {expired && <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded">만료</span>}
                </div>
                <p className="font-medium text-sm">{coupon.name}</p>
                {coupon.description && <p className="text-xs text-gray-500 mt-1">{coupon.description}</p>}
                {coupon.minAmount && <p className="text-xs text-gray-400 mt-1">{coupon.minAmount.toLocaleString()}원 이상 구매 시</p>}
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(coupon.validFrom).toLocaleDateString('ko-KR')} ~ {new Date(coupon.validUntil).toLocaleDateString('ko-KR')}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
