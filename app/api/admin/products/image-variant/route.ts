import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

const ALLOWED_WIDTHS = new Set([200, 300, 400, 600, 800]);

// [경량 이미지 변형 업로드]
// 샌드박스(sharp)에서 미리 리사이즈+WebP 로 만든 목록용 썸네일을 R2 에 저장한다.
// 원본 key + width 를 받아 `<base>@w<width>.webp` 로 저장 → 서빙 라우트가 ?w= 로 사용.
//
// GET: R2 에 아직 변형이 없는 원본 key 목록(=변형 생성 대상)을 조회.
// POST(multipart): { key, width, file(webp) } → R2 에 변형 저장.

export async function POST(req: NextRequest) {
  const authResult = await verifyAuthToken(req);
  if (authResult instanceof NextResponse) return authResult;
  if (authResult.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'ADMIN only' }, { status: 403 });
  }

  let r2: any = null;
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    r2 = (ctx.env as any).R2_BUCKET;
  } catch { /* 무시 */ }
  if (!r2) {
    return NextResponse.json({ success: false, error: 'R2_BUCKET 바인딩 없음' }, { status: 500 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch (e: any) {
    return NextResponse.json({ success: false, error: 'formData 파싱 실패' }, { status: 400 });
  }

  const key = String(form.get('key') || '').trim();
  const width = parseInt(String(form.get('width') || ''), 10);
  const file = form.get('file');

  if (!key || !ALLOWED_WIDTHS.has(width)) {
    return NextResponse.json({ success: false, error: 'key/width 유효하지 않음' }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, error: 'file(webp) 필요' }, { status: 400 });
  }

  // key 정규화: /api/images/ 접두어가 오면 제거
  let objectKey = key;
  if (objectKey.startsWith('/api/images/')) objectKey = objectKey.slice('/api/images/'.length);
  objectKey = objectKey.split('?')[0];

  const dotIdx = objectKey.lastIndexOf('.');
  const baseNoExt = dotIdx > 0 ? objectKey.slice(0, dotIdx) : objectKey;
  // 변형 키는 서빙 라우트 규칙(@w<width>.webp)에 맞춘다. 내용은 webp 가 기본이지만,
  // 초장(세로가 매우 큰) 이미지는 jpeg 로 저장될 수 있어 contentType 를 별도로 보관.
  const variantKey = `${baseNoExt}@w${width}.webp`;
  const contentType = String(form.get('contentType') || 'image/webp');

  try {
    const buf = await file.arrayBuffer();
    if (!buf || buf.byteLength === 0) {
      return NextResponse.json({ success: false, error: '빈 파일' }, { status: 400 });
    }
    await r2.put(variantKey, buf, { httpMetadata: { contentType } });
    return NextResponse.json({ success: true, variantKey, contentType, bytes: buf.byteLength });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}

// GET: 변형 생성 대상(원본 key) 목록 반환. 이미 변형이 있는지까지 확인.
export async function GET(req: NextRequest) {
  const authResult = await verifyAuthToken(req);
  if (authResult instanceof NextResponse) return authResult;
  if (authResult.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'ADMIN only' }, { status: 403 });
  }

  const width = parseInt(req.nextUrl.searchParams.get('width') || '400', 10);
  if (!ALLOWED_WIDTHS.has(width)) {
    return NextResponse.json({ success: false, error: 'width 유효하지 않음' }, { status: 400 });
  }

  let r2: any = null;
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    r2 = (ctx.env as any).R2_BUCKET;
  } catch { /* 무시 */ }
  if (!r2) {
    return NextResponse.json({ success: false, error: 'R2_BUCKET 바인딩 없음' }, { status: 500 });
  }

  const check = (req.nextUrl.searchParams.get('checkKey') || '').trim();
  if (check) {
    let objectKey = check;
    if (objectKey.startsWith('/api/images/')) objectKey = objectKey.slice('/api/images/'.length);
    objectKey = objectKey.split('?')[0];
    const dotIdx = objectKey.lastIndexOf('.');
    const baseNoExt = dotIdx > 0 ? objectKey.slice(0, dotIdx) : objectKey;
    const variantKey = `${baseNoExt}@w${width}.webp`;
    const head = await r2.head(variantKey).catch(() => null);
    return NextResponse.json({ success: true, variantKey, exists: !!head });
  }

  return NextResponse.json({ success: true, message: 'checkKey 파라미터로 개별 확인 가능' });
}
