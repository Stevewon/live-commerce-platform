import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';

// 관리자 상품 상세 조회 (GET)
export async function GET(
  req: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
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
      { success: false, error: '상품 조회에 실패했습니다' },
      { status: 500 }
    );
  }
}

// 관리자 상품 수정 (PATCH)
export async function PATCH(
  req: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
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
    const { name, description, price, stock, categoryId, isActive, imageUrl } = body;

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

    // 상품 수정
    const updatedProduct = await prisma.product.update({
      where: { id: id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price }),
        ...(stock !== undefined && { stock }),
        ...(categoryId && { categoryId }),
        ...(isActive !== undefined && { isActive }),
        ...(imageUrl && { imageUrl })
      },
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
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: updatedProduct,
      message: '상품이 성공적으로 수정되었습니다'
    });

  } catch (error) {
    console.error('상품 수정 실패:', error);
    return NextResponse.json(
      { success: false, error: '상품 수정에 실패했습니다' },
      { status: 500 }
    );
  }
}

// 관리자 상품 삭제 (DELETE)
export async function DELETE(
  req: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
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
      { success: false, error: '상품 삭제에 실패했습니다' },
      { status: 500 }
    );
  }
}
