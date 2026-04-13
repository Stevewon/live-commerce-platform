import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';

// 관리자 상품 조회 (GET)
export async function GET(req: NextRequest) {
  const prisma = await getPrisma();
  try {
    // 관리자 인증 확인
    const authResult = await verifyAuthToken(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    
    if (authResult.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status'); // 'active', 'inactive', 'all'
    const category = searchParams.get('category');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // 필터 조건
    const where: any = {};
    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }
    if (category && category !== 'all') {
      where.categoryId = category;
    }

    // 상품 조회 (관리자는 모든 상품 조회 가능)
    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: {
            select: {
              name: true,
              slug: true
            }
          }
        }
      }),
      prisma.product.count({ where })
    ]);

    return NextResponse.json({
      success: true,
      data: {
        products,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      }
    });

  } catch (error) {
    console.error('관리자 상품 조회 실패:', error);
    return NextResponse.json(
      { success: false, error: '상품 조회에 실패했습니다', detail: (error as any)?.message || String(error) },
      { status: 500 }
    );
  }
}

// 관리자 상품 등록 (POST)
export async function POST(req: NextRequest) {
  const prisma = await getPrisma();
  try {
    // 관리자 인증 확인
    const authResult = await verifyAuthToken(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    
    if (authResult.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { 
      name, 
      description, 
      price, 
      stock, 
      categoryId, 
      isActive,
      imageUrl,
      slug,
      thumbnail,
      images,
      detailContent,
      detailImages,
      comparePrice,
      sku,
      specifications,
      shippingInfo,
      returnInfo,
      isFeatured,
      origin,
      manufacturer,
      brand,
      tags,
      hasOptions,
      optionNames,
      variants
    } = body;

    // 필수 필드 검증
    if (!name || !categoryId || !price || price <= 0) {
      return NextResponse.json(
        { success: false, error: '필수 항목을 입력해주세요' },
        { status: 400 }
      );
    }

    // slug 자동 생성 (제공되지 않은 경우)
    const productSlug = slug || (name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'product') + '-' + Date.now();

    // 상품 생성
    const product = await prisma.product.create({
      data: {
        name,
        slug: productSlug,
        description: description || '',
        detailContent: detailContent || null,
        detailImages: detailImages ? (typeof detailImages === 'string' ? detailImages : JSON.stringify(detailImages)) : null,
        price: parseFloat(price),
        comparePrice: comparePrice ? parseFloat(comparePrice) : null,
        stock: parseInt(stock) || 0,
        sku: sku || null,
        images: images || JSON.stringify([imageUrl || '']),
        thumbnail: thumbnail || imageUrl || '',
        categoryId,
        specifications: specifications || null,
        shippingInfo: shippingInfo || null,
        returnInfo: returnInfo || null,
        isActive: isActive !== undefined ? isActive : true,
        isFeatured: isFeatured !== undefined ? isFeatured : false,
        origin: origin || null,
        manufacturer: manufacturer || null,
        brand: brand || null,
        tags: tags || null,
        hasOptions: hasOptions || false,
        optionNames: optionNames || null,
        // 변형(variants) 동시 생성
        ...(hasOptions && Array.isArray(variants) && variants.length > 0 ? {
          variants: {
            create: variants.map((v: any) => ({
              optionValues: typeof v.optionValues === 'string' ? v.optionValues : JSON.stringify(v.optionValues),
              price: v.price ? parseFloat(v.price) : null,
              comparePrice: v.comparePrice ? parseFloat(v.comparePrice) : null,
              stock: parseInt(v.stock) || 0,
              sku: v.sku || null,
              thumbnail: v.thumbnail || null,
              isActive: v.isActive !== undefined ? v.isActive : true,
            }))
          }
        } : {}),
      },
      include: {
        category: {
          select: {
            name: true,
            slug: true
          }
        },
        variants: true
      }
    });

    return NextResponse.json({
      success: true,
      message: '상품이 등록되었습니다',
      data: product
    });

  } catch (error: any) {
    console.error('관리자 상품 등록 실패:', error);
    
    // Unique constraint 에러 처리
    if (error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: '이미 존재하는 상품명 또는 SKU입니다' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: '상품 등록에 실패했습니다', detail: error?.message || String(error) },
      { status: 500 }
    );
  }
}
