import { NextRequest, NextResponse } from 'next/server';
import { buildAuthFormData, KISPG_AUTH_URL } from '@/lib/kispg';
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

    // 상품명 생성
    const goodsNm = order.items.length === 1
      ? order.items[0].product.name
      : `${order.items[0].product.name} 외 ${order.items.length - 1}건`;

    // 주문자 정보
    const ordNm = order.user?.name || order.shippingName;
    const ordTel = order.user?.phone || order.shippingPhone || order.guestPhone || '';
    const ordEmail = order.user?.email || order.guestEmail || '';

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://qrlive.io';
    const returnUrl = `${baseUrl}/api/payments/kispg/return`;

    // mbsReserved에 주문 ID를 넣어서 returnUrl에서 식별
    const formData = await buildAuthFormData({
      ordNo: order.orderNumber,
      goodsNm,
      goodsAmt: order.total,
      ordNm,
      ordTel,
      ordEmail,
      returnUrl,
      payMethod: 'card',
      mbsReserved: orderId,
    });

    // 자동 submit HTML 생성 (KISPG 권장 방식: full-page form POST)
    const formFields = Object.entries(formData)
      .map(([key, value]) => `<input type="hidden" name="${key}" value="${escapeHtml(String(value))}">`)
      .join('\n    ');

    const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>결제 진행 중 - QRLIVE</title>
  <style>
    body {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .loading {
      text-align: center;
    }
    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid #e2e8f0;
      border-top: 4px solid #3b82f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    p { color: #64748b; font-size: 16px; }
  </style>
</head>
<body>
  <div class="loading">
    <div class="spinner"></div>
    <p>결제 페이지로 이동 중입니다...</p>
  </div>
  <form id="kispgForm" method="POST" action="${escapeHtml(KISPG_AUTH_URL)}">
    ${formFields}
  </form>
  <script>
    document.getElementById('kispgForm').submit();
  </script>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error: any) {
    console.error('KISPG payment request error:', error);
    return NextResponse.json(
      { success: false, error: error.message || '결제 요청 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
