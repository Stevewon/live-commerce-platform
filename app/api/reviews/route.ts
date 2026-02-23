import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth/middleware';
import prisma from '@/lib/prisma';

// 리뷰 생성 (POST)
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuthToken(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { userId } = authResult;

    const body = await request.json();
    const { orderId, productId, rating, comment, images } = body;

    // 유효성 검사
    if (!orderId || !productId || !rating) {
      return NextResponse.json(
        { success: false, error: '필수 정보가 누락되었습니다' },
        { status: 400 }
      );
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, error: '평점은 1-5 사이여야 합니다' },
        { status: 400 }
      );
    }

    // 주문 확인 (본인 주문 & 배송 완료 상태)
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          where: { productId }
        }
      }
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    if (order.userId !== userId) {
      return NextResponse.json(
        { success: false, error: '본인의 주문만 리뷰를 작성할 수 있습니다' },
        { status: 403 }
      );
    }

    if (order.status !== 'DELIVERED') {
      return NextResponse.json(
        { success: false, error: '배송 완료된 주문만 리뷰를 작성할 수 있습니다' },
        { status: 400 }
      );
    }

    if (order.items.length === 0) {
      return NextResponse.json(
        { success: false, error: '해당 주문에 이 상품이 없습니다' },
        { status: 400 }
      );
    }

    // 중복 리뷰 확인
    const existingReview = await prisma.review.findFirst({
      where: {
        orderId,
        productId,
        userId
      }
    });

    if (existingReview) {
      return NextResponse.json(
        { success: false, error: '이미 리뷰를 작성하셨습니다' },
        { status: 400 }
      );
    }

    // 리뷰 생성
    const review = await prisma.review.create({
      data: {
        userId,
        productId,
        orderId,
        rating,
        comment: comment || '',
        images: images || []
      },
      include: {
        user: {
          select: {
            name: true,
            email: true
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

    // 상품 평점 업데이트
    const reviews = await prisma.review.findMany({
      where: { productId },
      select: { rating: true }
    });

    const averageRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    
    await prisma.product.update({
      where: { id: productId },
      data: {
        rating: Math.round(averageRating * 10) / 10, // 소수점 1자리
        reviewCount: reviews.length
      }
    });

    return NextResponse.json({
      success: true,
      message: '리뷰가 등록되었습니다',
      data: review
    });

  } catch (error) {
    console.error('Create review error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '리뷰 등록 중 오류가 발생했습니다',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// 리뷰 목록 조회 (GET)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const userId = searchParams.get('userId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    // 필터 조건
    const where: any = {};
    if (productId) where.productId = productId;
    if (userId) where.userId = userId;

    // 리뷰 조회
    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          user: {
            select: {
              name: true
            }
          },
          product: {
            select: {
              name: true,
              slug: true,
              thumbnail: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.review.count({ where })
    ]);

    return NextResponse.json({
      success: true,
      data: reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get reviews error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '리뷰 조회 중 오류가 발생했습니다',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
