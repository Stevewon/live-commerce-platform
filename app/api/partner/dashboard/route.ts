import { NextRequest, NextResponse } from 'next/server'
import { verifyAuthToken } from '@/lib/auth/middleware'
import { getPrisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const prisma = await getPrisma();
  try {
    // 인증 확인
    const authResult = await verifyAuthToken(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { userId, role } = authResult;

    // 파트너 권한 확인
    if (role !== 'PARTNER') {
      return NextResponse.json(
        { success: false, error: '파트너 권한이 필요합니다' },
        { status: 403 }
      );
    }

    // 파트너 정보 조회
    const partner = await prisma.partner.findUnique({
      where: { userId }
    });

    if (!partner) {
      return NextResponse.json(
        { success: false, error: '파트너 정보를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 파트너 활성화 상태 확인
    if (!partner.isActive) {
      return NextResponse.json(
        { success: false, error: '파트너 승인 대기 중입니다. 관리자 승인 후 이용 가능합니다.' },
        { status: 403 }
      );
    }

    const partnerId = partner.id;

    // 파트너의 총 주문 통계
    const orders = await prisma.order.findMany({
      where: { partnerId },
      include: {
        items: true
      }
    });

    // 통계 계산
    const totalSales = orders.reduce((sum, order) => sum + order.total, 0);
    const totalOrders = orders.length;
    
    // 정산 통계 (별도로 조회)
    const settlements = await prisma.settlement.findMany({
      where: { partnerId }
    });
    
    const pendingSettlement = orders
      .filter(order => !settlements.some(s => s.status === 'COMPLETED'))
      .reduce((sum, order) => sum + (order.partnerRevenue || 0), 0);
    
    const completedSettlement = settlements
      .filter(s => s.status === 'COMPLETED')
      .reduce((sum, settlement) => sum + settlement.amount, 0);

    // 오늘 매출 (한국 시간 기준)
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstNow = new Date(now.getTime() + kstOffset);
    const today = new Date(kstNow.getFullYear(), kstNow.getMonth(), kstNow.getDate());
    today.setTime(today.getTime() - kstOffset);
    const todaySales = orders
      .filter(order => new Date(order.createdAt) >= today)
      .reduce((sum, order) => sum + order.total, 0);

    // 활성 제품 수
    const activeProducts = await prisma.partnerProduct.count({
      where: {
        partnerId,
        isActive: true
      }
    });

    // 최근 주문 5건
    const recentOrders = await prisma.order.findMany({
      where: { partnerId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        total: true,
        partnerRevenue: true,
        status: true,
        createdAt: true
      }
    });

    return NextResponse.json({
      success: true,
      partner: {
        id: partner.id,
        storeName: partner.storeName,
        storeSlug: partner.storeSlug
      },
      stats: {
        totalSales,
        totalOrders,
        pendingSettlement,
        completedSettlement,
        activeProducts,
        todaySales
      },
      recentOrders
    });

  } catch (error: any) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || '데이터를 불러오는 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
