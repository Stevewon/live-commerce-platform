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

// 관리자 정산 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const decoded = verifyToken(request)
    if (!decoded || decoded.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다' },
        { status: 401 }
      )
    }

    const settlement = await prisma.settlement.findUnique({
      where: { id: params.id },
      include: {
        partner: {
          include: {
            user: {
              select: {
                email: true,
                name: true,
                phone: true
              }
            }
          }
        }
      }
    })

    if (!settlement) {
      return NextResponse.json(
        { error: '정산 내역을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 해당 기간의 주문 내역 조회
    const orders = await prisma.order.findMany({
      where: {
        partnerId: settlement.partnerId,
        status: { in: ['CONFIRMED', 'SHIPPING', 'DELIVERED'] },
        createdAt: {
          gte: settlement.startDate,
          lte: settlement.endDate
        }
      },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        },
        items: {
          include: {
            product: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({
      success: true,
      data: {
        settlement,
        orders
      }
    })

  } catch (error) {
    console.error('Settlement detail fetch error:', error)
    return NextResponse.json(
      { error: '정산 상세 조회 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

// 관리자 정산 승인/거부
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const decoded = verifyToken(request)
    if (!decoded || decoded.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다' },
        { status: 401 }
      )
    }

    const { status, rejectionReason } = await request.json()

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json(
        { error: '유효하지 않은 상태입니다' },
        { status: 400 }
      )
    }

    const settlement = await prisma.settlement.findUnique({
      where: { id: params.id }
    })

    if (!settlement) {
      return NextResponse.json(
        { error: '정산 내역을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    if (settlement.status !== 'PENDING') {
      return NextResponse.json(
        { error: '대기 중인 정산만 처리할 수 있습니다' },
        { status: 400 }
      )
    }

    const updatedSettlement = await prisma.settlement.update({
      where: { id: params.id },
      data: {
        status,
        ...(status === 'APPROVED' && { paidAt: new Date() }),
        ...(status === 'REJECTED' && rejectionReason && { rejectionReason })
      },
      include: {
        partner: {
          include: {
            user: {
              select: {
                name: true,
                email: true
              }
            }
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedSettlement,
      message: status === 'APPROVED' ? '정산이 승인되었습니다' : '정산이 거부되었습니다'
    })

  } catch (error) {
    console.error('Settlement update error:', error)
    return NextResponse.json(
      { error: '정산 처리 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
