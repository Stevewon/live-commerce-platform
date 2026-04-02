'use client';

import { useState, useEffect, useCallback } from 'react';

interface Review {
  id: string;
  rating: number;
  content: string;
  createdAt: string;
  user?: {
    name?: string;
  } | null;
  product?: {
    name: string;
    slug: string;
    thumbnail: string;
  };
}

interface ProductReviewsProps {
  productId: string;
  initialReviews?: Review[];
}

export default function ProductReviews({ productId, initialReviews }: ProductReviewsProps) {
  // Safely ensure initialReviews is always an array
  const safeInitial = Array.isArray(initialReviews) ? initialReviews : [];
  const [reviews, setReviews] = useState<Review[]>(safeInitial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rating, setRating] = useState({ average: 0, count: 0 });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadReviews = useCallback(async () => {
    try {
      setError('');
      const response = await fetch(`/api/reviews?productId=${productId}&limit=10&page=${page}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const result = await response.json();

      if (result.success) {
        // API returns data as array directly
        const reviewList = Array.isArray(result.data) ? result.data : [];
        setReviews(reviewList);
        
        // Calculate rating from reviews
        if (reviewList.length > 0) {
          const total = result.pagination?.total || reviewList.length;
          const avg = reviewList.reduce((sum: number, r: Review) => sum + (r.rating || 0), 0) / reviewList.length;
          setRating({ average: avg, count: total });
        } else {
          setRating({ average: 0, count: result.pagination?.total || 0 });
        }
        
        if (result.pagination) {
          setTotalPages(result.pagination.totalPages || 1);
        }
      }
    } catch (err) {
      console.error('Review load error:', err);
      setError('리뷰를 불러오는 중 오류가 발생했습니다.');
      // Fall back to initialReviews if API fails
      if (safeInitial.length > 0 && reviews.length === 0) {
        setReviews(safeInitial);
      }
    } finally {
      setLoading(false);
    }
  }, [productId, page]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const renderStars = (r: number) => {
    const full = Math.round(r);
    return '★'.repeat(full) + '☆'.repeat(5 - full);
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
        <p className="text-gray-500 text-sm">리뷰를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-6">상품 리뷰</h2>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={loadReviews}
            className="mt-2 text-sm text-red-500 hover:text-red-700 underline"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* Rating summary */}
      {rating.count > 0 && (
        <div className="mb-6 p-5 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-100">
          <div className="flex items-center gap-4">
            <div className="text-4xl font-black text-blue-600">
              {rating.average.toFixed(1)}
            </div>
            <div>
              <div className="text-xl text-yellow-500">{renderStars(rating.average)}</div>
              <div className="text-sm text-gray-600 mt-1">
                {rating.count}개의 리뷰
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Review list */}
      {reviews.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <span className="text-5xl block mb-4">📝</span>
          <p className="text-lg font-medium text-gray-500 mb-2">아직 리뷰가 없습니다</p>
          <p className="text-sm">첫 번째 리뷰를 작성해보세요!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="border border-gray-100 rounded-xl p-5 hover:border-blue-200 transition">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">
                    {(review.user?.name || '익명').charAt(0)}
                  </div>
                  <span className="font-medium text-gray-900">{review.user?.name || '익명'}</span>
                  <span className="text-yellow-500 text-sm">{renderStars(review.rating || 0)}</span>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(review.createdAt).toLocaleDateString('ko-KR')}
                </span>
              </div>
              <p className="text-gray-700 text-sm leading-relaxed">{review.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 border rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
          >
            이전
          </button>
          <span className="px-4 py-2 text-sm font-medium text-gray-600">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 border rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
