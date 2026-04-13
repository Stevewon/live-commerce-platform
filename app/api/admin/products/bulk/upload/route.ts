import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth/middleware';
import { getPrisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

/**
 * POST /api/admin/products/bulk/upload
 * 
 * 엑셀 파일을 업로드하여 상품을 대량 등록합니다.
 * - 엑셀 파일의 첫 번째 시트("상품입력")를 파싱
 * - 각 행을 검증 후 DB에 insert
 * - 결과(성공/실패/스킵) 리포트를 JSON으로 반환
 */
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

    // 파일 크기 체크 (10MB 제한)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: '파일 크기는 10MB 이하여야 합니다' }, { status: 400 });
    }

    // 파일 → ArrayBuffer → XLSX
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });

    // 첫 번째 시트 읽기
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json({ success: false, error: '엑셀 파일에 시트가 없습니다' }, { status: 400 });
    }
    const ws = wb.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    if (rows.length < 2) {
      return NextResponse.json({ success: false, error: '데이터가 없습니다. 헤더 아래에 상품 데이터를 입력하세요.' }, { status: 400 });
    }

    // 헤더(첫 행) 제거, 데이터 행만 추출
    const dataRows = rows.slice(1).filter((row) => {
      // 빈 행 건너뛰기 (상품명이 비어 있으면 건너뜀)
      return row[0] && String(row[0]).trim() !== '';
    });

    if (dataRows.length === 0) {
      return NextResponse.json({ success: false, error: '등록할 상품 데이터가 없습니다' }, { status: 400 });
    }

    // 카테고리 목록 조회 (이름 → ID 매핑)
    const categories = await prisma.category.findMany();
    const categoryMap = new Map<string, string>();
    categories.forEach((c: any) => {
      categoryMap.set(c.name.trim(), c.id);
      categoryMap.set(c.name.trim().toLowerCase(), c.id);
    });

    // 기존 SKU 조회 (중복 체크)
    const existingSkus = new Set<string>();
    const allProducts = await prisma.product.findMany({ select: { sku: true } });
    allProducts.forEach((p: any) => {
      if (p.sku) existingSkus.add(p.sku);
    });

    // 결과 추적
    const results: {
      row: number;
      name: string;
      status: 'success' | 'error' | 'skipped';
      message: string;
      productId?: string;
    }[] = [];

    let successCount = 0;
    let errorCount = 0;
    let skipCount = 0;

    // 각 행 처리
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2; // 엑셀에서의 행 번호 (1=헤더, 2부터 데이터)

      try {
        // 컬럼 매핑 (템플릿 순서와 동일)
        const name = String(row[0] || '').trim();
        const categoryName = String(row[1] || '').trim();
        const priceStr = String(row[2] || '').trim();
        const comparePriceStr = String(row[3] || '').trim();
        const stockStr = String(row[4] || '').trim();
        const sku = String(row[5] || '').trim() || null;
        const description = String(row[6] || '').trim();
        const detailContent = String(row[7] || '').trim() || null;
        const thumbnailUrl = String(row[8] || '').trim();
        const galleryUrls = String(row[9] || '').trim();
        const detailImageUrls = String(row[10] || '').trim();
        const origin = String(row[11] || '').trim() || null;
        const manufacturer = String(row[12] || '').trim() || null;
        const brand = String(row[13] || '').trim() || null;
        const tags = String(row[14] || '').trim() || null;
        const shippingInfo = String(row[15] || '').trim() || null;
        const returnInfo = String(row[16] || '').trim() || null;
        const isActiveStr = String(row[17] || 'Y').trim().toUpperCase();
        const isFeaturedStr = String(row[18] || 'N').trim().toUpperCase();

        // ── 필수 필드 검증 ──
        if (!name) {
          results.push({ row: rowNum, name: '(빈 행)', status: 'error', message: '상품명이 비어 있습니다' });
          errorCount++;
          continue;
        }

        if (!categoryName) {
          results.push({ row: rowNum, name, status: 'error', message: '카테고리명이 비어 있습니다' });
          errorCount++;
          continue;
        }

        const categoryId = categoryMap.get(categoryName) || categoryMap.get(categoryName.toLowerCase());
        if (!categoryId) {
          results.push({ row: rowNum, name, status: 'error', message: `카테고리 "${categoryName}"을(를) 찾을 수 없습니다. "카테고리목록" 시트를 참고하세요.` });
          errorCount++;
          continue;
        }

        // 가격 파싱 (숫자만 추출)
        const priceNum = parseFloat(priceStr.replace(/[^\d.]/g, ''));
        if (isNaN(priceNum) || priceNum <= 0) {
          results.push({ row: rowNum, name, status: 'error', message: `판매가가 올바르지 않습니다: "${priceStr}"` });
          errorCount++;
          continue;
        }

        const stockNum = parseInt(stockStr.replace(/[^\d]/g, ''), 10);
        if (isNaN(stockNum) || stockNum < 0) {
          results.push({ row: rowNum, name, status: 'error', message: `재고수량이 올바르지 않습니다: "${stockStr}"` });
          errorCount++;
          continue;
        }

        if (!description) {
          results.push({ row: rowNum, name, status: 'error', message: '상품 간단설명이 비어 있습니다' });
          errorCount++;
          continue;
        }

        // ── SKU 중복 체크 ──
        if (sku && existingSkus.has(sku)) {
          results.push({ row: rowNum, name, status: 'skipped', message: `SKU "${sku}"가 이미 존재합니다. 건너뜁니다.` });
          skipCount++;
          continue;
        }

        // ── 정가 파싱 ──
        let comparePrice: number | null = null;
        if (comparePriceStr) {
          comparePrice = parseFloat(comparePriceStr.replace(/[^\d.]/g, ''));
          if (isNaN(comparePrice) || comparePrice <= 0) {
            comparePrice = null;
          } else if (comparePrice <= priceNum) {
            // 정가가 판매가보다 낮거나 같으면 무시
            comparePrice = null;
          }
        }

        // ── 이미지 처리 ──
        const thumbnail = thumbnailUrl || '';
        const imagesArray = galleryUrls
          ? galleryUrls.split(',').map((u: string) => u.trim()).filter(Boolean)
          : (thumbnailUrl ? [thumbnailUrl] : []);
        const imagesJson = JSON.stringify(imagesArray);

        // 상세이미지
        let detailImagesJson: string | null = null;
        if (detailImageUrls) {
          const detailArr = detailImageUrls.split(',').map((u: string) => u.trim()).filter(Boolean);
          if (detailArr.length > 0) {
            detailImagesJson = JSON.stringify(detailArr);
          }
        }

        // ── slug 생성 ──
        const slug = (
          name.toLowerCase()
            .replace(/[^a-z0-9가-힣\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '') || 'product'
        ) + '-' + Date.now() + '-' + i;

        // ── DB 저장 ──
        const product = await prisma.product.create({
          data: {
            name,
            slug,
            description,
            detailContent,
            detailImages: detailImagesJson,
            price: priceNum,
            comparePrice,
            stock: stockNum,
            sku: sku || null,
            images: imagesJson,
            thumbnail,
            categoryId,
            specifications: null,
            shippingInfo,
            returnInfo,
            isActive: isActiveStr !== 'N',
            isFeatured: isFeaturedStr === 'Y',
            origin,
            manufacturer,
            brand,
            tags,
          },
        });

        // SKU 등록 후 중복 방지
        if (sku) existingSkus.add(sku);

        results.push({
          row: rowNum,
          name,
          status: 'success',
          message: '등록 완료',
          productId: product.id,
        });
        successCount++;

      } catch (rowError: any) {
        console.error(`[대량등록] ${rowNum}행 처리 실패:`, rowError);

        let errMsg = rowError?.message || String(rowError);
        if (rowError?.code === 'P2002') {
          errMsg = '상품명 또는 SKU가 중복되어 등록에 실패했습니다';
        }

        results.push({
          row: rowNum,
          name: String(row[0] || '').trim() || `(${rowNum}행)`,
          status: 'error',
          message: errMsg,
        });
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `대량등록 완료: 성공 ${successCount}건, 실패 ${errorCount}건, 건너뜀 ${skipCount}건`,
      data: {
        totalRows: dataRows.length,
        successCount,
        errorCount,
        skipCount,
        results,
      },
    });

  } catch (error: any) {
    console.error('[대량등록] 처리 실패:', error);
    return NextResponse.json(
      { success: false, error: '대량등록 처리에 실패했습니다', detail: error?.message },
      { status: 500 }
    );
  }
}
