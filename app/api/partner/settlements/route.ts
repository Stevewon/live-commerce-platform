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

// 파트너 정산 내역 조회
export async function GET(request: NextRequest) {
  try {
    const decoded = verifyToken(request)
    if (!decoded || decoded.role !== 'PARTNER') {
      return NextResponse.json(
        { error: '파트너 권한이 필요합니다' },
        { status: 401 }
      )
    }

    const partner = await prisma.partner.findUnique({
      where: { userId: decoded.userId }
    })

    if (!partner) {
      return NextResponse.json(
        { error: '파트너 정보를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    const settlements = await prisma.settlement.findMany({
      where: { partnerId: partner.id },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ settlements })

  } catch (error) {
    console.error('Settlement fetch error:', error)
    return NextResponse.json(
      { error: '정산 내역 조회 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

// 정산 요청
export async function POST(request: NextRequest) {
  try {
    const decoded = verifyToken(request)
    if (!decoded || decoded.role !== 'PARTNER') {
      return NextResponse.json(
        { error: '파트너 권한이 필요합니다' },
        { status: 401 }
      )
    }

    const partner = await prisma.partner.findUnique({
      where: { userId: decoded.userId }
    })

    if (!partner) {
      return NextResponse.json(
        { error: '파트너 정보를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { amount, bankAccount, accountHolder } = body

    // 정산 가능한 금액 확인 (배송 완료된 주문의 파트너 수익)
    const availableAmount = await prisma.order.aggregate({
      where: {
        partnerId: partner.id,
        status: 'DELIVERED',
        // 아직 정산되지 않은 주문
        Settlement: {
          none: {}
        }
      },
      _sum: {
        partnerProfit: true
      }
    })

    const availableTotal = availableAmount._sum.partnerProfit || 0

    if (amount > availableTotal) {
      return NextResponse.json(
        { error: `정산 가능 금액은 ${availableTotal.toLocaleString()}원입니다` },
        { status: 400 }
      )
    }

    // 정산 요청 생성
    const settlement = await prisma.settlement.create({
      data: {
        partnerId: partner.id,
        amount,
        status: 'PENDING',
        bankAccount,
        accountHolder,
        requestDate: new Date()
      }
    })

    return NextResponse.json({ settlement })

  } catch (error) {
    console.error('Settlement request error:', error)
    return NextResponse.json(
      { error: '정산 요청 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
