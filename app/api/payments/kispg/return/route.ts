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
 * [BUG FIX 2026-05-11 v2] PC 결제 tid 미저장 + 완료 화면 미표시 근본 수정
 * - 근본 원인: KISPG 결제창(WebView/인앱브라우저)에서 HTTP 303 redirect가 처리되지 않음
 *   → KISPG가 returnUrl로 POST 후 서버가 303 응답 → 브라우저가 redirect를 무시
 *   → 사용자는 결제완료 화면을 볼 수 없고, 빈 화면/로딩만 표시됨
 * - 해결: 모든 redirect를 HTML+JS+meta refresh 3중 방식으로 변경
 *   → htmlRedirect() 헬퍼가 HTML 페이지를 직접 내려보냄
 *   → JS location.replace + meta http-equiv=refresh + 수동 클릭 링크
 *   → 어떤 브라우저/WebView 환경에서도 100% 이동 보장
 * - 추가 개선:
 *   1) 승인 API 호출 전에 먼저 tid를 DB에 저장 (승인 실패해도 tid 보존)
 *   2) 승인 API 실패 시 1회 재시도 (일시적 네트워크 오류 대응)
 *   3) 승인 실패해도 tid가 DB에 남아있으므로 관리자가 수동 환불 가능
 */
export async function POST(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://qrlive.io';

  // URL query parameter에서 orderId 백업 추출
  const requestUrl = new URL(request.url);
  const urlOrderId = requestUrl.searchParams.get('orderId') || '';

  // 파라미터 파싱 (formData 파싱 실패 방지를 위해 여러 방법 시도)
  let params: Record<string, string> = {};
  const clonedRequest = request.clone();

  try {
    const bodyText = await request.text();
    console.log('[KISPG Return] Raw body length:', bodyText.length, 'first 500:', bodyText.substring(0, 500));

    if (bodyText && bodyText.length > 0) {
      const urlParams = new URLSearchParams(bodyText);
      urlParams.forEach((value, key) => {
        params[key] = value;
      });
    }
  } catch (parseError: any) {
    console.error('[KISPG Return] Body 파싱 실패 (text):', parseError.message);
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
  const amt = params['amt'] || params['goodsAmt'] || '';
  const ediDate = params['ediDate'] || '';
  const encData = params['encData'] || '';
  const mbsReserved = params['mbsReserved'] || '';

  const orderId = mbsReserved || urlOrderId;

  console.log('[KISPG Return] resultCd:', resultCd, 'resultMsg:', resultMsg, 'tid:', tid, 'ordNo:', ordNo, 'amt:', amt, 'orderId:', orderId, 'urlOrderId:', urlOrderId);

  // 파라미터가 전혀 없는 경우 (파싱 완전 실패)
  if (!resultCd && !tid && !orderId) {
    console.error('[KISPG Return] 파라미터 파싱 완전 실패 - 모든 값이 비어있음');
    const failUrl = new URL('/payment/fail', baseUrl);
    failUrl.searchParams.set('code', 'PARSE_ERROR');
    failUrl.searchParams.set('message', '결제 결과를 수신하지 못했습니다. 관리자에게 문의해주세요.');
    return htmlRedirect(failUrl.toString());
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
    return htmlRedirect(failUrl.toString());
  }

  try {
    // 1) 인증 결과 확인
    const authSuccessCodes = ['0000', '3001', '4000', 'A000', '7001', '8001', 'V000'];
    const isAuthSuccess = authSuccessCodes.includes(resultCd) || (tid && tid.length > 0);

    if (!isAuthSuccess) {
      console.error('[KISPG Return] 인증 실패:', resultCd, resultMsg);
      
      const userCancelCodes = ['0060', '0061', 'CC01', 'CC02'];
      if (orderId && !userCancelCodes.includes(resultCd)) {
        await cancelOrderAndRestoreStock(prisma, orderId);
      }

      const failUrl = new URL('/payment/fail', baseUrl);
      failUrl.searchParams.set('code', resultCd || 'AUTH_FAILED');
      failUrl.searchParams.set('message', resultMsg || '결제 인증에 실패했습니다');
      if (orderId) failUrl.searchParams.set('orderId', orderId);
      return htmlRedirect(failUrl.toString());
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
      return htmlRedirect(failUrl.toString());
    }

    if (!order) {
      console.error('[KISPG Return] 주문을 찾을 수 없음:', orderId);
      const failUrl = new URL('/payment/fail', baseUrl);
      failUrl.searchParams.set('code', 'ORDER_NOT_FOUND');
      failUrl.searchParams.set('message', '주문을 찾을 수 없습니다');
      return htmlRedirect(failUrl.toString());
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
      const failUrl = new URL('/payment/fail', baseUrl);
      failUrl.searchParams.set('code', 'AMOUNT_MISMATCH');
      failUrl.searchParams.set('message', `결제 금액 불일치 (주문: ${orderTotal}원, 결제: ${paidAmt}원). 관리자에게 문의해주세요.`);
      if (orderId) failUrl.searchParams.set('orderId', orderId);
      return htmlRedirect(failUrl.toString());
    }

    // ★★★ [v2 핵심 수정 1] 승인 API 호출 전에 먼저 tid를 DB에 저장 ★★★
    // 승인 API가 실패/타임아웃 되더라도 tid는 DB에 남아있어 관리자가 수동 환불 가능
    // [2026-05-11 v3 HOTFIX] D1 wrapper update() 가 silent fail 가능성 → raw SQL 폴백 동시 시도
    if (tid) {
      // ① ORM update 시도
      let preSaveOk = false;
      try {
        await prisma.order.update({
          where: { id: orderId },
          data: {
            paymentKey: tid,
            paymentMethod: payMethodToKorean(payMethod || 'card'),
          },
        });
        preSaveOk = true;
        console.log('[KISPG Return] tid 사전 저장 성공 (ORM):', tid);
      } catch (preSaveErr: any) {
        console.error('[KISPG Return] tid 사전 저장 ORM 실패:', preSaveErr?.message || preSaveErr);
      }
      // ② raw SQL 확정 저장 — ORM 성공/실패 무관하게 항상 paymentKey 가 DB 에 있도록 강제
      try {
        const nowIso = new Date().toISOString();
        const changes = await prisma.$executeRawUnsafe(
          'UPDATE "Order" SET "paymentKey" = ?, "paymentMethod" = ?, "updatedAt" = ? WHERE "id" = ?',
          tid, payMethodToKorean(payMethod || 'card'), nowIso, orderId
        );
        console.log('[KISPG Return] tid 사전 저장 raw SQL 결과 changes=', changes, 'tid=', tid, 'orderId=', orderId, 'ormOk=', preSaveOk);
        // raw 도 변경 0 건이면 SELECT 로 진단
        if (!changes || changes === 0) {
          try {
            const verify = await prisma.$queryRawUnsafe(
              'SELECT id, status, paymentKey FROM "Order" WHERE id = ? LIMIT 1', orderId
            );
            console.error('[KISPG Return] tid 사전 저장 raw 0건 변경 — verify:', JSON.stringify(verify));
          } catch (vErr: any) {
            console.error('[KISPG Return] verify SELECT 실패:', vErr?.message || vErr);
          }
        }
      } catch (rawErr: any) {
        console.error('[KISPG Return] tid 사전 저장 raw SQL 실패:', rawErr?.message || rawErr);
      }
    }

    // 3) 결제 승인 API 호출 (실패 시 1회 재시도)
    console.log('[KISPG Return] 승인 API 호출 시작... tid:', tid, 'goodsAmt:', orderTotal);
    let approveResult: any;
    let approveError: any = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        approveResult = await approveKispgPayment({
          tid,
          goodsAmt: orderTotal,
        });
        console.log('[KISPG Return] 승인 API 결과 (시도', attempt, '):', JSON.stringify(approveResult));

        if (approveResult._alreadyApproved) {
          console.log('[KISPG Return] 이미 승인된 거래 → 성공 처리');
        }
        approveError = null;
        break; // 성공 시 루프 종료
      } catch (err: any) {
        approveError = err;
        console.error('[KISPG Return] 승인 API 예외 (시도', attempt, '):', err.message);
        
        // 방화벽 차단은 재시도해도 동일하므로 즉시 중단
        const isFirewall = err.message?.includes('방화벽') || err.message?.includes('firewall') || err.message?.includes('redirect');
        if (isFirewall) {
          console.error('[KISPG Return] 방화벽 차단 → 재시도 불가');
          break;
        }
        
        // 첫 번째 시도 실패 시 500ms 대기 후 재시도
        if (attempt === 1) {
          console.log('[KISPG Return] 500ms 대기 후 재시도...');
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    // 승인 실패 처리
    if (approveError) {
      console.error('[KISPG Return] 승인 최종 실패:', approveError.message);

      // DB에서 주문 상태를 재확인 (다른 경로에서 이미 처리되었을 수 있음)
      try {
        const recheckedOrder = await prisma.order.findUnique({ where: { id: orderId } });
        if (recheckedOrder && (recheckedOrder.status === 'CONFIRMED' || recheckedOrder.status === 'SHIPPING' || recheckedOrder.status === 'DELIVERED')) {
          console.log('[KISPG Return] 승인 실패했지만 DB 재확인 결과 이미 결제 완료:', recheckedOrder.status);
          return redirectToSuccess(baseUrl, orderId, recheckedOrder.orderNumber, Math.round(recheckedOrder.total), tid || recheckedOrder.paymentKey || '', payMethod);
        }
      } catch (recheckErr: any) {
        console.error('[KISPG Return] DB 재확인 실패:', recheckErr.message);
      }

      // tid는 이미 사전 저장됨 (위의 "tid 사전 저장" 단계에서)

      const failUrl = new URL('/payment/fail', baseUrl);
      failUrl.searchParams.set('code', 'APPROVE_FAILED');
      const isFirewall = approveError.message?.includes('방화벽') || approveError.message?.includes('firewall') || approveError.message?.includes('redirect');
      let userMessage: string;
      if (isFirewall) {
        userMessage = '결제 승인 서버 연결에 실패했습니다. 결제금액은 자동 환불됩니다. 잠시 후 다시 시도해주세요.';
      } else {
        userMessage = '결제 처리 중 일시적 오류가 발생했습니다. 잠시 후 주문내역을 확인해주세요.';
      }
      failUrl.searchParams.set('message', userMessage);
      failUrl.searchParams.set('orderId', orderId);
      return htmlRedirect(failUrl.toString());
    }

    // 4) 결제 성공 → DB 업데이트 (status + tid + paidAt)
    // [2026-05-11 v3 HOTFIX] D1 wrapper update() silent fail 차단:
    //  - paidAt Date Invalid → .toISOString() RangeError 우회 (safePaidAtIso)
    //  - ORM update() 가 어떤 이유로든 실패해도 raw SQL 로 paymentKey 무조건 저장
    //  - 마지막에 SELECT 로 실제 저장 여부 검증 후 로그
    const paidAtIso = safePaidAtIso(approveResult?.appDtm);
    const paymentMethodKr = payMethodToKorean(payMethod);
    const nowIso = new Date().toISOString();

    // ① ORM update 시도 (3단 폴백)
    let ormOk = false;
    try {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'CONFIRMED',
          paymentMethod: paymentMethodKr,
          paymentKey: tid,
          paidAt: paidAtIso,
        },
      });
      ormOk = true;
      console.log('[KISPG Return] DB 업데이트 성공 (ORM 1차)! orderId:', orderId, 'tid:', tid, 'paidAt:', paidAtIso);
    } catch (dbUpdateError: any) {
      console.error('[KISPG Return] DB 업데이트 실패 (ORM 1차):', dbUpdateError?.message || dbUpdateError);
      try {
        await prisma.order.update({
          where: { id: orderId },
          data: { status: 'CONFIRMED', paymentMethod: paymentMethodKr, paymentKey: tid },
        });
        ormOk = true;
        console.log('[KISPG Return] DB 업데이트 성공 (ORM 2차 폴백)! tid:', tid);
      } catch (dbUpdateError2: any) {
        console.error('[KISPG Return] DB 업데이트 실패 (ORM 2차):', dbUpdateError2?.message || dbUpdateError2);
        try {
          await prisma.order.update({ where: { id: orderId }, data: { paymentKey: tid } });
          ormOk = true;
          console.log('[KISPG Return] paymentKey 단독 저장 성공 (ORM 3차)! tid:', tid);
        } catch (dbUpdateError3: any) {
          console.error('[KISPG Return] ORM 3차 실패:', dbUpdateError3?.message || dbUpdateError3);
        }
      }
    }

    // ② raw SQL 강제 저장 — ORM 결과 무관, paymentKey 는 절대 누락되면 안 됨
    try {
      const changes = await prisma.$executeRawUnsafe(
        'UPDATE "Order" SET "status" = ?, "paymentMethod" = ?, "paymentKey" = ?, "paidAt" = ?, "updatedAt" = ? WHERE "id" = ?',
        'CONFIRMED', paymentMethodKr, tid, paidAtIso, nowIso, orderId
      );
      console.log('[KISPG Return] raw SQL 강제 저장 changes=', changes, 'tid=', tid, 'ormOk=', ormOk);
    } catch (rawErr: any) {
      console.error('[KISPG Return] raw SQL 강제 저장 실패:', rawErr?.message || rawErr);
      // 마지막 안전망 — paymentKey 단독 raw
      try {
        const c2 = await prisma.$executeRawUnsafe(
          'UPDATE "Order" SET "paymentKey" = ?, "updatedAt" = ? WHERE "id" = ?',
          tid, nowIso, orderId
        );
        console.log('[KISPG Return] paymentKey 단독 raw SQL 결과 changes=', c2);
      } catch (rawErr2: any) {
        console.error('[KISPG Return] paymentKey 단독 raw SQL 도 실패:', rawErr2?.message || rawErr2);
      }
    }

    // ③ 최종 검증 — 실제로 DB 에 저장됐는지 SELECT 로 확인
    try {
      const verify: any = await prisma.$queryRawUnsafe(
        'SELECT id, status, paymentKey, paymentMethod, paidAt FROM "Order" WHERE id = ? LIMIT 1', orderId
      );
      const row = Array.isArray(verify) ? verify[0] : (verify?.results?.[0] || verify);
      console.log('[KISPG Return] 최종 검증 SELECT:', JSON.stringify(row));
      if (!row || !row.paymentKey) {
        console.error('[KISPG Return] ★★★ 치명적: 모든 저장 시도 후에도 paymentKey 미저장! orderId=', orderId, 'tid=', tid);
      }
    } catch (verifyErr: any) {
      console.error('[KISPG Return] 최종 검증 SELECT 실패:', verifyErr?.message || verifyErr);
    }

    console.log('[KISPG Return] 결제 성공! orderId:', orderId, 'tid:', tid, 'appNo:', approveResult.appNo);

    // 5) 성공 페이지로 HTTP 303 redirect
    return redirectToSuccess(baseUrl, orderId, order.orderNumber, orderTotal, tid, payMethod, approveResult.appNo);

  } catch (error: any) {
    console.error('[KISPG Return] 처리 오류:', error?.message || error, 'stack:', error?.stack);
    
    // 시스템 에러 시에도 DB 재확인
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
    return htmlRedirect(failUrl.toString());
  }
}

