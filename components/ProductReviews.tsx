'use client';

import { useState, useEffect } from 'react';

interface Review {
  id: string;
  rating: number;
  content: string;
  createdAt: string;
  user: {
    name: string;
  };
}

interface ProductReviewsProps {
  productId: string;
}

export default function ProductReviews({ productId }: ProductReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState({ average: 0, count: 0 });

  useEffect(() => {
    loadReviews();
  }, [productId]);

  const loadReviews = async () => {
    try {
      const response = await fetch(`/api/reviews?productId=${productId}&limit=5`);
      const result = await response.json();

      if (result.success) {
        setReviews(result.data.reviews);
        if (result.data.rating) {
          setRating(result.data.rating);
        }
      }
    } catch (error) {
      console.error('리뷰 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number) => {
    return '⭐'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
  };

  if (loading) {
    return <div className="text-center py-8">로딩 중...</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-6">상품 리뷰</h2>

      {/* 평점 요약 */}
      {rating.count > 0 && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold text-purple-600">
              {rating.average.toFixed(1)}
            </div>
            <div>
              <div className="text-2xl">{renderStars(rating.average)}</div>
              <div className="text-sm text-gray-600 mt-1">
                {rating.count}개의 리뷰
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 리뷰 목록 */}
      {reviews.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          아직 리뷰가 없습니다. 첫 리뷰를 작성해보세요!
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="border-b border-gray-200 pb-4 last:border-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{review.user.name}</span>
                  <span className="text-yellow-500">{renderStars(review.rating)}</span>
                </div>
                <span className="text-sm text-gray-500">
                  {new Date(review.createdAt).toLocaleDateString('ko-KR')}
                </span>
              </div>
              <p className="text-gray-700">{review.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
