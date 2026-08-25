import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { ensureBottomBannerColumns } from '@/lib/ensureProductColumns';

// GET /api/products/[slug] - 상품 상세 조회
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const prisma = await getPrisma();
  try {
    const resolvedParams = await context.params;
    const { slug } = resolvedParams;

    // 하단 배너 컬럼 자동 보정 (없으면 조회 시 Prisma 오류 방지)
    try { await ensureBottomBannerColumns(); } catch {}
    const product = await prisma.product.findUnique({
      where: {
        slug: slug,
      },
      include: {
        category: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    });
    
    if (!product) {
      return NextResponse.json(
        {
          success: false,
          error: 'Product not found',
        },
        { status: 404 }
      );
    }

    // ★ 어드민 전용 필드는 공개 응답에서 제거 (sku=상품코드 내부관리용, supplyPrice=공급가)
    const pub: any = product;
    delete pub.sku;
    delete pub.supplyPrice;

    return NextResponse.json({
      success: true,
      data: pub,
    });
  } catch (error) {
    console.error('[PRODUCT_GET]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch product',
      },
      { status: 500 }
    );
  }
}
