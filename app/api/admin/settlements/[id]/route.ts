import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'
import { notifySettlementStatusChange } from '@/lib/notifications'

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

// 정산 승인/거절
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const decoded = verifyToken(request)
    if (!decoded || decoded.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const params = await context.params
    const settlementId = params.id
    const { status, rejectReason } = body

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json(
        { error: '유효하지 않은 상태입니다' },
        { status: 400 }
      )
    }

    const updateData: any = {
      status,
      processedAt: new Date()
    }

    if (status === 'REJECTED' && rejectReason) {
      updateData.rejectReason = rejectReason
    }

    if (status === 'APPROVED') {
      updateData.completedAt = new Date()
    }

    const settlement = await prisma.settlement.update({
      where: { id: settlementId },
      data: updateData,
      include: {
        partner: {
          include: {
            user: {
              select: {
                email: true,
                name: true
              }
            }
          }
        }
      }
    })
    
    // 알림 발송
    await notifySettlementStatusChange(
      settlement.partner.userId,
      settlement.amount,
      status
    );

    return NextResponse.json({ settlement })

  } catch (error) {
    console.error('Settlement update error:', error)
    return NextResponse.json(
      { error: '정산 처리 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
