import { NextRequest, NextResponse } from 'next/server';
import { approveKispgPayment } from '@/lib/kispg';
import { getPrisma } from '@/lib/prisma';

/**
 * POST /api/payments/kispg/return
 * 
 * KISPG 결제창에서 인증 완료 후 이 URL로 POST redirect된다.
 * 인증 결과를 검증하고 → 승인 API를 호출 → 성공/실패 페이지로 redirect.
 * 
 * KISPG 인증 결과 파라미터:
 *   resultCd, resultMsg, payMethod, tid, ordNo, amt, ediDate, encData, mbsReserved
 *   + goodsAmt (일부 응답에 포함)
 * 
 * [BUG FIX 2026-04-30]
 * - 승인 API가 "MOID 중복/이미 처리" 응답을 반환해도 실제 결제는 성공한 경우가 많음
 *   → 이전: 무조건 실패 처리 + 주문 CANCELLED → 사용자에게 "실패" 표시
 *   → 수정: DB에서 실제 주문 상태를 재확인 후, 결제가 이미 승인됐으면 성공 처리
 * - approveKispgPayment()가 이제 "이미 처리된 거래"를 성공으로 반환 (_alreadyApproved 플래그)
 * - 승인 실패 시에도 PENDING 주문을 무조건 취소하지 않고, DB 재확인 후 판단
 * 
 * [BUG FIX 2026-05-11] PC 결제 완료 화면 미표시 + tid 미저장 수정
 * - 근본 원인: KISPG PC 결제는 팝업 윈도우에서 진행됨.
 *   NextResponse.redirect(303)는 팝업 내에서만 동작하여 부모 창에 결제 결과가 전달되지 않음.
 *   → 팝업이 닫히면 부모 창은 결제 완료 화면을 표시할 수 없음
 *   → tid가 DB에 저장되기 전에 팝업이 닫히면 tid도 미저장
 * - 해결: HTTP 303 redirect 대신 HTML+JavaScript를 반환하여:
 *   1) 팝업인 경우: window.opener(부모 창)에 결제 결과를 postMessage로 전달 후 팝업 닫기
 *   2) 같은 창인 경우(모바일): location.href로 직접 이동
 *   → 부모 창이 결과를 수신하고 성공/실패 페이지로 이동
 */
