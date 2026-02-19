import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth/middleware';

// GET /api/cart - 장바구니 조회
export async function GET(request: NextRequest) {
  return requireAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const userId = req.user!.userId;
      
      const cartItems = await prisma.cartItem.findMany({
        where: {
          userId,
        },
        include: {
          product: {
            include: {
              category: {
                select: {
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      
      return NextResponse.json({
        success: true,
        data: cartItems,
      });
    } catch (error) {
      console.error('[CART_GET]', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch cart',
        },
        { status: 500 }
      );
    }
  });
}

// POST /api/cart - 장바구니에 추가
export async function POST(request: NextRequest) {
  return requireAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const userId = req.user!.userId;
      const body = await req.json();
      const { productId, quantity = 1 } = body;
      
      if (!productId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Product ID is required',
          },
          { status: 400 }
        );
      }
      
      // 상품 존재 확인
      const product = await prisma.product.findUnique({
        where: { id: productId },
      });
      
      if (!product) {
        return NextResponse.json(
          {
            success: false,
            error: 'Product not found',
          },
          { status: 404 }
        );
      }
      
      // 이미 장바구니에 있는지 확인
      const existingItem = await prisma.cartItem.findUnique({
        where: {
          userId_productId: {
            userId,
            productId,
          },
        },
      });
      
      let cartItem;
      
      if (existingItem) {
        // 수량 업데이트
        cartItem = await prisma.cartItem.update({
          where: {
            id: existingItem.id,
          },
          data: {
            quantity: existingItem.quantity + quantity,
          },
          include: {
            product: true,
          },
        });
      } else {
        // 새로 추가
        cartItem = await prisma.cartItem.create({
          data: {
            userId,
            productId,
            quantity,
          },
          include: {
            product: true,
          },
        });
      }
      
      return NextResponse.json({
        success: true,
        data: cartItem,
      });
    } catch (error) {
      console.error('[CART_POST]', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to add to cart',
        },
        { status: 500 }
      );
    }
  });
}

// DELETE /api/cart - 장바구니에서 삭제
export async function DELETE(request: NextRequest) {
  return requireAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const userId = req.user!.userId;
      const { searchParams } = new URL(req.url);
      const productId = searchParams.get('productId');
      
      if (!productId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Product ID is required',
          },
          { status: 400 }
        );
      }
      
      await prisma.cartItem.deleteMany({
        where: {
          userId,
          productId,
        },
      });
      
      return NextResponse.json({
        success: true,
        message: 'Item removed from cart',
      });
    } catch (error) {
      console.error('[CART_DELETE]', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to remove from cart',
        },
        { status: 500 }
      );
    }
  });
}

// PATCH /api/cart - 장바구니 수량 업데이트
export async function PATCH(request: NextRequest) {
  return requireAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const userId = req.user!.userId;
      const body = await req.json();
      const { productId, quantity } = body;
      
      if (!productId || quantity === undefined) {
        return NextResponse.json(
          {
            success: false,
            error: 'Product ID and quantity are required',
          },
          { status: 400 }
        );
      }
      
      if (quantity <= 0) {
        // 수량이 0 이하면 삭제
        await prisma.cartItem.deleteMany({
          where: {
            userId,
            productId,
          },
        });
        
        return NextResponse.json({
          success: true,
          message: 'Item removed from cart',
        });
      }
      
      const cartItem = await prisma.cartItem.updateMany({
        where: {
          userId,
          productId,
        },
        data: {
          quantity,
        },
      });
      
      return NextResponse.json({
        success: true,
        data: cartItem,
      });
    } catch (error) {
      console.error('[CART_PATCH]', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to update cart',
        },
        { status: 500 }
      );
    }
  });
}
