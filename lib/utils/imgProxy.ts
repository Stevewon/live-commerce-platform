// [이미지 URL 헬퍼]
// 상품 이미지 URL 을 그대로 반환한다.
//
// [중요] 과거엔 외부(dbimg.co.kr) 이미지를 /api/img 프록시(엣지 캐시)로 감쌌으나,
//   실측 결과 프록시 왕복(사용자→우리Worker→외부→우리→사용자)이
//   원본 직접 로딩(사용자→외부)보다 항상 느렸다(캐시 MISS 시 2~3s vs 1.3s).
//   → 프록시를 태우지 않고 원본 URL 을 그대로 쓰는 것이 가장 빠르다.
//
//   함수 시그니처는 유지하여 각 페이지 코드를 건드리지 않고 한 곳에서 되돌린다.
//   (data:/blob:/상대경로/절대URL 모두 원본 그대로 통과)

export function proxyImg(url: string | null | undefined): string {
  if (!url) return '';
  const u = String(url).trim();
  if (!u) return '';
  // 과거 프록시 형식이 저장돼 있던 경우(/api/img?url=...) 원본으로 복원
  if (u.startsWith('/api/img?')) {
    try {
      const q = u.split('?')[1] || '';
      const params = new URLSearchParams(q);
      const orig = params.get('url');
      if (orig) return orig;
    } catch { /* 무시 */ }
    return u;
  }
  // 그 외에는 원본 그대로 사용 (가장 빠름)
  return u;
}

// [목록/카드용 경량 썸네일 URL]
// 우리 R2 서빙 경로(/api/images/...)인 경우에만 ?w=<width> 를 붙여
// 미리 만들어둔 경량 WebP 변형을 받도록 한다. (변형 없으면 서버가 원본으로 폴백)
// 외부 URL(dbimg 등)이나 data:/blob:/기타는 리사이즈 대상이 아니므로 그대로 반환.
export function thumbUrl(
  url: string | null | undefined,
  width: 200 | 300 | 400 | 600 | 800 = 400
): string {
  const u = proxyImg(url);
  if (!u) return '';
  // 우리 R2 서빙 경로만 리사이즈 파라미터 적용
  if (u.startsWith('/api/images/')) {
    // 이미 쿼리가 있으면 건드리지 않음
    if (u.includes('?')) return u;
    return `${u}?w=${width}`;
  }
  return u;
}
