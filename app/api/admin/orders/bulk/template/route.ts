import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth/middleware';
import { getPrisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

/**
 * GET /api/admin/orders/bulk/template
 * 
 * 송장 대량등록용 엑셀 템플릿 다운로드
 * - 시트 1: 송장 입력 시트 (주문번호, 택배사, 운송장번호)
 *   → 현재 CONFIRMED(확인됨) 상태의 주문 목록을 미리 채워줌
 * - 시트 2: 입력 가이드
 */
export async function GET(req: NextRequest) {
  const prisma = await getPrisma();

  try {
    // 관리자 인증
    const authResult = await verifyAuthToken(req);
    if (authResult instanceof NextResponse) return authResult;
    if (authResult.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    // 쿼리 파라미터: status 필터 (기본 CONFIRMED, 쉼표구분으로 복수)
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get('status') || 'CONFIRMED,PENDING';
    const statusList = statusParam.split(',').map(s => s.trim()).filter(Boolean);

    // 송장 미등록 주문 조회 (trackingNumber가 비어있는 주문)
    const orders = await prisma.order.findMany({
      where: {
        status: { in: statusList },
        OR: [
          { trackingNumber: null },
          { trackingNumber: '' },
        ],
      },
      include: {
        user: { select: { name: true, email: true, phone: true, nickname: true } },
        items: {
          include: {
            product: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000, // 최대 1000건
    });

    const wb = XLSX.utils.book_new();

    // ═══════════════════════════════════════
    // 시트 1: 송장 입력
    // ═══════════════════════════════════════
    const headers = [
      '주문번호*',
      '택배사*',
      '운송장번호*',
      '수령인(참고)',
      '연락처(참고)',
      '배송지(참고)',
      '상품명(참고)',
      '주문금액(참고)',
      '주문일시(참고)',
      '현재상태(참고)',
    ];

    const dataRows = orders.map((order: any) => {
      const itemNames = order.items.map((item: any) => {
        const productName = item.product?.name || '상품';
        return item.quantity > 1 ? `${productName} x${item.quantity}` : productName;
      }).join(', ');

      const customerName = order.user?.name || order.user?.nickname || order.shippingName || '-';
      const customerPhone = order.user?.phone || order.shippingPhone || '-';

      return [
        order.orderNumber,
        '', // 택배사 - 입력 필요
        '', // 운송장번호 - 입력 필요
        customerName,
        customerPhone,
        order.shippingAddress || '-',
        itemNames || '-',
        order.total,
        new Date(order.createdAt).toLocaleString('ko-KR'),
        order.status === 'CONFIRMED' ? '확인됨' :
          order.status === 'PENDING' ? '대기중' :
          order.status === 'SHIPPING' ? '배송중' : order.status,
      ];
    });

    const sheetData = [headers, ...dataRows];
    const ws1 = XLSX.utils.aoa_to_sheet(sheetData);

    // 열 너비 설정
    ws1['!cols'] = [
      { wch: 22 },  // 주문번호
      { wch: 15 },  // 택배사
      { wch: 22 },  // 운송장번호
      { wch: 12 },  // 수령인
      { wch: 16 },  // 연락처
      { wch: 40 },  // 배송지
      { wch: 35 },  // 상품명
      { wch: 14 },  // 주문금액
      { wch: 20 },  // 주문일시
      { wch: 10 },  // 현재상태
    ];

    XLSX.utils.book_append_sheet(wb, ws1, '송장입력');

    // ═══════════════════════════════════════
    // 시트 2: 입력 가이드
    // ═══════════════════════════════════════
    const guideData = [
      ['필드명', '필수여부', '설명', '예시'],
      ['주문번호', '필수(*)', '주문번호를 정확히 입력 (자동으로 채워져 있음)', 'ORD-20260413-XXXXX'],
      ['택배사', '필수(*)', '택배사 이름을 정확히 입력', 'CJ대한통운'],
      ['운송장번호', '필수(*)', '택배 운송장 번호', '123456789012'],
      ['수령인', '참고', '수령인 이름 (수정 불필요, 참고용)', '홍길동'],
      ['연락처', '참고', '수령인 연락처 (수정 불필요, 참고용)', '010-1234-5678'],
      ['배송지', '참고', '배송 주소 (수정 불필요, 참고용)', '서울시 강남구...'],
      ['상품명', '참고', '주문 상품 (수정 불필요, 참고용)', '블루투스 이어폰 x2'],
      ['주문금액', '참고', '총 주문금액 (수정 불필요, 참고용)', '59000'],
      ['주문일시', '참고', '주문 생성 시각 (수정 불필요, 참고용)', '2026. 4. 13. 오후 3:00'],
      ['현재상태', '참고', '현재 주문 상태 (수정 불필요, 참고용)', '확인됨'],
      ['', '', '', ''],
      ['[지원 택배사 목록]', '', '', ''],
      ['CJ대한통운', '', '', ''],
      ['롯데택배', '', '', ''],
      ['한진택배', '', '', ''],
      ['로젠택배', '', '', ''],
      ['우체국택배', '', '', ''],
      ['경동택배', '', '', ''],
      ['대신택배', '', '', ''],
      ['GS편의점택배', '', '', ''],
      ['EMS (국제우편)', '', '', ''],
      ['', '', '', ''],
      ['[주의사항]', '', '', ''],
      ['1. 첫 번째 행(헤더)은 삭제하지 마세요.', '', '', ''],
      ['2. "주문번호", "택배사", "운송장번호" 3개 필드만 필수입니다.', '', '', ''],
      ['3. "(참고)" 컬럼은 확인용이며, 업로드 시 무시됩니다.', '', '', ''],
      ['4. 송장 등록 시 주문 상태가 자동으로 "배송중"으로 변경됩니다.', '', '', ''],
      ['5. 이미 송장이 등록된 주문은 새 송장으로 덮어씁니다.', '', '', ''],
      ['6. 한 번에 최대 1,000건까지 처리 가능합니다.', '', '', ''],
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(guideData);
    ws2['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 50 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws2, '입력가이드');

    // 엑셀 파일 생성
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const dateStr = new Date().toISOString().slice(0, 10);
    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="QRLIVE_invoice_bulk_template_${dateStr}.xlsx"`,
      },
    });

  } catch (error: any) {
    console.error('송장 템플릿 생성 실패:', error);
    return NextResponse.json(
      { success: false, error: '템플릿 생성에 실패했습니다', detail: error?.message },
      { status: 500 }
    );
  }
}
