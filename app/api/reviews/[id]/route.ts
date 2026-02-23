import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth/middleware';
import prisma from '@/lib/prisma';

// 리뷰 수정 (PATCH)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await verifyAuthToken(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { userId, role } = authResult;

    const body = await request.json();
    const { rating, comment, images } = body;

    // 리뷰 확인
    const review = await prisma.review.findUnique({
      where: { id: params.id }
    });

    if (!review) {
      return NextResponse.json(
        { success: false, error: '리뷰를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 본인 확인
    if (review.userId !== userId) {
      return NextResponse.json(
        { success: false, error: '본인의 리뷰만 수정할 수 있습니다' },
        { status: 403 }
      );
    }

    // 리뷰 수정
    const updatedReview = await prisma.review.update({
      where: { id: params.id },
      data: {
        ...(rating !== undefined && { rating }),
        ...(comment !== undefined && { comment }),
        ...(images !== undefined && { images })
      },
      include: {
        user: {
          select: {
            name: true
          }
        },
        product: {
          select: {
            name: true,
            slug: true
          }
        }
      }
    });

    // 평점이 변경된 경우 상품 평균 평점 업데이트
    if (rating !== undefined) {
      const reviews = await prisma.review.findMany({
        where: { productId: review.productId },
        select: { rating: true }
      });

      const averageRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      
      await prisma.product.update({
        where: { id: review.productId },
        data: {
          rating: Math.round(averageRating * 10) / 10
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: '리뷰가 수정되었습니다',
      data: updatedReview
    });

  } catch (error) {
    console.error('Update review error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '리뷰 수정 중 오류가 발생했습니다',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// 리뷰 삭제 (DELETE)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await verifyAuthToken(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { userId, role } = authResult;

    // 리뷰 확인
    const review = await prisma.review.findUnique({
      where: { id: params.id }
    });

    if (!review) {
      return NextResponse.json(
        { success: false, error: '리뷰를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 본인 또는 관리자 확인
    if (review.userId !== userId && role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: '본인의 리뷰만 삭제할 수 있습니다' },
        { status: 403 }
      );
    }

    // 리뷰 삭제
    await prisma.review.delete({
      where: { id: params.id }
    });

    // 상품 평균 평점 업데이트
    const reviews = await prisma.review.findMany({
      where: { productId: review.productId },
      select: { rating: true }
    });

    if (reviews.length > 0) {
      const averageRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      await prisma.product.update({
        where: { id: review.productId },
        data: {
          rating: Math.round(averageRating * 10) / 10,
          reviewCount: reviews.length
        }
      });
    } else {
      await prisma.product.update({
        where: { id: review.productId },
        data: {
          rating: 0,
          reviewCount: 0
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: '리뷰가 삭제되었습니다'
    });

  } catch (error) {
    console.error('Delete review error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '리뷰 삭제 중 오류가 발생했습니다',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
