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

    // 모든 제품 가져오기
    const products = await prisma.product.findMany({
      include: {
        category: {
          select: {
            name: true
          }
        },
        _count: {
          select: {
            partnerProducts: true,
            orderItems: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({ products })

  } catch (error) {
    console.error('Admin Products API error:', error)
    return NextResponse.json(
      { error: '제품을 불러오는 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
