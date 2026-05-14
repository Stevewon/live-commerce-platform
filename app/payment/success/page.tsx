'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { clearGuestCart } from '@/lib/utils/guestCart';
import { authFetch } from '@/lib/auth/clientFetch';

/**
 * [2026-05-12 v1.0.17 HOTFIX] PC 카드결제 후 흰 창 + "오류가 발생했습니다" 사고
 *
 * 사고 증상:
 *   - 사장님 PC 에서 결제 완료 → /payment/success 진입 → 흰 창 + "오류가 발생했습니다" (app/error.tsx)
 *   - 결제는 정상 처리됐지만 화면이 깨짐
 *
 * 원인 추적:
 *   1. useEffect 안에서 alert() / router.push() 즉시 호출 — hydration 중 throw 가능
 *   2. localStorage / sessionStorage / clearGuestCart 호출이 try-catch 없거나 일부만 보호됨
 *   3. sync API 응답 키 미스매치: 서버 `{ok: true, ...}` 인데 클라이언트 `data.success` 체크 → 항상 false →
 *      3회 재시도 모두 false 판정 → "동기화 지연" 경고를 항상 노출 (실제는 성공)
 *   4. orderInfo?.amount?.toLocaleString() 같은 chain 이 amount NaN 일 때 throw 가능
 *
 * 패치:
 *   1. useEffect 전체를 try-catch 로 감싸서 throw 가 global error.tsx 로 전파되지 않도록 차단
 *   2. 모든 storage / browser API 접근에 typeof window 가드 + try-catch
 *   3. orderId 없는 경우 alert/router.push 대신 안전한 fallback UI (즉시 종료 안 함)
 *   4. sync API 응답 검증을 `ok || success` 둘 다 허용 (호환 패치)
 *   5. amount/orderNumber 안전 변환 + parseInt NaN 가드
 *   6. ErrorBoundary 패턴: handleKispgSuccess / fetchOrderInfo 둘 다 throw 0건 보장
 */
function PaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [orderInfo, setOrderInfo] = useState<any>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'retrying' | 'failed'>('idle');
  const [fatalError, setFatalError] = useState<string | null>(null);

  // KISPG 결제 완료 후 파라미터 (모든 접근에 안전 가드)
  const orderId = safeGet(searchParams, 'orderId');
  const orderNumber = safeGet(searchParams, 'orderNumber');
  const amount = safeGet(searchParams, 'amount');
  const tid = safeGet(searchParams, 'tid');
  const payMethod = safeGet(searchParams, 'payMethod');
  const appNo = safeGet(searchParams, 'appNo');

  useEffect(() => {
    // ★ [HOTFIX v1.0.17] useEffect 전체 try-catch — 어떤 throw 도 global error.tsx 로 전파 금지
    // ★ [HOTFIX v1.0.18 2026-05-13] 증상 1 (PC 결제완료 메세지 안뜸) 추측 방어 패치:
    //   - 기존: orderId 없으면 즉시 fatalError → "주문 정보가 없습니다" 안내 화면 노출
    //   - 문제: KISPG return 핸들러가 일부 경로(이미 결제 완료 / 시스템 에러 후 재확인 / GET redirect)
    //           에서 orderNumber/tid 는 정상 전달되나 orderId 가 누락되는 케이스 보고 가능성
    //           → 사장님 입장에서는 "결제는 됐는데 완료 메세지 안 뜸"으로 인식
    //   - 패치: orderId/tid/orderNumber 셋 다 없을 때만 fatalError, 하나라도 있으면 완료 화면 표시
    //          (tid 또는 orderNumber 만 있어도 KISPG 결제 정상 완료로 판단)
    try {
      // sessionStorage cleanup (브라우저 환경 가드)
      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage.removeItem('kispgFormData');
        } catch {}
      }

      // ★ v1.0.18: fatalError 조건 완화 — orderId/tid/orderNumber 모두 없을 때만
      if (!orderId && !tid && !orderNumber) {
        setFatalError('주문 정보가 없습니다');
        setIsLoading(false);
        return;
      }

      // KISPG 결제: tid 또는 orderNumber 있으면 URL 파라미터 기반 즉시 표시 (orderId 없어도 OK)
      if (tid || orderNumber) {
        handleKispgSuccess().catch((e) => {
          console.error('[Success] handleKispgSuccess unhandled:', e);
          setIsLoading(false);
        });
      } else if (orderId) {
        // orderId 만 있고 tid/orderNumber 없는 경우 → DB 직접 조회
        fetchOrderInfo().catch((e) => {
          console.error('[Success] fetchOrderInfo unhandled:', e);
          setIsLoading(false);
        });
      } else {
        // 도달 불가능한 분기 (위에서 모두 걸러짐) — 안전망
        setIsLoading(false);
      }
    } catch (e) {
      console.error('[Success] useEffect 예외 차단:', e);
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // KISPG 결제 성공 처리 (모든 단계 try-catch)
  const handleKispgSuccess = async () => {
    try {
      // 비회원 판별: URL param guestToken 우선 → localStorage 폴백 (각 단계 try-catch)
      let urlGuestToken = '';
      let localGuestToken = '';
      try {
        urlGuestToken = safeGet(searchParams, 'guestToken');
      } catch {}
      try {
        if (typeof window !== 'undefined') {
          localGuestToken = window.localStorage.getItem('guestOrderToken') || '';
        }
      } catch {}
      const guestToken = urlGuestToken || localGuestToken;
      setIsGuest(!!guestToken);

      // 안전한 숫자 변환
      const safeAmount = (() => {
        try {
          const n = amount ? parseInt(amount, 10) : 0;
          return Number.isFinite(n) ? n : 0;
        } catch {
          return 0;
        }
      })();

      setOrderInfo({
        orderNumber: orderNumber || '',
        amount: safeAmount,
        paymentKey: tid || '',
        method: payMethodToKorean(payMethod || 'card'),
        appNo: appNo || '',
      });

      setIsLoading(false);

      // paymentKey sync — 비동기, 실패해도 화면에 영향 없음
      if (orderId && tid) {
        runSyncWithRetry({
          orderId,
          tid,
          payMethod: payMethod || 'card',
          appNo: appNo || '',
          amount: safeAmount,
        }).catch((e) => console.error('[Success] runSyncWithRetry unhandled:', e));
      }

      // 장바구니 비우기 (실패 무시)
      try {
        if (guestToken) {
          clearGuestCart();
        } else {
          await authFetch('/api/cart', { method: 'DELETE' }).catch(() => {});
        }
      } catch (e) {
        console.error('[Success] cart clear 실패 (무시):', e);
      }
    } catch (error: any) {
      console.error('[Success] handleKispgSuccess error:', error);
      // throw 하지 않고 화면 표시 진행 (가능한 데이터로 fallback)
      setOrderInfo((prev: any) => prev || {
        orderNumber: orderNumber || '',
        amount: 0,
        paymentKey: tid || '',
        method: '카드',
        appNo: '',
      });
      setIsLoading(false);
    }
  };

  // paymentKey sync 공격적 재시도 (응답 키 호환 패치)
  const runSyncWithRetry = async (payload: {
    orderId: string;
    tid: string;
    payMethod: string;
    appNo: string;
    amount: number;
  }) => {
    const MAX_ATTEMPTS = 3;
    const RETRY_DELAY_MS = 3000;

    // ★ [v1.0.21] 재시도해도 절대 성공 못 하는 응답(401/404/400 등 4xx) → 즉시 중단
    // 5xx 또는 network 예외만 재시도 (3회) — 불필요한 콘솔 에러 노이즈 + 9초 지연 제거
    let fatalStop = false;

    const attemptSync = async (attempt: number): Promise<boolean> => {
      try {
        setSyncStatus(attempt === 1 ? 'syncing' : 'retrying');
        const res = await authFetch('/api/payments/kispg/sync', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          console.error(`[sync] HTTP ${res.status} — attempt ${attempt}/${MAX_ATTEMPTS}`);
          // 4xx: 클라이언트 측 명확한 실패 — 재시도 의미 없음, 즉시 중단
          if (res.status >= 400 && res.status < 500) {
            fatalStop = true;
          }
          return false;
        }

        const data: any = await res.json().catch(() => null);
        // ★ [HOTFIX] 서버 응답: { ok: true, ... } — 클라 호환을 위해 success/ok 둘 다 허용
        const succeeded = !!(data && (data.ok === true || data.success === true || data.skipped === true));
        if (succeeded) {
          console.log(`[sync] OK — attempt ${attempt}/${MAX_ATTEMPTS}`, data);
          setSyncStatus('success');
          return true;
        }
        console.error(`[sync] not ok — attempt ${attempt}/${MAX_ATTEMPTS}`, data);
        return false;
      } catch (e) {
        console.error(`[sync] 예외 — attempt ${attempt}/${MAX_ATTEMPTS}:`, e);
        return false;
      }
    };

    for (let i = 1; i <= MAX_ATTEMPTS; i++) {
      const ok = await attemptSync(i);
      if (ok) return;
      // ★ [v1.0.21] 4xx 응답이면 재시도 즉시 중단 (불필요한 9초 지연 + 콘솔 노이즈 제거)
      if (fatalStop) {
        console.warn(`[sync] 4xx 응답 — 재시도 중단 (attempt ${i}/${MAX_ATTEMPTS})`);
        setSyncStatus('failed');
        return;
      }
      if (i < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
    console.error(`[sync] 모든 재시도(${MAX_ATTEMPTS}회) 실패 — orderId=${payload.orderId} tid=${payload.tid}`);
    setSyncStatus('failed');
  };

  // DB에서 주문 정보 직접 조회
  const fetchOrderInfo = async () => {
    try {
      let guestToken = '';
      try {
        if (typeof window !== 'undefined') {
          guestToken = window.localStorage.getItem('guestOrderToken') || '';
        }
      } catch {}
      const headers: Record<string, string> = {};
      if (guestToken) {
        headers['x-guest-order-token'] = guestToken;
      }

      const res = await authFetch(`/api/orders/${orderId}`, { headers });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        const order = data?.data || data?.order;
        if (order) {
          const safeTotal = (() => {
            try {
              const n = Number(order.total);
              return Number.isFinite(n) ? n : 0;
            } catch {
              return 0;
            }
          })();
          setOrderInfo({
            orderNumber: order.orderNumber || '',
            amount: safeTotal,
            method: order.paymentMethod || '카드',
          });
          setIsGuest(!order.userId);
        }
      }
    } catch (err) {
      console.error('[Success] Order fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // ★ [HOTFIX] orderId 누락 등 fallback UI — 흰 창 대신 친절한 안내
  if (fatalError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow p-8 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">{fatalError}</h1>
          <p className="text-sm text-gray-600 mb-6">
            결제가 완료된 경우 주문 내역에서 확인하실 수 있습니다.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/my-orders"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition"
            >
              주문 내역 보기
            </Link>
            <Link
              href="/"
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-50 transition"
            >
              홈으로
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">결제를 확인하고 있습니다...</p>
        </div>
      </div>
    );
  }

  // 안전한 amount 표시
  const displayAmount = (() => {
    try {
      const n = Number(orderInfo?.amount);
      if (!Number.isFinite(n)) return '0';
      return n.toLocaleString();
    } catch {
      return '0';
    }
  })();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-lg w-full">
        {/* 성공 아이콘 */}
        <div className="text-center mb-8">
          <div className="inline-block p-6 bg-green-100 rounded-full mb-4">
            <svg className="w-16 h-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">결제 완료!</h1>
          <p className="text-gray-600">주문이 성공적으로 처리되었습니다</p>
        </div>

        {/* 주문 정보 */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="space-y-4">
            <div className="flex justify-between border-b pb-3">
              <span className="text-gray-500">주문번호</span>
              <span className="font-bold text-gray-900">{orderInfo?.orderNumber || '-'}</span>
            </div>
            <div className="flex justify-between border-b pb-3">
              <span className="text-gray-500">결제수단</span>
              <span className="text-gray-900">{orderInfo?.method || '카드'}</span>
            </div>
            {orderInfo?.appNo && (
              <div className="flex justify-between border-b pb-3">
                <span className="text-gray-500">승인번호</span>
                <span className="font-mono text-gray-900">{orderInfo.appNo}</span>
              </div>
            )}
            <div className="flex justify-between pt-2">
              <span className="text-gray-500 text-lg">결제 금액</span>
              <span className="text-2xl font-bold text-blue-600">
                ₩{displayAmount}
              </span>
            </div>
          </div>

          {/* sync 상태 인디케이터 — 실패 시에만 노출 */}
          {syncStatus === 'failed' && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-semibold">결제는 정상 처리되었으나 일부 정보 동기화가 지연되고 있습니다.</p>
                  <p className="mt-1 text-yellow-700">주문 내역에 잠시 후 반영됩니다. 문제가 지속되면 고객센터로 문의해주세요.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 안내 메시지 */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
          <h3 className="text-blue-800 font-semibold mb-2">배송 안내</h3>
          <ul className="space-y-1.5 text-blue-700 text-sm">
            <li>• 상품은 영업일 기준 2-3일 내에 배송됩니다</li>
            <li>• 배송 조회는 마이페이지 &gt; 주문 내역에서 가능합니다</li>
            {isGuest && (
              <li className="text-orange-600 font-medium">• 비회원 주문 조회: 주문번호와 연락처로 조회 가능합니다</li>
            )}
          </ul>
        </div>

        {/* 비회원 주문 정보 알림 */}
        {isGuest && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 mb-6">
            <h3 className="text-orange-800 font-semibold mb-2">비회원 주문 안내</h3>
            <p className="text-sm text-orange-700 mb-3">
              주문번호 <span className="font-bold">{orderInfo?.orderNumber || '-'}</span>를 기억해주세요.
              주문 조회 시 필요합니다.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-1 text-sm font-bold text-orange-600 hover:text-orange-700"
            >
              회원가입하면 더 많은 혜택을 받을 수 있어요 →
            </Link>
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="flex flex-col sm:flex-row gap-3">
          {isGuest ? (
            <>
              <Link
                href="/orders/lookup"
                className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-center transition shadow-sm"
              >
                주문 조회하기
              </Link>
              <Link
                href="/products"
                className="flex-1 py-4 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-bold text-center transition border border-gray-300"
              >
                쇼핑 계속하기
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/my-orders"
                className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-center transition shadow-sm"
              >
                주문 내역 보기
              </Link>
              <Link
                href="/products"
                className="flex-1 py-4 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-bold text-center transition border border-gray-300"
              >
                쇼핑 계속하기
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ★ searchParams.get() 안전 래퍼 (null/undefined/throw 모두 방어)
function safeGet(sp: URLSearchParams | ReturnType<typeof useSearchParams>, key: string): string {
  try {
    const v = sp?.get(key);
    return v === null || v === undefined ? '' : String(v);
  } catch {
    return '';
  }
}

function payMethodToKorean(method: string): string {
  const map: Record<string, string> = {
    card: '신용카드', CARD: '신용카드',
    bank: '계좌이체', BANK: '계좌이체',
    vacnt: '가상계좌', VACNT: '가상계좌',
    hp: '휴대폰결제', HP: '휴대폰결제',
  };
  return map[method] || method || '신용카드';
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">로딩 중...</p>
        </div>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}
