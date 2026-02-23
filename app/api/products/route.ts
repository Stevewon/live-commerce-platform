import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/products - 상품 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const featured = searchParams.get('featured');
    const slug = searchParams.get('slug');
    
    // Slug로 단일 상품 조회 (파트너 정보 포함)
    if (slug) {
      const product = await prisma.product.findFirst({
        where: {
          slug,
          isActive: true,
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          partnerProducts: {
            where: {
              isActive: true,
            },
            include: {
              partner: {
                include: {
                  user: {
                    select: {
                      name: true,
                      email: true,
                    },
                  },
                },
              },
            },
            orderBy: {
              customPrice: 'asc', // 가격이 낮은 순으로 정렬
            },
          },
        },
      });
      
      if (!product) {
        return NextResponse.json({
          success: false,
          error: 'Product not found',
        }, { status: 404 });
      }
      
      return NextResponse.json({
        success: true,
        data: [product], // 배열로 반환하여 기존 코드와 호환성 유지
      });
    }
    
    // 상품 목록 조회
    const where: any = {
      isActive: true,
    };
    
    if (category && category !== 'all') {
      where.category = {
        equals: category,
      };
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    if (featured === 'true') {
      where.isFeatured = true;
    }
    
    const products = await prisma.product.findMany({
      where,
      include: {
        category: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    return NextResponse.json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error('[PRODUCTS_GET]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch products',
      },
      { status: 500 }
    );
  }
}
