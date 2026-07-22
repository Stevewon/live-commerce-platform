import { getPrisma } from '@/lib/prisma';
import { unstable_cache } from 'next/cache';

/**
 * slug 로 단일 상품을 조회한다(파트너/리뷰/변형/카테고리 포함).
 * 상세 페이지 서버 컴포넌트와 /api/products?slug= 가 동일 결과를 공유하도록 공용화.
 * 반환 형태는 클라이언트가 기대하는 것과 동일(배열 필드 보장).
 */
async function fetchProductBySlug(slug: string): Promise<any | null> {
  const prisma = await getPrisma();
  const product = await prisma.product.findFirst({
    where: { slug, isActive: true },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      partnerProducts: {
        where: { isActive: true },
        include: {
          partner: {
            include: { user: { select: { name: true, email: true } } },
          },
        },
        orderBy: { customPrice: 'asc' },
      },
      reviews: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      variants: {
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!product) return null;

  // 클라이언트가 항상 배열을 기대하는 관계 필드 보장
  const p: any = product;
  if (!Array.isArray(p.reviews)) p.reviews = [];
  if (!Array.isArray(p.partnerProducts)) p.partnerProducts = [];
  if (!Array.isArray(p.variants)) p.variants = [];
  return p;
}

/**
 * slug 단위로 60초 캐시한 상품 조회.
 * 반복 방문 시 D1 조회를 건너뛰고 캐시된 결과를 즉시 반환한다(쿠팡식 즉시 상세).
 * 재고/가격 변경은 60초 내 반영.
 */
export const getProductBySlug = (slug: string): Promise<any | null> =>
  unstable_cache(
    () => fetchProductBySlug(slug),
    ['product-by-slug', slug],
    { revalidate: 60, tags: [`product:${slug}`] }
  )();
