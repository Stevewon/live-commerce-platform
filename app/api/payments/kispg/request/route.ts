import { NextRequest, NextResponse } from 'next/server';
import { buildAuthFormData, getKispgAuthUrl } from '@/lib/kispg';
import { getPrisma } from '@/lib/prisma';

/**
 * POST /api/payments/kispg/request
 * 
 * 체크아웃에서 주문 생성 후 호출.
 * KISPG 결제창으로 자동 submit하는 HTML 폼을 반환한다.
 * 
 * Body: { orderId: string }
 *   - orderId: DB 주문 ID
 */
export async function POST(request: NextRequest) {
  const prisma = await getPrisma();

  try {
    const { orderId } = await request.json();

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: '주문 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // DB에서 주문 조회
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: { product: { select: { name: true } } }
        },
        user: { select: { name: true, email: true, phone: true } },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 이미 결제 완료된 주문은 결제 재시도 불가 (MOID 중복 방지)
    if (order.status === 'CONFIRMED' || order.status === 'SHIPPING' || order.status === 'DELIVERED') {
      return NextResponse.json(
        { success: false, error: '이미 결제가 완료된 주문입니다. 주문내역을 확인해주세요.' },
        { status: 400 }
      );
    }

    if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
      return NextResponse.json(
        { success: false, error: '취소 또는 환불된 주문입니다. 새로 주문해주세요.' },
        { status: 400 }
      );
    }

    if (order.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: '결제 대기 상태가 아닌 주문입니다.' },
        { status: 400 }
      );
    }

    // 상품명 생성 (특수문자 제거 - KISPG에서 일부 특수문자 거부)
    const rawGoodsNm = order.items.length === 1
      ? order.items[0].product.name
      : `${order.items[0].product.name} 외 ${order.items.length - 1}건`;
    const goodsNm = rawGoodsNm.replace(/[<>\"\'&\\]/g, '').substring(0, 40);

    // 주문자 정보 (KISPG는 ordTel 필수 - 빈값이면 W008 에러 발생)
    const ordNm = (order.user?.name || order.shippingName || '주문자').replace(/[<>\"\'&\\]/g, '');
    const rawTel = (order.shippingPhone || order.user?.phone || order.guestPhone || '').replace(/[^0-9-]/g, '');
    const ordTel = rawTel || '01000000000'; // KISPG 필수값 - 비어있으면 기본값
    const ordEmail = order.user?.email || order.guestEmail || '';

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://qrlive.io';
    const returnUrl = `${baseUrl}/api/payments/kispg/return`;

    console.log('[KISPG Request] orderId:', orderId, 'orderNumber:', order.orderNumber, 'total:', order.total, 'returnUrl:', returnUrl);

    // mbsReserved에 주문 ID를 넣어서 returnUrl에서 식별
    // goodsAmt는 반드시 정수 (원 단위)
    // ordNo: KISPG는 영문+숫자만 허용 (하이픈 등 특수문자 불가 - 9998 에러 발생)
    // MOID 중복 방지: 같은 주문으로 결제 재시도 시 KISPG가 중복 MOID를 거부하므로
    // ordNo에 밀리초 타임스탬프 + 랜덤값을 추가하여 매 요청마다 유니크하게 만듦
    // (DB의 orderNumber는 변경하지 않고, KISPG에 보내는 ordNo만 유니크화)
    const baseOrdNo = order.orderNumber.replace(/[^a-zA-Z0-9]/g, '');
    // 밀리초 타임스탬프(base36) + 2자리 랜덤 = 매우 높은 유니크성 보장
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 4);
    const safeOrdNo = `${baseOrdNo}T${timestamp}${random}`.substring(0, 40); // KISPG ordNo 최대 40자
    console.log('[KISPG Request] ordNo 변환:', order.orderNumber, '->', safeOrdNo);

    const formData = await buildAuthFormData({
      ordNo: safeOrdNo,
      goodsNm,
      goodsAmt: Math.round(order.total),
      ordNm,
      ordTel,
      ordEmail,
      returnUrl,
      payMethod: 'card',
      mbsReserved: orderId,
    });

    const authUrl = getKispgAuthUrl();
    console.log('[KISPG Request] Auth URL:', authUrl, 'formData.mid:', formData.mid, 'formData.goodsAmt:', formData.goodsAmt);

    // JSON으로 form 데이터 반환 → 클라이언트에서 동적 form 생성 후 submit
    // (document.write() 방식은 PC Chrome에서 차단될 수 있으므로 사용하지 않음)
    return NextResponse.json({
      success: true,
      authUrl,
      formData,
    });
  } catch (error: any) {
    console.error('KISPG payment request error:', error);
    return NextResponse.json(
      { success: false, error: error.message || '결제 요청 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}