export async function POST(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://qrlive.io';

  // URL query parameter에서 orderId 백업 추출
  // (KISPG 모바일 에러 페이지에서 mbsReserved를 전달하지 않으므로 returnUrl에 포함시킴)
  const requestUrl = new URL(request.url);
  const urlOrderId = requestUrl.searchParams.get('orderId') || '';

  // 파라미터 파싱 (formData 파싱 실패 방지를 위해 여러 방법 시도)
  let params: Record<string, string> = {};

  // body를 두 가지 방법으로 파싱하기 위해 먼저 clone
  const clonedRequest = request.clone();

  try {
    // 방법 1: request.text()로 원본 body를 직접 파싱 (가장 안정적)
    const bodyText = await request.text();
    console.log('[KISPG Return] Raw body length:', bodyText.length, 'first 500:', bodyText.substring(0, 500));

    if (bodyText && bodyText.length > 0) {
      // URLSearchParams로 직접 파싱
      const urlParams = new URLSearchParams(bodyText);
      urlParams.forEach((value, key) => {
        params[key] = value;
      });
    }
  } catch (parseError: any) {
    console.error('[KISPG Return] Body 파싱 실패 (text):', parseError.message);

    // 방법 2: formData() fallback (clone된 request 사용)
    try {
      const formData = await clonedRequest.formData();
      formData.forEach((value, key) => {
        params[key] = String(value);
      });
    } catch (formError: any) {
      console.error('[KISPG Return] formData 파싱도 실패:', formError.message);
    }
  }

  console.log('[KISPG Return] Parsed params:', JSON.stringify(params));

  const resultCd = params['resultCd'] || '';
  const resultMsg = params['resultMsg'] || '';
  const payMethod = params['payMethod'] || '';
  const tid = params['tid'] || '';
  const ordNo = params['ordNo'] || '';
  // KISPG 응답에서 금액: amt 또는 goodsAmt 필드
  const amt = params['amt'] || params['goodsAmt'] || '';
  const ediDate = params['ediDate'] || '';
  const encData = params['encData'] || '';
  const mbsReserved = params['mbsReserved'] || '';

  // orderId 결정: mbsReserved → URL query parameter (백업) 순서로 시도
  const orderId = mbsReserved || urlOrderId;

  console.log('[KISPG Return] resultCd:', resultCd, 'resultMsg:', resultMsg, 'tid:', tid, 'ordNo:', ordNo, 'amt:', amt, 'orderId:', orderId, 'urlOrderId:', urlOrderId);

  // 파라미터가 전혀 없는 경우 (파싱 완전 실패)
  if (!resultCd && !tid && !orderId) {
    console.error('[KISPG Return] 파라미터 파싱 완전 실패 - 모든 값이 비어있음');
    const failUrl = new URL('/payment/fail', baseUrl);
    failUrl.searchParams.set('code', 'PARSE_ERROR');
    failUrl.searchParams.set('message', '결제 결과를 수신하지 못했습니다. 관리자에게 문의해주세요.');
    return htmlRedirectResponse(failUrl.toString(), baseUrl);
  }

  let prisma: any;
  try {
    prisma = await getPrisma();
  } catch (dbError: any) {
    console.error('[KISPG Return] DB 연결 실패:', dbError.message);
    const failUrl = new URL('/payment/fail', baseUrl);
    failUrl.searchParams.set('code', 'DB_ERROR');
    failUrl.searchParams.set('message', '시스템 오류가 발생했습니다. 결제가 완료된 경우 자동 처리됩니다.');
    if (orderId) failUrl.searchParams.set('orderId', orderId);
    return htmlRedirectResponse(failUrl.toString(), baseUrl);
  }

  try {
    // 1) 인증 결과 확인
    // KISPG 성공 코드: 0000(일반), 3001(카드결제 성공), 4000(계좌이체 성공), 
    // A000(가상계좌 성공), 7001(휴대폰결제 성공) 등 결제수단별로 다름
    // tid가 존재하면 인증은 성공한 것이므로 승인 단계로 진행
    const authSuccessCodes = ['0000', '3001', '4000', 'A000', '7001', '8001', 'V000'];
    const isAuthSuccess = authSuccessCodes.includes(resultCd) || (tid && tid.length > 0);

    if (!isAuthSuccess) {
      console.error('[KISPG Return] 인증 실패:', resultCd, resultMsg);
      
      // 사용자 취소(resultCd: "0060" 등)가 아닌 경우만 주문 취소
      const userCancelCodes = ['0060', '0061', 'CC01', 'CC02'];
      if (orderId && !userCancelCodes.includes(resultCd)) {
        await cancelOrderAndRestoreStock(prisma, orderId);
      }

      const failUrl = new URL('/payment/fail', baseUrl);
      failUrl.searchParams.set('code', resultCd || 'AUTH_FAILED');
      failUrl.searchParams.set('message', resultMsg || '결제 인증에 실패했습니다');
      if (orderId) failUrl.searchParams.set('orderId', orderId);
      return htmlRedirectResponse(failUrl.toString(), baseUrl);
    }

    console.log('[KISPG Return] 인증 성공! resultCd:', resultCd, 'resultMsg:', resultMsg, 'tid:', tid);

    // 2) 주문 조회
    let order: any;
    try {
      order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: { include: { product: true } },
        },
      });
    } catch (dbQueryError: any) {
      console.error('[KISPG Return] 주문 조회 DB 오류:', dbQueryError.message, 'orderId:', orderId);
      const failUrl = new URL('/payment/fail', baseUrl);
      failUrl.searchParams.set('code', 'DB_QUERY_ERROR');
      failUrl.searchParams.set('message', '주문 조회 중 오류가 발생했습니다. 결제가 완료된 경우 관리자에게 문의해주세요.');
      if (orderId) failUrl.searchParams.set('orderId', orderId);
      return htmlRedirectResponse(failUrl.toString(), baseUrl);
    }

    if (!order) {
      console.error('[KISPG Return] 주문을 찾을 수 없음:', orderId);
      const failUrl = new URL('/payment/fail', baseUrl);
      failUrl.searchParams.set('code', 'ORDER_NOT_FOUND');
      failUrl.searchParams.set('message', '주문을 찾을 수 없습니다');
      return htmlRedirectResponse(failUrl.toString(), baseUrl);
    }

    // 이미 결제 완료된 주문인 경우 바로 성공 페이지로 이동 (중복 처리 방지)
    if (order.status === 'CONFIRMED' || order.status === 'SHIPPING' || order.status === 'DELIVERED') {
      console.log('[KISPG Return] 이미 결제 완료된 주문:', orderId, 'status:', order.status);
      return redirectToSuccess(baseUrl, orderId, order.orderNumber, Math.round(order.total), tid || order.paymentKey || '', payMethod);
    }

    // 금액 검증 (정수 비교 - Float 소수점 이슈 방지)
    const orderTotal = Math.round(order.total);
    const paidAmt = parseInt(amt) || 0;
    console.log('[KISPG Return] 금액 검증: order.total=', order.total, 'rounded=', orderTotal, 'paidAmt=', paidAmt);
    
    if (paidAmt > 0 && orderTotal !== paidAmt) {
      console.error('[KISPG Return] 금액 불일치:', orderTotal, 'vs', paidAmt);
      // 금액 불일치지만 주문 취소하지 않음 - 카드 결제는 이미 완료된 상태일 수 있음
      // 관리자가 수동 처리하도록 로그만 남김
      const failUrl = new URL('/payment/fail', baseUrl);
      failUrl.searchParams.set('code', 'AMOUNT_MISMATCH');
      failUrl.searchParams.set('message', `결제 금액 불일치 (주문: ${orderTotal}원, 결제: ${paidAmt}원). 관리자에게 문의해주세요.`);
      if (orderId) failUrl.searchParams.set('orderId', orderId);
      return htmlRedirectResponse(failUrl.toString(), baseUrl);
    }

    // 3) 결제 승인 API 호출
    console.log('[KISPG Return] 승인 API 호출 시작... tid:', tid, 'goodsAmt:', orderTotal);
    let approveResult: any;
    try {
      approveResult = await approveKispgPayment({
        tid,
        goodsAmt: orderTotal,
      });
      console.log('[KISPG Return] 승인 API 결과:', JSON.stringify(approveResult));

      // approveKispgPayment()가 성공을 반환 (_alreadyApproved 포함)
      // → 정상 승인이든, 이미 처리된 거래든 모두 성공으로 처리
      if (approveResult._alreadyApproved) {
        console.log('[KISPG Return] 이미 승인된 거래 → 성공 처리 (주문 취소하지 않음)');
      }

    } catch (approveError: any) {
      console.error('[KISPG Return] 승인 API 예외:', approveError.message);
      
      // ★★★ 핵심 수정: 승인 실패 시 DB에서 주문 상태를 재확인 ★★★
      // KISPG 승인 API가 에러를 반환해도, 실제로는 카드 승인이 이미 완료된 경우가 있음
      // (네트워크 타임아웃, 중복 요청, 테스트 환경 특성 등)
      // → DB를 다시 조회하여 이미 CONFIRMED 상태이면 성공 처리
      try {
        const recheckedOrder = await prisma.order.findUnique({ where: { id: orderId } });
        if (recheckedOrder && (recheckedOrder.status === 'CONFIRMED' || recheckedOrder.status === 'SHIPPING' || recheckedOrder.status === 'DELIVERED')) {
          console.log('[KISPG Return] 승인 실패했지만 DB 재확인 결과 이미 결제 완료:', recheckedOrder.status);
          return redirectToSuccess(baseUrl, orderId, recheckedOrder.orderNumber, Math.round(recheckedOrder.total), tid || recheckedOrder.paymentKey || '', payMethod);
        }
      } catch (recheckErr: any) {
        console.error('[KISPG Return] DB 재확인 실패:', recheckErr.message);
      }

      // DB에 tid를 저장하여 나중에 관리자가 확인할 수 있도록 함
      try {
        await prisma.order.update({
          where: { id: orderId },
          data: {
            paymentKey: tid, // 실패해도 tid 저장 (환불 추적용)
            paymentMethod: payMethodToKorean(payMethod || 'card'),
          },
        });
      } catch (updateErr: any) {
        console.error('[KISPG Return] tid 저장 실패:', updateErr.message);
      }

      const failUrl = new URL('/payment/fail', baseUrl);
      failUrl.searchParams.set('code', 'APPROVE_FAILED');
      // 에러 유형별 사용자 친화적 메시지
      const isFirewall = approveError.message?.includes('방화벽') || approveError.message?.includes('firewall') || approveError.message?.includes('redirect');
      let userMessage: string;
      if (isFirewall) {
        userMessage = '결제 승인 서버 연결에 실패했습니다. 결제금액은 자동 환불됩니다. 잠시 후 다시 시도해주세요.';
      } else {
        userMessage = '결제 처리 중 일시적 오류가 발생했습니다. 잠시 후 주문내역을 확인해주세요.';
      }
      // ★ MOID 중복이어도 주문을 CANCELLED로 변경하지 않음!
      // 결제가 실제로 완료되었을 수 있으므로 PENDING 상태 유지 → 관리자가 확인
      failUrl.searchParams.set('message', userMessage);
      failUrl.searchParams.set('orderId', orderId);
      return htmlRedirectResponse(failUrl.toString(), baseUrl);
    }

    // 4) 결제 성공 → DB 업데이트
    try {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'CONFIRMED',
          paymentMethod: payMethodToKorean(payMethod),
          paymentKey: tid, // KISPG의 tid를 paymentKey로 저장 (취소 시 사용)
          paidAt: approveResult.appDtm
            ? parseKispgDateTime(approveResult.appDtm)
            : new Date(),
        },
      });
      console.log('[KISPG Return] DB 업데이트 성공! orderId:', orderId);
    } catch (dbUpdateError: any) {
      console.error('[KISPG Return] DB 업데이트 실패:', dbUpdateError.message);
      // DB 업데이트 실패해도 결제는 이미 승인됨 → 성공 페이지로 보내야 함
      // (관리자가 나중에 수동 확인)
    }

    console.log('[KISPG Return] 결제 성공! orderId:', orderId, 'tid:', tid, 'appNo:', approveResult.appNo);

    // 5) 성공 페이지로 redirect
    return redirectToSuccess(baseUrl, orderId, order.orderNumber, orderTotal, tid, payMethod, approveResult.appNo);

  } catch (error: any) {
    console.error('[KISPG Return] 처리 오류:', error?.message || error, 'stack:', error?.stack);
    
    // ★ 시스템 에러 시에도 DB 재확인: 이미 결제 완료되었을 수 있음
    if (orderId) {
      try {
        const recheckedOrder = await prisma.order.findUnique({ where: { id: orderId } });
        if (recheckedOrder && (recheckedOrder.status === 'CONFIRMED' || recheckedOrder.status === 'SHIPPING' || recheckedOrder.status === 'DELIVERED')) {
          console.log('[KISPG Return] 시스템 에러지만 DB 재확인 결과 이미 결제 완료:', recheckedOrder.status);
          return redirectToSuccess(baseUrl, orderId, recheckedOrder.orderNumber, Math.round(recheckedOrder.total), recheckedOrder.paymentKey || tid || '', payMethod);
        }
      } catch (recheckErr) {
        console.error('[KISPG Return] 시스템 에러 후 DB 재확인도 실패:', recheckErr);
      }
    }

    const failUrl = new URL('/payment/fail', baseUrl);
    failUrl.searchParams.set('code', 'SYSTEM_ERROR');
    failUrl.searchParams.set('message', '결제 처리 중 시스템 오류가 발생했습니다. 결제가 완료된 경우 관리자에게 문의해주세요.');
    if (orderId) failUrl.searchParams.set('orderId', orderId);
    return htmlRedirectResponse(failUrl.toString(), baseUrl);
  }
}

