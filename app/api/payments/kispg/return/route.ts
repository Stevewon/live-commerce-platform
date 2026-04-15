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
 */
export async function POST(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://qrlive.io';

  // 파라미터 파싱 (formData 파싱 실패 방지를 위해 여러 방법 시도)
  let params: Record<string, string> = {};

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

    // 방법 2: formData() fallback
    try {
      const clonedRequest = request.clone();
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

  // mbsReserved에 orderId(DB 주문 ID)가 들어있음
  const orderId = mbsReserved;

  console.log('[KISPG Return] resultCd:', resultCd, 'resultMsg:', resultMsg, 'tid:', tid, 'ordNo:', ordNo, 'amt:', amt, 'orderId:', orderId);

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
      const successUrl = new URL('/payment/success', baseUrl);
      successUrl.searchParams.set('orderId', orderId);
      successUrl.searchParams.set('orderNumber', order.orderNumber);
      successUrl.searchParams.set('amount', Math.round(order.total).toString());
      successUrl.searchParams.set('tid', tid || order.paymentKey || '');
      successUrl.searchParams.set('payMethod', payMethod || 'card');
      return NextResponse.redirect(successUrl.toString(), 303);
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
      return NextResponse.redirect(failUrl.toString(), 303);
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
    } catch (approveError: any) {
      console.error('[KISPG Return] 승인 실패:', approveError.message);
      
      // 중요: 카드 결제는 이미 완료되었을 수 있음!
      // 승인 실패해도 무조건 주문 취소하지 않음
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
      const isMoidDuplicate = approveError.message?.includes('MOID') || approveError.message?.includes('중복') || approveError.message?.includes('이미 처리');
      let userMessage: string;
      if (isFirewall) {
        userMessage = '결제 승인 서버 연결에 실패했습니다. 결제금액은 자동 환불됩니다. 잠시 후 다시 시도해주세요.';
      } else if (isMoidDuplicate) {
        userMessage = '주문번호(MOID)중복 또는 이미 처리된 주문입니다. 주문내역을 확인 후 새로 주문해주세요.';
        // MOID 중복이면 주문을 CANCELLED로 변경하여 재주문 유도
        try {
          await prisma.order.update({
            where: { id: orderId },
            data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: '결제 승인 실패 (MOID 중복)' },
          });
          console.log('[KISPG Return] MOID 중복 → 주문 취소 처리:', orderId);
        } catch (cancelErr: any) {
          console.error('[KISPG Return] MOID 중복 주문 취소 실패:', cancelErr.message);
        }
      } else {
        userMessage = approveError.message || '결제 처리 중 문제가 발생했습니다';
      }
      failUrl.searchParams.set('message', userMessage);
      failUrl.searchParams.set('orderId', orderId);
      return NextResponse.redirect(failUrl.toString(), 303);
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
    const successUrl = new URL('/payment/success', baseUrl);
    successUrl.searchParams.set('orderId', orderId);
    successUrl.searchParams.set('orderNumber', order.orderNumber);
    successUrl.searchParams.set('amount', orderTotal.toString());
    successUrl.searchParams.set('tid', tid);
    successUrl.searchParams.set('payMethod', payMethod);
    if (approveResult.appNo) {
      successUrl.searchParams.set('appNo', approveResult.appNo);
    }
    return NextResponse.redirect(successUrl.toString(), 303);

  } catch (error: any) {
    console.error('[KISPG Return] 처리 오류:', error?.message || error, 'stack:', error?.stack);
    const failUrl = new URL('/payment/fail', baseUrl);
    failUrl.searchParams.set('code', 'SYSTEM_ERROR');
    failUrl.searchParams.set('message', '결제 처리 중 시스템 오류가 발생했습니다. 결제가 완료된 경우 관리자에게 문의해주세요.');
    if (orderId) failUrl.searchParams.set('orderId', orderId);
    return NextResponse.redirect(failUrl.toString(), 303);
  }
}

// ─── 주문 취소 + 재고 복구 헬퍼 ───
async function cancelOrderAndRestoreStock(prisma: any, orderId: string) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order || order.status === 'CANCELLED') return;

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
export async function GET(request: NextRequest) {
  console.log('[KISPG Return] GET 요청 수신 - URL:', request.url);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://qrlive.io';
  
  // URL 쿼리 파라미터에서 결제 정보 추출 시도
  const url = new URL(request.url);
  const orderId = url.searchParams.get('orderId') || url.searchParams.get('mbsReserved') || '';
  
  if (orderId) {
    // orderId가 있으면 주문 상태 확인 후 적절한 페이지로 이동
    try {
      const prisma = await getPrisma();
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (order && (order.status === 'CONFIRMED' || order.status === 'SHIPPING' || order.status === 'DELIVERED')) {
        const successUrl = new URL('/payment/success', baseUrl);
        successUrl.searchParams.set('orderId', orderId);
        successUrl.searchParams.set('orderNumber', order.orderNumber);
        successUrl.searchParams.set('amount', Math.round(order.total).toString());
        return NextResponse.redirect(successUrl.toString(), 303);
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
  return NextResponse.redirect(failUrl.toString(), 303);
}
