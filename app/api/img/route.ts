import { NextRequest, NextResponse } from 'next/server';

// [이미지 프록시 + 엣지 캐시 — 스트리밍]
// 외부(dbimg.co.kr 등) / 내부(R2) 이미지를 우리 Worker 가 대신 받아
// Cloudflare 엣지(Cache API)에 저장하고 장기 캐시 헤더로 서빙한다.
//
// 목적: 상품 썸네일이 매번 느린 외부 서버(1.5s+)에서 로드되는 문제를
//       "이후엔 우리 엣지에서 수십 ms" 로 바꾼다.
//
// [핵심 개선] 첫 요청(MISS)에서 arrayBuffer() 로 전부 버퍼링하지 않고
//   upstream.body 스트림을 그대로 흘려보낸다(스트리밍). 엣지 저장은
//   ctx.waitUntil() 로 백그라운드 처리 → MISS 여도 원본과 동일 속도.

export const dynamic = 'force-dynamic';

const ALLOWED_HOSTS = [
  'dbimg.co.kr',
  'www.dbimg.co.kr',
];

function isAllowed(target: URL, selfHost: string): boolean {
  // 자기 자신(R2 프록시 경로) 은 항상 허용
  if (target.host === selfHost) return true;
  const host = target.host.toLowerCase();
  if (ALLOWED_HOSTS.includes(host)) return true;
  // 이미지로 흔히 쓰는 서브도메인/CDN 도 허용 (https 만)
  if (target.protocol === 'https:' && /\.(co\.kr|com|net|cloudfront\.net|r2\.dev)$/.test(host)) return true;
  return false;
}

export async function GET(req: NextRequest) {
  const { searchParams, host } = new URL(req.url);
  const raw = searchParams.get('url');
  if (!raw) {
    return NextResponse.json({ error: 'url 파라미터가 필요합니다' }, { status: 400 });
  }

  let target: URL;
  try {
    // 상대경로(/api/images/...) 는 자기 호스트 기준으로 해석
    target = new URL(raw, req.url);
  } catch {
    return NextResponse.json({ error: '잘못된 url' }, { status: 400 });
  }

  if (target.protocol !== 'https:' && target.protocol !== 'http:') {
    return NextResponse.json({ error: '지원하지 않는 프로토콜' }, { status: 400 });
  }
  if (!isAllowed(target, host)) {
    return NextResponse.json({ error: '허용되지 않은 이미지 호스트' }, { status: 400 });
  }

  // Cloudflare context (waitUntil 사용) — 없으면 백그라운드 저장 생략
  let ctxWaitUntil: ((p: Promise<any>) => void) | null = null;
  const cache = (globalThis as any).caches?.default;
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const cfCtx: any = await getCloudflareContext();
    if (cfCtx?.ctx?.waitUntil) {
      ctxWaitUntil = (p: Promise<any>) => cfCtx.ctx.waitUntil(p);
    }
  } catch { /* 컨텍스트 없으면 무시 */ }

  const cacheKey = new Request(req.url);

  // ── 엣지 캐시 조회 (HIT 이면 즉시 반환) ──
  if (cache) {
    try {
      const hit = await cache.match(cacheKey);
      if (hit) {
        const h = new Headers(hit.headers);
        h.set('X-Img-Cache', 'HIT');
        return new NextResponse(hit.body, { status: hit.status, headers: h });
      }
    } catch { /* 캐시 조회 실패는 무시 */ }
  }

  // ── 원본 fetch ──
  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      headers: {
        'Accept': 'image/avif,image/webp,image/*,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (compatible; QRLiveImageProxy/1.0)',
        'Referer': target.origin,
      },
      // Cloudflare 자체 캐시도 활용(원본을 CF 가 캐시)
      cf: { cacheEverything: true, cacheTtl: 31536000 },
    } as any);
  } catch {
    return NextResponse.json({ error: '원본 이미지 로드 실패' }, { status: 502 });
  }

  if (!upstream.ok) {
    return NextResponse.json({ error: `원본 응답 오류: ${upstream.status}` }, { status: upstream.status === 404 ? 404 : 502 });
  }

  const contentType = upstream.headers.get('content-type') || 'image/jpeg';
  if (!contentType.startsWith('image/')) {
    return NextResponse.json({ error: '이미지가 아닙니다' }, { status: 415 });
  }

  const headers = new Headers();
  headers.set('Content-Type', contentType);
  // 브라우저 + 우리 엣지 장기 캐시 (이미지는 사실상 불변)
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('CDN-Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('X-Img-Cache', 'MISS');
  const etag = upstream.headers.get('etag');
  if (etag) headers.set('ETag', etag);
  const contentLength = upstream.headers.get('content-length');
  if (contentLength) headers.set('Content-Length', contentLength);

  const canStore = !!(cache && upstream.body);

  // [스트리밍] body 를 두 갈래로 분기: 하나는 즉시 사용자에게, 하나는 엣지 저장용.
  // 버퍼링 없이 바로 흘려보내므로 MISS 여도 원본 속도와 동일.
  if (canStore && ctxWaitUntil) {
    const [toClient, toCache] = upstream.body!.tee();
    // 백그라운드로 엣지 캐시에 저장 (사용자 응답을 지연시키지 않음)
    const cacheResponse = new NextResponse(toCache, { headers });
    ctxWaitUntil(
      (async () => {
        try { await cache.put(cacheKey, cacheResponse); } catch { /* 무시 */ }
      })()
    );
    return new NextResponse(toClient, { headers });
  }

  // waitUntil 을 못 쓰는 환경: 그냥 스트리밍만(캐시 저장 생략) — 여전히 원본 속도
  return new NextResponse(upstream.body, { headers });
}