// ─── 성공 페이지 redirect 헬퍼 ───
// [2026-05-11 v5] HTTP 303 → HTML+JS+meta 3중 redirect
// 근본 원인: KISPG 결제창(WebView/인앱브라우저)에서 HTTP 303 redirect가 씹힘
//           → 사용자 브라우저가 success 페이지로 이동 안 됨 → 결제완료 화면 미표시
// 해결: HTML 페이지를 직접 내려보내서 JS location.replace + meta refresh + 클릭 링크 3중으로
//       어떤 환경에서도 100% 이동 보장
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
  return htmlRedirect(successUrl.toString());
}

// ─── HTML 기반 3중 redirect (KISPG WebView 호환) ───
function htmlRedirect(url: string): NextResponse {
  const safeUrl = url.replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="1;url=${safeUrl}">
<title>이동 중...</title>
<script>
try{window.location.replace("${safeUrl}")}catch(e){window.location.href="${safeUrl}"}
</script>
</head><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#f8f9fa">
<div style="text-align:center">
<div style="width:40px;height:40px;border:3px solid #ddd;border-top:3px solid #3b82f6;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 16px"></div>
<p style="color:#666;margin:0 0 12px">결제 처리 중입니다...</p>
<a href="${safeUrl}" style="color:#3b82f6;text-decoration:underline;font-size:14px">자동으로 이동하지 않으면 여기를 눌러주세요</a>
</div>
<style>@keyframes spin{to{transform:rotate(360deg)}}</style>
</body></html>`;
  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

// ─── 주문 취소 + 재고 복구 헬퍼 ───
async function cancelOrderAndRestoreStock(prisma: any, orderId: string) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order || order.status === 'CANCELLED') return;

    if (order.status === 'CONFIRMED' || order.status === 'SHIPPING' || order.status === 'DELIVERED') {
      console.log('[KISPG] 이미 결제 완료된 주문 → 취소 건너뜀:', orderId, order.status);
      return;
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });

      // 재고 복구 (batch update - N+1 쿼리 제거)
      // 같은 productId 가 items 에 여러 번 나올 수 있으므로 productId 별로 합산
      const stockIncrementMap = new Map<string, number>();
      for (const item of order.items) {
        const qty = Number(item.quantity);
        if (!item.productId || !Number.isFinite(qty) || qty <= 0) continue;
        stockIncrementMap.set(
          item.productId,
          (stockIncrementMap.get(item.productId) || 0) + qty
        );
      }
      if (stockIncrementMap.size > 0) {
        const productIds = Array.from(stockIncrementMap.keys());
        const caseParts: string[] = [];
        const params: any[] = [];
        for (const [pid, qty] of stockIncrementMap.entries()) {
          caseParts.push(`WHEN ? THEN stock + ?`);
          params.push(pid, qty);
        }
        const placeholders = productIds.map(() => '?').join(',');
        const sql = `UPDATE "Product" SET stock = CASE id ${caseParts.join(' ')} ELSE stock END, "updatedAt" = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`;
        await tx.$executeRawUnsafe(sql, ...params, ...productIds);
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

// ─── [2026-05-11 HOTFIX] paidAt 안전 ISO 변환 ───
// 목적: paidAt 으로 Invalid Date 가 들어가 .toISOString() RangeError 발생 → 전체 update 실패 → paymentKey(TID) 누락 차단
// 1) appDtm 비어있음/짧음 → 현재 시각 ISO
// 2) parseKispgDateTime 결과가 Invalid → 현재 시각 ISO 폴백
// 3) 모든 예외 → 현재 시각 ISO 폴백 (절대 throw 안 함)
function safePaidAtIso(appDtm: string | undefined | null): string {
  try {
    if (!appDtm || typeof appDtm !== 'string' || appDtm.length < 14) {
      return new Date().toISOString();
    }
    const d = parseKispgDateTime(appDtm);
    if (!d || isNaN(d.getTime())) {
      return new Date().toISOString();
    }
    return d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

// ─── GET 핸들러 (모바일 일부 환경에서 GET redirect 대비) ───
/**
 * [BUG FIX 2026-05-11 v2] HTML+JS+meta 3중 redirect (KISPG WebView 호환)
 */
export async function GET(request: NextRequest) {
  console.log('[KISPG Return] GET 요청 수신 - URL:', request.url);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://qrlive.io';
  
  const url = new URL(request.url);
  const orderId = url.searchParams.get('orderId') || url.searchParams.get('mbsReserved') || '';
  const resultCd = url.searchParams.get('resultCd') || '';
  const resultMsg = url.searchParams.get('resultMsg') || '';
  const tid = url.searchParams.get('tid') || '';
  const payMethod = url.searchParams.get('payMethod') || '';
  
  console.log('[KISPG Return GET] orderId:', orderId, 'resultCd:', resultCd, 'tid:', tid);

  const authSuccessCodes = ['0000', '3001', '4000', 'A000', '7001', '8001', 'V000'];

  if (orderId) {
    try {
      const prisma = await getPrisma();
      const order = await prisma.order.findUnique({ where: { id: orderId } });

      if (!order) {
        console.error('[KISPG Return GET] 주문을 찾을 수 없음:', orderId);
        const failUrl = new URL('/payment/fail', baseUrl);
        failUrl.searchParams.set('code', 'ORDER_NOT_FOUND');
        failUrl.searchParams.set('message', '주문을 찾을 수 없습니다');
        return htmlRedirect(failUrl.toString());
      }

      // 이미 결제 완료된 주문은 바로 성공 페이지로
      if (order.status === 'CONFIRMED' || order.status === 'SHIPPING' || order.status === 'DELIVERED') {
        console.log('[KISPG Return GET] 이미 결제 완료된 주문:', orderId, order.status);
        return redirectToSuccess(baseUrl, orderId, order.orderNumber, Math.round(order.total), order.paymentKey || tid || '', payMethod || 'card');
      }

      // PENDING 상태이고 tid가 있으면 승인 시도
      if (order.status === 'PENDING' && tid && tid.length > 10) {
        console.log('[KISPG Return GET] PENDING 주문 + tid 존재 → 승인 시도');
        const paymentMethodKrGet = payMethodToKorean(payMethod || 'card');
        const nowIsoGet = new Date().toISOString();

        // tid 사전 저장 (ORM + raw SQL 이중 안전망)
        try {
          await prisma.order.update({
            where: { id: orderId },
            data: { paymentKey: tid, paymentMethod: paymentMethodKrGet },
          });
        } catch {}
        try {
          const c = await prisma.$executeRawUnsafe(
            'UPDATE "Order" SET "paymentKey" = ?, "paymentMethod" = ?, "updatedAt" = ? WHERE "id" = ?',
            tid, paymentMethodKrGet, nowIsoGet, orderId
          );
          console.log('[KISPG Return GET] tid 사전 저장 raw SQL changes=', c, 'tid=', tid);
        } catch (preRawErr: any) {
          console.error('[KISPG Return GET] tid 사전 저장 raw SQL 실패:', preRawErr?.message || preRawErr);
        }

        try {
          const approveResult = await approveKispgPayment({
            tid,
            goodsAmt: Math.round(order.total),
          });

          // [2026-05-11 v3 HOTFIX] paidAt 안전 변환 + ORM 3단 폴백 + raw SQL 강제 저장 + 최종 검증
          const paidAtIsoGet = safePaidAtIso(approveResult?.appDtm);
          let ormOkGet = false;
          try {
            await prisma.order.update({
              where: { id: orderId },
              data: {
                status: 'CONFIRMED',
                paymentMethod: paymentMethodKrGet,
                paymentKey: tid,
                paidAt: paidAtIsoGet,
              },
            });
            ormOkGet = true;
            console.log('[KISPG Return GET] DB 업데이트 성공 (ORM 1차)! tid:', tid, 'paidAt:', paidAtIsoGet);
          } catch (dbErrGet1: any) {
            console.error('[KISPG Return GET] DB 업데이트 실패 (ORM 1차):', dbErrGet1?.message || dbErrGet1);
            try {
              await prisma.order.update({
                where: { id: orderId },
                data: { status: 'CONFIRMED', paymentMethod: paymentMethodKrGet, paymentKey: tid },
              });
              ormOkGet = true;
              console.log('[KISPG Return GET] DB 업데이트 성공 (ORM 2차 폴백)! tid:', tid);
            } catch (dbErrGet2: any) {
              console.error('[KISPG Return GET] DB 업데이트 실패 (ORM 2차):', dbErrGet2?.message || dbErrGet2);
              try {
                await prisma.order.update({ where: { id: orderId }, data: { paymentKey: tid } });
                ormOkGet = true;
                console.log('[KISPG Return GET] paymentKey 단독 저장 성공 (ORM 3차)! tid:', tid);
              } catch (dbErrGet3: any) {
                console.error('[KISPG Return GET] ORM 3차 실패:', dbErrGet3?.message || dbErrGet3);
              }
            }
          }

          // raw SQL 강제 저장 — ORM 결과 무관, paymentKey 절대 누락 금지
          try {
            const changes = await prisma.$executeRawUnsafe(
              'UPDATE "Order" SET "status" = ?, "paymentMethod" = ?, "paymentKey" = ?, "paidAt" = ?, "updatedAt" = ? WHERE "id" = ?',
              'CONFIRMED', paymentMethodKrGet, tid, paidAtIsoGet, nowIsoGet, orderId
            );
            console.log('[KISPG Return GET] raw SQL 강제 저장 changes=', changes, 'tid=', tid, 'ormOk=', ormOkGet);
          } catch (rawErrGet: any) {
            console.error('[KISPG Return GET] raw SQL 강제 저장 실패:', rawErrGet?.message || rawErrGet);
            try {
              const c2 = await prisma.$executeRawUnsafe(
                'UPDATE "Order" SET "paymentKey" = ?, "updatedAt" = ? WHERE "id" = ?',
                tid, nowIsoGet, orderId
              );
              console.log('[KISPG Return GET] paymentKey 단독 raw SQL changes=', c2);
            } catch (rawErrGet2: any) {
              console.error('[KISPG Return GET] paymentKey 단독 raw SQL 도 실패:', rawErrGet2?.message || rawErrGet2);
            }
          }

          // 최종 검증
          try {
            const verifyGet: any = await prisma.$queryRawUnsafe(
              'SELECT id, status, paymentKey, paymentMethod, paidAt FROM "Order" WHERE id = ? LIMIT 1', orderId
            );
            const rowGet = Array.isArray(verifyGet) ? verifyGet[0] : (verifyGet?.results?.[0] || verifyGet);
            console.log('[KISPG Return GET] 최종 검증 SELECT:', JSON.stringify(rowGet));
            if (!rowGet || !rowGet.paymentKey) {
              console.error('[KISPG Return GET] ★★★ 치명적: 모든 저장 시도 후에도 paymentKey 미저장! orderId=', orderId, 'tid=', tid);
            }
          } catch (vErrGet: any) {
            console.error('[KISPG Return GET] 최종 검증 SELECT 실패:', vErrGet?.message || vErrGet);
          }

          console.log('[KISPG Return GET] 승인 성공! alreadyApproved:', !!approveResult._alreadyApproved);
          return redirectToSuccess(baseUrl, orderId, order.orderNumber, Math.round(order.total), tid, payMethod || 'card', approveResult.appNo);
        } catch (approveErr: any) {
          console.error('[KISPG Return GET] 승인 실패:', approveErr.message);
          
          // DB 재확인
          try {
            const recheckedOrder = await prisma.order.findUnique({ where: { id: orderId } });
            if (recheckedOrder && (recheckedOrder.status === 'CONFIRMED' || recheckedOrder.status === 'SHIPPING' || recheckedOrder.status === 'DELIVERED')) {
              console.log('[KISPG Return GET] 승인 실패했지만 DB 재확인 결과 이미 결제 완료');
              return redirectToSuccess(baseUrl, orderId, recheckedOrder.orderNumber, Math.round(recheckedOrder.total), recheckedOrder.paymentKey || tid || '', payMethod || 'card');
            }
          } catch (recheckErr) {
            console.error('[KISPG Return GET] DB 재확인 실패:', recheckErr);
          }
        }
      }

      // 에러 결과가 있고, 인증 성공 코드가 아닌 경우만 에러 표시
      if (resultCd && !authSuccessCodes.includes(resultCd)) {
        const userCancelCodes = ['0060', '0061', 'CC01', 'CC02'];
        const failUrl = new URL('/payment/fail', baseUrl);
        failUrl.searchParams.set('code', resultCd);
        failUrl.searchParams.set('message', userCancelCodes.includes(resultCd) 
          ? '결제가 취소되었습니다'
          : (resultMsg || '결제 인증에 실패했습니다'));
        failUrl.searchParams.set('orderId', orderId);
        return htmlRedirect(failUrl.toString());
      }
    } catch (e) {
      console.error('[KISPG Return GET] DB 조회 실패:', e);
    }
  }
  
  // 기본: 결제 실패 안내
  const failUrl = new URL('/payment/fail', baseUrl);
  failUrl.searchParams.set('code', 'INVALID_METHOD');
  failUrl.searchParams.set('message', '결제 처리를 완료하지 못했습니다. 주문 내역을 확인해주세요.');
  if (orderId) failUrl.searchParams.set('orderId', orderId);
  return htmlRedirect(failUrl.toString());
}
