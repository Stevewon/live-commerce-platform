import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';

const STATUS_LABELS: Record<string, string> = {
  PENDING: '대기중',
  CONFIRMED: '확인됨',
  SHIPPING: '배송중',
  DELIVERED: '배송완료',
  CANCELLED: '취소됨',
  REFUNDED: '환불됨',
};

// CSV 셀 값 이스케이프 처리
function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // 쉼표, 줄바꿈, 따옴표가 포함되면 따옴표로 감싸기
  if (str.includes(',') || str.includes('\n') || str.includes('"') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// GET /api/admin/orders/export - 주문 목록 엑셀(CSV) 다운로드
export async function GET(req: NextRequest) {
  const prisma = await getPrisma();
  try {
    const authResult = await verifyAuthToken(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (authResult.role !== 'ADMIN') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    // 쿼리 파라미터 (필터 유지)
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'ALL';
    const search = searchParams.get('search') || '';
    const partnerId = searchParams.get('partnerId') || '';

    // 필터 조건
    const where: any = {};

    if (status !== 'ALL') {
      where.status = status;
    }

    if (partnerId) {
      where.partnerId = partnerId;
    }

    if (search) {
      const orderNumberFilter = { orderNumber: { contains: search } };
      let searchUserIds: string[] = [];
      try {
        const matchingUsers = await prisma.user.findMany({
          where: {
            OR: [
              { name: { contains: search } },
              { nickname: { contains: search } },
              { email: { contains: search } },
            ],
          },
        });
        searchUserIds = matchingUsers.map((u: any) => u.id);
      } catch {
        searchUserIds = [];
      }

      const orConditions: any[] = [orderNumberFilter];
      if (searchUserIds.length > 0) {
        orConditions.push({ userId: { in: searchUserIds } });
      }
      where.OR = orConditions;
    }

    // 전체 주문 조회 (페이지네이션 없이)
    const orders = await prisma.order.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            email: true,
            nickname: true,
            phone: true,
          },
        },
        partner: {
          select: {
            storeName: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                name: true,
                price: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // CSV 헤더 (BOM 포함 - Excel에서 한글 깨짐 방지)
    const BOM = '\uFEFF';
    const headers = [
      '주문번호',
      '주문일시',
      '주문상태',
      '고객명',
      '고객이메일',
      '고객연락처',
      '비회원이메일',
      '비회원연락처',
      '받는분',
      '배송연락처',
      '배송주소',
      '우편번호',
      '배송메모',
      '상품명',
      '상품수량',
      '상품단가',
      '상품소계',
      '소계',
      '할인금액',
      '배송비',
      '총결제금액',
      '결제방법',
      '결제일시',
      '파트너',
      '택배사',
      '운송장번호',
      '발송일시',
      '배송완료일시',
    ];

    const rows: string[] = [headers.map(escapeCsvCell).join(',')];

    for (const order of orders as any[]) {
      const customerName = order.user?.name || order.user?.nickname || '비회원';
      const customerEmail = order.user?.email || '';
      const customerPhone = order.user?.phone || '';
      const orderDate = order.createdAt
        ? new Date(order.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
        : '';
      const paidDate = order.paidAt
        ? new Date(order.paidAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
        : '';
      const shippedDate = order.shippedAt
        ? new Date(order.shippedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
        : '';
      const deliveredDate = order.deliveredAt
        ? new Date(order.deliveredAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
        : '';

      const items = order.items || [];

      if (items.length === 0) {
        // 주문에 상품이 없는 경우 (드문 경우)
        rows.push([
          order.orderNumber,
          orderDate,
          STATUS_LABELS[order.status] || order.status,
          customerName,
          customerEmail,
          customerPhone,
          order.guestEmail || '',
          order.guestPhone || '',
          order.shippingName || '',
          order.shippingPhone || '',
          order.shippingAddress || '',
          order.shippingZipCode || '',
          order.shippingMemo || '',
          '', // 상품명
          '', // 수량
          '', // 단가
          '', // 소계
          order.subtotal || 0,
          order.discount || 0,
          order.shippingFee || 0,
          order.total || 0,
          order.paymentMethod || '',
          paidDate,
          order.partner?.storeName || '',
          order.trackingCompany || '',
          order.trackingNumber || '',
          shippedDate,
          deliveredDate,
        ].map(escapeCsvCell).join(','));
      } else {
        // 각 상품별 행 생성
        items.forEach((item: any, idx: number) => {
          rows.push([
            idx === 0 ? order.orderNumber : '', // 첫 번째 상품에만 주문번호
            idx === 0 ? orderDate : '',
            idx === 0 ? (STATUS_LABELS[order.status] || order.status) : '',
            idx === 0 ? customerName : '',
            idx === 0 ? customerEmail : '',
            idx === 0 ? customerPhone : '',
            idx === 0 ? (order.guestEmail || '') : '',
            idx === 0 ? (order.guestPhone || '') : '',
            idx === 0 ? (order.shippingName || '') : '',
            idx === 0 ? (order.shippingPhone || '') : '',
            idx === 0 ? (order.shippingAddress || '') : '',
            idx === 0 ? (order.shippingZipCode || '') : '',
            idx === 0 ? (order.shippingMemo || '') : '',
            item.product?.name || '삭제된 상품',
            item.quantity || 0,
            item.price || 0,
            (item.price || 0) * (item.quantity || 0),
            idx === 0 ? (order.subtotal || 0) : '',
            idx === 0 ? (order.discount || 0) : '',
            idx === 0 ? (order.shippingFee || 0) : '',
            idx === 0 ? (order.total || 0) : '',
            idx === 0 ? (order.paymentMethod || '') : '',
            idx === 0 ? paidDate : '',
            idx === 0 ? (order.partner?.storeName || '') : '',
            idx === 0 ? (order.trackingCompany || '') : '',
            idx === 0 ? (order.trackingNumber || '') : '',
            idx === 0 ? shippedDate : '',
            idx === 0 ? deliveredDate : '',
          ].map(escapeCsvCell).join(','));
        });
      }
    }

    const csvContent = BOM + rows.join('\r\n');

    // 파일명 생성
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const fileName = `orders_${dateStr}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch (error: any) {
    console.error('Admin orders export error:', error);
    return NextResponse.json({ error: '주문 목록 다운로드 실패' }, { status: 500 });
  }
}
