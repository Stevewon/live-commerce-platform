import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';
import { ensureSupplyPriceColumn, ensureOverseasBlockedColumn, ensureBottomBannerColumns } from '@/lib/ensureProductColumns';

// 관리자 상품 상세 조회 (GET)
export async function GET(
  req: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  const prisma = await getPrisma();
  try {
    const { id } = await segmentData.params;
    // 관리자 인증 확인
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

    // 하단 배너 등 신규 컬럼 자동 보정 (없으면 전체 조회 시 오류 방지)
    try { await ensureBottomBannerColumns(); } catch {}

    const product = await prisma.product.findUnique({
      where: { id: id },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        partnerProducts: {
          include: {
            partner: {
              select: {
                id: true,
                storeName: true,
                storeSlug: true
              }
            }
          }
        },
        variants: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: '상품을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: product
    });

  } catch (error) {
    console.error('상품 조회 실패:', error);
    return NextResponse.json(
      { success: false, error: '상품 조회에 실패했습니다', detail: (error as any)?.message || String(error) },
      { status: 500 }
    );
  }
}

// 관리자 상품 수정 (PATCH)
export async function PATCH(
  req: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  const prisma = await getPrisma();
  try {
    const { id } = await segmentData.params;
    // 관리자 인증 확인
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

    const body = await req.json();
    const {
      name, slug, description, detailContent,
      price, comparePrice, supplyPrice, stock, sku,
      images, detailImages, thumbnail,
      specifications, shippingInfo, returnInfo,
      categoryId, isActive, isFeatured, overseasBlocked,
      imageUrl, // 하위호환
      origin, manufacturer, brand, tags,
      hasOptions, optionNames, variants,
      bottomBannerImage, bottomBannerLink
    } = body;

    // 상품 존재 확인
    const existingProduct = await prisma.product.findUnique({
      where: { id: id }
    });

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: '상품을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 카테고리 존재 확인 (변경하는 경우)
    if (categoryId && categoryId !== existingProduct.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: categoryId }
      });
      if (!category) {
        return NextResponse.json(
          { success: false, error: '존재하지 않는 카테고리입니다' },
          { status: 400 }
        );
      }
    }

    // 공급가(supplyPrice) + 해외배송불가(overseasBlocked) + 하단배너 컬럼 자동 보정 (셀프 힐링)
    await ensureSupplyPriceColumn();
    await ensureOverseasBlockedColumn();
    await ensureBottomBannerColumns();

    // 업데이트 데이터 구성 (전달된 필드만 업데이트)
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (description !== undefined) updateData.description = description;
    if (detailContent !== undefined) updateData.detailContent = detailContent;
    if (price !== undefined) updateData.price = parseFloat(price);
    if (comparePrice !== undefined) updateData.comparePrice = comparePrice ? parseFloat(comparePrice) : null;
    if (supplyPrice !== undefined) updateData.supplyPrice = (supplyPrice !== null && supplyPrice !== '') ? parseFloat(supplyPrice) : null;
    if (stock !== undefined) updateData.stock = parseInt(stock);
    if (sku !== undefined) updateData.sku = sku || null;
    if (images !== undefined) updateData.images = typeof images === 'string' ? images : JSON.stringify(images);
    if (detailImages !== undefined) updateData.detailImages = detailImages ? (typeof detailImages === 'string' ? detailImages : JSON.stringify(detailImages)) : null;
    if (thumbnail !== undefined) updateData.thumbnail = thumbnail;
    if (imageUrl && !thumbnail) updateData.thumbnail = imageUrl; // 하위호환
    if (specifications !== undefined) updateData.specifications = specifications ? (typeof specifications === 'string' ? specifications : JSON.stringify(specifications)) : null;
    if (shippingInfo !== undefined) updateData.shippingInfo = shippingInfo || null;
    if (returnInfo !== undefined) updateData.returnInfo = returnInfo || null;
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (isFeatured !== undefined) updateData.isFeatured = isFeatured;
    if (overseasBlocked !== undefined) updateData.overseasBlocked = overseasBlocked === true;
    if (origin !== undefined) updateData.origin = origin || null;
    if (manufacturer !== undefined) updateData.manufacturer = manufacturer || null;
    if (brand !== undefined) updateData.brand = brand || null;
    if (tags !== undefined) updateData.tags = tags || null;
    if (hasOptions !== undefined) updateData.hasOptions = hasOptions;
    if (optionNames !== undefined) updateData.optionNames = optionNames ? (typeof optionNames === 'string' ? optionNames : JSON.stringify(optionNames)) : null;
    // 상세페이지 하단 배너 (이미지 + 클릭 시 새 창 링크). 빈 문자열은 null 로 저장(배너 제거).
    if (bottomBannerImage !== undefined) updateData.bottomBannerImage = (typeof bottomBannerImage === 'string' && bottomBannerImage.trim()) ? bottomBannerImage.trim() : null;
    if (bottomBannerLink !== undefined) updateData.bottomBannerLink = (typeof bottomBannerLink === 'string' && bottomBannerLink.trim()) ? bottomBannerLink.trim() : null;

    // 변형(variants) 처리: 기존 삭제 후 새로 생성 (upsert 패턴)
    if (hasOptions !== undefined && Array.isArray(variants)) {
      // 기존 variants 모두 삭제
      await prisma.productVariant.deleteMany({
        where: { productId: id }
      });
      // 새 variants 생성
      if (variants.length > 0) {
        await prisma.productVariant.createMany({
          data: variants.map((v: any) => ({
            productId: id,
            optionValues: typeof v.optionValues === 'string' ? v.optionValues : JSON.stringify(v.optionValues),
            price: v.price ? parseFloat(v.price) : null,
            comparePrice: v.comparePrice ? parseFloat(v.comparePrice) : null,
            stock: parseInt(v.stock) || 0,
            sku: v.sku || null,
            thumbnail: v.thumbnail || null,
            isActive: v.isActive !== undefined ? v.isActive : true,
          }))
        });
      }
    }

    // 상품 수정
    const updatedProduct = await prisma.product.update({
      where: { id: id },
      data: updateData,
      include: {
        category: {
          select: {
            name: true,
            slug: true
          }
        },
        partnerProducts: {
          include: {
            partner: {
              select: {
                storeName: true
              }
            }
          }
        },
        variants: true
      }
    });

    return NextResponse.json({
      success: true,
      data: updatedProduct,
      message: '상품이 성공적으로 수정되었습니다'
    });

  } catch (error) {
    console.error('상품 수정 실패:', error);
    // Unique constraint 위반 (상품명 slug 또는 상품코드 sku 중복)
    if ((error as any)?.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: '이미 존재하는 상품명 또는 상품코드입니다' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: '상품 수정에 실패했습니다', detail: (error as any)?.message || String(error) },
      { status: 500 }
    );
  }
}

// 관리자 상품 삭제 (DELETE)
export async function DELETE(
  req: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  const prisma = await getPrisma();
  try {
    const { id } = await segmentData.params;
    // 관리자 인증 확인
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

    // 상품 존재 확인
    const product = await prisma.product.findUnique({
      where: { id: id }
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: '상품을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 주문 내역이 있는지 확인
    const orderItemCount = await prisma.orderItem.count({
      where: { productId: id }
    });

    if (orderItemCount > 0) {
      // 주문 내역이 있으면 비활성화만 가능
      await prisma.product.update({
        where: { id: id },
        data: { isActive: false }
      });
      return NextResponse.json({
        success: true,
        message: '주문 내역이 있어 상품이 비활성화되었습니다'
      });
    }

    // 주문 내역이 없으면 완전 삭제
    await prisma.product.delete({
      where: { id: id }
    });

    return NextResponse.json({
      success: true,
      message: '상품이 성공적으로 삭제되었습니다'
    });

  } catch (error) {
    console.error('상품 삭제 실패:', error);
    return NextResponse.json(
      { success: false, error: '상품 삭제에 실패했습니다', detail: (error as any)?.message || String(error) },
      { status: 500 }
    );
  }
}
