import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth/middleware';

// GET /api/cart - 장바구니 조회
export async function GET(request: NextRequest) {
  const prisma = await getPrisma();
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
          variant: {
            select: { id: true, optionValues: true, price: true },
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
  const prisma = await getPrisma();
  return requireAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const userId = req.user!.userId;
      const body = await req.json();
      const { productId, quantity = 1 } = body;
      const variantId: string | null = body.variantId || null;
      
      if (!productId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Product ID is required',
          },
          { status: 400 }
        );
      }
      
      // 상품 존재 확인 (옵션 필수 검증을 위해 변형까지 조회)
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: { variants: true },
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

      // [옵션 필수] 옵션이 있는 상품은 반드시 옵션(변형)을 선택해야 장바구니 담기 가능
      const productVariants: any[] = Array.isArray((product as any).variants) ? (product as any).variants : [];
      const optionRequired = !!(product as any).hasOptions && productVariants.length > 0;
      if (optionRequired) {
        if (!variantId) {
          return NextResponse.json(
            { success: false, error: '옵션을 선택해주세요.', code: 'OPTION_REQUIRED' },
            { status: 400 }
          );
        }
        if (!productVariants.some((v) => v.id === variantId)) {
          return NextResponse.json(
            { success: false, error: '선택한 옵션을 찾을 수 없습니다.', code: 'OPTION_INVALID' },
            { status: 400 }
          );
        }
      }
      
      // 이미 장바구니에 있는지 확인 (같은 상품+같은 옵션이면 수량 합산)
      const existingItem = await prisma.cartItem.findFirst({
        where: {
          userId,
          productId,
          variantId: variantId,
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
            variantId,
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

// DELETE /api/cart - 장바구니에서 삭제 (특정 상품 또는 전체)
export async function DELETE(request: NextRequest) {
  const prisma = await getPrisma();
  return requireAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const userId = req.user!.userId;
      const { searchParams } = new URL(req.url);
      const productId = searchParams.get('productId');
      
      if (productId) {
        // 특정 상품 삭제
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
      } else {
        // 전체 삭제 (장바구니 비우기)
        await prisma.cartItem.deleteMany({
          where: {
            userId,
          },
        });
        
        return NextResponse.json({
          success: true,
          message: 'Cart cleared',
        });
      }
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
  const prisma = await getPrisma();
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
