import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth/middleware';
import { getPrisma } from '@/lib/prisma';

// 리뷰 사진 업로드 전용 엔드포인트
// 【중요】구매하지 않은 사람은 절대 업로드 불가.
//   리뷰 작성(POST /api/reviews)과 "동일한 자격 검증"을 통과해야만 업로드 허용:
//   로그인 + 본인 주문 + 배송완료(DELIVERED) + 해당 주문에 이 상품 포함.
// - R2 우선, 실패 시 base64 data URL 폴백
// - 저장 경로: reviews/<timestamp>_<safeName>

function fail(message: string, code: string, status = 500) {
  console.error(`[REVIEW_UPLOAD] FAIL: ${code} - ${message}`);
  return NextResponse.json(
    { ok: false, success: false, message, code, error: message },
    { status }
  );
}

function ok(data: Record<string, unknown>, message: string) {
  return NextResponse.json({ ok: true, success: true, data, message });
}

export async function POST(req: NextRequest) {
  // ── 1. 인증 ──
  let authResult: Awaited<ReturnType<typeof verifyAuthToken>>;
  try {
    authResult = await verifyAuthToken(req);
  } catch (e: any) {
    return fail(`인증 처리 실패: ${e?.message}`, 'AUTH_EXCEPTION', 500);
  }
  if (authResult instanceof NextResponse) {
    return authResult; // 401 등
  }
  const { userId } = authResult;

  // ── 2. formData 파싱 (file + orderId + productId) ──
  let file: File;
  let orderId: string;
  let productId: string;
  try {
    const formData = await req.formData();
    const raw = formData.get('file');
    orderId = String(formData.get('orderId') || '');
    productId = String(formData.get('productId') || '');
    if (!raw || !(raw instanceof File)) {
      return fail('파일이 제공되지 않았습니다', 'NO_FILE', 400);
    }
    file = raw;
  } catch (e: any) {
    return fail('파일 업로드 처리에 실패했습니다', 'FORM_PARSE', 400);
  }

  if (!orderId || !productId) {
    return fail('주문 정보가 없습니다', 'NO_ORDER', 400);
  }

  // ── 3. 【구매 검증】리뷰 작성 자격과 동일하게 확인 ──
  //   구매하지 않았거나, 배송 완료 전이거나, 본인 주문이 아니면 업로드 차단.
  const prisma = await getPrisma();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { where: { productId } } },
  });

  if (!order) {
    return fail('주문을 찾을 수 없습니다', 'ORDER_NOT_FOUND', 404);
  }
  if (order.userId !== userId) {
    return fail('본인의 주문만 리뷰 사진을 올릴 수 있습니다', 'NOT_OWNER', 403);
  }
  if (order.status !== 'DELIVERED') {
    return fail('배송 완료된 주문만 리뷰 사진을 올릴 수 있습니다', 'NOT_DELIVERED', 400);
  }
  if (!order.items || order.items.length === 0) {
    return fail('해당 주문에 이 상품이 없습니다', 'PRODUCT_NOT_IN_ORDER', 400);
  }

  // ── 4. 파일 검증 ──
  // 모바일/앱 WebView 카메라·갤러리에서 올라오는 이미지는 file.type 이
  // 비어있거나(image/*), image/heic 등으로 오는 경우가 있다.
  // → MIME 우선 검증하되, MIME 이 애매하면 파일 확장자로 폴백 검증한다.
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  const fileExt = (file.name.split('.').pop() || '').toLowerCase();
  const typeOk = allowedTypes.includes(file.type);
  const extOk = allowedExts.includes(fileExt);
  // MIME 이 정확히 이미지 계열(image/*)이면 확장자로 통과 허용.
  const looksLikeImage = typeof file.type === 'string' && file.type.startsWith('image/');
  if (!typeOk && !(extOk && (looksLikeImage || file.type === ''))) {
    return fail('JPG, PNG, GIF, WEBP 형식의 이미지만 업로드할 수 있습니다', 'INVALID_TYPE', 400);
  }
  const MAX_SIZE = 8 * 1024 * 1024; // 8MB
  if (file.size > MAX_SIZE) {
    return fail('이미지 크기는 최대 8MB까지 가능합니다', 'TOO_LARGE', 400);
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch (e: any) {
    return fail('파일을 읽는 중 오류가 발생했습니다', 'READ_FAIL', 500);
  }

  const timestamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\s+/g, '_');
  const key = `reviews/${timestamp}_${rand}_${safeName}`;

  // MIME 이 비어있거나 image/* 형태로만 온 경우, 확장자로 실제 타입을 보정한다.
  const extToMime: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
  };
  const resolvedType =
    allowedTypes.includes(file.type) ? file.type : (extToMime[fileExt] || 'image/jpeg');

  // ── 5. R2 업로드 시도 ──
  let r2Error: string | null = null;
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    const env = ctx.env as Record<string, unknown>;

    if (!env.R2_BUCKET) {
      r2Error = 'R2_BUCKET 바인딩 없음';
      console.error(`[REVIEW_UPLOAD] ${r2Error}`);
    } else {
      const r2 = env.R2_BUCKET as any;
      await r2.put(key, buffer, {
        httpMetadata: { contentType: resolvedType },
      });

      const r2PublicUrl = env.R2_PUBLIC_URL as string | undefined;
      const publicUrl = r2PublicUrl ? `${r2PublicUrl}/${key}` : `/api/images/${key}`;

      return ok(
        { url: publicUrl, key, storage: 'r2', fileName: safeName, fileSize: file.size, fileType: file.type },
        '이미지가 업로드되었습니다'
      );
    }
  } catch (e: any) {
    r2Error = e?.message || String(e);
    console.error(`[REVIEW_UPLOAD] R2 put 실패: ${r2Error}`);
  }

  // ── 6. Fallback: base64 data URL ──
  try {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const CHUNK = 8192;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
      for (let j = 0; j < slice.length; j++) {
        binary += String.fromCharCode(slice[j]);
      }
    }
    const base64 = btoa(binary);
    const dataUrl = `data:${resolvedType};base64,${base64}`;

    return ok(
      { url: dataUrl, storage: 'base64', fileName: safeName, fileSize: file.size, fileType: file.type },
      '이미지가 업로드되었습니다'
    );
  } catch (e: any) {
    return fail('이미지 처리 중 오류가 발생했습니다', 'BASE64_FAIL', 500);
  }
}
