import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// 쿠폰 검증 (POST)
export async function POST(req: NextRequest) {
  try {
    const { code, subtotal } = await req.json();

    if (!code) {
      return NextResponse.json(
        { success: false, error: '쿠폰 코드를 입력해주세요' },
        { status: 400 }
      );
    }

    // 쿠폰 조회
    const coupon = await prisma.coupon.findUnique({
      where: { code: code.toUpperCase() }
    });

    if (!coupon) {
      return NextResponse.json(
        { success: false, error: '존재하지 않는 쿠폰입니다' },
        { status: 404 }
      );
    }

    // 활성화 상태 확인
    if (!coupon.isActive) {
      return NextResponse.json(
        { success: false, error: '사용할 수 없는 쿠폰입니다' },
        { status: 400 }
      );
    }

    // 유효기간 확인
    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validUntil) {
      return NextResponse.json(
        { success: false, error: '쿠폰 사용 기간이 아닙니다' },
        { status: 400 }
      );
    }

    // 사용 횟수 확인
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      return NextResponse.json(
        { success: false, error: '쿠폰 사용 가능 횟수를 초과했습니다' },
        { status: 400 }
      );
    }

    // 최소 주문 금액 확인
    if (coupon.minAmount && subtotal < coupon.minAmount) {
      return NextResponse.json(
        { 
          success: false, 
          error: `최소 주문 금액 ${coupon.minAmount.toLocaleString()}원 이상부터 사용 가능합니다` 
        },
        { status: 400 }
      );
    }

    // 할인 금액 계산
    let discountAmount = 0;
    let shippingDiscount = 0;

    switch (coupon.type) {
      case 'FIXED':
        discountAmount = coupon.value;
        break;
      
      case 'PERCENT':
        discountAmount = subtotal * (coupon.value / 100);
        // 최대 할인 금액 적용
        if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
          discountAmount = coupon.maxDiscount;
        }
        break;
      
      case 'FREE_SHIPPING':
        shippingDiscount = 3000; // 기본 배송비 (실제 배송비는 주문 시 계산)
        break;
    }

    return NextResponse.json({
      success: true,
      data: {
        coupon: {
          id: coupon.id,
          code: coupon.code,
          name: coupon.name,
          type: coupon.type
        },
        discount: {
          amount: Math.round(discountAmount),
          shippingDiscount: Math.round(shippingDiscount)
        }
      }
    });

  } catch (error) {
    console.error('쿠폰 검증 실패:', error);
    return NextResponse.json(
      { success: false, error: '쿠폰 검증에 실패했습니다' },
      { status: 500 }
    );
  }
}
