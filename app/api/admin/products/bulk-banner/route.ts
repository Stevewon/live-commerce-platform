import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';
import { ensureBottomBannerColumns } from '@/lib/ensureProductColumns';

/**
 * [2026-08-25 사장님 요청] 상세페이지 하단 배너 "일괄 등록" API.
 *
 * 어드민 전용. 지정한 배너 이미지 + 링크를 전체 상품(또는 활성 상품만)에
 * 한 번에 적용한다. (개별 등록은 기존 상품 POST/PATCH 에서 처리)
 *
 * body:
 *   - bottomBannerImage:    string  (필수, 배너 이미지 URL)
 *   - bottomBannerLink:     string  (선택, 클릭 시 새 창으로 열릴 링크)
 *   - bottomBannerPosition: string  (선택, 'top'|'bottom'|'both'. 기본 'bottom')
 *   - onlyActive:           boolean (선택, true 면 isActive=true 상품에만 적용. 기본 false=전체)
 *   - clear:                boolean (선택, true 면 배너를 전체에서 제거. image/link 무시)
 */
export async function POST(req: NextRequest) {
  const prisma = await getPrisma();
  try {
    // 관리자 인증
    const authResult = await verifyAuthToken(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    if (authResult.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const clear = body?.clear === true;
    const onlyActive = body?.onlyActive === true;
    const image = typeof body?.bottomBannerImage === 'string' ? body.bottomBannerImage.trim() : '';
    const link = typeof body?.bottomBannerLink === 'string' ? body.bottomBannerLink.trim() : '';
    const position = ['top', 'bottom', 'both'].includes(body?.bottomBannerPosition) ? body.bottomBannerPosition : 'bottom';

    if (!clear && !image) {
      return NextResponse.json(
        { success: false, error: '배너 이미지를 먼저 등록해주세요' },
        { status: 400 }
      );
    }

    // 하단 배너 컬럼 자동 보정 (셀프 힐링)
    await ensureBottomBannerColumns();

    const where = onlyActive ? { isActive: true } : {};
    const data = clear
      ? { bottomBannerImage: null, bottomBannerLink: null }
      : { bottomBannerImage: image, bottomBannerLink: link || null, bottomBannerPosition: position };

    const result = await prisma.product.updateMany({ where, data });

    return NextResponse.json({
      success: true,
      message: clear
        ? `전체 ${result.count}개 상품의 하단 배너를 제거했습니다`
        : `전체 ${result.count}개 상품에 하단 배너를 일괄 등록했습니다`,
      data: { updated: result.count },
    });
  } catch (error: any) {
    console.error('하단 배너 일괄 등록 실패:', error);
    return NextResponse.json(
      { success: false, error: '일괄 등록에 실패했습니다', detail: error?.message || String(error) },
      { status: 500 }
    );
  }
}
