'use client';

import { Suspense, useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

/**
 * [2026-05-13 v1.0.20] PC iframe / 모바일 페이지이동 디바이스 분기 (KISPG 공식 가이드 준수)
 *
 * 사고 배경 (증상 #3 — 사장님 PC 결제창 "확인" 무반응 사고):
 *   - v1.0.16~v1.0.19 까지 PC/모바일 모두 form.target='_self' 페이지 이동 방식 사용
 *   - KIS정보통신 PG운영실 공식 회신 (2026-05-13):
 *     "PC: iframe 방식 / 모바일: 페이지 이동 방식" — 우리는 PC 도 모바일 방식으로 진행함
 *   - 결과: PC 결제 다이얼로그 "확인" 버튼 클릭 시 postMessage 수신자 없음 → 무반응
 *
 * 해결 (v1.0.20 — KISPG 공식 paySample.jsp 구조 준수):
 *   1) 디바이스 판별: User-Agent 모바일 키워드 OR viewport width < 768px → 모바일 모드
 *   2) PC 모드:
 *      - mask + window + iframe(name="pay_frame") DOM 생성
 *      - form.target = 'pay_frame' 로 KISPG /v2/auth 호출
 *      - window.addEventListener('message', returnData) 로 KISPG 인증결과 수신
 *      - resultCode '0000' → 동적 form 생성 → returnUrl 로 POST submit (페이지 이동)
 *      - resultCode 'XXXX' 또는 사용자 취소 → mask/iframe hide
 *   3) 모바일 모드 (기존 v1.0.16 유지):
 *      - form.target = '_self' 페이지 이동 방식
 *
 * 폴링/타임아웃 로직은 v1.0.16 그대로 유지 (5초 간격, 5분 타임아웃, escalate=1)
 *
 * URL 파라미터:
 *   - orderId (필수): 결제 대기 중인 주문 ID
 *   - orderNumber (선택): 표시용 주문번호
 *   - guestToken (선택): 비회원 주문 토큰
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

  // ★ [2026-05-13 v1.0.20] PC iframe 모달 표시 상태
  const [showPcModal, setShowPcModal] = useState(false);
  const [isPcMode, setIsPcMode] = useState(false);

  // KISPG form 자동 submit (autoSubmit=kispg) — PC/모바일 분기
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

      // ★ [v1.0.20] 디바이스 판별 — KISPG 공식 가이드 준수
      //   - User-Agent 모바일 키워드 OR viewport width < 768px → 모바일 모드
      //   - 그 외 → PC 모드 (iframe 방식)
      const ua = navigator.userAgent || '';
      const isMobileUA = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|Windows Phone|Opera Mini|IEMobile/i.test(ua);
      const isSmallScreen = typeof window !== 'undefined' && window.innerWidth < 768;
      const isMobile = isMobileUA || isSmallScreen;
      const pcMode = !isMobile;
      setIsPcMode(pcMode);

      console.log('[PaymentWaiting v1.0.20] 디바이스 판별:', {
        ua: ua.substring(0, 80),
        isMobileUA,
        isSmallScreen,
        viewportWidth: typeof window !== 'undefined' ? window.innerWidth : -1,
        finalMode: pcMode ? 'PC(iframe)' : 'MOBILE(self)',
      });

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = payload.authUrl;
      form.acceptCharset = 'utf-8';
      form.style.display = 'none';

      // ★ [v1.0.20 핵심] PC는 iframe 이름으로 target 지정 / 모바일은 _self
      form.target = pcMode ? 'kispg_pay_frame' : '_self';

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

      // PC 모드: iframe 모달 표시 후 submit
      // 모바일 모드: 즉시 페이지 이동 submit
      if (pcMode) {
        setShowPcModal(true);
        // iframe DOM 마운트 후 submit (React 렌더 사이클 대기)
        setTimeout(() => {
          try {
            form.submit();
          } catch (e) {
            console.error('[PaymentWaiting] PC iframe form.submit() 실패:', e);
          }
        }, 200);
      } else {
        // 모바일: 기존 100ms 딜레이 후 페이지 이동
        setTimeout(() => {
          try {
            form.submit();
          } catch (e) {
            console.error('[PaymentWaiting] 모바일 form.submit() 실패:', e);
          }
        }, 100);
      }
    } catch (e) {
      console.error('[PaymentWaiting] 자동 submit 처리 실패:', e);
    }
  }, [autoSubmit]);

  // ★ [2026-05-13 v1.0.20] KISPG postMessage 리스너 (PC iframe 결제창 ↔ 부모창 통신)
  //   KISPG 공식 paySample.jsp 의 returnData 함수 구조 그대로 준수
  //   - resultCode '0000' → 동적 form 생성하여 returnUrl 로 POST submit (페이지 이동)
  //   - resultCode 'XXXX' → 인증 실패 alert 후 iframe 닫기
  //   - 빈 객체/취소 → iframe 닫기 (사용자 X 클릭)
  useEffect(() => {
    if (!isPcMode) return;

    const returnData = (e: MessageEvent) => {
      try {
        if (!e?.data) return;
        const data: any = e.data;
        console.log('[PaymentWaiting v1.0.20] KISPG postMessage 수신:', JSON.stringify(data));

        // resultCode 있는 경우만 처리 (KISPG 공식 스펙)
        if (data && typeof data === 'object' && data.resultCode !== undefined) {
          if (data.resultCode === '0000' && data.data) {
            // 인증 성공 → returnUrl 로 POST submit
            const raw = sessionStorage.getItem('kispgFormDataReturnUrl');
            // payload 에서 returnUrl 추출 못한 경우 우리 기본 return 경로 사용
            let returnUrl = raw || `${window.location.origin}/api/payments/kispg/return`;
            // 동적 form 생성 (KISPG 공식 receive_result 구조)
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = returnUrl;
            form.acceptCharset = 'utf-8';
            form.style.display = 'none';
            form.target = '_self';
            Object.entries(data.data).forEach(([key, value]) => {
              const input = document.createElement('input');
              input.type = 'hidden';
              input.name = key;
              input.value = String(value);
              form.appendChild(input);
            });
            document.body.appendChild(form);
            setShowPcModal(false);
            form.submit();
          } else {
            // 인증 실패 — 사용자에게 알림 + iframe 닫기
            const resData: any = data.data || {};
            const resultCd = resData.resultCd || data.resultCode || '';
            const resultMsg = resData.resultMsg || '결제가 취소되었거나 실패했습니다';
            console.warn('[PaymentWaiting v1.0.20] KISPG 인증 실패:', resultCd, resultMsg);
            setShowPcModal(false);
            // 실패 alert 는 다음 tick 에 (모달 닫힘 후)
            setTimeout(() => {
              try {
                alert(`[${resultCd}] ${resultMsg}`);
              } catch {}
            }, 100);
          }
        }
      } catch (err) {
        console.error('[PaymentWaiting v1.0.20] postMessage 처리 실패:', err);
      }
    };

    window.addEventListener('message', returnData, false);
    return () => {
      window.removeEventListener('message', returnData, false);
    };
  }, [isPcMode]);

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

      {/* ★ [2026-05-13 v1.0.20] PC iframe 결제창 모달 — KISPG 공식 paySample.jsp 구조 준수
            - PC 디바이스 + autoSubmit=kispg 일 때만 표시
            - mask (검은 반투명 배경) + window (전체 화면) + iframe(name="kispg_pay_frame")
            - form.target = 'kispg_pay_frame' 으로 KISPG /v2/auth 호출
            - KISPG → parent.postMessage 로 인증결과 회신 → useEffect 의 returnData 리스너가 처리 */}
      {isPcMode && showPcModal && (
        <>
          <div
            style={{
              position: 'fixed',
              zIndex: 9000,
              backgroundColor: '#000',
              opacity: 0.6,
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
            }}
          />
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              zIndex: 10000,
            }}
          >
            <iframe
              id="kispg_pay_frame"
              name="kispg_pay_frame"
              src="about:blank"
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                background: 'white',
              }}
              marginWidth={0}
              marginHeight={0}
              frameBorder={0}
              scrolling="no"
            />
          </div>
        </>
      )}
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
