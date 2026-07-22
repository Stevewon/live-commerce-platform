// [이미지 프록시 URL 헬퍼]
// 상품 이미지 URL 을 우리 엣지 캐시 프록시(/api/img)로 감싼다.
// - 외부(dbimg.co.kr 등) 이미지를 우리 Cloudflare 엣지에 캐시하여 반복 로딩을 가속.
// - 이미 우리 프록시/데이터URL/빈 값이면 그대로 반환 (이중 프록시 방지).

export function proxyImg(url: string | null | undefined): string {
  if (!url) return '';
  const u = String(url).trim();
  if (!u) return '';
  // data URL, blob, 이미 프록시된 것은 그대로
  if (u.startsWith('data:') || u.startsWith('blob:')) return u;
  if (u.startsWith('/api/img?')) return u;
  // http(s) 또는 상대경로(/api/images/...) 모두 프록시 대상
  if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('/')) {
    return `/api/img?url=${encodeURIComponent(u)}`;
  }
  return u;
}
