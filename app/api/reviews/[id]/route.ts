import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';

// 리뷰 수정 (PATCH)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 인증 확인
    const authResult = await verifyAuthToken(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { id: reviewId } = await params;
    const { rating, content, images } = await req.json();

    // 리뷰 존재 확인
    const review = await prisma.review.findUnique({
      where: { id: reviewId }
    });

    if (!review) {
      return NextResponse.json(
        { success: false, error: '리뷰를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 본인 리뷰인지 확인
    if (review.userId !== authResult.userId) {
      return NextResponse.json(
        { success: false, error: '본인의 리뷰만 수정할 수 있습니다' },
        { status: 403 }
      );
    }

    // 리뷰 수정
    const updatedReview = await prisma.review.update({
      where: { id: reviewId },
      data: {
        rating: rating !== undefined ? rating : review.rating,
        content: content !== undefined ? content : review.content,
        images: images !== undefined ? JSON.stringify(images) : review.images
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
            thumbnail: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: '리뷰가 수정되었습니다',
      data: {
        ...updatedReview,
        images: updatedReview.images ? JSON.parse(updatedReview.images) : null
      }
    });

  } catch (error) {
    console.error('리뷰 수정 실패:', error);
    return NextResponse.json(
      { success: false, error: '리뷰 수정에 실패했습니다' },
      { status: 500 }
    );
  }
}

// 리뷰 삭제 (DELETE)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 인증 확인
    const authResult = await verifyAuthToken(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { id: reviewId } = await params;

    // 리뷰 존재 확인
    const review = await prisma.review.findUnique({
      where: { id: reviewId }
    });

    if (!review) {
      return NextResponse.json(
        { success: false, error: '리뷰를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 본인 리뷰이거나 관리자인지 확인
    if (review.userId !== authResult.userId && authResult.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: '본인의 리뷰만 삭제할 수 있습니다' },
        { status: 403 }
      );
    }

    // 리뷰 삭제
    await prisma.review.delete({
      where: { id: reviewId }
    });

    return NextResponse.json({
      success: true,
      message: '리뷰가 삭제되었습니다'
    });

  } catch (error) {
    console.error('리뷰 삭제 실패:', error);
    return NextResponse.json(
      { success: false, error: '리뷰 삭제에 실패했습니다' },
      { status: 500 }
    );
  }
}

// 리뷰 좋아요 (POST)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reviewId } = await params;

    // 리뷰 좋아요 증가
    const review = await prisma.review.update({
      where: { id: reviewId },
      data: {
        likes: { increment: 1 }
      }
    });

    return NextResponse.json({
      success: true,
      data: { likes: review.likes }
    });

  } catch (error) {
    console.error('리뷰 좋아요 실패:', error);
    return NextResponse.json(
      { success: false, error: '리뷰 좋아요에 실패했습니다' },
      { status: 500 }
    );
  }
}
