import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth/middleware';
import { getPrisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

/**
 * POST /api/admin/orders/bulk/upload
 * 
 * 엑셀 파일을 업로드하여 송장을 대량 등록합니다.
 * - 엑셀의 주문번호, 택배사, 운송장번호를 읽어 주문을 업데이트
 * - 주문 상태를 SHIPPING으로 변경하고 shippedAt 기록
 * - 행별 성공/실패/건너뜀 리포트 반환
 */

// 지원 택배사 목록
const VALID_CARRIERS = [
  'CJ대한통운',
  '롯데택배',
  '한진택배',
  '로젠택배',
  '우체국택배',
  '경동택배',
  '대신택배',
  'GS편의점택배',
  'EMS',
  'EMS (국제우편)',
  // 영문 변형
  'CJ',
  'LOTTE',
  'HANJIN',
  'LOGEN',
  'EPOST',
];

export async function POST(req: NextRequest) {
  const prisma = await getPrisma();

  try {
    // 관리자 인증
    const authResult = await verifyAuthToken(req);
    if (authResult instanceof NextResponse) return authResult;
    if (authResult.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    // FormData에서 파일 읽기
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ success: false, error: '파일을 선택해주세요' }, { status: 400 });
    }

    // 파일 확장자 체크
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return NextResponse.json({ success: false, error: '.xlsx 또는 .xls 파일만 업로드 가능합니다' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: '파일 크기는 10MB 이하여야 합니다' }, { status: 400 });
    }

    // 파일 → XLSX
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });

    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json({ success: false, error: '엑셀 파일에 시트가 없습니다' }, { status: 400 });
    }
    const ws = wb.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    if (rows.length < 2) {
      return NextResponse.json({ success: false, error: '데이터가 없습니다. 헤더 아래에 송장 데이터를 입력하세요.' }, { status: 400 });
    }

    // 헤더 제거, 데이터 행만 추출
    const dataRows = rows.slice(1).filter((row) => {
      // 주문번호가 비어있으면 건너뜀
      return row[0] && String(row[0]).trim() !== '';
    });

    if (dataRows.length === 0) {
      return NextResponse.json({ success: false, error: '등록할 송장 데이터가 없습니다' }, { status: 400 });
    }

    if (dataRows.length > 1000) {
      return NextResponse.json({ success: false, error: '한 번에 최대 1,000건까지 처리 가능합니다' }, { status: 400 });
    }

    // 주문번호 목록 추출하여 한 번에 조회
    const orderNumbers = dataRows.map(row => String(row[0]).trim());
    const existingOrders = await prisma.order.findMany({
      where: { orderNumber: { in: orderNumbers } },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        trackingCompany: true,
        trackingNumber: true,
      },
    });
    const orderMap = new Map<string, any>();
    existingOrders.forEach((o: any) => orderMap.set(o.orderNumber, o));

    // 결과 추적
    const results: {
      row: number;
      orderNumber: string;
      status: 'success' | 'error' | 'skipped';
      message: string;
    }[] = [];

    let successCount = 0;
    let errorCount = 0;
    let skipCount = 0;
    const now = new Date();

    // 각 행 처리
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2; // 엑셀 행번호

      const orderNumber = String(row[0] || '').trim();
      const trackingCompany = String(row[1] || '').trim();
      const trackingNumber = String(row[2] || '').trim();

      try {
        // ── 필수 필드 검증 ──
        if (!orderNumber) {
          results.push({ row: rowNum, orderNumber: '(빈 행)', status: 'error', message: '주문번호가 비어 있습니다' });
          errorCount++;
          continue;
        }

        if (!trackingCompany) {
          results.push({ row: rowNum, orderNumber, status: 'error', message: '택배사가 비어 있습니다' });
          errorCount++;
          continue;
        }

        if (!trackingNumber) {
          results.push({ row: rowNum, orderNumber, status: 'error', message: '운송장번호가 비어 있습니다' });
          errorCount++;
          continue;
        }

        // 운송장 번호 형식 체크 (숫자와 하이픈만 허용, 최소 5자)
        const cleanTrackingNumber = trackingNumber.replace(/[\s-]/g, '');
        if (cleanTrackingNumber.length < 5) {
          results.push({ row: rowNum, orderNumber, status: 'error', message: `운송장번호가 너무 짧습니다: "${trackingNumber}"` });
          errorCount++;
          continue;
        }

        // ── 주문 조회 ──
        const order = orderMap.get(orderNumber);
        if (!order) {
          results.push({ row: rowNum, orderNumber, status: 'error', message: `주문번호 "${orderNumber}"을(를) 찾을 수 없습니다` });
          errorCount++;
          continue;
        }

        // ── 상태 체크 ──
        if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
          results.push({ row: rowNum, orderNumber, status: 'skipped', message: `취소/환불된 주문은 송장 등록할 수 없습니다 (현재: ${order.status})` });
          skipCount++;
          continue;
        }

        if (order.status === 'DELIVERED') {
          results.push({ row: rowNum, orderNumber, status: 'skipped', message: '이미 배송완료된 주문입니다' });
          skipCount++;
          continue;
        }

        // ── DB 업데이트 ──
        await prisma.order.update({
          where: { id: order.id },
          data: {
            trackingCompany,
            trackingNumber,
            status: 'SHIPPING',
            shippedAt: now,
          },
        });

        results.push({
          row: rowNum,
          orderNumber,
          status: 'success',
          message: `${trackingCompany} ${trackingNumber} 등록 완료`,
        });
        successCount++;

      } catch (rowError: any) {
        console.error(`[송장 대량등록] ${rowNum}행 처리 실패:`, rowError);
        results.push({
          row: rowNum,
          orderNumber,
          status: 'error',
          message: rowError?.message || String(rowError),
        });
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `송장 대량등록 완료: 성공 ${successCount}건, 실패 ${errorCount}건, 건너뜀 ${skipCount}건`,
      data: {
        totalRows: dataRows.length,
        successCount,
        errorCount,
        skipCount,
        results,
      },
    });

  } catch (error: any) {
    console.error('[송장 대량등록] 처리 실패:', error);
    return NextResponse.json(
      { success: false, error: '송장 대량등록에 실패했습니다', detail: error?.message },
      { status: 500 }
    );
  }
}
