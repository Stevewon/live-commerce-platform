'use client';

import { useEffect, useState } from 'react';
import { authFetch } from '@/lib/auth/clientFetch';

interface TrackEvent {
  time: string | null;
  statusCode: string | null;
  statusName: string | null;
  description: string | null;
  location: string | null;
}

interface TrackingResponse {
  success: boolean;
  supported: boolean;
  error?: string;
  externalUrl?: string | null;
  carrierName?: string | null;
  trackingNumber?: string | null;
  from?: string | null;
  to?: string | null;
  events?: TrackEvent[];
}

interface Props {
  orderId: string;
  onClose: () => void;
}

function fmtTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 인앱 배송추적 모달 (모바일 최적화).
 * 외부 CJ대한통운 사이트로 나가지 않고 /api/orders/[id]/tracking 결과를
 * 세로 타임라인으로 표시. 미지원/실패 시 외부 링크 버튼으로 폴백.
 */
export default function TrackingModal({ orderId, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TrackingResponse | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await authFetch(`/api/orders/${orderId}/tracking`);
        const json = (await res.json().catch(() => null)) as TrackingResponse | null;
        if (alive) setData(json);
      } catch {
        if (alive) setData({ success: false, supported: true, error: '배송 정보를 불러오지 못했습니다.' });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [orderId]);

  const events = data?.events ?? [];
  const hasEvents = data?.success && events.length > 0;
  const externalUrl = data?.externalUrl || null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white rounded-t-2xl">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <span>🚚</span> 배송 조회
          </h3>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-4 flex-1">
          {/* 운송장 요약 */}
          {(data?.carrierName || data?.trackingNumber) && (
            <div className="mb-4 rounded-xl bg-gray-50 border border-gray-100 p-3 text-sm">
              <div className="flex justify-between py-0.5">
                <span className="text-gray-500">택배사</span>
                <span className="font-medium text-gray-900">{data?.carrierName || '-'}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-gray-500">운송장</span>
                <span className="font-mono font-medium text-gray-900">{data?.trackingNumber || '-'}</span>
              </div>
            </div>
          )}

          {loading && (
            <div className="py-12 flex flex-col items-center justify-center text-gray-400">
              <div className="w-8 h-8 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin mb-3" />
              <span className="text-sm">배송 정보를 불러오는 중…</span>
            </div>
          )}

          {/* 타임라인 */}
          {!loading && hasEvents && (
            <ol className="relative border-l-2 border-indigo-100 ml-2">
              {events.map((ev, i) => {
                const isLatest = i === 0;
                return (
                  <li key={i} className="mb-5 ml-4">
                    <span
                      className={`absolute -left-[9px] flex items-center justify-center w-4 h-4 rounded-full ring-4 ring-white ${
                        isLatest ? 'bg-indigo-600' : 'bg-indigo-200'
                      }`}
                    />
                    <div className="flex flex-col">
                      <span
                        className={`text-sm font-semibold ${
                          isLatest ? 'text-indigo-700' : 'text-gray-700'
                        }`}
                      >
                        {ev.statusName || ev.description || '배송 진행'}
                      </span>
                      {ev.location && (
                        <span className="text-xs text-gray-500 mt-0.5">📍 {ev.location}</span>
                      )}
                      {ev.description && ev.statusName && ev.description !== ev.statusName && (
                        <span className="text-xs text-gray-400 mt-0.5 break-words">{ev.description}</span>
                      )}
                      {ev.time && (
                        <span className="text-[11px] text-gray-400 mt-1">{fmtTime(ev.time)}</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {/* 실패/미지원 폴백 */}
          {!loading && !hasEvents && (
            <div className="py-8 flex flex-col items-center text-center">
              <span className="text-3xl mb-3">📦</span>
              <p className="text-sm text-gray-600 mb-1">
                {data?.error || '아직 배송 정보가 등록되지 않았습니다.'}
              </p>
              {externalUrl && (
                <a
                  href={externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
                >
                  택배사 사이트에서 조회
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>
          )}

          {/* 성공했어도 외부 링크는 하단에 보조 제공 */}
          {!loading && hasEvents && externalUrl && (
            <div className="pt-2 mt-2 border-t border-gray-100">
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-500 hover:text-indigo-700 underline"
              >
                택배사 사이트에서 원본 보기
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