// ─── HTML+JS 기반 redirect 응답 (PC 팝업 + 모바일 동시 호환) ───
/**
 * [2026-05-11 BUG FIX]
 * HTTP 303 redirect 대신 HTML 페이지를 반환하여 JS로 리다이렉트.
 * 
 * KISPG PC 결제는 팝업 윈도우를 사용함.
 * HTTP 303은 팝업 내에서만 redirect되어 부모 창에 결과가 전달되지 않음.
 * 
 * 이 함수는:
 * 1) 팝업 윈도우인 경우: window.opener(부모 창)에 postMessage로 URL 전달 후 팝업 닫기
 * 2) 같은 창인 경우(모바일/iframe 없는 PC): location.href로 직접 이동
 * 3) 어떤 경우든 3초 후 자동 이동 (안전장치)
 */
function htmlRedirectResponse(targetUrl: string, baseUrl: string) {
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>결제 처리 중...</title>
  <style>
    body{margin:0;padding:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f8f9fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
    .container{text-align:center;padding:40px}
    .spinner{width:48px;height:48px;border:4px solid #e9ecef;border-top:4px solid #3b82f6;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 20px}
    @keyframes spin{to{transform:rotate(360deg)}}
    .text{color:#6b7280;font-size:16px;font-weight:500}
    .link{color:#3b82f6;text-decoration:underline;cursor:pointer;font-size:14px;margin-top:12px;display:inline-block}
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <div class="text">결제 처리 중입니다...</div>
    <a class="link" href="${escapeHtml(targetUrl)}">자동 이동되지 않으면 여기를 클릭하세요</a>
  </div>
  <script>
    (function() {
      var targetUrl = ${JSON.stringify(targetUrl)};
      var baseOrigin = ${JSON.stringify(new URL(baseUrl).origin)};
      
      // 1) 팝업 윈도우인 경우: 부모 창에 결과 전달 후 팝업 닫기
      if (window.opener && !window.opener.closed) {
        try {
          // 부모 창에 결제 결과 URL을 postMessage로 전달
          window.opener.postMessage({
            type: 'KISPG_PAYMENT_RESULT',
            url: targetUrl
          }, baseOrigin);
          
          // 부모 창으로 직접 이동 시도 (같은 origin인 경우 동작)
          try {
            window.opener.location.href = targetUrl;
          } catch(e) {
            // cross-origin이면 postMessage만 사용
          }
          
          // 팝업 닫기 (약간의 딜레이 후)
          setTimeout(function() {
            try { window.close(); } catch(e) {}
          }, 500);
          
          // 팝업이 안 닫히는 경우 자체적으로도 이동
          setTimeout(function() {
            if (!window.closed) {
              window.location.href = targetUrl;
            }
          }, 2000);
          return;
        } catch(e) {
          // opener 접근 실패 시 일반 redirect로 fallback
          console.log('[KISPG] opener 접근 실패, 직접 이동:', e);
        }
      }
      
      // 2) 같은 창인 경우 (모바일 또는 팝업 없는 PC): 직접 이동
      window.location.href = targetUrl;
      
      // 3) 안전장치: 3초 후에도 이동 안 되면 강제 이동
      setTimeout(function() {
        window.location.replace(targetUrl);
      }, 3000);
    })();
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

// HTML escape helper
function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ─── 성공 페이지 redirect 헬퍼 ───
// [2026-05-11] HTTP 303 → HTML+JS redirect로 변경 (PC 팝업 호환)
function redirectToSuccess(baseUrl: string, orderId: string, orderNumber: string, amount: number, tid: string, payMethod: string, appNo?: string) {
  const successUrl = new URL('/payment/success', baseUrl);
  successUrl.searchParams.set('orderId', orderId);
  successUrl.searchParams.set('orderNumber', orderNumber);
  successUrl.searchParams.set('amount', amount.toString());
  successUrl.searchParams.set('tid', tid);
  successUrl.searchParams.set('payMethod', payMethod || 'card');
  if (appNo) {
    successUrl.searchParams.set('appNo', appNo);
  }
  return htmlRedirectResponse(successUrl.toString(), baseUrl);
}

// ─── 주문 취소 + 재고 복구 헬퍼 ───
async function cancelOrderAndRestoreStock(prisma: any, orderId: string) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order || order.status === 'CANCELLED') return;

    // ★ 이미 결제 완료된 주문은 취소하지 않음 (결제가 실제로 성공한 상태일 수 있음)
    if (order.status === 'CONFIRMED' || order.status === 'SHIPPING' || order.status === 'DELIVERED') {
      console.log('[KISPG] 이미 결제 완료된 주문 → 취소 건너뜀:', orderId, order.status);
      return;
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });

      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
    });
  } catch (err) {
    console.error('[KISPG] 주문 취소/재고 복구 실패:', err);
  }
}

