import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth/middleware';
import { getPrisma } from '@/lib/prisma';
import { getCarrierId, getTrackingUrl } from '@/lib/utils/courier';
import { trackShipment, isInAppTrackingEnabled } from '@/lib/tracking/delivery-tracker';

/**
 * GET /api/orders/[id]/tracking — 인앱 배송추적
 * ---------------------------------------------------------------------------
 * 외부 택배사 사이트로 나가지 않고, 우리 서버가 Delivery Tracker 로 배송추적
 * 데이터를 받아와 반환한다. 프론트는 이걸로 모바일 최적화 타임라인을 그린다.
 *
 * 보안:
 *   - 본인 주문(회원) / 비회원 토큰 / 관리자만 조회 가능 (주문상세 API 와 동일)
 *   - 운송장 번호는 주문 레코드에 저장된 값만 사용 (임의 운송장 조회 차단)
 *
 * 폴백:
 *   - credentials 미설정 또는 미지원 택배사 → supported=false + externalUrl 반환.
 *     프론트는 externalUrl(외부 링크)로 폴백한다.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const prisma = await getPrisma();
  try {
    const { id: orderId } = await context.params;

    // 인증 (회원)
    let userId: string | null = null;
    let userRole: string | null = null;
    const authResult = await verifyAuthToken(req);
    if (!(authResult instanceof NextResponse)) {
      userId = authResult.userId;
      userRole = authResult.role || null;
    }

    const guestOrderToken =
      req.headers.get('x-guest-order-token') ||
      new URL(req.url).searchParams.get('guestOrderToken') ||
      '';

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        guestOrderToken: true,
        trackingCompany: true,
        trackingNumber: true,
      },
    });

    if (!order) {
      return NextResponse.json({ success: false, error: '주문을 찾을 수 없습니다' }, { status: 404 });
    }

    // 소유권 검증 (주문상세 API 와 동일)
    const isAdmin = userRole === 'ADMIN';
    const isOwnerMember = userId && order.userId === userId;
    const isOwnerGuest = !order.userId && guestOrderToken && order.guestOrderToken === guestOrderToken;
    if (!isAdmin && !isOwnerMember && !isOwnerGuest) {
      return NextResponse.json({ success: false, error: '접근 권한이 없습니다' }, { status: 403 });
    }

    const company = order.trackingCompany || '';
    const trackingNumber = order.trackingNumber || '';

    if (!company || !trackingNumber) {
      return NextResponse.json(
        { success: false, error: '아직 운송장 정보가 등록되지 않았습니다.', supported: true },
        { status: 200 }
      );
    }

    const carrierId = getCarrierId(company);
    const externalUrl = getTrackingUrl(company, trackingNumber);

    // 인앱 추적 미설정/미지원 → 외부 링크 폴백 신호
    if (!isInAppTrackingEnabled() || !carrierId) {
      return NextResponse.json({
        success: true,
        supported: false,
        externalUrl,
        carrierName: company,
        trackingNumber,
      });
    }

    const outcome = await trackShipment(carrierId, trackingNumber);

    if (!outcome.ok) {
      // 지원되지만 조회 실패 → 외부 링크도 함께 넘겨서 프론트가 대안 제시
      return NextResponse.json({
        success: false,
        supported: outcome.supported,
        error: outcome.error || '배송 정보를 불러오지 못했습니다.',
        externalUrl,
        carrierName: company,
        trackingNumber,
      });
    }

    return NextResponse.json({
      success: true,
      supported: true,
      carrierName: company,
      trackingNumber,
      from: outcome.data?.from ?? null,
      to: outcome.data?.to ?? null,
      events: outcome.data?.events ?? [],
      externalUrl,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: '배송 정보를 불러오지 못했습니다.', detail: String(err?.message || err).slice(0, 200) },
      { status: 500 }
    );
  }
}
