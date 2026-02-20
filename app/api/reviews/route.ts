import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';

// 리뷰 작성 (POST)
export async function POST(req: NextRequest) {
  try {
    // 인증 확인
    const authResult = await verifyAuthToken(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { orderId, productId, rating, content, images } = await req.json();

    // 입력 검증
    if (!orderId || !productId || !rating || !content) {
      return NextResponse.json(
        { success: false, error: '필수 항목을 입력해주세요' },
        { status: 400 }
      );
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, error: '별점은 1-5 사이여야 합니다' },
        { status: 400 }
      );
    }

    // 주문 확인 (본인 주문인지, 배송 완료 상태인지)
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

    if (order.userId !== authResult.userId) {
      return NextResponse.json(
        { success: false, error: '본인 주문에만 리뷰를 작성할 수 있습니다' },
        { status: 403 }
      );
    }

    if (order.status !== 'DELIVERED') {
      return NextResponse.json(
        { success: false, error: '배송 완료된 주문에만 리뷰를 작성할 수 있습니다' },
        { status: 400 }
      );
    }

    if (order.items.length === 0) {
      return NextResponse.json(
        { success: false, error: '주문에 해당 상품이 없습니다' },
        { status: 400 }
      );
    }

    // 이미 리뷰 작성했는지 확인
    const existingReview = await prisma.review.findUnique({
      where: { orderId }
    });

    if (existingReview) {
      return NextResponse.json(
        { success: false, error: '이미 리뷰를 작성한 주문입니다' },
        { status: 400 }
      );
    }

    // 리뷰 생성
    const review = await prisma.review.create({
      data: {
        productId,
        userId: authResult.userId,
        orderId,
        rating,
        content,
        images: images ? JSON.stringify(images) : null
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
            thumbnail: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: '리뷰가 작성되었습니다',
      data: review
    });

  } catch (error) {
    console.error('리뷰 작성 실패:', error);
    return NextResponse.json(
      { success: false, error: '리뷰 작성에 실패했습니다' },
      { status: 500 }
    );
  }
}

// 리뷰 조회 (GET)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('productId');
    const userId = searchParams.get('userId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    // 필터 조건
    const where: any = {};
    if (productId) {
      where.productId = productId;
    }
    if (userId) {
      where.userId = userId;
    }

    // 리뷰 조회
    const [reviews, totalCount, avgRating] = await Promise.all([
      prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
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
      }),
      prisma.review.count({ where }),
      productId ? prisma.review.aggregate({
        where: { productId },
        _avg: { rating: true },
        _count: true
      }) : null
    ]);

    // 이미지 JSON 파싱
    const reviewsWithParsedImages = reviews.map(review => ({
      ...review,
      images: review.images ? JSON.parse(review.images) : null
    }));

    return NextResponse.json({
      success: true,
      data: {
        reviews: reviewsWithParsedImages,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit)
        },
        rating: avgRating ? {
          average: avgRating._avg.rating || 0,
          count: avgRating._count
        } : null
      }
    });

  } catch (error) {
    console.error('리뷰 조회 실패:', error);
    return NextResponse.json(
      { success: false, error: '리뷰 조회에 실패했습니다' },
      { status: 500 }
    );
  }
}