// ─── payMethod 코드 → 한글 변환 ───
function payMethodToKorean(method: string): string {
  const map: Record<string, string> = {
    card: '신용카드',
    CARD: '신용카드',
    bank: '계좌이체',
    BANK: '계좌이체',
    vacnt: '가상계좌',
    VACNT: '가상계좌',
    hp: '휴대폰결제',
    HP: '휴대폰결제',
  };
  return map[method] || method;
}

// ─── KISPG 날짜 파싱 (yyyyMMddHHmmss) ───
function parseKispgDateTime(dt: string): Date {
  if (!dt || dt.length < 14) return new Date();
  const year = parseInt(dt.substring(0, 4));
  const month = parseInt(dt.substring(4, 6)) - 1;
  const day = parseInt(dt.substring(6, 8));
  const hour = parseInt(dt.substring(8, 10));
  const minute = parseInt(dt.substring(10, 12));
  const second = parseInt(dt.substring(12, 14));
  return new Date(year, month, day, hour, minute, second);
}

// ─── GET 핸들러 (모바일 일부 환경에서 GET redirect 대비) ───
/**
 * [BUG FIX 2026-04-30]
 * - resultCd 체크 시 인증 성공 코드 목록을 사용하도록 수정 (이전: '0000'만 성공)
 * - 승인 실패 시에도 DB 재확인하여 이미 결제 완료된 경우 성공 처리
 * 
 * [BUG FIX 2026-05-11]
 * - HTTP 303 → HTML+JS redirect로 변경 (PC 팝업 호환)
 */
