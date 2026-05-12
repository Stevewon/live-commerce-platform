import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';
import { inquireKispgPayment, classifyInquireResult } from '@/lib/kispg';

/**
 * POST /api/admin/stuck-orders/inquire
 *
 * [2026-05-12 옵션 1] KISPG 거래조회 자동 복구 (어드민 원클릭)
 *
 * 동작:
 * 1) 어드민 권한 확인
 * 2) Body { orderId } 또는 { orderNumber } 로 주문 식별
 * 3) DB 에서 orderNumber(ordNo) + total(goodsAmt) 추출
 * 4) KISPG `/v2/order` 거래조회 호출
 * 5) classifyInquireResult 로 상태 분류:
 *    - CONFIRMED → paymentKey/status/paidAt 자동 저장
 *    - CANCELLED → status=CANCELLED 자동 반영
 *    - PENDING (가상계좌 입금대기) → 변경 없음, 정보만 반환
 *    - UNKNOWN → 변경 없음, 사장님 수동 확인 안내
 *
 * 사장님 사고 케이스(지나/hero zina) 처리 흐름:
 *   DB: ORD-1778558607255 PENDING, paymentKey=MANUAL-RECOVERY-xxx, total=3010
 *   → 이 API 호출
 *   → KISPG inquire(ordNo='ORD-1778558607255', goodsAmt=3010)
 *   → 응답에 실제 tid + appNo + trxStatus='승인'
 *   → DB 자동 업데이트: paymentKey = 실제 tid, status='CONFIRMED', paidAt=KISPG appDtm 또는 now
 *
 * Body:
 *   { orderId?: string, orderNumber?: string }  (둘 중 하나 필수)
 */
