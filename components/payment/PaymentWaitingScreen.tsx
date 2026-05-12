'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

/**
 * [2026-05-12 v1.0.15] 결제 대기 화면 폴링 컴포넌트
 *
 * 배경:
 *   - PC 에서 KISPG 결제창을 띄우면, 폰으로 결제 인증 후 returnUrl 응답이
 *     PC 브라우저로 자동 전달되지 않는 케이스가 있음
 *   - PC 사용자: "핸드폰 카드승인은 뜨는데 PC 결제완료 메시지가 안 뜸"
 *   - 취소 시도도 동일 (폰에서 취소해도 PC 가 멍함)
 *
 * 해결:
 *   - 결제 시작과 동시에 sessionStorage 에 pendingPaymentOrderId 마커 기록
 *   - 이 컴포넌트가 부모 컨텍스트(checkout 페이지)에서 마커 감지 → 폴링 시작
 *   - 5초 간격으로 /api/orders/status?orderId=... 호출
 *   - 5회(25초) 후에도 PENDING → escalate=1 로 KISPG 거래조회 자동 호출
 *   - 상태 변화 감지 즉시 결과 페이지로 자동 이동
 *   - 5분(60회) 타임아웃 → 주문 내역 페이지로 안내
 *
 * 모바일 영향 0건:
 *   - 모바일은 returnUrl 응답이 정상 도달 → 결제완료 페이지로 즉시 이동
 *   - PaymentWaitingScreen 은 잠시 떴다가 unmount (window navigation)
 *
 * sessionStorage 키:
 *   - pendingPaymentOrderId: 주문 ID
 *   - pendingPaymentOrderNumber: 주문 번호 (표시용)
 *   - pendingPaymentGuestToken: 비회원 토큰 (success 페이지 redirect 시 사용)
 *   - pendingPaymentStartedAt: 결제 시작 시각 ms (타임아웃 계산용)
 */

const POLL_INTERVAL_MS = 5000;        // 5초 간격
const ESCALATE_AFTER_POLLS = 5;       // 5회 = 25초 후부터 escalate=1
const MAX_POLLS = 60;                  // 60회 = 5분 타임아웃

interface PendingPayment {
  orderId: string;
  orderNumber: string;
  guestToken: string;
  startedAt: number;
}

function readPendingPayment(): PendingPayment | null {
  try {
    const orderId = sessionStorage.getItem('pendingPaymentOrderId') || '';
    const orderNumber = sessionStorage.getItem('pendingPaymentOrderNumber') || '';
    const guestToken = sessionStorage.getItem('pendingPaymentGuestToken') || '';
    const startedAtStr = sessionStorage.getItem('pendingPaymentStartedAt') || '';
    const startedAt = parseInt(startedAtStr) || 0;
    if (!orderId) return null;
    return { orderId, orderNumber, guestToken, startedAt };
  } catch {
    return null;
  }
}

function clearPendingPayment() {
  try {
    sessionStorage.removeItem('pendingPaymentOrderId');
    sessionStorage.removeItem('pendingPaymentOrderNumber');
    sessionStorage.removeItem('pendingPaymentGuestToken');
    sessionStorage.removeItem('pendingPaymentStartedAt');
  } catch {}
}

