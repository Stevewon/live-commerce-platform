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

    // 주문자 정보
    const ordNm = (order.user?.name || order.shippingName || '주문자').replace(/[<>\"\'&\\]/g, '');
    const ordTel = (order.user?.phone || order.shippingPhone || order.guestPhone || '').replace(/[^0-9-]/g, '');
    const ordEmail = order.user?.email || order.guestEmail || '';

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://qrlive.io';
    const returnUrl = `${baseUrl}/api/payments/kispg/return`;

    console.log('[KISPG Request] orderId:', orderId, 'orderNumber:', order.orderNumber, 'total:', order.total, 'returnUrl:', returnUrl);

    // mbsReserved에 주문 ID를 넣어서 returnUrl에서 식별
    // goodsAmt는 반드시 정수 (원 단위)
    const formData = await buildAuthFormData({
      ordNo: order.orderNumber,
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


