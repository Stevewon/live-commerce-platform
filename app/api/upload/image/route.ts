import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth/middleware';

// 단계 코드 상수
const STEP = {
  VALIDATE: 'VALIDATION',
  R2_BIND: 'R2_BINDING',
  R2_PUT: 'R2_PUT',
  FALLBACK: 'FALLBACK_WRITE',
  DONE: 'DONE',
} as const;

function fail(step: string, message: string, code: string, status = 500) {
  console.error(`[UPLOAD_${step}] FAIL: ${code} - ${message}`);
  return NextResponse.json(
    { ok: false, success: false, step, message, code, error: message },
    { status }
  );
}

function ok(step: string, data: Record<string, unknown>, message: string) {
  console.log(`[UPLOAD_${step}] OK: ${message}`);
  return NextResponse.json(
    { ok: true, success: true, step, data, message }
  );
}

export async function POST(req: NextRequest) {
  // ── 1. 인증 ──
  let authResult: Awaited<ReturnType<typeof verifyAuthToken>>;
  try {
    authResult = await verifyAuthToken(req);
  } catch (e: any) {
    return fail(STEP.VALIDATE, `인증 처리 실패: ${e?.message}`, 'AUTH_EXCEPTION', 500);
  }
  if (authResult instanceof NextResponse) {
    return authResult; // 401 등 이미 만들어진 응답
  }
  if (!['ADMIN', 'PARTNER'].includes(authResult.role)) {
    return fail(STEP.VALIDATE, '권한이 필요합니다 (ADMIN 또는 PARTNER)', 'FORBIDDEN', 403);
  }
  console.log(`[UPLOAD_VALIDATE] 인증 통과: userId=${authResult.userId} role=${authResult.role}`);

  // ── 2. formData 파싱 + 파일 검증 ──
  let file: File;
  try {
    const formData = await req.formData();
    const raw = formData.get('file');
    if (!raw || !(raw instanceof File)) {
      return fail(STEP.VALIDATE, '파일이 제공되지 않았습니다', 'NO_FILE', 400);
    }
    file = raw;
  } catch (e: any) {
    return fail(STEP.VALIDATE, `formData 파싱 실패: ${e?.message}`, 'FORM_PARSE', 400);
  }

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return fail(STEP.VALIDATE, `지원하지 않는 파일 형식: ${file.type}`, 'INVALID_TYPE', 400);
  }

  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return fail(STEP.VALIDATE, `파일 크기 초과: ${file.size} bytes (최대 10MB)`, 'TOO_LARGE', 400);
  }

  console.log(`[UPLOAD_VALIDATE] 파일 검증 통과: name=${file.name} type=${file.type} size=${file.size}`);

  // ── 3. 파일 버퍼 1회 읽기 (이후 재사용) ──
  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch (e: any) {
    return fail(STEP.VALIDATE, `파일 읽기 실패: ${e?.message}`, 'READ_FAIL', 500);
  }

  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\s+/g, '_');
  const key = `products/${timestamp}_${safeName}`;

  // ── 4. R2 업로드 시도 ──
  let r2Available = false;
  let r2Error: string | null = null;

  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    const env = ctx.env as Record<string, unknown>;

    // R2 바인딩 존재 확인
    if (!env.R2_BUCKET) {
      r2Error = 'env.R2_BUCKET이 undefined - wrangler.jsonc r2_buckets 바인딩 확인 필요';
      console.error(`[UPLOAD_R2] ${r2Error}`);
      // 여기서 return하지 않고 fallback으로 진행
    } else {
      r2Available = true;
      const r2 = env.R2_BUCKET as any;

      console.log(`[UPLOAD_R2] R2_BUCKET 바인딩 발견, put 시도: key=${key}`);

      await r2.put(key, buffer, {
        httpMetadata: { contentType: file.type },
      });

      console.log(`[UPLOAD_R2] put 성공: key=${key}`);

      // R2 공개 URL 결정
      const r2PublicUrl = env.R2_PUBLIC_URL as string | undefined;
      const publicUrl = r2PublicUrl
        ? `${r2PublicUrl}/${key}`
        : `/api/images/${key}`;

      return ok(STEP.DONE, {
        url: publicUrl,
        key,
        storage: 'r2',
        fileName: safeName,
        fileSize: file.size,
        fileType: file.type,
      }, '이미지가 R2에 업로드되었습니다');
    }
  } catch (e: any) {
    r2Error = e?.message || String(e);
    console.error(`[UPLOAD_R2] R2 put 실패: ${r2Error}`);
    console.error(`[UPLOAD_R2] stack: ${e?.stack || 'no stack'}`);
    // fallback으로 진행
  }

  // ── 5. Fallback: base64 data URL ──
  console.log(`[UPLOAD_FALLBACK] R2 사용 불가 (${r2Error}), base64 변환 시도`);

  try {
    const bytes = new Uint8Array(buffer);
    // chunk-safe base64: spread operator 스택 오버플로 방지
    let binary = '';
    const CHUNK = 8192;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
      for (let j = 0; j < slice.length; j++) {
        binary += String.fromCharCode(slice[j]);
      }
    }
    const base64 = btoa(binary);
    const dataUrl = `data:${file.type};base64,${base64}`;

    console.log(`[UPLOAD_FALLBACK] base64 변환 성공: ${base64.length} chars`);

    return ok(STEP.DONE, {
      url: dataUrl,
      storage: 'base64',
      r2Error: r2Error,
      fileName: safeName,
      fileSize: file.size,
      fileType: file.type,
    }, `이미지 업로드 완료 (base64 fallback, R2 실패: ${r2Error})`);

  } catch (e: any) {
    return fail(STEP.FALLBACK, `base64 변환 실패: ${e?.message}`, 'BASE64_FAIL', 500);
  }
}
