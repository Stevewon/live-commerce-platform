// [이미지 R2 자동 이전 유틸]
// 외부(dbimg.co.kr 등) 이미지를 우리 Cloudflare R2 로 복사하고
// 우리 도메인에서 서빙되는 URL(/api/images/<key>)로 바꿔준다.
//
// - Workers 런타임엔 sharp 가 없어 리사이즈/WebP 변환은 불가.
//   대신 우리 R2 + 강력한 엣지 캐시(/api/images/[...key])로 재방문 속도를 크게 올린다.
// - 이미 우리 것(/api/images/, R2_PUBLIC_URL, data:)이면 이전 대상이 아니다.

// 이전 대상 판별: 외부 http(s) URL 만 이전한다.
export function needsMigration(url: string | null | undefined): boolean {
  if (!url) return false;
  const u = String(url).trim();
  if (!u) return false;
  if (u.startsWith('data:')) return false;          // base64 는 별도 처리(리사이즈 백필)
  if (u.startsWith('/api/images/')) return false;    // 이미 우리 R2 서빙 경로
  if (u.startsWith('/')) return false;               // 기타 내부 상대경로
  // 외부 절대 URL 만 이전
  return u.startsWith('http://') || u.startsWith('https://');
}

// 확장자/컨텐트타입 → 안전한 R2 key 파일명
function extFromContentType(ct: string): string {
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('png')) return 'png';
  if (ct.includes('gif')) return 'gif';
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
  return 'jpg';
}

/**
 * 외부 이미지 1개를 R2 로 복사하고 새 서빙 URL 을 반환한다.
 * 실패하면 원본 URL 을 그대로 반환(안전).
 *
 * @param url 원본(외부) 이미지 URL
 * @param r2  env.R2_BUCKET 바인딩
 * @param r2PublicUrl env.R2_PUBLIC_URL (있으면 사용, 없으면 /api/images/ 경로)
 */
export async function migrateImageToR2(
  url: string,
  r2: any,
  r2PublicUrl?: string
): Promise<{ url: string; migrated: boolean; bytes?: number }> {
  if (!needsMigration(url) || !r2) {
    return { url, migrated: false };
  }

  try {
    const upstream = await fetch(url, {
      headers: {
        'Accept': 'image/avif,image/webp,image/*,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (compatible; QRLiveImageMigrator/1.0)',
      },
      cf: { cacheEverything: true, cacheTtl: 3600 },
    } as any);

    if (!upstream.ok) return { url, migrated: false };

    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) return { url, migrated: false };

    const buf = await upstream.arrayBuffer();
    if (!buf || buf.byteLength === 0) return { url, migrated: false };

    // 원본 URL 로부터 안정적인 key 생성 (같은 원본 → 같은 key = 멱등)
    let baseName = 'img';
    try {
      const p = new URL(url).pathname;
      baseName = p.split('/').filter(Boolean).join('_').replace(/[^a-zA-Z0-9._-]/g, '_') || 'img';
    } catch { /* 무시 */ }
    // 확장자 보정
    const ext = extFromContentType(contentType);
    if (!baseName.toLowerCase().endsWith(`.${ext}`)) {
      baseName = baseName.replace(/\.[a-zA-Z0-9]+$/, '') + `.${ext}`;
    }
    const key = `products/migrated/${baseName}`;

    await r2.put(key, buf, { httpMetadata: { contentType } });

    const newUrl = r2PublicUrl ? `${r2PublicUrl}/${key}` : `/api/images/${key}`;
    return { url: newUrl, migrated: true, bytes: buf.byteLength };
  } catch {
    return { url, migrated: false };
  }
}

// 문자열/JSON배열/배열 형태의 이미지 필드를 파싱해 URL 배열로
export function parseImageList(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === 'string');
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return [];
    if (s.startsWith('[')) {
      try {
        const arr = JSON.parse(s);
        return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
      } catch { return []; }
    }
    // 단일 URL 문자열
    return [s];
  }
  return [];
}
