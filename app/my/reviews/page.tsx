'use client';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Review {
  id: string;
  rating: number;
  content: string;
  images: string | null;
  createdAt: string;
  product: {
    id: string;
    name: string;
    slug: string;
    thumbnail: string;
  };
}

export default function MyReviewsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user) fetchReviews();
  }, [user, authLoading]);

  const fetchReviews = async () => {
    try {
      const token = localStorage.getItem('auth-token');
      const res = await fetch('/api/reviews?my=true', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setReviews(data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const deleteReview = async (id: string) => {
    if (!confirm('리뷰를 삭제하시겠습니까?')) return;
    try {
      const token = localStorage.getItem('auth-token');
      const res = await fetch(`/api/reviews/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setReviews(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

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
        <h1 className="text-2xl font-bold">내 리뷰</h1>
        <Link href="/my" className="text-sm text-gray-500 hover:text-gray-700">← 마이페이지</Link>
      </div>

      {reviews.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-lg">
          <p className="text-gray-500 mb-4">작성한 리뷰가 없습니다</p>
          <Link href="/my/orders" className="text-blue-600 hover:underline">주문 내역에서 리뷰 작성하기</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="bg-white border rounded-lg p-4 shadow-sm">
              <div className="flex items-start gap-4">
                {review.product?.thumbnail && (
                  <img src={review.product.thumbnail} alt={review.product.name} className="w-16 h-16 rounded object-cover" />
                )}
                <div className="flex-1">
                  <Link href={`/products/${review.product?.slug}`} className="font-medium hover:text-blue-600">
                    {review.product?.name}
                  </Link>
                  <div className="flex items-center gap-1 mt-1">
                    {[1,2,3,4,5].map(s => (
                      <span key={s} className={s <= review.rating ? 'text-yellow-400' : 'text-gray-300'}>★</span>
                    ))}
                  </div>
                  <p className="text-gray-700 mt-2 text-sm">{review.content}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-400">{new Date(review.createdAt).toLocaleDateString('ko-KR')}</span>
                    <button onClick={() => deleteReview(review.id)} className="text-xs text-red-500 hover:underline">삭제</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
