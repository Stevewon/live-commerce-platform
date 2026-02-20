import { NextRequest, NextResponse } from 'next/server'
import { verifyAuthToken } from '@/lib/auth/middleware'
import prisma from '@/lib/prisma'

// 주문 생성 (POST)
export async function POST(req: NextRequest) {
  try {
    // 인증 확인
    const authResult = await verifyAuthToken(req)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { userId } = authResult

    const body = await req.json()
    const {
      items, // [{ productId, quantity, price }]
      shippingName,
      shippingPhone,
      shippingAddress,
      shippingZipCode,
      shippingMemo,
      paymentMethod = 'CARD',
      shippingFee = 3000,
      couponCode // 쿠폰 코드 추가
    } = body

    // 유효성 검사
    if (!items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: '주문할 상품이 없습니다' },
        { status: 400 }
      )
    }

    if (!shippingName || !shippingPhone || !shippingAddress) {
      return NextResponse.json(
        { success: false, error: '배송 정보를 입력해주세요' },
        { status: 400 }
      )
    }

    // 상품 가격 검증
    const productIds = items.map((item: any) => item.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } }
    })

    let subtotal = 0
    const validatedItems: Array<{
      productId: string
      quantity: number
      price: number
    }> = []

    for (const item of items) {
      const product = products.find(p => p.id === item.productId)
      if (!product) {
        return NextResponse.json(
          { success: false, error: `상품을 찾을 수 없습니다: ${item.productId}` },
          { status: 404 }
        )
      }

      // 재고 확인
      if (product.stock < item.quantity) {
        return NextResponse.json(
          { success: false, error: `${product.name}의 재고가 부족합니다` },
          { status: 400 }
        )
      }

      const itemTotal = product.price * item.quantity
      subtotal += itemTotal

      validatedItems.push({
        productId: product.id,
        quantity: item.quantity,
        price: product.price
      })
    }

    // 쿠폰 처리
    let discount = 0
    let appliedShippingFee = shippingFee
    let couponId: string | null = null

    if (couponCode) {
      const coupon = await prisma.coupon.findUnique({
        where: { code: couponCode.toUpperCase() }
      })

      if (coupon && coupon.isActive) {
        const now = new Date()
        // 유효기간 및 사용 횟수 확인
        if (now >= coupon.validFrom && now <= coupon.validUntil) {
          if (coupon.usageLimit === null || coupon.usedCount < coupon.usageLimit) {
            // 최소 주문 금액 확인
            if (!coupon.minAmount || subtotal >= coupon.minAmount) {
              couponId = coupon.id

              switch (coupon.type) {
                case 'FIXED':
                  discount = coupon.value
                  break
                case 'PERCENT':
                  discount = subtotal * (coupon.value / 100)
                  if (coupon.maxDiscount && discount > coupon.maxDiscount) {
                    discount = coupon.maxDiscount
                  }
                  break
                case 'FREE_SHIPPING':
                  appliedShippingFee = 0
                  break
              }
            }
          }
        }
      }
    }

    const total = subtotal - discount + appliedShippingFee

    // 주문 번호 생성 (ORD-timestamp)
    const orderNumber = `ORD-${Date.now()}`

    // 주문 생성 (트랜잭션)
    const order = await prisma.$transaction(async (tx) => {
      // 주문 생성
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          userId,
          subtotal,
          discount,
          shippingFee: appliedShippingFee,
          total,
          shippingName,
          shippingPhone,
          shippingAddress,
          shippingZipCode,
          shippingMemo,
          paymentMethod,
          status: 'PENDING',
          couponId, // 쿠폰 ID 저장
          // 주문 항목 생성
          items: {
            create: validatedItems
          }
        },
        include: {
          items: {
            include: {
              product: true
            }
          }
        }
      })

      // 재고 차감
      for (const item of validatedItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity
            }
          }
        })
      }

      // 쿠폰 사용 횟수 증가
      if (couponId) {
        await tx.coupon.update({
          where: { id: couponId },
          data: {
            usedCount: { increment: 1 }
          }
        })
      }

      return newOrder
    })

    return NextResponse.json({
      success: true,
      order,
      message: '주문이 완료되었습니다'
    })
  } catch (error: any) {
    console.error('Create order error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '주문 처리 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

// 주문 내역 조회 (GET)
export async function GET(req: NextRequest) {
  try {
    // 인증 확인
    const authResult = await verifyAuthToken(req)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { userId } = authResult

    // 주문 내역 조회
    const orders = await prisma.order.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                category: true
              }
            }
          }
        },
        review: {
          select: {
            id: true,
            rating: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({
      success: true,
      orders
    })
  } catch (error: any) {
    console.error('Get orders error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '주문 내역 조회 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
