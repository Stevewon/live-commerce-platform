'use client';

import { useState } from 'react';

interface CouponData {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: string;
  value: number;
  minAmount: number | null;
  maxDiscount: number | null;
  discountAmount: number;
}

interface Props {
  totalAmount: number;
  onApply: (coupon: CouponData | null) => void;
  appliedCoupon: CouponData | null;
}

export default function CouponInput({ totalAmount, onApply, appliedCoupon }: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleApply = async () => {
    if (!code.trim()) {
      setError('쿠폰 코드를 입력해주세요.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/coupons/validate?code=${encodeURIComponent(code.trim())}&amount=${totalAmount}`);
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || '유효하지 않은 쿠폰입니다.');
        return;
      }

      if (data.success && data.data) {
        onApply(data.data);
        setError('');
      }
    } catch (err) {
      setError('쿠폰 확인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = () => {
    onApply(null);
    setCode('');
    setError('');
  };

  if (appliedCoupon) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-green-600 font-bold text-sm">🎉 쿠폰 적용됨</span>
              <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded font-medium">
                {appliedCoupon.code}
              </span>
            </div>
            <p className="text-sm text-green-700 mt-1">{appliedCoupon.name}</p>
            <p className="text-lg font-bold text-green-700 mt-1">
              -₩{appliedCoupon.discountAmount.toLocaleString()} 할인
            </p>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="text-sm text-red-500 hover:text-red-700 font-medium px-3 py-1 rounded hover:bg-red-50 transition"
          >
            제거
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">🎫 쿠폰 할인</h3>
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="쿠폰 코드 입력"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleApply(); } }}
        />
        <button
          type="button"
          onClick={handleApply}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition whitespace-nowrap"
        >
          {loading ? '확인중...' : '적용'}
        </button>
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      <p className="text-xs text-gray-400 mt-1">쿠폰 코드가 있다면 입력해주세요.</p>
    </div>
  );
}
