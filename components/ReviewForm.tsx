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
      {/*
        모달 레이아웃 (핵심):
        - flex-col + max-h-[90vh] 로 전체 높이 제한
        - 헤더 = 고정, 본문(폼 내용) = 스크롤(flex-1 overflow-y-auto)
        - 하단 버튼 = footer 로 항상 하단 고정 → 사진을 몇 장 첨부하든
          파란 "리뷰 작성" 버튼이 절대 화면 밖으로 밀려나지 않는다.
      */}
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* 헤더 (고정) */}
        <div className="px-6 pt-6 pb-3 border-b border-gray-100 shrink-0">
          <h2 className="text-2xl font-bold">리뷰 작성</h2>
          <p className="text-sm text-gray-600 mt-1">{productName}</p>
        </div>

        {/* 본문 (스크롤) */}
        <form id="review-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4">
          {/* 별점 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">별점</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">리뷰 내용</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              rows={4}
              placeholder="상품에 대한 솔직한 리뷰를 작성해주세요"
              required
            />
          </div>

          {/* 사진 첨부 */}
          <div className="mb-2">
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
                /*
                  ★ 사진 첨부 버튼을 <label htmlFor> 방식으로 구현.
                  버튼 + JS input.click() 방식은 일부 브라우저/모바일에서
                  hidden(display:none) input 을 무시해 파일창이 안 뜨는 문제가 있다.
                  <label htmlFor="review-photo-input"> 은 브라우저 네이티브 동작으로
                  파일 선택창을 열기 때문에 JS 없이도 항상 확실하게 작동한다.
                */
                <label
                  htmlFor="review-photo-input"
                  className={`w-20 h-20 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:border-purple-400 hover:text-purple-500 transition cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  {uploading ? (
                    <span className="text-xs">업로드중</span>
                  ) : (
                    <>
                      <span className="text-2xl leading-none">＋</span>
                      <span className="text-[11px] mt-0.5">사진</span>
                    </>
                  )}
                </label>
              )}
            </div>

            {/*
              input 은 label(htmlFor) 로 트리거된다.
              - accept="image/*": 갤러리/카메라 모두 선택 가능
              - display:none 대신 sr-only 스타일: 일부 브라우저의 hidden input
                click 무시 이슈를 피하면서 화면에는 안 보이게 유지.
              - 서버(/api/reviews/upload)에서 최종 타입을 다시 검증하므로 안전.
            */}
            <input
              id="review-photo-input"
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFilesSelected}
              disabled={uploading}
              style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 }}
            />
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </form>

        {/* 하단 버튼 (항상 고정) */}
        <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex gap-3 bg-white">
          <button
            type="submit"
            form="review-form"
            disabled={loading || uploading}
            className="flex-1 bg-purple-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '작성 중...' : uploading ? '사진 업로드 중...' : '리뷰 작성'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 bg-gray-200 text-gray-700 py-3 px-4 rounded-lg font-semibold hover:bg-gray-300 disabled:opacity-50 transition-colors"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
