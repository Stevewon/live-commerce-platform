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
    if (!decoded || decoded.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다' },
        { status: 401 }
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

    // 오늘 통계
    const today = new Date()
    today.setHours(0, 0, 0, 0)
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
