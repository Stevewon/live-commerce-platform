import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';

// 파트너 활성화/비활성화 (PATCH)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { isActive, commissionRate } = await req.json();
    const { id: partnerId } = await params;

    // 파트너 존재 확인
    const existingPartner = await prisma.partner.findUnique({
      where: { id: partnerId }
    });

    if (!existingPartner) {
      return NextResponse.json(
        { success: false, error: '파트너를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 업데이트 데이터 준비
    const updateData: any = {};
    if (typeof isActive === 'boolean') {
      updateData.isActive = isActive;
    }
    if (typeof commissionRate === 'number') {
      if (commissionRate < 0 || commissionRate > 100) {
        return NextResponse.json(
          { success: false, error: '수수료율은 0~100 사이여야 합니다' },
          { status: 400 }
        );
      }
      updateData.commissionRate = commissionRate;
    }

    // 파트너 업데이트
    const updatedPartner = await prisma.partner.update({
      where: { id: partnerId },
      data: updateData,
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: '파트너 정보가 업데이트되었습니다',
      data: updatedPartner
    });

  } catch (error) {
    console.error('파트너 업데이트 실패:', error);
    return NextResponse.json(
      { success: false, error: '파트너 업데이트에 실패했습니다' },
      { status: 500 }
    );
  }
}

// 파트너 삭제 (DELETE)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: partnerId } = await params;

    // 파트너 존재 확인
    const existingPartner = await prisma.partner.findUnique({
      where: { id: partnerId },
      include: {
        _count: {
          select: {
            orders: true,
            products: true
          }
        }
      }
    });

    if (!existingPartner) {
      return NextResponse.json(
        { success: false, error: '파트너를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 주문이나 상품이 있으면 삭제 불가
    if (existingPartner._count.orders > 0 || existingPartner._count.products > 0) {
      return NextResponse.json(
        { success: false, error: '주문이나 상품이 있는 파트너는 삭제할 수 없습니다. 비활성화를 사용하세요.' },
        { status: 400 }
      );
    }

    // 파트너 삭제
    await prisma.partner.delete({
      where: { id: partnerId }
    });

    return NextResponse.json({
      success: true,
      message: '파트너가 삭제되었습니다'
    });

  } catch (error) {
    console.error('파트너 삭제 실패:', error);
    return NextResponse.json(
      { success: false, error: '파트너 삭제에 실패했습니다' },
      { status: 500 }
    );
  }
}
