import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// 허용 리사이즈 폭(오용/캐시 폭증 방지) — 목록 카드/썸네일용
const ALLOWED_WIDTHS = new Set([200, 300, 400, 600, 800]);

function parseWidth(req: NextRequest): number | null {
  const w = req.nextUrl.searchParams.get('w');
  if (!w) return null;
  const n = parseInt(w, 10);
  if (!Number.isFinite(n)) return null;
  return ALLOWED_WIDTHS.has(n) ? n : null;
}

export async function GET(
  req: NextRequest,
  segmentData: { params: Promise<{ key: string[] }> }
) {
  try {
    const { key } = await segmentData.params;
    const objectKey = key.join('/');
    const width = parseWidth(req);

    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    const r2 = (ctx.env as any).R2_BUCKET;

    if (!r2) {
      return NextResponse.json({ error: 'R2 not configured' }, { status: 500 });
    }

    // 엣지 캐시(Cache API) 우선 조회 - 리사이즈 여부까지 포함한 전체 URL 을 키로 사용
    const cache = (globalThis as any).caches?.default;
    const cacheKey = new Request(req.url);
    if (cache) {
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
    }

    // ── 리사이즈 폭이 지정되면, 미리 만들어둔 경량 변형(@w<width>.webp)을 우선 서빙 ──
    // 변형은 배포 파이프라인/백필 잡에서 sharp 로 미리 생성해 R2 에 올려둔다.
    // 변형이 없으면 원본으로 안전하게 폴백한다.
    let servedKey = objectKey;
    let forcedContentType: string | null = null;

    if (width) {
      const dotIdx = objectKey.lastIndexOf('.');
      const baseNoExt = dotIdx > 0 ? objectKey.slice(0, dotIdx) : objectKey;
      const variantKey = `${baseNoExt}@w${width}.webp`;
      const variant = await r2.get(variantKey);
      if (variant) {
        servedKey = variantKey;
        // 변형은 대부분 webp 지만, 초장 이미지는 jpeg 로 저장됨 → 저장된 실제 타입 사용
        forcedContentType = variant.httpMetadata?.contentType || 'image/webp';
        // variant 객체를 그대로 사용해 재조회 비용 절감
        return await respond(variant, forcedContentType, cache, cacheKey);
      }
      // 변형 없음 → 원본 폴백
    }

    const object = await r2.get(servedKey);
    if (!object) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }
    return await respond(object, forcedContentType, cache, cacheKey);
  } catch (error) {
    console.error('Image serve error:', error);
    return NextResponse.json({ error: 'Failed to serve image' }, { status: 500 });
  }
}

async function respond(
  object: any,
  forcedContentType: string | null,
  cache: any,
  cacheKey: Request
): Promise<NextResponse> {
  const headers = new Headers();
  headers.set('Content-Type', forcedContentType || object.httpMetadata?.contentType || 'image/jpeg');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('CDN-Cache-Control', 'public, max-age=31536000, immutable');
  if (object.httpEtag) headers.set('ETag', object.httpEtag);

  const response = new NextResponse(object.body, { headers });

  if (cache) {
    try {
      await cache.put(cacheKey, response.clone());
    } catch {
      // 캐시 저장 실패는 무시
    }
  }
  return response;
}
