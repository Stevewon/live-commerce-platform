import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyAuthToken } from '@/lib/auth/middleware';

const prisma = new PrismaClient();

// GET: 쿠폰 상세 조회
export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await segmentData.params;

    // 인증 확인
    const authResult = await verifyAuthToken(request);
    if (!authResult.valid || !authResult.user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    // 관리자 권한 확인
    if (authResult.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    // 쿠폰 조회
    const coupon = await prisma.coupon.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            orders: true,
          },
        },
      },
    });

    if (!coupon) {
      return NextResponse.json({ error: '쿠폰을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: coupon,
    });
  } catch (error) {
    console.error('쿠폰 조회 오류:', error);
    return NextResponse.json(
      { error: '쿠폰 정보를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// PATCH: 쿠폰 수정
export async function PATCH(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await segmentData.params;

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
      name,
      description,
      value,
      minAmount,
      maxDiscount,
      validFrom,
      validUntil,
      usageLimit,
      isActive,
    } = body;

    // 쿠폰 존재 확인
    const existingCoupon = await prisma.coupon.findUnique({
      where: { id },
    });

    if (!existingCoupon) {
      return NextResponse.json({ error: '쿠폰을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 업데이트할 데이터 준비
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (value !== undefined) updateData.value = parseFloat(value);
    if (minAmount !== undefined) updateData.minAmount = minAmount ? parseFloat(minAmount) : null;
    if (maxDiscount !== undefined) updateData.maxDiscount = maxDiscount ? parseFloat(maxDiscount) : null;
    if (validFrom !== undefined) updateData.validFrom = new Date(validFrom);
    if (validUntil !== undefined) updateData.validUntil = new Date(validUntil);
    if (usageLimit !== undefined) updateData.usageLimit = usageLimit ? parseInt(usageLimit) : null;
    if (isActive !== undefined) updateData.isActive = isActive;

    // 쿠폰 수정
    const coupon = await prisma.coupon.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: coupon,
      message: '쿠폰이 수정되었습니다.',
    });
  } catch (error) {
    console.error('쿠폰 수정 오류:', error);
    return NextResponse.json(
      { error: '쿠폰 수정에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE: 쿠폰 삭제
export async function DELETE(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await segmentData.params;

    // 인증 확인
    const authResult = await verifyAuthToken(request);
    if (!authResult.valid || !authResult.user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    // 관리자 권한 확인
    if (authResult.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    // 쿠폰 존재 확인
    const existingCoupon = await prisma.coupon.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            orders: true,
          },
        },
      },
    });

    if (!existingCoupon) {
      return NextResponse.json({ error: '쿠폰을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 사용된 쿠폰인 경우 삭제 대신 비활성화
    if (existingCoupon._count.orders > 0) {
      await prisma.coupon.update({
        where: { id },
        data: { isActive: false },
      });

      return NextResponse.json({
        success: true,
        message: '사용된 쿠폰은 삭제 대신 비활성화되었습니다.',
      });
    }

    // 쿠폰 삭제
    await prisma.coupon.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: '쿠폰이 삭제되었습니다.',
    });
  } catch (error) {
    console.error('쿠폰 삭제 오류:', error);
    return NextResponse.json(
      { error: '쿠폰 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
