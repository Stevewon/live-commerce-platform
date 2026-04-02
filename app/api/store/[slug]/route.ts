import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

// GET /api/store/[slug] - 파트너 스토어 정보 + 상품 조회
export async function GET(
  req: NextRequest,
  segmentData: { params: Promise<{ slug: string }> }
) {
  const prisma = await getPrisma();
  try {
    const { slug } = await segmentData.params;

    // 파트너 스토어 조회
    const partner = await prisma.partner.findUnique({
      where: { storeSlug: slug },
      include: {
        user: {
          select: {
            name: true,
          }
        }
      }
    });

    if (!partner) {
      return NextResponse.json(
        { success: false, error: '스토어를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    if (!partner.isActive) {
      return NextResponse.json(
        { success: false, error: '현재 운영 중이지 않은 스토어입니다' },
        { status: 404 }
      );
    }

    // 파트너가 선택한 상품 목록 조회
    const partnerProducts = await prisma.partnerProduct.findMany({
      where: {
        partnerId: partner.id,
        isActive: true,
      },
      include: {
        product: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
              }
            }
          }
        }
      }
    });

    // 활성 상품만 필터링
    const products = partnerProducts
      .filter(pp => pp.product && pp.product.isActive)
      .map(pp => ({
        ...pp.product,
        customPrice: pp.customPrice,
        partnerProductId: pp.id,
      }));

    return NextResponse.json({
      success: true,
      data: {
        store: {
          id: partner.id,
          storeName: partner.storeName,
          storeSlug: partner.storeSlug,
          description: partner.description,
          logo: partner.logo,
          banner: partner.banner,
          ownerName: partner.user?.name,
        },
        products,
        totalProducts: products.length,
      }
    });

  } catch (error) {
    console.error('스토어 조회 실패:', error);
    return NextResponse.json(
      { success: false, error: '스토어 정보를 불러올 수 없습니다' },
      { status: 500 }
    );
  }
}
