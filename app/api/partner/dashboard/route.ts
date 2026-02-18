import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this'

function verifyToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  try {
    return jwt.verify(token, JWT_SECRET) as any
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const decoded = verifyToken(request)
    if (!decoded || !decoded.partnerId) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      )
    }

    const partnerId = decoded.partnerId

    // 파트너의 총 주문 통계
    const orders = await prisma.order.findMany({
      where: { partnerId },
      include: {
        items: true
      }
    })

    // 통계 계산
    const totalSales = orders.reduce((sum, order) => sum + order.total, 0)
    const totalOrders = orders.length
    
    // 정산 통계 (별도로 조회)
    const settlements = await prisma.settlement.findMany({
      where: { partnerId }
    })
    
    const pendingSettlement = orders
      .filter(order => !settlements.some(s => s.status === 'COMPLETED'))
      .reduce((sum, order) => sum + order.partnerRevenue, 0)
    
    const completedSettlement = settlements
      .filter(s => s.status === 'COMPLETED')
      .reduce((sum, settlement) => sum + settlement.amount, 0)

    // 오늘 매출
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todaySales = orders
      .filter(order => new Date(order.createdAt) >= today)
      .reduce((sum, order) => sum + order.total, 0)

    // 활성 제품 수
    const activeProducts = await prisma.partnerProduct.count({
      where: {
        partnerId,
        isActive: true
      }
    })

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
    })

    return NextResponse.json({
      stats: {
        totalSales,
        totalOrders,
        pendingSettlement,
        completedSettlement,
        activeProducts,
        todaySales
      },
      recentOrders
    })

  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json(
      { error: '데이터를 불러오는 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
