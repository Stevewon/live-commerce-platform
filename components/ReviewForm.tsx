'use client';

import { useState, useRef } from 'react';
import { authFetch } from '@/lib/auth/clientFetch';

interface ReviewFormProps {
  orderId: string;
  productId: string;
  productName: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const MAX_IMAGES = 5;

export default function ReviewForm({ orderId, productId, productName, onSuccess, onCancel }: ReviewFormProps) {
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    // 파일 input 초기화 (같은 파일 다시 선택 가능하게)
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (files.length === 0) return;

    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      setError(`사진은 최대 ${MAX_IMAGES}장까지 첨부할 수 있습니다`);
      return;
    }
    const targets = files.slice(0, remaining);

    setError('');
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of targets) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('orderId', orderId);
        formData.append('productId', productId);
        const res = await authFetch('/api/reviews/upload', {
          method: 'POST',
          body: formData,
        });
        const result = await res.json();
        if (result.success && result.data?.url) {
          uploaded.push(result.data.url as string);
        } else {
          setError(result.error || result.message || '사진 업로드에 실패했습니다');
        }
      }
      if (uploaded.length > 0) {
        setImages((prev) => [...prev, ...uploaded]);
      }
    } catch (err) {
      console.error('사진 업로드 실패:', err);
      setError('사진 업로드 중 오류가 발생했습니다');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      setError('리뷰 내용을 입력해주세요');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await authFetch('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({
          orderId,
          productId,
          rating,
          comment: content,
          images, // 문자열 URL 배열
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

  const canAddMore = images.length < MAX_IMAGES;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
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

          {/* 사진 첨부 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              사진 첨부 <span className="text-gray-400 font-normal">(선택 · 최대 {MAX_IMAGES}장)</span>
            </label>

            <div className="flex flex-wrap gap-2">
              {images.map((url, idx) => (
                <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`첨부 이미지 ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute top-0.5 right-0.5 w-5 h-5 flex items-center justify-center rounded-full bg-black/60 text-white text-xs hover:bg-black/80"
                    aria-label="사진 삭제"
                  >
                    ✕
                  </button>
                </div>
              ))}

              {canAddMore && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-20 h-20 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:border-purple-400 hover:text-purple-500 transition disabled:opacity-50"
                >
                  {uploading ? (
                    <span className="text-xs">업로드중</span>
                  ) : (
                    <>
                      <span className="text-2xl leading-none">＋</span>
                      <span className="text-[11px] mt-0.5">사진</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              multiple
              onChange={handleFilesSelected}
              className="hidden"
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
              disabled={loading || uploading}
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
