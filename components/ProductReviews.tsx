'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { authFetch } from '@/lib/auth/clientFetch';
import ReviewForm from '@/components/ReviewForm';

interface Review {
  id: string;
  rating: number;
  content: string;
  createdAt: string;
  images?: string[] | string | null;
  user?: {
    name?: string;
  } | null;
  product?: {
    name: string;
    slug: string;
    thumbnail: string;
  };
}

// images 값(배열 or JSON 문자열 or null)을 문자열 URL 배열로 정규화
function toImageArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((u) => typeof u === 'string');
  if (typeof raw === 'string' && raw.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((u) => typeof u === 'string') : [];
    } catch {
      return [];
    }
  }
  return [];
}

interface ProductReviewsProps {
  productId: string;
  productName?: string;
  initialReviews?: Review[];
}

export default function ProductReviews({ productId, productName, initialReviews }: ProductReviewsProps) {
  const router = useRouter();
  const { user } = useAuth();
  // 리뷰 작성 자격/폼 상태
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [eligibleOrderId, setEligibleOrderId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState('');

  // "이 상품 리뷰 쓸 자격" 판별: 로그인 + 이 상품 포함 + 배송완료 + 아직 리뷰 안 쓴 주문 찾기
  const startWriteReview = useCallback(async () => {
    setNotice('');

    if (!user) {
      setNotice('리뷰를 작성하려면 로그인이 필요합니다.');
      setTimeout(() => {
        router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      }, 900);
      return;
    }

    try {
      setCheckingEligibility(true);
      const res = await authFetch('/api/orders');
      const data = await res.json();
      const orders: any[] = Array.isArray(data?.data) ? data.data : [];

      // 이 상품이 담긴 배송완료 주문 중, 아직 리뷰를 쓰지 않은 주문
      const target = orders.find((o) =>
        String(o.status).toUpperCase() === 'DELIVERED' &&
        !o.review &&
        Array.isArray(o.items) &&
        o.items.some((it: any) => it.productId === productId)
      );

      if (target) {
        setEligibleOrderId(target.id);
        setShowForm(true);
        return;
      }

      // 자격 없음 → 사유별 안내
      const hasThisProduct = orders.some((o) =>
        Array.isArray(o.items) && o.items.some((it: any) => it.productId === productId)
      );
      const alreadyReviewed = orders.some((o) =>
        o.review && Array.isArray(o.items) && o.items.some((it: any) => it.productId === productId)
      );

      if (alreadyReviewed) {
        setNotice('이미 이 상품에 리뷰를 작성하셨습니다. 감사합니다!');
      } else if (hasThisProduct) {
        setNotice('배송이 완료된 후에 리뷰를 작성하실 수 있습니다.');
      } else {
        setNotice('구매하고 배송이 완료된 상품만 리뷰를 작성할 수 있습니다.');
      }
    } catch (err) {
      console.error('리뷰 자격 확인 실패:', err);
      setNotice('리뷰 작성 자격을 확인하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setCheckingEligibility(false);
    }
  }, [user, productId, router]);

  return <ProductReviewsInner
    productId={productId}
    productName={productName}
    initialReviews={initialReviews}
    startWriteReview={startWriteReview}
    checkingEligibility={checkingEligibility}
    notice={notice}
    showForm={showForm}
    eligibleOrderId={eligibleOrderId}
    onFormClose={() => setShowForm(false)}
  />;
}

interface InnerProps extends ProductReviewsProps {
  startWriteReview: () => void;
  checkingEligibility: boolean;
  notice: string;
  showForm: boolean;
  eligibleOrderId: string | null;
  onFormClose: () => void;
}

function ProductReviewsInner({
  productId,
  productName,
  initialReviews,
  startWriteReview,
  checkingEligibility,
  notice,
  showForm,
  eligibleOrderId,
  onFormClose,
}: InnerProps) {
  // Safely ensure initialReviews is always an array
  const safeInitial = Array.isArray(initialReviews) ? initialReviews : [];
  const [reviews, setReviews] = useState<Review[]>(safeInitial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rating, setRating] = useState({ average: 0, count: 0 });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [lightbox, setLightbox] = useState<string | null>(null);

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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-900">상품 리뷰</h2>
        <button
          onClick={startWriteReview}
          disabled={checkingEligibility}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-white bg-gradient-to-br from-purple-500 to-indigo-500 shadow-md shadow-purple-500/30 transition-all hover:shadow-lg hover:brightness-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {checkingEligibility ? (
            <>
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              확인 중...
            </>
          ) : (
            <>✍️ 리뷰 작성</>
          )}
        </button>
      </div>

      {/* 리뷰 작성 자격 안내 */}
      {notice && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-700">{notice}</p>
        </div>
      )}

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
          <p className="text-sm mb-5">첫 번째 리뷰를 작성해보세요!</p>
          <button
            onClick={startWriteReview}
            disabled={checkingEligibility}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-semibold text-white bg-gradient-to-br from-purple-500 to-indigo-500 shadow-md shadow-purple-500/30 transition-all hover:shadow-lg hover:brightness-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {checkingEligibility ? '확인 중...' : '✍️ 리뷰 작성하기'}
          </button>
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

              {/* 첨부 사진 */}
              {(() => {
                const imgs = toImageArray(review.images);
                if (imgs.length === 0) return null;
                return (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {imgs.map((url, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setLightbox(url)}
                        className="w-20 h-20 rounded-lg overflow-hidden border border-gray-200 hover:opacity-90 transition"
                        aria-label={`리뷰 사진 ${i + 1} 크게 보기`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`리뷰 사진 ${i + 1}`} loading="lazy" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}

      {/* 사진 확대 라이트박스 */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="리뷰 사진 확대"
            className="max-w-full max-h-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/20 text-white text-xl hover:bg-white/30"
            aria-label="닫기"
          >
            ✕
          </button>
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

      {/* 리뷰 작성 모달 */}
      {showForm && eligibleOrderId && (
        <ReviewForm
          orderId={eligibleOrderId}
          productId={productId}
          productName={productName || '상품'}
          onSuccess={() => {
            onFormClose();
            setPage(1);
            loadReviews();
          }}
          onCancel={onFormClose}
        />
      )}
    </div>
  );
}
