import { NextRequest, NextResponse } from 'next/server'
import { verifyAuthToken } from '@/lib/auth/middleware'
import { getPrisma } from '@/lib/prisma';
import { cancelTossPayment } from '@/lib/toss';

// 주문 상세 조회 (GET)
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const prisma = await getPrisma();
  try {
    const { id } = await context.params;
    // 인증 확인
    const authResult = await verifyAuthToken(req)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { userId } = authResult

    const { id: orderId } = await context.params

    // 주문 조회
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              include: {
                category: true
              }
            }
          }
        }
      }
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 본인의 주문인지 확인
    if (order.userId !== userId) {
      return NextResponse.json(
        { success: false, error: '접근 권한이 없습니다' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      order
    })
  } catch (error: any) {
    console.error('Get order detail error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '주문 조회 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

// 주문 취소 (PATCH)
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const prisma = await getPrisma();
  try {
    const { id } = await context.params;
    // 인증 확인
    const authResult = await verifyAuthToken(req)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { userId } = authResult

    const { id: orderId } = await context.params
    const { status } = await req.json()

    // 주문 조회
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 본인의 주문인지 확인
    if (order.userId !== userId) {
      return NextResponse.json(
        { success: false, error: '접근 권한이 없습니다' },
        { status: 403 }
      )
    }

    // 취소 가능한 상태인지 확인
    if (order.status !== 'PENDING' && order.status !== 'CONFIRMED') {
      return NextResponse.json(
        { success: false, error: '이미 배송이 시작되어 취소할 수 없습니다' },
        { status: 400 }
      )
    }

    // 주문 상태 업데이트
    const updateData: any = { status }

    // 취소 시 Toss 결제 취소 및 재고 복구
    if (status === 'CANCELLED') {
      updateData.cancelledAt = new Date()
      
      // Toss Payments 실결제 취소
      if (order.paymentKey) {
        try {
          const cancelResult = await cancelTossPayment(order.paymentKey, '고객 요청에 의한 주문 취소')
          updateData.refundAmount = cancelResult.cancels?.[0]?.cancelAmount || order.total
          updateData.refundedAt = new Date()
        } catch (tossError: any) {
          console.error('Toss payment cancel failed:', tossError.message)
          // Toss 취소 실패해도 주문 취소는 진행 (수동 환불 필요)
        }
      }
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    })

    // 취소 시 재고 복구
    if (status === 'CANCELLED') {
      for (const item of updatedOrder.items) {
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              increment: item.quantity
            }
          }
        })
      }
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      message: status === 'CANCELLED' ? '주문이 취소되었습니다' : '주문 상태가 변경되었습니다'
    })
  } catch (error: any) {
    console.error('Update order error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '주문 처리 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