export async function POST(request: NextRequest) {
  const prisma = await getPrisma();
  try {
    const authResult = await verifyAuthToken(request);
    if (authResult instanceof NextResponse) return authResult;
    if (authResult.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const orderId: string = (body?.orderId || '').trim();
    const orderNumber: string = (body?.orderNumber || '').trim();
    if (!orderId && !orderNumber) {
      return NextResponse.json(
        { success: false, error: 'orderId 또는 orderNumber 중 하나는 필수' },
        { status: 400 }
      );
    }

    // 1) DB 에서 주문 조회 (id 우선)
    const whereCol = orderId ? 'id' : 'orderNumber';
    const whereVal = orderId || orderNumber;
    let order: any = null;
    try {
      const rows: any = await prisma.$queryRawUnsafe(
        `SELECT id, orderNumber, status, paymentMethod, paymentKey, paidAt, total, shippingName
         FROM "Order" WHERE "${whereCol}" = ? LIMIT 1`,
        whereVal
      );
      order = Array.isArray(rows) ? rows[0] : (rows?.results?.[0] || rows);
    } catch (e: any) {
      console.error('[admin/stuck-orders/inquire] DB SELECT 실패:', e?.message || e);
      return NextResponse.json(
        { success: false, error: 'DB 조회 실패', detail: e?.message || String(e) },
        { status: 500 }
      );
    }

    if (!order) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다', whereCol, whereVal },
        { status: 404 }
      );
    }

    const goodsAmt = Number(order.total);
    if (!Number.isFinite(goodsAmt) || goodsAmt <= 0) {
      return NextResponse.json(
        { success: false, error: '주문 금액이 비정상', total: order.total },
        { status: 400 }
      );
    }

    // 2) KISPG 거래조회 (ordNo 기반 — paymentKey 가 placeholder 일 수 있으므로 tid 미사용)
    //    기존 paymentKey 가 KISPG 형식(quanta001m... 같은 실제 TID)이면 tid 우선 시도 가능하지만,
    //    여기서는 ordNo 단독 조회로 단순화 (KISPG 가 ordNo 로 단일 거래 식별)
    let inquireRes: any;
    try {
      inquireRes = await inquireKispgPayment({
        ordNo: order.orderNumber,
        goodsAmt,
      });
    } catch (e: any) {
      console.error('[admin/stuck-orders/inquire] KISPG 조회 실패:', e?.message || e);
      return NextResponse.json(
        {
          success: false,
          error: 'KISPG 거래조회 실패',
          detail: e?.message || String(e),
          order: {
            id: order.id,
            orderNumber: order.orderNumber,
            status: order.status,
            paymentKey: order.paymentKey,
          },
        },
        { status: 502 }
      );
    }

    const classified = classifyInquireResult(inquireRes);
    console.log(
      '[admin/stuck-orders/inquire] classified:',
      JSON.stringify(classified),
      'orderNumber:', order.orderNumber
    );

    // 3) 결과 분류에 따른 DB 업데이트
    const nowIso = new Date().toISOString();
    let updated = false;
    let updateChanges = 0;
    const before = {
      status: order.status,
      paymentKey: order.paymentKey,
      paymentMethod: order.paymentMethod,
      paidAt: order.paidAt,
    };

    if (classified.kind === 'CONFIRMED' && classified.tid) {
      // CONFIRMED 자동 저장 (paymentKey 가 placeholder 이거나 비어있을 때만)
      // 이미 같은 tid 가 박혀있고 status=CONFIRMED 면 skip (idempotent)
      const sameTid = order.paymentKey === classified.tid;
      const alreadyConfirmed = order.status === 'CONFIRMED';
      if (sameTid && alreadyConfirmed) {
        console.log('[admin/stuck-orders/inquire] 이미 CONFIRMED + 동일 tid — skip');
      } else {
        const paymentMethodKr = payMethodToKorean(classified.payMethod || 'card');
        // appDtm(yyyymmddhhmmss) 을 ISO 변환 시도 (실패 시 nowIso 폴백)
        const paidAtIso = appDtmToIso(classified.appDtm) || nowIso;
        try {
          updateChanges = await prisma.$executeRawUnsafe(
            `UPDATE "Order"
             SET status = ?, paymentMethod = ?, paymentKey = ?, paidAt = ?, updatedAt = ?
             WHERE id = ?`,
            'CONFIRMED', paymentMethodKr, classified.tid, paidAtIso, nowIso, order.id
          );
          updated = true;
          console.log(
            '[admin/stuck-orders/inquire] CONFIRMED 자동 저장. changes=',
            updateChanges,
            'orderNumber=', order.orderNumber,
            'tid=', classified.tid
          );
        } catch (e: any) {
          console.error('[admin/stuck-orders/inquire] UPDATE 실패:', e?.message || e);
          return NextResponse.json(
            {
              success: false,
              error: 'DB UPDATE 실패',
              detail: e?.message || String(e),
              classified,
            },
            { status: 500 }
          );
        }
      }
    } else if (classified.kind === 'CANCELLED' && classified.tid) {
      // KISPG 측에서 이미 취소된 거래 — DB 도 CANCELLED 로 정정
      if (order.status === 'CANCELLED') {
        console.log('[admin/stuck-orders/inquire] 이미 CANCELLED — skip');
      } else {
        try {
          const paymentMethodKr = payMethodToKorean(classified.payMethod || 'card');
          updateChanges = await prisma.$executeRawUnsafe(
            `UPDATE "Order"
             SET status = ?, paymentMethod = ?, paymentKey = ?, cancelledAt = ?, cancelReason = ?, updatedAt = ?
             WHERE id = ?`,
            'CANCELLED', paymentMethodKr, classified.tid, nowIso, 'KISPG 측 취소 확인 (자동 동기화)', nowIso, order.id
          );
          updated = true;
          console.log(
            '[admin/stuck-orders/inquire] CANCELLED 자동 동기화. changes=',
            updateChanges,
            'orderNumber=', order.orderNumber
          );
        } catch (e: any) {
          console.error('[admin/stuck-orders/inquire] CANCELLED UPDATE 실패:', e?.message || e);
        }
      }
    }
    // PENDING (가상계좌 입금대기) / UNKNOWN → DB 변경 없음

    // 4) 사후 조회로 최종 상태 확인
    let after: any = null;
    try {
      const rows2: any = await prisma.$queryRawUnsafe(
        `SELECT id, orderNumber, status, paymentMethod, paymentKey, paidAt
         FROM "Order" WHERE id = ? LIMIT 1`,
        order.id
      );
      after = Array.isArray(rows2) ? rows2[0] : (rows2?.results?.[0] || rows2);
    } catch {}

    return NextResponse.json({
      success: true,
      orderNumber: order.orderNumber,
      kispg: {
        resultCd: inquireRes?.resultCd,
        resultMsg: inquireRes?.resultMsg,
        tid: inquireRes?.tid,
        appNo: inquireRes?.appNo,
        appDtm: inquireRes?.appDtm,
        amt: inquireRes?.amt,
        payMethod: inquireRes?.payMethod,
        trxStatus: inquireRes?.trxStatus,
        cancelYN: inquireRes?.cancelYN,
        fnNm: inquireRes?.fnNm,
      },
      classified: { kind: classified.kind },
      updated,
      updateChanges,
      before,
      after,
    });
  } catch (error: any) {
    console.error('[admin/stuck-orders/inquire] 예외:', error?.message || error);
    return NextResponse.json(
      { success: false, error: 'inquire error', detail: error?.message || String(error) },
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

/**
 * KISPG appDtm (yyyymmddhhmmss) → ISO 8601 변환
 * 실패 시 null 반환 (호출부에서 nowIso 폴백)
 */
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
  // KISPG appDtm 은 KST 기준 → ISO 변환 시 +09:00 명시
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}+09:00`;
  const parsed = new Date(iso);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
