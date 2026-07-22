import { NextRequest, NextResponse } from 'next/server';

// [이미지 프록시 + 엣지 캐시]
// 외부(dbimg.co.kr 등) / 내부(R2) 이미지를 우리 Worker 가 대신 받아
// Cloudflare 엣지(Cache API)에 저장하고 장기 캐시 헤더로 서빙한다.
//
// 목적: 상품 목록/상세의 썸네일이 매번 느린 외부 서버(1.5s+)에서 로드되는 문제를
//       "첫 1회만 외부 fetch, 이후엔 우리 엣지에서 수십 ms" 로 바꾼다.
//
// 사용: /api/img?url=<원본URL>   (프론트에서 자동으로 감싼다)
// - Workers 런타임엔 sharp 가 없어 리사이즈는 못 하지만,
//   엣지 캐시 + WebP Accept 전달 + 장기 캐시로 반복 로딩 비용을 없앤다.

export const runtime = 'edge'; // 엣지에서 실행 (해당 시)

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

  // ── 엣지 캐시 조회 ──
  const cache = (globalThis as any).caches?.default;
  // 캐시 키는 요청 URL(원본 url 파라미터 포함) 기준
  const cacheKey = new Request(req.url);
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

  // ── 원본 fetch (WebP 선호 Accept 전달) ──
  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      headers: {
        // 원본 서버가 WebP 를 줄 수 있으면 받도록
        'Accept': 'image/avif,image/webp,image/*,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (compatible; QRLiveImageProxy/1.0)',
        'Referer': target.origin,
      },
      // Cloudflare 엣지 캐시 힌트
      cf: { cacheEverything: true, cacheTtl: 31536000 },
    } as any);
  } catch (e: any) {
    return NextResponse.json({ error: '원본 이미지 로드 실패' }, { status: 502 });
  }

  if (!upstream.ok) {
    return NextResponse.json({ error: `원본 응답 오류: ${upstream.status}` }, { status: upstream.status === 404 ? 404 : 502 });
  }

  const contentType = upstream.headers.get('content-type') || 'image/jpeg';
  if (!contentType.startsWith('image/')) {
    return NextResponse.json({ error: '이미지가 아닙니다' }, { status: 415 });
  }

  const body = await upstream.arrayBuffer();

  const headers = new Headers();
  headers.set('Content-Type', contentType);
  // 브라우저 + 우리 엣지 장기 캐시 (이미지는 사실상 불변)
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('CDN-Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('X-Img-Cache', 'MISS');
  const etag = upstream.headers.get('etag');
  if (etag) headers.set('ETag', etag);

  const response = new NextResponse(body, { headers });

  // 엣지 캐시에 저장 (다음 요청부터 HIT)
  if (cache) {
    try { await cache.put(cacheKey, response.clone()); } catch { /* 무시 */ }
  }

  return response;
}
