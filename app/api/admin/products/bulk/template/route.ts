import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth/middleware';
import { getPrisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

/**
 * GET /api/admin/products/bulk/template
 * 
 * 상품 대량등록용 엑셀 템플릿 다운로드
 * - 첫 번째 시트: 상품 입력 시트 (헤더 + 예시 2행)
 * - 두 번째 시트: 카테고리 목록 (참고용)
 * - 세 번째 시트: 입력 가이드
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

    // 카테고리 목록 조회
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
    });

    const wb = XLSX.utils.book_new();

    // ═══════════════════════════════════════
    // 시트 1: 상품 입력
    // ═══════════════════════════════════════
    const headers = [
      '상품명*',
      '카테고리명*',
      '판매가*',
      '정가',
      '재고수량*',
      'SKU(상품코드)',
      '상품 간단설명*',
      '상세설명(HTML)',
      '대표이미지URL',
      '갤러리이미지URL(쉼표구분)',
      '상세이미지URL(쉼표구분)',
      '원산지',
      '제조사',
      '브랜드',
      '검색태그(쉼표구분)',
      '배송안내',
      '교환반품안내',
      '판매상태(Y/N)',
      '추천상품(Y/N)',
    ];

    // 예시 데이터 2행
    const example1 = [
      '프리미엄 블루투스 이어폰 X1',
      categories[0]?.name || '전자기기',
      '59000',
      '79000',
      '100',
      'BT-X1-BLK',
      '고품질 블루투스 5.3 이어폰, ANC 노이즈캔슬링, 30시간 재생',
      '<h2>프리미엄 블루투스 이어폰</h2><p>최고의 음질을 경험하세요.</p>',
      'https://example.com/images/earphone-main.jpg',
      'https://example.com/images/earphone-1.jpg,https://example.com/images/earphone-2.jpg',
      'https://example.com/images/earphone-detail-1.jpg,https://example.com/images/earphone-detail-2.jpg',
      '대한민국',
      '(주)큐라이브',
      'QRLIVE',
      '블루투스,이어폰,노이즈캔슬링,ANC',
      '',
      '',
      'Y',
      'Y',
    ];

    const example2 = [
      '오가닉 코튼 라운드넥 티셔츠',
      categories[1]?.name || '의류',
      '35000',
      '45000',
      '200',
      'CT-RN-WHT',
      '100% 유기농 면 소재, 편안한 데일리 티셔츠',
      '',
      'https://example.com/images/tshirt-main.jpg',
      '',
      '',
      '인도',
      '오가닉팩토리',
      'ORGLAB',
      '티셔츠,면,데일리,여름',
      '',
      '',
      'Y',
      'N',
    ];

    const productData = [headers, example1, example2];
    const ws1 = XLSX.utils.aoa_to_sheet(productData);

    // 열 너비 설정
    ws1['!cols'] = [
      { wch: 30 },  // 상품명
      { wch: 15 },  // 카테고리명
      { wch: 12 },  // 판매가
      { wch: 12 },  // 정가
      { wch: 10 },  // 재고수량
      { wch: 15 },  // SKU
      { wch: 40 },  // 간단설명
      { wch: 50 },  // 상세설명
      { wch: 40 },  // 대표이미지
      { wch: 50 },  // 갤러리이미지
      { wch: 50 },  // 상세이미지
      { wch: 12 },  // 원산지
      { wch: 15 },  // 제조사
      { wch: 12 },  // 브랜드
      { wch: 30 },  // 태그
      { wch: 30 },  // 배송안내
      { wch: 30 },  // 교환반품
      { wch: 12 },  // 판매상태
      { wch: 12 },  // 추천상품
    ];

    XLSX.utils.book_append_sheet(wb, ws1, '상품입력');

    // ═══════════════════════════════════════
    // 시트 2: 카테고리 목록
    // ═══════════════════════════════════════
    const catHeaders = ['카테고리명', '슬러그', 'ID'];
    const catRows = categories.map((c: any) => [c.name, c.slug, c.id]);
    const ws2 = XLSX.utils.aoa_to_sheet([catHeaders, ...catRows]);
    ws2['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws2, '카테고리목록');

    // ═══════════════════════════════════════
    // 시트 3: 입력 가이드
    // ═══════════════════════════════════════
    const guideData = [
      ['필드명', '필수여부', '설명', '예시'],
      ['상품명', '필수(*)', '상품의 이름 (최대 100자)', '프리미엄 블루투스 이어폰 X1'],
      ['카테고리명', '필수(*)', '"카테고리목록" 시트의 카테고리명과 정확히 일치해야 합니다', '전자기기'],
      ['판매가', '필수(*)', '숫자만 입력 (원 단위, 쉼표 없이)', '59000'],
      ['정가', '선택', '할인 전 원래 가격 (판매가보다 높아야 함)', '79000'],
      ['재고수량', '필수(*)', '0 이상의 정수', '100'],
      ['SKU(상품코드)', '선택', '고유한 상품 관리 코드', 'BT-X1-BLK'],
      ['상품 간단설명', '필수(*)', '상품 목록에 표시될 1~2줄 설명 (최대 200자)', '고품질 블루투스 5.3 이어폰'],
      ['상세설명(HTML)', '선택', 'HTML 태그 사용 가능한 상세 설명', '<h2>제목</h2><p>내용</p>'],
      ['대표이미지URL', '선택', '상품 썸네일 이미지 URL', 'https://example.com/image.jpg'],
      ['갤러리이미지URL', '선택', '여러 이미지를 쉼표(,)로 구분', 'https://a.jpg,https://b.jpg'],
      ['상세이미지URL', '선택', '상세페이지 이미지를 쉼표(,)로 구분', 'https://d1.jpg,https://d2.jpg'],
      ['원산지', '선택', '상품 원산지', '대한민국'],
      ['제조사', '선택', '제조사명', '(주)큐라이브'],
      ['브랜드', '선택', '브랜드명', 'QRLIVE'],
      ['검색태그', '선택', '검색 키워드를 쉼표(,)로 구분', '블루투스,이어폰,ANC'],
      ['배송안내', '선택', '배송 관련 안내 (미입력 시 기본값 적용)', ''],
      ['교환반품안내', '선택', '교환/반품 안내 (미입력 시 기본값 적용)', ''],
      ['판매상태', '선택', 'Y=판매중, N=판매중지 (기본값: Y)', 'Y'],
      ['추천상품', '선택', 'Y=추천, N=일반 (기본값: N)', 'N'],
      ['', '', '', ''],
      ['[주의사항]', '', '', ''],
      ['1. 첫 번째 행(헤더)은 삭제하지 마세요.', '', '', ''],
      ['2. 예시 행(2~3행)은 삭제하고 실제 데이터를 입력하세요.', '', '', ''],
      ['3. 카테고리명은 "카테고리목록" 시트의 이름과 정확히 일치해야 합니다.', '', '', ''],
      ['4. 이미지 URL은 사전에 업로드된 이미지의 URL을 입력하세요.', '', '', ''],
      ['5. 가격은 숫자만 입력하세요 (쉼표, 원 등 제외).', '', '', ''],
      ['6. SKU가 기존 상품과 중복되면 해당 행은 건너뜁니다.', '', '', ''],
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(guideData);
    ws3['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 55 }, { wch: 35 }];
    XLSX.utils.book_append_sheet(wb, ws3, '입력가이드');

    // 엑셀 파일 생성
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="QRLIVE_product_bulk_template_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });

  } catch (error: any) {
    console.error('엑셀 템플릿 생성 실패:', error);
    return NextResponse.json(
      { success: false, error: '템플릿 생성에 실패했습니다', detail: error?.message },
      { status: 500 }
    );
  }
}
