'use client';

import { Suspense, useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

/**
 * [2026-05-12 v1.0.16] 결제 대기 전용 페이지 — 폴링 아키텍처 재설계
 *
 * 배경 (v1.0.15 폴링 화면 실패 사고):
 *   - v1.0.15 에서 PaymentWaitingScreen 을 checkout 페이지에 마운트했으나,
 *     form.submit() 후 페이지 전체가 KISPG 결제창으로 전환되며 checkout DOM 통째로 unmount
 *     → PaymentWaitingScreen 영구 사라짐 → 사장님 PC 결제완료 미표시 사고 재발
 *
 * 해결 (v1.0.16):
 *   - 결제 시작 → /payment/waiting 페이지로 먼저 이동 → KISPG form 자동 submit
 *   - KISPG 결제창에서 returnUrl 정상이면: /payment/success 또는 /payment/fail 로 이동
 *   - KISPG 결제창에서 returnUrl 안 와도: /payment/waiting 페이지는 그대로 유지
 *     (PC 브라우저는 결제창 완료 후 자체 페이지가 살아있음)
 *   - 5초 간격 폴링 → 5회(25초) 이후 escalate=1 → KISPG /v2/order 자동 호출
 *   - 5분(60회) 타임아웃 → 주문내역 안내
 *
 * 모바일 영향 0건:
 *   - 모바일은 KISPG returnUrl 정상 → success/fail 로 즉시 이동 → waiting 페이지 unmount
 *   - 폴링은 PC 브라우저에서 결제창 닫힌 후 살아있는 시점에만 동작
 *
 * URL 파라미터:
 *   - orderId (필수): 결제 대기 중인 주문 ID
 *   - orderNumber (선택): 표시용 주문번호
 *   - guestToken (선택): 비회원 주문 토큰 (success 페이지로 redirect 시 전달)
 *   - autoSubmit (선택): 'kispg' 이면 sessionStorage.kispgFormData 로 form 자동 submit
 */

const POLL_INTERVAL_MS = 5000;
const ESCALATE_AFTER_POLLS = 5;
const MAX_POLLS = 60;

function PaymentWaitingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId') || '';
  const orderNumber = searchParams.get('orderNumber') || '';
  const guestToken = searchParams.get('guestToken') || '';
  const autoSubmit = searchParams.get('autoSubmit') || '';

  const [pollCount, setPollCount] = useState(0);
  const [statusText, setStatusText] = useState('결제창에서 결제를 진행해주세요...');
  const [timedOut, setTimedOut] = useState(false);
  const [startedAt] = useState(() => Date.now());

  const intervalRef = useRef<any>(null);
  const pollCountRef = useRef(0);
  const stoppedRef = useRef(false);
  const submittedRef = useRef(false);

  // KISPG form 자동 submit (autoSubmit=kispg)
  useEffect(() => {
    if (autoSubmit !== 'kispg' || submittedRef.current) return;
    submittedRef.current = true;

    try {
      const raw = sessionStorage.getItem('kispgFormData');
      if (!raw) {
        console.warn('[PaymentWaiting] kispgFormData 없음 — 자동 submit 건너뜀');
        return;
      }
      const payload = JSON.parse(raw);
      if (!payload?.authUrl || !payload?.formData) {
        console.warn('[PaymentWaiting] kispgFormData 형식 오류');
        return;
      }

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = payload.authUrl;
      form.acceptCharset = 'utf-8';
      form.style.display = 'none';
      form.target = '_self';

      Object.entries(payload.formData).forEach(([key, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = String(value);
        form.appendChild(input);
      });

      document.body.appendChild(form);

      // sessionStorage 정리 (한 번만 사용)
      try {
        sessionStorage.removeItem('kispgFormData');
      } catch {}

      // 약간의 딜레이 후 submit (모바일 form submit 지연 방지)
      setTimeout(() => {
        try {
          form.submit();
        } catch (e) {
          console.error('[PaymentWaiting] form.submit() 실패:', e);
        }
      }, 100);
    } catch (e) {
      console.error('[PaymentWaiting] 자동 submit 처리 실패:', e);
    }
  }, [autoSubmit]);

  const stopPolling = useCallback(() => {
    stoppedRef.current = true;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const goSuccess = useCallback(() => {
    stopPolling();
    const url = new URL('/payment/success', window.location.origin);
    url.searchParams.set('orderId', orderId);
    if (orderNumber) url.searchParams.set('orderNumber', orderNumber);
    if (guestToken) url.searchParams.set('guestToken', guestToken);
    window.location.replace(url.toString());
  }, [orderId, orderNumber, guestToken, stopPolling]);

  const goFail = useCallback((reason?: string) => {
    stopPolling();
    const url = new URL('/payment/fail', window.location.origin);
    url.searchParams.set('orderId', orderId);
    url.searchParams.set('code', 'CANCELLED');
    url.searchParams.set('message', reason || '결제가 취소되었습니다');
    if (guestToken) url.searchParams.set('guestToken', guestToken);
    window.location.replace(url.toString());
  }, [orderId, guestToken, stopPolling]);

  const pollOnce = useCallback(async () => {
    if (stoppedRef.current || !orderId) return;
    pollCountRef.current += 1;
    const currentPoll = pollCountRef.current;
    setPollCount(currentPoll);

    if (currentPoll > MAX_POLLS) {
      stopPolling();
      setTimedOut(true);
      setStatusText('결제 결과 확인 중입니다. 잠시 후 주문내역을 확인해주세요.');
      return;
    }

    const useEscalate = currentPoll > ESCALATE_AFTER_POLLS;

    try {
      const url = `/api/orders/status?orderId=${encodeURIComponent(orderId)}${useEscalate ? '&escalate=1' : ''}`;
      const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) {
        if (res.status === 404) {
          stopPolling();
          setStatusText('주문 정보를 찾을 수 없습니다. 주문 내역을 확인해주세요.');
          return;
        }
        return;
      }
      const data: any = await res.json().catch(() => ({}));
      if (!data?.success || !data?.data) return;

      const status: string = data.data.status;

      if (data.data.isPaid || status === 'CONFIRMED' || status === 'SHIPPING' || status === 'DELIVERED') {
        setStatusText('결제 확인 완료! 잠시만요...');
        goSuccess();
        return;
      }
      if (data.data.isCancelled || status === 'CANCELLED') {
        const reason: string = data.data.cancelReason || '결제가 취소되었습니다';
        setStatusText(`결제가 취소되었습니다: ${reason}`);
        goFail(reason);
        return;
      }

      if (useEscalate) {
        if (data.escalate?.applied) {
          setStatusText('KISPG 결제 결과 확인 중...');
        } else if (data.escalate?.kind === 'UNKNOWN') {
          setStatusText('결제 진행 중... (KISPG 측 거래 확인 중)');
        } else if (data.escalate?.kind === 'INQUIRE_FAILED') {
          setStatusText('결제 결과 재확인 중... 잠시만요');
        } else {
          setStatusText('결제 결과 확인 중...');
        }
      } else {
        if (currentPoll <= 1) {
          setStatusText('결제창에서 결제를 진행해주세요...');
        } else {
          setStatusText('결제 진행 중... 결과를 자동으로 확인합니다');
        }
      }
    } catch (err: any) {
      console.warn('[PaymentWaiting] poll error:', err?.message || err);
    }
  }, [orderId, goSuccess, goFail, stopPolling]);

  // 폴링 시작
  useEffect(() => {
    if (!orderId) return;
    pollCountRef.current = 0;
    stoppedRef.current = false;

    // KISPG form 자동 submit 가 끝난 후 폴링 시작 (약간의 딜레이)
    const startDelay = autoSubmit === 'kispg' ? 3000 : 500;
    const startTimer = setTimeout(() => {
      pollOnce();
      intervalRef.current = setInterval(() => {
        pollOnce();
      }, POLL_INTERVAL_MS);
    }, startDelay);

    return () => {
      clearTimeout(startTimer);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // orderId 없는 경우
  if (!orderId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">잘못된 접근입니다</h1>
          <p className="text-sm text-gray-600 mb-6">주문 정보가 없습니다.</p>
          <Link
            href="/"
            className="inline-block bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const elapsedSec = Math.floor((Date.now() - startedAt) / 1000);
  const remainingSec = Math.max(0, (MAX_POLLS * POLL_INTERVAL_MS / 1000) - elapsedSec);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center px-4 py-8">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        {!timedOut ? (
          <div className="text-center">
            <div
              className="mx-auto mb-5"
              style={{
                width: 56,
                height: 56,
                border: '4px solid #e5e7eb',
                borderTopColor: '#3b82f6',
                borderRadius: '50%',
                animation: 'qrlive-spin 1s linear infinite',
              }}
            />
            <h1 className="text-xl font-extrabold text-slate-900 mb-3">
              결제 진행 중입니다
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              {statusText}
            </p>
            <div className="bg-slate-100 rounded-xl p-3 text-left text-sm text-slate-600 mb-3">
              <div><strong>주문번호:</strong> {orderNumber || '-'}</div>
              <div className="mt-1">
                <strong>경과:</strong> {elapsedSec}초 · <strong>자동 확인까지:</strong> 약 {remainingSec}초
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              결제창에서 결제 완료/취소를 하시면 이 화면이 자동으로 결과 페이지로 이동합니다.<br />
              PC 사용자는 휴대폰에서 결제 인증을 마치셔도 이 화면이 자동 갱신됩니다.
            </p>
            <button
              onClick={() => {
                if (window.confirm('결제 진행을 중단하고 주문내역으로 이동하시겠습니까?\n\n(결제가 이미 완료됐다면 주문내역에서 확인 가능)')) {
                  stopPolling();
                  router.push('/orders');
                }
              }}
              className="text-sm text-slate-500 hover:text-slate-700 border border-slate-300 rounded-lg px-4 py-2 font-medium"
            >
              주문내역으로 이동
            </button>
          </div>
        ) : (
          <div className="text-center">
            <div className="text-5xl mb-4">⏱️</div>
            <h1 className="text-xl font-extrabold text-slate-900 mb-3">
              결제 결과 확인 중
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed mb-5">
              {statusText}<br />
              결제가 완료된 경우 잠시 후 자동으로 처리됩니다.<br />
              주문내역에서 상태를 확인하실 수 있습니다.
            </p>
            <Link
              href="/orders"
              className="inline-block bg-blue-600 text-white font-bold px-6 py-3 rounded-lg hover:bg-blue-700"
            >
              주문내역으로 이동
            </Link>
          </div>
        )}
      </div>
      <style>{`@keyframes qrlive-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function PaymentWaitingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">결제 정보를 불러오는 중...</p>
          </div>
        </div>
      }
    >
      <PaymentWaitingContent />
    </Suspense>
  );
}