export async function GET(request: NextRequest) {
  console.log('[KISPG Return] GET 요청 수신 - URL:', request.url);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://qrlive.io';
  
  // URL 쿼리 파라미터에서 결제 정보 추출 시도
  const url = new URL(request.url);
  const orderId = url.searchParams.get('orderId') || url.searchParams.get('mbsReserved') || '';
  const resultCd = url.searchParams.get('resultCd') || '';
  const resultMsg = url.searchParams.get('resultMsg') || '';
  const tid = url.searchParams.get('tid') || '';
  const payMethod = url.searchParams.get('payMethod') || '';
  
  console.log('[KISPG Return GET] orderId:', orderId, 'resultCd:', resultCd, 'tid:', tid);

  // 인증 성공 코드 목록 (결제수단별로 다름)
  const authSuccessCodes = ['0000', '3001', '4000', 'A000', '7001', '8001', 'V000'];

  if (orderId) {
    // orderId가 있으면 주문 상태 확인 후 적절한 페이지로 이동
    try {
      const prisma = await getPrisma();
      const order = await prisma.order.findUnique({ where: { id: orderId } });

      if (!order) {
        console.error('[KISPG Return GET] 주문을 찾을 수 없음:', orderId);
        const failUrl = new URL('/payment/fail', baseUrl);
        failUrl.searchParams.set('code', 'ORDER_NOT_FOUND');
        failUrl.searchParams.set('message', '주문을 찾을 수 없습니다');
        return htmlRedirectResponse(failUrl.toString(), baseUrl);
      }

      // ★ 이미 결제 완료된 주문은 바로 성공 페이지로
      if (order.status === 'CONFIRMED' || order.status === 'SHIPPING' || order.status === 'DELIVERED') {
        console.log('[KISPG Return GET] 이미 결제 완료된 주문:', orderId, order.status);
        return redirectToSuccess(baseUrl, orderId, order.orderNumber, Math.round(order.total), order.paymentKey || tid || '', payMethod || 'card');
      }

      // PENDING 상태이고 tid가 있으면 승인 시도 (모바일 GET redirect 특수 케이스)
      if (order.status === 'PENDING' && tid && tid.length > 10) {
        console.log('[KISPG Return GET] PENDING 주문 + tid 존재 → 승인 시도');
        try {
          const approveResult = await approveKispgPayment({
            tid,
            goodsAmt: Math.round(order.total),
          });
          
          // approveKispgPayment가 성공을 반환 (정상 승인 또는 _alreadyApproved)
          await prisma.order.update({
            where: { id: orderId },
            data: {
              status: 'CONFIRMED',
              paymentMethod: payMethodToKorean(payMethod || 'card'),
              paymentKey: tid,
              paidAt: approveResult.appDtm
                ? parseKispgDateTime(approveResult.appDtm)
                : new Date(),
            },
          });

          console.log('[KISPG Return GET] 승인 성공! alreadyApproved:', !!approveResult._alreadyApproved);
          return redirectToSuccess(baseUrl, orderId, order.orderNumber, Math.round(order.total), tid, payMethod || 'card', approveResult.appNo);
        } catch (approveErr: any) {
          console.error('[KISPG Return GET] 승인 실패:', approveErr.message);
          
          // ★ 승인 실패 시에도 DB 재확인
          try {
            const recheckedOrder = await prisma.order.findUnique({ where: { id: orderId } });
            if (recheckedOrder && (recheckedOrder.status === 'CONFIRMED' || recheckedOrder.status === 'SHIPPING' || recheckedOrder.status === 'DELIVERED')) {
              console.log('[KISPG Return GET] 승인 실패했지만 DB 재확인 결과 이미 결제 완료');
              return redirectToSuccess(baseUrl, orderId, recheckedOrder.orderNumber, Math.round(recheckedOrder.total), recheckedOrder.paymentKey || tid || '', payMethod || 'card');
            }
          } catch (recheckErr) {
            console.error('[KISPG Return GET] DB 재확인 실패:', recheckErr);
          }

          // tid 저장 (추적용)
          try {
            await prisma.order.update({
              where: { id: orderId },
              data: { paymentKey: tid, paymentMethod: payMethodToKorean(payMethod || 'card') },
            });
          } catch {}
        }
      }

      // 에러 결과가 있고, 인증 성공 코드가 아닌 경우만 에러 표시
      // ★ 수정: 이전에는 '0000'이 아닌 모든 코드를 에러로 처리 → 성공 코드 목록으로 비교
      if (resultCd && !authSuccessCodes.includes(resultCd)) {
        // 사용자 취소가 아닌 경우만 실패 페이지 표시
        const userCancelCodes = ['0060', '0061', 'CC01', 'CC02'];
        const failUrl = new URL('/payment/fail', baseUrl);
        failUrl.searchParams.set('code', resultCd);
        failUrl.searchParams.set('message', userCancelCodes.includes(resultCd) 
          ? '결제가 취소되었습니다'
          : (resultMsg || '결제 인증에 실패했습니다'));
        failUrl.searchParams.set('orderId', orderId);
        return htmlRedirectResponse(failUrl.toString(), baseUrl);
      }
    } catch (e) {
      console.error('[KISPG Return GET] DB 조회 실패:', e);
    }
  }
  
  // 기본: 결제 실패 안내 (GET으로는 정상 결제 처리 불가)
  const failUrl = new URL('/payment/fail', baseUrl);
  failUrl.searchParams.set('code', 'INVALID_METHOD');
  failUrl.searchParams.set('message', '결제 처리를 완료하지 못했습니다. 주문 내역을 확인해주세요.');
  if (orderId) failUrl.searchParams.set('orderId', orderId);
  return htmlRedirectResponse(failUrl.toString(), baseUrl);
}
