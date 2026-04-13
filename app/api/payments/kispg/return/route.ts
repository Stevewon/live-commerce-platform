import { NextRequest, NextResponse } from 'next/server';
import { approveKispgPayment, verifyAuthResult } from '@/lib/kispg';
import { getPrisma } from '@/lib/prisma';

/**
 * POST /api/payments/kispg/return
 * 
 * KISPG 결제창에서 인증 완료 후 이 URL로 POST redirect된다.
 * 인증 결과를 검증하고 → 승인 API를 호출 → 성공/실패 페이지로 redirect.
 * 
 * KISPG 인증 결과 파라미터:
 *   resultCd, resultMsg, payMethod, tid, ordNo, amt, ediDate, encData, mbsReserved
 */
export async function POST(request: NextRequest) {
  const prisma = await getPrisma();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://qrlive.io';

  try {
    // KISPG는 application/x-www-form-urlencoded로 POST
    const formData = await request.formData();

    const resultCd = formData.get('resultCd') as string || '';
    const resultMsg = formData.get('resultMsg') as string || '';
    const payMethod = formData.get('payMethod') as string || '';
    const tid = formData.get('tid') as string || '';
    const ordNo = formData.get('ordNo') as string || '';
    const amt = formData.get('amt') as string || '';
    const ediDate = formData.get('ediDate') as string || '';
    const encData = formData.get('encData') as string || '';
    const mbsReserved = formData.get('mbsReserved') as string || '';

    // mbsReserved에 orderId(DB 주문 ID)가 들어있음
    const orderId = mbsReserved;

    console.log('[KISPG Return] resultCd:', resultCd, 'resultMsg:', resultMsg, 'tid:', tid, 'ordNo:', ordNo, 'amt:', amt);

    // 1) 인증 실패 처리
    if (resultCd !== '0000') {
      console.error('[KISPG Return] 인증 실패:', resultCd, resultMsg);
      
      // 주문 상태를 CANCELLED로 변경하고 재고 복구
      if (orderId) {
        await cancelOrderAndRestoreStock(prisma, orderId);
      }

      const failUrl = new URL('/payment/fail', baseUrl);
      failUrl.searchParams.set('code', resultCd);
      failUrl.searchParams.set('message', resultMsg || '결제 인증에 실패했습니다');
      if (orderId) failUrl.searchParams.set('orderId', orderId);
      return NextResponse.redirect(failUrl.toString(), 303);
    }

    // 2) 주문 조회
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { product: true } },
      },
    });

    if (!order) {
      console.error('[KISPG Return] 주문을 찾을 수 없음:', orderId);
      const failUrl = new URL('/payment/fail', baseUrl);
      failUrl.searchParams.set('code', 'ORDER_NOT_FOUND');
      failUrl.searchParams.set('message', '주문을 찾을 수 없습니다');
      return NextResponse.redirect(failUrl.toString(), 303);
    }

    // 금액 검증
    if (order.total !== parseInt(amt)) {
      console.error('[KISPG Return] 금액 불일치:', order.total, 'vs', amt);
      await cancelOrderAndRestoreStock(prisma, orderId);
      const failUrl = new URL('/payment/fail', baseUrl);
      failUrl.searchParams.set('code', 'AMOUNT_MISMATCH');
      failUrl.searchParams.set('message', '결제 금액이 일치하지 않습니다');
      return NextResponse.redirect(failUrl.toString(), 303);
    }

    // 3) 결제 승인 API 호출
    let approveResult: any;
    try {
      approveResult = await approveKispgPayment({
        tid,
        goodsAmt: order.total,
      });
    } catch (approveError: any) {
      console.error('[KISPG Return] 승인 실패:', approveError.message);
      await cancelOrderAndRestoreStock(prisma, orderId);

      const failUrl = new URL('/payment/fail', baseUrl);
      failUrl.searchParams.set('code', 'APPROVE_FAILED');
      failUrl.searchParams.set('message', approveError.message || '결제 승인에 실패했습니다');
      failUrl.searchParams.set('orderId', orderId);
      return NextResponse.redirect(failUrl.toString(), 303);
    }

    // 4) 결제 성공 → DB 업데이트
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

    console.log('[KISPG Return] 결제 성공! orderId:', orderId, 'tid:', tid);

    // 5) 성공 페이지로 redirect
    const successUrl = new URL('/payment/success', baseUrl);
    successUrl.searchParams.set('orderId', orderId);
    successUrl.searchParams.set('orderNumber', order.orderNumber);
    successUrl.searchParams.set('amount', amt);
    successUrl.searchParams.set('tid', tid);
    successUrl.searchParams.set('payMethod', payMethod);
    if (approveResult.appNo) {
      successUrl.searchParams.set('appNo', approveResult.appNo);
    }
    return NextResponse.redirect(successUrl.toString(), 303);

  } catch (error: any) {
    console.error('[KISPG Return] 처리 오류:', error);
    const failUrl = new URL('/payment/fail', baseUrl);
    failUrl.searchParams.set('code', 'SYSTEM_ERROR');
    failUrl.searchParams.set('message', '결제 처리 중 시스템 오류가 발생했습니다');
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
