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
    const productId = params.id

    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: body
    })

    return NextResponse.json({ product: updatedProduct })

  } catch (error) {
    console.error('Product update error:', error)
    return NextResponse.json(
      { error: '제품 업데이트 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
