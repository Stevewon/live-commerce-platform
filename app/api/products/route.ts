import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

// GET /api/products - 상품 목록 조회 (정렬/필터/페이지네이션 지원)
export async function GET(request: NextRequest) {
  const prisma = await getPrisma();
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const featured = searchParams.get('featured');
    const slug = searchParams.get('slug');
    const tag = searchParams.get('tag');

    // 정렬
    const sort = searchParams.get('sort'); // popular, price-low, price-high, newest, rating, discount
    // 필터
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const inStock = searchParams.get('inStock'); // 'true' = 재고있는것만
    const brand = searchParams.get('brand');

    // 페이지네이션
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Slug로 단일 상품 조회 (파트너 정보 + 리뷰 + 변형 포함)
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
            where: { isActive: true },
            include: {
              partner: {
                include: {
                  user: {
                    select: { name: true, email: true },
                  },
                },
              },
            },
            orderBy: { customPrice: 'asc' },
          },
          reviews: {
            include: {
              user: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
          variants: {
            where: { isActive: true },
            orderBy: { createdAt: 'asc' },
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
        data: [product],
      });
    }

    // 상품 목록 조회 - 필터 빌드
    const where: any = {
      isActive: true,
    };

    // 카테고리 필터
    if (category && category !== 'all') {
      // 카테고리 slug로 필터
      const cat = await prisma.category.findFirst({ where: { slug: category } });
      if (cat) {
        where.categoryId = cat.id;
      }
    }

    // 검색 (이름 + 설명 + 브랜드 + 태그)
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
        { brand: { contains: search } },
        { tags: { contains: search } },
      ];
    }

    // 태그 필터
    if (tag) {
      where.tags = { contains: tag };
    }

    // 추천 상품 필터
    if (featured === 'true') {
      where.isFeatured = true;
    }

    // 가격 필터
    if (minPrice) {
      where.price = { ...(where.price || {}), gte: parseFloat(minPrice) };
    }
    if (maxPrice) {
      where.price = { ...(where.price || {}), lte: parseFloat(maxPrice) };
    }

    // 재고 필터
    if (inStock === 'true') {
      where.stock = { gt: 0 };
    }

    // 브랜드 필터
    if (brand) {
      where.brand = brand;
    }

    // 정렬 옵션 매핑
    let orderBy: any = { createdAt: 'desc' }; // 기본: 최신순
    switch (sort) {
      case 'price-low':
        orderBy = { price: 'asc' };
        break;
      case 'price-high':
        orderBy = { price: 'desc' };
        break;
      case 'newest':
        orderBy = { createdAt: 'desc' };
        break;
      case 'popular':
        orderBy = { isFeatured: 'desc' }; // 추천 상품 우선 + 최신순
        break;
      case 'discount':
        orderBy = { comparePrice: 'desc' };
        break;
      case 'name':
        orderBy = { name: 'asc' };
        break;
      default:
        orderBy = { createdAt: 'desc' };
    }

    // 상품 조회 + 페이지네이션
    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: {
            select: { name: true, slug: true },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    // 사용 가능한 브랜드 목록 (필터 UI용)
    const brands = await prisma.product.findMany({
      where: { isActive: true, brand: { not: null } },
      select: { brand: true },
      distinct: ['brand'],
    });

    return NextResponse.json({
      success: true,
      data: products,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      filters: {
        brands: brands.map((b: any) => b.brand).filter(Boolean),
      },
    });
  } catch (error) {
    console.error('[PRODUCTS_GET]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}
