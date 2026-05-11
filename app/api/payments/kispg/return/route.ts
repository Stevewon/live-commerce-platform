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
 * - 근본 원인 재분석: form.target='_self'로 checkout 페이지가 KISPG로 이동됨
 *   → 팝업 없이 같은 창에서 결제가 진행됨
 *   → htmlRedirectResponse() (HTML+JS)는 불필요한 중간 단계를 추가하여 불안정
 *   → JS가 실행되지 않거나 지연되면 리다이렉트 실패 → 사용자는 스피너만 보게됨
 * - 해결: HTML+JS 방식을 완전 제거하고 표준 HTTP 303 redirect로 복원
 *   → HTTP 303은 브라우저 프로토콜 레벨에서 처리되어 100% 안정적
 *   → form.target='_self'이므로 같은 창에서 즉시 이동됨
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
    return NextResponse.redirect(failUrl.toString(), 303);
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
    return NextResponse.redirect(failUrl.toString(), 303);
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
      return NextResponse.redirect(failUrl.toString(), 303);
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
      return NextResponse.redirect(failUrl.toString(), 303);
    }

    if (!order) {
      console.error('[KISPG Return] 주문을 찾을 수 없음:', orderId);
      const failUrl = new URL('/payment/fail', baseUrl);
      failUrl.searchParams.set('code', 'ORDER_NOT_FOUND');
      failUrl.searchParams.set('message', '주문을 찾을 수 없습니다');
      return NextResponse.redirect(failUrl.toString(), 303);
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
      return NextResponse.redirect(failUrl.toString(), 303);
    }

    // ★★★ [v2 핵심 수정 1] 승인 API 호출 전에 먼저 tid를 DB에 저장 ★★★
    // 승인 API가 실패/타임아웃 되더라도 tid는 DB에 남아있어 관리자가 수동 환불 가능
    if (tid) {
      try {
        await prisma.order.update({
          where: { id: orderId },
          data: {
            paymentKey: tid,
            paymentMethod: payMethodToKorean(payMethod || 'card'),
          },
        });
        console.log('[KISPG Return] tid 사전 저장 성공:', tid);
      } catch (preSaveErr: any) {
        console.error('[KISPG Return] tid 사전 저장 실패:', preSaveErr.message);
        // 실패해도 계속 진행 (승인 성공 후 다시 저장 시도)
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
      return NextResponse.redirect(failUrl.toString(), 303);
    }

    // 4) 결제 성공 → DB 업데이트 (status + tid + paidAt)
    // [2026-05-11 HOTFIX] paymentKey 저장 누락 차단:
    //  - paidAt Date 객체가 Invalid Date 일 경우 .toISOString() 에서 RangeError 발생 → 전체 update 실패 → paymentKey 누락
    //  - 해결: ISO string 으로 강제 변환 + Invalid 시 안전 폴백
    //  - 추가 안전망: paymentKey/status 1차 저장 → paidAt 2차 저장 (분리)
    //    paidAt 실패해도 거래번호는 무조건 DB 에 남도록
    const paidAtIso = safePaidAtIso(approveResult?.appDtm);
    try {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'CONFIRMED',
          paymentMethod: payMethodToKorean(payMethod),
          paymentKey: tid,
          paidAt: paidAtIso,
        },
      });
      console.log('[KISPG Return] DB 업데이트 성공! orderId:', orderId, 'tid:', tid, 'paidAt:', paidAtIso);
    } catch (dbUpdateError: any) {
      console.error('[KISPG Return] DB 업데이트 실패 (1차):', dbUpdateError?.message || dbUpdateError);
      // ★ 1차 실패 시 paymentKey 단독 저장으로 폴백 — 거래번호는 무조건 DB 에 남겨야 함
      try {
        await prisma.order.update({
          where: { id: orderId },
          data: {
            status: 'CONFIRMED',
            paymentMethod: payMethodToKorean(payMethod),
            paymentKey: tid,
          },
        });
        console.log('[KISPG Return] DB 업데이트 성공 (2차 폴백, paidAt 제외)! orderId:', orderId, 'tid:', tid);
      } catch (dbUpdateError2: any) {
        console.error('[KISPG Return] DB 업데이트 실패 (2차):', dbUpdateError2?.message || dbUpdateError2);
        // ★ 2차도 실패하면 paymentKey 만 단독으로 — 어떤 경우에도 거래번호 누락 금지
        try {
          await prisma.order.update({
            where: { id: orderId },
            data: { paymentKey: tid },
          });
          console.log('[KISPG Return] paymentKey 단독 저장 성공 (3차 폴백)! orderId:', orderId, 'tid:', tid);
        } catch (dbUpdateError3: any) {
          console.error('[KISPG Return] paymentKey 단독 저장도 실패 (3차):', dbUpdateError3?.message || dbUpdateError3);
        }
      }
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
    return NextResponse.redirect(failUrl.toString(), 303);
  }
}

