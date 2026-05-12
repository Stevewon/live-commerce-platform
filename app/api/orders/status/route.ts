import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { inquireKispgPayment, classifyInquireResult } from '@/lib/kispg';

/**
 * GET /api/orders/status?orderId=xxx&escalate=0|1
 *
 * 결제 후 주문 상태를 확인하는 경량 API
 * - 인증 불필요 (결제 실패 페이지 / 결제 대기 화면에서 호출)
 * - 최소한의 정보만 반환 (보안: 주소/연락처/TID 등 민감 정보 제외)
 * - 회원/비회원 모두 지원
 *
 * [2026-04-30] 결제 성공인데 실패 페이지로 이동하는 버그 수정 시 추가
 * → 실패 페이지에서 이 API로 주문 상태를 재확인하여, 실제로 결제 완료된 경우 성공 페이지로 자동 이동
 *
 * [2026-05-12 v1.0.15] PC 결제완료 미표시 사고 방지 폴링 보강
 * → 결제 대기 화면(PaymentWaitingScreen)이 5초 간격으로 폴링
 * → escalate=1 파라미터 전달 시 PENDING 상태면 KISPG /v2/order 거래조회 자동 호출
 *   → KISPG 측 실제 상태(승인/취소/입금대기/UNKNOWN)에 따라 자동 DB UPDATE
 *   → PC 사용자가 결제완료 화면을 못 봐도 폴링 화면이 자동 결과 페이지로 이동
 * → 모바일 영향 0건: 모바일은 returnUrl 응답이 정상 도달 → 폴링 시작 직후 CONFIRMED 감지 → 즉시 이동
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    const escalate = searchParams.get('escalate') === '1';

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'orderId가 필요합니다' },
        { status: 400 }
      );
    }

    const prisma = await getPrisma();
    let order: any = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        paymentMethod: true,
        paidAt: true,
        createdAt: true,
        cancelledAt: true,
        cancelReason: true,
        paymentKey: true, // 내부 escalate 처리용 — 응답에는 포함하지 않음
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // [2026-05-12] escalate=1 + 아직 PENDING + paymentKey 비어있거나 placeholder
    //   → KISPG `/v2/order` 거래조회 자동 호출 → 자동 동기화
    //   인증 불필요 API 이므로 escalate 트리거는 클라이언트가 일정 횟수 폴링 후에만 보내도록 약속
    //   (오남용 방지: rate limit 은 KISPG 측 자체 + paymentKey 형식 검증으로 자연 차단)
    let escalateResult: any = null;
    if (
      escalate &&
      order.status === 'PENDING' &&
      (!order.paymentKey || order.paymentKey === '' || String(order.paymentKey).startsWith('MANUAL-RECOVERY-'))
    ) {
      const goodsAmt = Number(order.total);
      if (Number.isFinite(goodsAmt) && goodsAmt > 0) {
        try {
          const inquireRes = await inquireKispgPayment({
            ordNo: order.orderNumber,
            goodsAmt,
          });
          const classified = classifyInquireResult(inquireRes);
          console.log(
            '[orders/status] escalate inquire:',
            order.orderNumber,
            'kind=', classified.kind,
            'tid=', classified.tid
          );

          const nowIso = new Date().toISOString();

          if (classified.kind === 'CONFIRMED' && classified.tid) {
            const paymentMethodKr = payMethodToKorean(classified.payMethod || 'card');
            const paidAtIso = appDtmToIso(classified.appDtm) || nowIso;
            try {
              await prisma.$executeRawUnsafe(
                `UPDATE "Order"
                 SET status = ?, paymentMethod = ?, paymentKey = ?, paidAt = ?, updatedAt = ?
                 WHERE id = ?`,
                'CONFIRMED', paymentMethodKr, classified.tid, paidAtIso, nowIso, order.id
              );
              escalateResult = { kind: 'CONFIRMED', applied: true };
              // 사후 재조회
              order = await prisma.order.findUnique({
                where: { id: orderId },
                select: {
                  id: true, orderNumber: true, status: true, total: true,
                  paymentMethod: true, paidAt: true, createdAt: true,
                  cancelledAt: true, cancelReason: true, paymentKey: true,
                },
              });
            } catch (e: any) {
              console.error('[orders/status] escalate CONFIRMED UPDATE 실패:', e?.message || e);
              escalateResult = { kind: 'CONFIRMED', applied: false, error: e?.message || String(e) };
            }
          } else if (classified.kind === 'CANCELLED' && classified.tid) {
            try {
              const paymentMethodKr = payMethodToKorean(classified.payMethod || 'card');
              await prisma.$executeRawUnsafe(
                `UPDATE "Order"
                 SET status = ?, paymentMethod = ?, paymentKey = ?, cancelledAt = ?, cancelReason = ?, updatedAt = ?
                 WHERE id = ?`,
                'CANCELLED', paymentMethodKr, classified.tid, nowIso,
                'KISPG 측 취소 확인 (자동 동기화)', nowIso, order.id
              );
              escalateResult = { kind: 'CANCELLED', applied: true };
              order = await prisma.order.findUnique({
                where: { id: orderId },
                select: {
                  id: true, orderNumber: true, status: true, total: true,
                  paymentMethod: true, paidAt: true, createdAt: true,
                  cancelledAt: true, cancelReason: true, paymentKey: true,
                },
              });
            } catch (e: any) {
              console.error('[orders/status] escalate CANCELLED UPDATE 실패:', e?.message || e);
              escalateResult = { kind: 'CANCELLED', applied: false, error: e?.message || String(e) };
            }
          } else if (classified.kind === 'PENDING') {
            // 가상계좌 입금대기 — 변경 없음
            escalateResult = { kind: 'PENDING', applied: false };
          } else {
            // UNKNOWN — 변경 없음 (cron 의 30분 룰에 위임)
            escalateResult = { kind: 'UNKNOWN', applied: false };
          }
        } catch (inqErr: any) {
          console.error('[orders/status] escalate inquire 호출 실패:', inqErr?.message || inqErr);
          escalateResult = { kind: 'INQUIRE_FAILED', applied: false, error: inqErr?.message || String(inqErr) };
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.total,
        paymentMethod: order.paymentMethod,
        isPaid: ['CONFIRMED', 'SHIPPING', 'DELIVERED'].includes(order.status),
        isCancelled: order.status === 'CANCELLED',
        paidAt: order.paidAt,
        cancelledAt: order.cancelledAt,
        cancelReason: order.cancelReason,
      },
      escalate: escalateResult,
    });
  } catch (error: any) {
    console.error('[Order Status] 조회 실패:', error?.message || error);
    return NextResponse.json(
      { success: false, error: '주문 상태 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

function payMethodToKorean(method: string): string {
  const m = String(method || '').toLowerCase();
  const map: Record<string, string> = {
    card: '신용카드',
    bank: '계좌이체',
    vacnt: '가상계좌',
    hp: '휴대폰결제',
  };
  return map[m] || method || '신용카드';
}

function appDtmToIso(appDtm?: string): string | null {
  if (!appDtm || typeof appDtm !== 'string') return null;
  const clean = appDtm.replace(/\D/g, '');
  if (clean.length !== 14) return null;
  const y = clean.slice(0, 4);
  const mo = clean.slice(4, 6);
  const d = clean.slice(6, 8);
  const h = clean.slice(8, 10);
  const mi = clean.slice(10, 12);
  const s = clean.slice(12, 14);
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}+09:00`;
  const parsed = new Date(iso);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
