import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';

// GET /api/admin/reviews - 관리자 리뷰 목록 조회 (검색/필터/페이지네이션 + 통계)
export async function GET(req: NextRequest) {
  const prisma = await getPrisma();
  try {
    const authResult = await verifyAuthToken(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    if (authResult.role !== 'ADMIN') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get('search') || '').trim();
    const rating = searchParams.get('rating') || 'ALL'; // ALL | 1~5
    const reported = searchParams.get('reported') || 'ALL'; // ALL | true
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const skip = (page - 1) * limit;

    // 필터 조건
    const where: any = {};
    if (rating !== 'ALL') {
      const r = parseInt(rating);
      if (r >= 1 && r <= 5) where.rating = r;
    }
    if (reported === 'true') where.isReported = true;
    if (search) {
      where.OR = [
        { content: { contains: search } },
        { product: { name: { contains: search } } },
        { user: { name: { contains: search } } },
      ];
    }

    const [reviews, total, stats] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          product: { select: { id: true, name: true, slug: true, thumbnail: true } },
          order: { select: { id: true, orderNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.review.count({ where }),
      // 전체 통계 (필터 무관)
      (async () => {
        const all = await prisma.review.findMany({ select: { rating: true, isReported: true } });
        const count = all.length;
        const avg = count > 0 ? all.reduce((s, r) => s + (r.rating || 0), 0) / count : 0;
        const reportedCount = all.filter((r) => r.isReported).length;
        return {
          count,
          averageRating: Math.round(avg * 10) / 10,
          reportedCount,
        };
      })(),
    ]);

    return NextResponse.json({
      success: true,
      data: reviews,
      stats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Admin get reviews error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '리뷰 조회 중 오류가 발생했습니다',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
