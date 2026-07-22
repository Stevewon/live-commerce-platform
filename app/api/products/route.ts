import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { ensureProductIndexes } from '@/lib/ensureProductColumns';

// [엣지 캐시 헬퍼]
// OpenNext 응답은 Cache-Control 헤더만으로는 Cloudflare 엣지에 자동 캐시되지 않아
// (cf-cache-status 없음) 매 요청마다 Worker 가 DB 를 조회한다(1.3s+).
// Cache API(caches.default)를 명시적으로 사용해 목록 응답을 엣지에 저장하고,
// 다음 요청부터는 DB 조회 없이 수십 ms 로 응답한다.
const EDGE_CACHE_TTL = 300; // 초 (5분) — MISS 빈도를 줄여 콜드 DB 조회 최소화

// 백그라운드 작업을 응답 반환 이후로 미룬다(waitUntil). 컨텍스트가 없으면 즉시 실행.
async function runAfterResponse(task: Promise<any>): Promise<void> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx: any = await getCloudflareContext();
    const wu = ctx?.ctx?.waitUntil || ctx?.executionCtx?.waitUntil;
    if (typeof wu === 'function') {
      wu.call(ctx.ctx || ctx.executionCtx, task);
      return;
    }
  } catch { /* 무시 */ }
  // waitUntil 사용 불가 시엔 그냥 fire-and-forget (await 하지 않음)
  task.catch(() => {});
}

// 브랜드 목록(필터 UI용)은 페이지네이션과 무관하므로 프로세스 메모리에 캐시.
// 페이지를 넘길 때마다 전체 상품에서 distinct brand 를 재조회하던 비용 제거.
let _brandsCache: { at: number; brands: string[] } | null = null;
const BRANDS_TTL_MS = 5 * 60 * 1000; // 5분

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

    // ── 엣지 캐시 조회 (단일 slug 조회는 상세라 제외, 목록만 캐시) ──
    const edgeCache = !slug ? (globalThis as any).caches?.default : null;
    const cacheKey = new Request(request.url);
    if (edgeCache) {
      try {
        const hit = await edgeCache.match(cacheKey);
        if (hit) {
          const h = new Headers(hit.headers);
          h.set('X-Edge-Cache', 'HIT');
          return new NextResponse(hit.body, { status: hit.status, headers: h });
        }
      } catch { /* 캐시 조회 실패는 무시하고 DB 조회 진행 */ }
    }

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

    // 목록 조회 성능 인덱스 보장 — 응답을 블로킹하지 않도록 백그라운드로.
    // (인덱스는 IF NOT EXISTS 이므로 이미 존재하면 no-op. 콜드 요청마다
    //  5회 D1 왕복으로 응답이 지연되던 것을 waitUntil 로 밀어냄)
    runAfterResponse(ensureProductIndexes());

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

    // 브랜드 목록(필터 UI용)은 페이지/필터와 무관 → 프로세스 메모리 캐시 사용.
    // 캐시가 살아있으면 이 요청에선 distinct 쿼리를 아예 실행하지 않는다.
    const brandsCached =
      _brandsCache && Date.now() - _brandsCache.at < BRANDS_TTL_MS
        ? _brandsCache.brands
        : null;

    // 상품 조회 + 페이지네이션 (병렬 실행)
    // 목록에 필요한 필드만 select → 응답 크기/속도 개선
    // (detailContent, detailImages, specifications 등 무거운 필드 제외)
    const queries: Promise<any>[] = [
      prisma.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          comparePrice: true,
          stock: true,
          thumbnail: true,
          brand: true,
          tags: true,
          isFeatured: true,
          category: {
            select: { name: true, slug: true },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ];
    // 브랜드 캐시가 없을 때만 distinct 쿼리를 병렬에 추가
    if (!brandsCached) {
      queries.push(
        prisma.product.findMany({
          where: { isActive: true, brand: { not: null } },
          select: { brand: true },
          distinct: ['brand'],
        })
      );
    }

    const results = await Promise.all(queries);
    const products = results[0];
    const totalCount = results[1];
    let brandList: string[];
    if (brandsCached) {
      brandList = brandsCached;
    } else {
      brandList = (results[2] as any[]).map((b: any) => b.brand).filter(Boolean);
      _brandsCache = { at: Date.now(), brands: brandList };
    }

    const response = NextResponse.json({
      success: true,
      data: products,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      filters: {
        brands: brandList,
      },
    }, {
      headers: {
        // 브라우저 + 엣지 캐시 (stale-while-revalidate로 반복 로딩 체감 속도 개선)
        'Cache-Control': `public, max-age=60, s-maxage=${EDGE_CACHE_TTL}, stale-while-revalidate=600`,
        'CDN-Cache-Control': `public, s-maxage=${EDGE_CACHE_TTL}`,
        'X-Edge-Cache': 'MISS',
      },
    });

    // ── 엣지 캐시에 저장 (다음 요청부터 HIT → DB 조회 생략) ──
    // waitUntil 로 응답 반환 이후에 저장 → put 완료를 기다리지 않아 체감속도 개선
    if (edgeCache) {
      runAfterResponse(
        Promise.resolve().then(() => edgeCache.put(cacheKey, response.clone()))
      );
    }

    return response;
  } catch (error) {
    console.error('[PRODUCTS_GET]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}