// ─── 성공 페이지 redirect 헬퍼 ───
// [2026-05-11 v2] 표준 HTTP 303 redirect 사용 (HTML+JS 방식 제거)
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
  return NextResponse.redirect(successUrl.toString(), 303);
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
 * [BUG FIX 2026-05-11 v2] HTTP 303 redirect 사용
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
        return NextResponse.redirect(failUrl.toString(), 303);
      }

      // 이미 결제 완료된 주문은 바로 성공 페이지로
      if (order.status === 'CONFIRMED' || order.status === 'SHIPPING' || order.status === 'DELIVERED') {
        console.log('[KISPG Return GET] 이미 결제 완료된 주문:', orderId, order.status);
        return redirectToSuccess(baseUrl, orderId, order.orderNumber, Math.round(order.total), order.paymentKey || tid || '', payMethod || 'card');
      }

      // PENDING 상태이고 tid가 있으면 승인 시도
      if (order.status === 'PENDING' && tid && tid.length > 10) {
        console.log('[KISPG Return GET] PENDING 주문 + tid 존재 → 승인 시도');
        
        // tid 사전 저장
        try {
          await prisma.order.update({
            where: { id: orderId },
            data: { paymentKey: tid, paymentMethod: payMethodToKorean(payMethod || 'card') },
          });
        } catch {}

        try {
          const approveResult = await approveKispgPayment({
            tid,
            goodsAmt: Math.round(order.total),
          });
          
          // [2026-05-11 HOTFIX] paidAt Invalid Date 차단 + 3단 폴백 — 거래번호 누락 절대 금지
          const paidAtIsoGet = safePaidAtIso(approveResult?.appDtm);
          try {
            await prisma.order.update({
              where: { id: orderId },
              data: {
                status: 'CONFIRMED',
                paymentMethod: payMethodToKorean(payMethod || 'card'),
                paymentKey: tid,
                paidAt: paidAtIsoGet,
              },
            });
            console.log('[KISPG Return GET] DB 업데이트 성공! orderId:', orderId, 'tid:', tid, 'paidAt:', paidAtIsoGet);
          } catch (dbErrGet1: any) {
            console.error('[KISPG Return GET] DB 업데이트 실패 (1차):', dbErrGet1?.message || dbErrGet1);
            try {
              await prisma.order.update({
                where: { id: orderId },
                data: {
                  status: 'CONFIRMED',
                  paymentMethod: payMethodToKorean(payMethod || 'card'),
                  paymentKey: tid,
                },
              });
              console.log('[KISPG Return GET] DB 업데이트 성공 (2차 폴백, paidAt 제외)! tid:', tid);
            } catch (dbErrGet2: any) {
              console.error('[KISPG Return GET] DB 업데이트 실패 (2차):', dbErrGet2?.message || dbErrGet2);
              try {
                await prisma.order.update({
                  where: { id: orderId },
                  data: { paymentKey: tid },
                });
                console.log('[KISPG Return GET] paymentKey 단독 저장 성공 (3차 폴백)! tid:', tid);
              } catch (dbErrGet3: any) {
                console.error('[KISPG Return GET] paymentKey 단독 저장 실패 (3차):', dbErrGet3?.message || dbErrGet3);
              }
            }
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
        return NextResponse.redirect(failUrl.toString(), 303);
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
  return NextResponse.redirect(failUrl.toString(), 303);
}
