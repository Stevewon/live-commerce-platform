import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET: 쿠폰 유효성 검증 (공개 API)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const amount = searchParams.get('amount');

    if (!code) {
      return NextResponse.json(
        { error: '쿠폰 코드를 입력해주세요.' },
        { status: 400 }
      );
    }

    // 쿠폰 조회
    const coupon = await prisma.coupon.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!coupon) {
      return NextResponse.json(
        { error: '유효하지 않은 쿠폰 코드입니다.' },
        { status: 404 }
      );
    }

    const now = new Date();

    // 쿠폰 상태 검증
    if (!coupon.isActive) {
      return NextResponse.json(
        { error: '비활성화된 쿠폰입니다.' },
        { status: 400 }
      );
    }

    if (now < coupon.validFrom) {
      return NextResponse.json(
        { error: '아직 사용할 수 없는 쿠폰입니다.' },
        { status: 400 }
      );
    }

    if (now > coupon.validUntil) {
      return NextResponse.json(
        { error: '기한이 만료된 쿠폰입니다.' },
        { status: 400 }
      );
    }

    // 사용 횟수 검증
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return NextResponse.json(
        { error: '사용 가능 횟수를 초과한 쿠폰입니다.' },
        { status: 400 }
      );
    }

    // 최소 주문 금액 검증
    if (amount && coupon.minAmount && parseFloat(amount) < coupon.minAmount) {
      return NextResponse.json(
        { 
          error: `최소 주문 금액은 ₩${coupon.minAmount.toLocaleString()}입니다.`,
        },
        { status: 400 }
      );
    }

    // 할인 금액 계산
    let discountAmount = 0;
    if (amount) {
      const orderAmount = parseFloat(amount);
      
      if (coupon.type === 'FIXED') {
        discountAmount = coupon.value;
      } else if (coupon.type === 'PERCENT') {
        discountAmount = (orderAmount * coupon.value) / 100;
        if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
          discountAmount = coupon.maxDiscount;
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: coupon.id,
        code: coupon.code,
        name: coupon.name,
        description: coupon.description,
        type: coupon.type,
        value: coupon.value,
        minAmount: coupon.minAmount,
        maxDiscount: coupon.maxDiscount,
        discountAmount,
      },
      message: '사용 가능한 쿠폰입니다.',
    });
  } catch (error) {
    console.error('쿠폰 검증 오류:', error);
    return NextResponse.json(
      { error: '쿠폰 검증에 실패했습니다.' },
      { status: 500 }
    );
  }
}
