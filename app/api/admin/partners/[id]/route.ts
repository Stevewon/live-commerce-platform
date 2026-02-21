import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';

// 관리자 파트너 상세 조회 (GET)
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
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

    const partner = await prisma.partner.findUnique({
      where: { id: params.id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
            createdAt: true
          }
        },
        _count: {
          select: {
            products: true,
            orders: true,
            settlements: true
          }
        }
      }
    });

    if (!partner) {
      return NextResponse.json(
        { success: false, error: '파트너를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 총 매출 계산
    const revenue = await prisma.order.aggregate({
      where: {
        partnerId: partner.id,
        status: { in: ['CONFIRMED', 'SHIPPING', 'DELIVERED'] }
      },
      _sum: { total: true }
    });

    return NextResponse.json({
      success: true,
      data: {
        ...partner,
        totalRevenue: revenue._sum.total || 0
      }
    });

  } catch (error) {
    console.error('파트너 조회 실패:', error);
    return NextResponse.json(
      { success: false, error: '파트너 조회에 실패했습니다' },
      { status: 500 }
    );
  }
}

// 관리자 파트너 정보 수정 (PATCH)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
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

    const body = await req.json();
    const { isActive, commissionRate, storeName, businessNumber, bankAccount } = body;

    // 파트너 존재 확인
    const partner = await prisma.partner.findUnique({
      where: { id: params.id }
    });

    if (!partner) {
      return NextResponse.json(
        { success: false, error: '파트너를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 파트너 정보 수정
    const updatedPartner = await prisma.partner.update({
      where: { id: params.id },
      data: {
        ...(isActive !== undefined && { isActive }),
        ...(commissionRate !== undefined && { commissionRate }),
        ...(storeName && { storeName }),
        ...(businessNumber !== undefined && { businessNumber }),
        ...(bankAccount && { bankAccount })
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: updatedPartner,
      message: '파트너 정보가 수정되었습니다'
    });

  } catch (error) {
    console.error('파트너 수정 실패:', error);
    return NextResponse.json(
      { success: false, error: '파트너 수정에 실패했습니다' },
      { status: 500 }
    );
  }
}

// 관리자 파트너 삭제 (DELETE)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
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

    // 파트너 존재 확인
    const partner = await prisma.partner.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            products: true,
            orders: true
          }
        }
      }
    });

    if (!partner) {
      return NextResponse.json(
        { success: false, error: '파트너를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 상품이나 주문이 있으면 비활성화만 가능
    if (partner._count.products > 0 || partner._count.orders > 0) {
      await prisma.partner.update({
        where: { id: params.id },
        data: { isActive: false }
      });
      return NextResponse.json({
        success: true,
        message: '상품 또는 주문 내역이 있어 파트너가 비활성화되었습니다'
      });
    }

    // 연결된 데이터가 없으면 완전 삭제
    await prisma.partner.delete({
      where: { id: params.id }
    });

    return NextResponse.json({
      success: true,
      message: '파트너가 성공적으로 삭제되었습니다'
    });

  } catch (error) {
    console.error('파트너 삭제 실패:', error);
    return NextResponse.json(
      { success: false, error: '파트너 삭제에 실패했습니다' },
      { status: 500 }
    );
  }
}
