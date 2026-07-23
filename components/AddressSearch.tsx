'use client';

import { useEffect, useRef, useState } from 'react';

interface DaumPostcodeData {
  zonecode: string;
  roadAddress: string;
  jibunAddress: string;
  buildingName: string;
  apartment: string;
  autoRoadAddress: string;
  autoJibunAddress: string;
}

interface Props {
  onComplete: (data: { zipCode: string; address: string }) => void;
  className?: string;
  children?: React.ReactNode;
}

declare global {
  interface Window {
    daum: any;
  }
}

const POSTCODE_SRC =
  'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';

// 스크립트를 한 번만 로드하고, 로드 완료를 Promise 로 공유 (여러 컴포넌트/재클릭 대비)
let postcodeLoadPromise: Promise<void> | null = null;
function loadPostcodeScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.daum?.Postcode) return Promise.resolve();
  if (postcodeLoadPromise) return postcodeLoadPromise;

  postcodeLoadPromise = new Promise<void>((resolve, reject) => {
    // 이미 삽입된 스크립트가 있으면 그것을 재사용
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${POSTCODE_SRC}"]`
    );
    if (existing) {
      if (window.daum?.Postcode) return resolve();
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('postcode load error')));
      return;
    }
    const script = document.createElement('script');
    script.src = POSTCODE_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      postcodeLoadPromise = null; // 실패 시 다음 클릭에서 재시도 허용
      reject(new Error('postcode load error'));
    };
    document.head.appendChild(script);
  });
  return postcodeLoadPromise;
}

export default function AddressSearch({ onComplete, className, children }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const embedRef = useRef<HTMLDivElement>(null);

  // 마운트 시 스크립트 미리 로드 (클릭 시점 지연/팝업차단 방지)
  useEffect(() => {
    loadPostcodeScript().catch(() => { /* 클릭 시 재시도 */ });
  }, []);

  // 레이어가 열리면 그 안에 우편번호 UI 를 embed (팝업이 아니라 화면 내 삽입 → 모바일 팝업차단 회피)
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        await loadPostcodeScript();
      } catch {
        if (!cancelled) {
          alert('주소 검색 서비스를 불러오지 못했습니다. 네트워크 상태를 확인 후 다시 시도해주세요.');
          setOpen(false);
          setLoading(false);
        }
        return;
      }
      if (cancelled || !embedRef.current || !window.daum?.Postcode) {
        setLoading(false);
        return;
      }

      // 컨테이너 초기화 후 embed
      embedRef.current.innerHTML = '';
      new window.daum.Postcode({
        oncomplete: (data: DaumPostcodeData) => {
          const address = data.roadAddress || data.jibunAddress;
          const extraAddr = data.buildingName ? ` (${data.buildingName})` : '';
          onComplete({
            zipCode: data.zonecode,
            address: address + extraAddr,
          });
          setOpen(false);
        },
        onclose: () => {
          // 사용자가 내부 X 로 닫는 경우
          setOpen(false);
        },
        width: '100%',
        height: '100%',
      }).embed(embedRef.current, { autoClose: true });

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, onComplete]);

  // 레이어 열려있는 동안 body 스크롤 잠금 (모바일에서 배경 스크롤 방지)
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ||
          'px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 transition whitespace-nowrap'
        }
      >
        {children || '🔍 주소 검색'}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/50"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden"
            style={{ height: '80vh', maxHeight: '600px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <span className="font-semibold text-gray-800">주소 검색</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="닫기"
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 text-xl leading-none"
              >
                ×
              </button>
            </div>

            {loading && (
              <div className="absolute inset-0 top-[49px] flex items-center justify-center text-gray-500 text-sm bg-white">
                주소 검색을 불러오는 중...
              </div>
            )}

            {/* 다음 우편번호 UI 가 이 안에 embed 됨 */}
            <div ref={embedRef} className="w-full" style={{ height: 'calc(100% - 49px)' }} />
          </div>
        </div>
      )}
    </>
  );
}
