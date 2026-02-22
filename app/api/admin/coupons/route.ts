import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyAuthToken } from '@/lib/auth/middleware';

const prisma = new PrismaClient();

// GET: 쿠폰 목록 조회 (관리자)
export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const authResult = await verifyAuthToken(request);
    if (!authResult.valid || !authResult.user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    // 관리자 권한 확인
    if (authResult.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    // 쿼리 파라미터
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status'); // active, inactive, expired, all
    const search = searchParams.get('search');

    const skip = (page - 1) * limit;

    // 필터 조건
    const where: any = {};

    if (search) {
      where.OR = [
        { code: { contains: search } },
        { name: { contains: search } },
      ];
    }

    const now = new Date();

    if (status === 'active') {
      where.isActive = true;
      where.validFrom = { lte: now };
      where.validUntil = { gte: now };
    } else if (status === 'inactive') {
      where.isActive = false;
    } else if (status === 'expired') {
      where.validUntil = { lt: now };
    }

    // 쿠폰 목록 조회
    const [coupons, total] = await Promise.all([
      prisma.coupon.findMany({
        where,
        include: {
          _count: {
            select: {
              orders: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.coupon.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        coupons,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('쿠폰 목록 조회 오류:', error);
    return NextResponse.json(
      { error: '쿠폰 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// POST: 쿠폰 생성 (관리자)
export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const authResult = await verifyAuthToken(request);
    if (!authResult.valid || !authResult.user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    // 관리자 권한 확인
    if (authResult.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const {
      code,
      name,
      description,
      type,
      value,
      minAmount,
      maxDiscount,
      validFrom,
      validUntil,
      usageLimit,
      isActive,
    } = body;

    // 필수 값 검증
    if (!code || !name || !type || value === undefined || !validFrom || !validUntil) {
      return NextResponse.json(
        { error: '필수 정보를 모두 입력해주세요.' },
        { status: 400 }
      );
    }

    // 쿠폰 타입 검증
    if (!['FIXED', 'PERCENT', 'FREE_SHIPPING'].includes(type)) {
      return NextResponse.json(
        { error: '올바른 쿠폰 타입을 선택해주세요.' },
        { status: 400 }
      );
    }

    // 쿠폰 코드 중복 확인
    const existingCoupon = await prisma.coupon.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (existingCoupon) {
      return NextResponse.json(
        { error: '이미 사용중인 쿠폰 코드입니다.' },
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
        usageLimit: usageLimit ? parseInt(usageLimit) : null,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    return NextResponse.json({
      success: true,
      data: coupon,
      message: '쿠폰이 생성되었습니다.',
    });
  } catch (error) {
    console.error('쿠폰 생성 오류:', error);
    return NextResponse.json(
      { error: '쿠폰 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
