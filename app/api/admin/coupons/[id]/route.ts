import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';

// 쿠폰 수정 (PATCH)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    const { id: couponId } = await params;
    const { isActive, usageLimit } = await req.json();

    const updateData: any = {};
    if (typeof isActive === 'boolean') {
      updateData.isActive = isActive;
    }
    if (typeof usageLimit === 'number') {
      updateData.usageLimit = usageLimit;
    }

    const updatedCoupon = await prisma.coupon.update({
      where: { id: couponId },
      data: updateData
    });

    return NextResponse.json({
      success: true,
      message: '쿠폰이 수정되었습니다',
      data: updatedCoupon
    });

  } catch (error) {
    console.error('쿠폰 수정 실패:', error);
    return NextResponse.json(
      { success: false, error: '쿠폰 수정에 실패했습니다' },
      { status: 500 }
    );
  }
}

// 쿠폰 삭제 (DELETE)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    const { id: couponId } = await params;

    // 사용된 쿠폰은 삭제 불가
    const coupon = await prisma.coupon.findUnique({
      where: { id: couponId },
      include: {
        _count: {
          select: { orders: true }
        }
      }
    });

    if (!coupon) {
      return NextResponse.json(
        { success: false, error: '쿠폰을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    if (coupon._count.orders > 0) {
      return NextResponse.json(
        { success: false, error: '사용된 쿠폰은 삭제할 수 없습니다. 비활성화하세요.' },
        { status: 400 }
      );
    }

    await prisma.coupon.delete({
      where: { id: couponId }
    });

    return NextResponse.json({
      success: true,
      message: '쿠폰이 삭제되었습니다'
    });

  } catch (error) {
    console.error('쿠폰 삭제 실패:', error);
    return NextResponse.json(
      { success: false, error: '쿠폰 삭제에 실패했습니다' },
      { status: 500 }
    );
  }
}
