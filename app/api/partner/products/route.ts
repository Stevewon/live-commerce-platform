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

// 파트너가 선택한 제품 목록 조회
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

    const partnerProducts = await prisma.partnerProduct.findMany({
      where: { partnerId: partner.id },
      include: {
        product: {
          include: {
            category: true
          }
        }
      }
    })

    return NextResponse.json({ products: partnerProducts })

  } catch (error) {
    console.error('Partner products fetch error:', error)
    return NextResponse.json(
      { error: '제품 목록 조회 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

// 제품 추가/제거
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
    const { productId, action } = body // action: 'add' or 'remove'

    if (action === 'add') {
      // 이미 추가된 제품인지 확인
      const existing = await prisma.partnerProduct.findUnique({
        where: {
          partnerId_productId: {
            partnerId: partner.id,
            productId
          }
        }
      })

      if (existing) {
        return NextResponse.json(
          { error: '이미 추가된 제품입니다' },
          { status: 400 }
        )
      }

      const partnerProduct = await prisma.partnerProduct.create({
        data: {
          partnerId: partner.id,
          productId,
          isActive: true
        },
        include: {
          product: true
        }
      })

      return NextResponse.json({ partnerProduct })

    } else if (action === 'remove') {
      await prisma.partnerProduct.delete({
        where: {
          partnerId_productId: {
            partnerId: partner.id,
            productId
          }
        }
      })

      return NextResponse.json({ message: '제품이 제거되었습니다' })

    } else {
      return NextResponse.json(
        { error: '유효하지 않은 액션입니다' },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Partner product action error:', error)
    return NextResponse.json(
      { error: '제품 처리 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
