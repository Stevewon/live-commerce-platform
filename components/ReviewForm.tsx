'use client';

import { useState } from 'react';

interface ReviewFormProps {
  orderId: string;
  productId: string;
  productName: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function ReviewForm({ orderId, productId, productName, onSuccess, onCancel }: ReviewFormProps) {
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      setError('리뷰 내용을 입력해주세요');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const token = localStorage.getItem('token');
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          orderId,
          productId,
          rating,
          content
        })
      });

      const result = await response.json();

      if (result.success) {
        alert('리뷰가 작성되었습니다!');
        if (onSuccess) {
          onSuccess();
        }
      } else {
        setError(result.error || '리뷰 작성에 실패했습니다');
      }
    } catch (err) {
      console.error('리뷰 작성 실패:', err);
      setError('리뷰 작성 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
        <h2 className="text-2xl font-bold mb-4">리뷰 작성</h2>
        
        <div className="mb-4">
          <p className="text-sm text-gray-600">{productName}</p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* 별점 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              별점
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="text-3xl focus:outline-none transition-colors"
                >
                  {star <= rating ? '⭐' : '☆'}
                </button>
              ))}
            </div>
          </div>

          {/* 리뷰 내용 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              리뷰 내용
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              rows={5}
              placeholder="상품에 대한 솔직한 리뷰를 작성해주세요"
              required
            />
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '작성 중...' : '리뷰 작성'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 disabled:opacity-50 transition-colors"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