export default function PaymentWaitingScreen() {
  const router = useRouter();
  const [pending, setPending] = useState<PendingPayment | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const [statusText, setStatusText] = useState('결제창에서 결제를 진행해주세요...');
  const [timedOut, setTimedOut] = useState(false);
  const intervalRef = useRef<any>(null);
  const pollCountRef = useRef(0);
  const stoppedRef = useRef(false);

  // sessionStorage 마커 감지 후 폴링 시작
  useEffect(() => {
    const p = readPendingPayment();
    if (!p) return;
    setPending(p);
    pollCountRef.current = 0;
    stoppedRef.current = false;

    // 즉시 1회 호출 (결제창이 빠르게 닫힌 경우 대비)
    pollOnce(p);

    intervalRef.current = setInterval(() => {
      pollOnce(p);
    }, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 주문번호 변경 시 폴링 재시작 (페이지 내 결제 재시도 케이스)
  useEffect(() => {
    const onStorage = () => {
      const p = readPendingPayment();
      if (p && (!pending || p.orderId !== pending.orderId)) {
        setPending(p);
        pollCountRef.current = 0;
        stoppedRef.current = false;
        setTimedOut(false);
        setStatusText('결제창에서 결제를 진행해주세요...');
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => {
          pollOnce(p);
        }, POLL_INTERVAL_MS);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const stopPolling = useCallback(() => {
    stoppedRef.current = true;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const goSuccess = useCallback((p: PendingPayment) => {
    stopPolling();
    clearPendingPayment();
    const url = new URL('/payment/success', window.location.origin);
    url.searchParams.set('orderId', p.orderId);
    if (p.orderNumber) url.searchParams.set('orderNumber', p.orderNumber);
    if (p.guestToken) url.searchParams.set('guestToken', p.guestToken);
    window.location.replace(url.toString());
  }, [stopPolling]);

  const goFail = useCallback((p: PendingPayment, reason?: string) => {
    stopPolling();
    clearPendingPayment();
    const url = new URL('/payment/fail', window.location.origin);
    url.searchParams.set('orderId', p.orderId);
    url.searchParams.set('code', 'CANCELLED');
    url.searchParams.set('message', reason || '결제가 취소되었습니다');
    if (p.guestToken) url.searchParams.set('guestToken', p.guestToken);
    window.location.replace(url.toString());
  }, [stopPolling]);

  const pollOnce = useCallback(async (p: PendingPayment) => {
    if (stoppedRef.current) return;
    pollCountRef.current += 1;
    const currentPoll = pollCountRef.current;
    setPollCount(currentPoll);

    // 타임아웃 체크
    if (currentPoll > MAX_POLLS) {
      stopPolling();
      setTimedOut(true);
      setStatusText('결제 결과 확인 중입니다. 잠시 후 주문내역을 확인해주세요.');
      return;
    }

    // ESCALATE_AFTER_POLLS 회 이후부터 KISPG 거래조회 자동 호출
    const useEscalate = currentPoll > ESCALATE_AFTER_POLLS;

    try {
      const url = `/api/orders/status?orderId=${encodeURIComponent(p.orderId)}${useEscalate ? '&escalate=1' : ''}`;
      const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) {
        if (res.status === 404) {
          stopPolling();
          setStatusText('주문 정보를 찾을 수 없습니다. 주문 내역을 확인해주세요.');
          return;
        }
        return; // 일시적 오류 — 다음 폴링에서 재시도
      }
      const data: any = await res.json().catch(() => ({}));
      if (!data?.success || !data?.data) return;

      const status: string = data.data.status;

      if (data.data.isPaid || status === 'CONFIRMED' || status === 'SHIPPING' || status === 'DELIVERED') {
        setStatusText('결제 확인 완료! 잠시만요...');
        goSuccess(p);
        return;
      }
      if (data.data.isCancelled || status === 'CANCELLED') {
        const reason: string = data.data.cancelReason || '결제가 취소되었습니다';
        setStatusText(`결제가 취소되었습니다: ${reason}`);
        goFail(p, reason);
        return;
      }

      // PENDING 유지 — 상태 메시지 단계별 갱신
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
      // 네트워크 오류 — 다음 폴링에서 재시도
      console.warn('[PaymentWaitingScreen] poll error:', err?.message || err);
    }
  }, [goSuccess, goFail, stopPolling]);

  if (!pending) return null;

  const elapsedSec = Math.floor((Date.now() - pending.startedAt) / 1000);
  const remainingSec = Math.max(0, (MAX_POLLS * POLL_INTERVAL_MS / 1000) - elapsedSec);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.78)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: 20,
          padding: '32px 28px',
          maxWidth: 440,
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          textAlign: 'center',
        }}
      >
        {!timedOut ? (
          <>
            <div
              style={{
                width: 56,
                height: 56,
                margin: '0 auto 18px',
                border: '4px solid #e5e7eb',
                borderTopColor: '#3b82f6',
                borderRadius: '50%',
                animation: 'qrlive-spin 1s linear infinite',
              }}
            />
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', margin: '0 0 10px' }}>
              결제 진행 중입니다
            </h2>
            <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, margin: '0 0 16px' }}>
              {statusText}
            </p>
            <div
              style={{
                background: '#f1f5f9',
                borderRadius: 12,
                padding: '12px 16px',
                fontSize: 13,
                color: '#475569',
                marginBottom: 12,
                textAlign: 'left',
              }}
            >
              <div><strong>주문번호:</strong> {pending.orderNumber || '-'}</div>
              <div style={{ marginTop: 4 }}>
                <strong>경과:</strong> {elapsedSec}초 · <strong>자동 확인까지:</strong> 약 {remainingSec}초
              </div>
            </div>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 14px', lineHeight: 1.5 }}>
              결제창에서 결제 완료/취소를 하시면 이 화면이 자동으로 결과 페이지로 이동합니다.<br />
              PC 사용자는 휴대폰에서 결제 인증을 마치셔도 이 화면이 자동 갱신됩니다.
            </p>
            <button
              onClick={() => {
                if (window.confirm('결제 진행을 중단하고 주문내역으로 이동하시겠습니까?\n\n(결제가 이미 완료됐다면 주문내역에서 확인 가능)')) {
                  clearPendingPayment();
                  if (intervalRef.current) clearInterval(intervalRef.current);
                  router.push('/orders');
                }
              }}
              style={{
                background: 'transparent',
                color: '#64748b',
                border: '1px solid #cbd5e1',
                borderRadius: 10,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              주문내역으로 이동
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 56, marginBottom: 14 }}>⏱️</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', margin: '0 0 10px' }}>
              결제 결과 확인 중
            </h2>
            <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, margin: '0 0 18px' }}>
              {statusText}<br />
              결제가 완료된 경우 잠시 후 자동으로 처리됩니다.<br />
              주문내역에서 상태를 확인하실 수 있습니다.
            </p>
            <button
              onClick={() => {
                clearPendingPayment();
                router.push('/orders');
              }}
              style={{
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 10,
                padding: '12px 24px',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              주문내역으로 이동
            </button>
          </>
        )}
      </div>
      <style>{`@keyframes qrlive-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
