import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/wishlist - 위시리스트 조회
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        { status: 401 }
      );
    }
    
    const wishlistItems = await prisma.wishlistItem.findMany({
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
      data: wishlistItems,
    });
  } catch (error) {
    console.error('[WISHLIST_GET]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch wishlist',
      },
      { status: 500 }
    );
  }
}

// POST /api/wishlist - 위시리스트에 추가
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { productId } = body;
    
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
    
    // 이미 위시리스트에 있는지 확인
    const existingItem = await prisma.wishlistItem.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });
    
    if (existingItem) {
      return NextResponse.json({
        success: true,
        data: existingItem,
        message: 'Already in wishlist',
      });
    }
    
    const wishlistItem = await prisma.wishlistItem.create({
      data: {
        userId,
        productId,
      },
      include: {
        product: true,
      },
    });
    
    return NextResponse.json({
      success: true,
      data: wishlistItem,
    });
  } catch (error) {
    console.error('[WISHLIST_POST]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to add to wishlist',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/wishlist - 위시리스트에서 삭제
export async function DELETE(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
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
    
    await prisma.wishlistItem.deleteMany({
      where: {
        userId,
        productId,
      },
    });
    
    return NextResponse.json({
      success: true,
      message: 'Item removed from wishlist',
    });
  } catch (error) {
    console.error('[WISHLIST_DELETE]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to remove from wishlist',
      },
      { status: 500 }
    );
  }
}
