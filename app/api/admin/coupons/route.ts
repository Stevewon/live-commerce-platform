import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';

// 관리자 쿠폰 생성 (POST)
export async function POST(req: NextRequest) {
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

    const { code, name, description, type, value, minAmount, maxDiscount, validFrom, validUntil, usageLimit } = await req.json();

    // 입력 검증
    if (!code || !name || !type || value === undefined || !validFrom || !validUntil) {
      return NextResponse.json(
        { success: false, error: '필수 항목을 입력해주세요' },
        { status: 400 }
      );
    }

    // 쿠폰 타입 검증
    if (!['FIXED', 'PERCENT', 'FREE_SHIPPING'].includes(type)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 쿠폰 타입입니다' },
        { status: 400 }
      );
    }

    // 정률 쿠폰 검증
    if (type === 'PERCENT' && (value < 0 || value > 100)) {
      return NextResponse.json(
        { success: false, error: '할인율은 0~100 사이여야 합니다' },
        { status: 400 }
      );
    }

    // 쿠폰 코드 중복 확인
    const existingCoupon = await prisma.coupon.findUnique({
      where: { code: code.toUpperCase() }
    });

    if (existingCoupon) {
      return NextResponse.json(
        { success: false, error: '이미 사용 중인 쿠폰 코드입니다' },
        { status: 400 }
      );
    }

    // 쿠폰 생성
    const coupon = await prisma.coupon.create({
      data: {
        code: code.toUpperCase(),
        name,
        description,
        type,
        value: parseFloat(value),
        minAmount: minAmount ? parseFloat(minAmount) : null,
        maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
        validFrom: new Date(validFrom),
        validUntil: new Date(validUntil),
        usageLimit: usageLimit ? parseInt(usageLimit) : null
      }
    });

    return NextResponse.json({
      success: true,
      message: '쿠폰이 생성되었습니다',
      data: coupon
    });

  } catch (error) {
    console.error('쿠폰 생성 실패:', error);
    return NextResponse.json(
      { success: false, error: '쿠폰 생성에 실패했습니다' },
      { status: 500 }
    );
  }
}

// 관리자 쿠폰 목록 조회 (GET)
export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status'); // 'active', 'inactive', 'all'
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // 필터 조건
    const where: any = {};
    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    // 쿠폰 조회
    const [coupons, totalCount] = await Promise.all([
      prisma.coupon.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              orders: true
            }
          }
        }
      }),
      prisma.coupon.count({ where })
    ]);

    return NextResponse.json({
      success: true,
      data: {
        coupons,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      }
    });

  } catch (error) {
    console.error('쿠폰 조회 실패:', error);
    return NextResponse.json(
      { success: false, error: '쿠폰 조회에 실패했습니다' },
      { status: 500 }
    );
  }
}
