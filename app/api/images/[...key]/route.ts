import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  segmentData: { params: Promise<{ key: string[] }> }
) {
  try {
    const { key } = await segmentData.params;
    const objectKey = key.join('/');

    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    const r2 = (ctx.env as any).R2_BUCKET;

    if (!r2) {
      return NextResponse.json({ error: 'R2 not configured' }, { status: 500 });
    }

    // 엣지 캐시(Cache API) 우선 조회 - R2/Worker 반복 접근 방지
    const cache = (globalThis as any).caches?.default;
    const cacheKey = new Request(req.url);
    if (cache) {
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
    }

    const object = await r2.get(objectKey);
    if (!object) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    const headers = new Headers();
    headers.set('Content-Type', object.httpMetadata?.contentType || 'image/jpeg');
    // 브라우저 + CDN 엣지 장기 캐시
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('CDN-Cache-Control', 'public, max-age=31536000, immutable');
    if (object.httpEtag) headers.set('ETag', object.httpEtag);

    const response = new NextResponse(object.body, { headers });

    // 엣지 캐시에 저장 (본문 소비 충돌 방지를 위해 clone)
    if (cache) {
      try {
        await cache.put(cacheKey, response.clone());
      } catch {
        // 캐시 저장 실패는 무시 (원본 응답은 정상 반환)
      }
    }

    return response;
  } catch (error) {
    console.error('Image serve error:', error);
    return NextResponse.json({ error: 'Failed to serve image' }, { status: 500 });
  }
}
