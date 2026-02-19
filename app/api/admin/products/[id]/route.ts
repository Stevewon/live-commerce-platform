import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';

// 상품 활성화/비활성화 및 정보 수정 (PATCH)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
    const { id: productId } = await params;

    // 상품 존재 확인
    const existingProduct = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: '상품을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 업데이트 데이터 준비
    const updateData: any = {};
    if (typeof body.isActive === 'boolean') {
      updateData.isActive = body.isActive;
    }
    if (typeof body.isFeatured === 'boolean') {
      updateData.isFeatured = body.isFeatured;
    }
    if (body.name) {
      updateData.name = body.name;
    }
    if (body.description) {
      updateData.description = body.description;
    }
    if (typeof body.price === 'number') {
      updateData.price = body.price;
    }
    if (typeof body.stock === 'number') {
      updateData.stock = body.stock;
    }
    if (body.imageUrl) {
      updateData.imageUrl = body.imageUrl;
    }
    if (body.categoryId) {
      updateData.categoryId = body.categoryId;
    }

    // 상품 업데이트
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: updateData,
      include: {
        category: {
          select: {
            name: true,
            slug: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: '상품 정보가 업데이트되었습니다',
      data: updatedProduct
    });

  } catch (error) {
    console.error('상품 업데이트 실패:', error);
    return NextResponse.json(
      { success: false, error: '상품 업데이트에 실패했습니다' },
      { status: 500 }
    );
  }
}

// 상품 삭제 (DELETE)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    const { id: productId } = await params;

    // 상품 존재 확인
    const existingProduct = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        _count: {
          select: {
            orderItems: true
          }
        }
      }
    });

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: '상품을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 주문이 있으면 삭제 불가
    if (existingProduct._count.orderItems > 0) {
      return NextResponse.json(
        { success: false, error: '주문이 있는 상품은 삭제할 수 없습니다. 비활성화를 사용하세요.' },
        { status: 400 }
      );
    }

    // 상품 삭제
    await prisma.product.delete({
      where: { id: productId }
    });

    return NextResponse.json({
      success: true,
      message: '상품이 삭제되었습니다'
    });

  } catch (error) {
    console.error('상품 삭제 실패:', error);
    return NextResponse.json(
      { success: false, error: '상품 삭제에 실패했습니다' },
      { status: 500 }
    );
  }
}
