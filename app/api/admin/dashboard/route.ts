import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';

export async function GET(request: NextRequest) {
  const prisma = await getPrisma();
  try {
    const authResult = await verifyAuthToken(request);
    if (authResult instanceof NextResponse) return authResult;
    if (authResult.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다' },
        { status: 403 }
      )
    }

    // 모든 주문 가져오기
    const orders = await prisma.order.findMany({
      include: {
        partner: {
          select: {
            storeName: true
          }
        },
        user: {
          select: {
            name: true
          }
        }
      }
    })

    // 통계 계산
    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0)
    const totalOrders = orders.length
    const pendingOrders = orders.filter(order => order.status === 'PENDING').length

    // 오늘 통계 (한국 시간 기준)
    const now = new Date()
    const kstOffset = 9 * 60 * 60 * 1000 // UTC+9
    const kstNow = new Date(now.getTime() + kstOffset)
    const today = new Date(kstNow.getFullYear(), kstNow.getMonth(), kstNow.getDate())
    today.setTime(today.getTime() - kstOffset) // KST 자정을 UTC로 변환
    const todayOrders = orders.filter(order => new Date(order.createdAt) >= today)
    const todayRevenue = todayOrders.reduce((sum, order) => sum + order.total, 0)

    // 파트너 수
    const totalPartners = await prisma.partner.count({
      where: { isActive: true }
    })

    // 제품 수
    const totalProducts = await prisma.product.count({
      where: { isActive: true }
    })

    // 고객 수
    const totalCustomers = await prisma.user.count({
      where: { role: 'CUSTOMER' }
    })

    // 최근 주문 10건
    const recentOrders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        partner: {
          select: {
            storeName: true
          }
        },
        user: {
          select: {
            name: true
          }
        }
      }
    })

    // 파트너 목록 (주문 수 포함)
    const partners = await prisma.partner.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        },
        _count: {
          select: {
            orders: true
          }
        }
      }
    })

    return NextResponse.json({
      stats: {
        totalRevenue,
        totalOrders,
        totalProducts,
        totalPartners,
        totalCustomers,
        pendingOrders,
        todayRevenue,
        todayOrders: todayOrders.length
      },
      recentOrders,
      partners
    })

  } catch (error) {
    console.error('Admin Dashboard API error:', error)
    return NextResponse.json(
      { error: '데이터를 불러오는 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
