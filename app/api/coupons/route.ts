import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

// 쿠폰 목록 조회 (GET) - 사용자용
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const available = searchParams.get('available') === 'true';

    const now = new Date();
    const where: any = {
      isActive: true
    };

    if (available) {
      where.validFrom = { lte: now };
      where.validUntil = { gte: now };
    }

    const coupons = await prisma.coupon.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({
      success: true,
      data: coupons
    });

  } catch (error) {
    console.error('Get coupons error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '쿠폰 조회 중 오류가 발생했습니다',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// 쿠폰 생성 (POST) - 관리자 전용
export async function POST(request: NextRequest) {
  try {
    // 관리자 인증
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      code,
      name,
      type,
      value,
      maxDiscount,
      minAmount,
      validFrom,
      validUntil,
      usageLimit,
      isActive
    } = body;

    // 유효성 검사
    if (!code || !name || !type || value === undefined) {
      return NextResponse.json(
        { success: false, error: '필수 정보가 누락되었습니다' },
        { status: 400 }
      );
    }

    if (!['FIXED', 'PERCENT', 'FREE_SHIPPING'].includes(type)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 쿠폰 타입입니다' },
        { status: 400 }
      );
    }

    // 쿠폰 코드 중복 확인
    const existing = await prisma.coupon.findUnique({
      where: { code: code.toUpperCase() }
    });

    if (existing) {
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
        type,
        value,
        maxDiscount: maxDiscount || null,
        minAmount: minAmount || null,
        validFrom: validFrom ? new Date(validFrom) : new Date(),
        validUntil: validUntil ? new Date(validUntil) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 기본 30일
        usageLimit: usageLimit || null,
        usedCount: 0,
        isActive: isActive !== undefined ? isActive : true
      }
    });

    return NextResponse.json({
      success: true,
      message: '쿠폰이 생성되었습니다',
      data: coupon
    });

  } catch (error) {
    console.error('Create coupon error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '쿠폰 생성 중 오류가 발생했습니다',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
