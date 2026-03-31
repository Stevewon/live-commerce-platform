import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth/middleware';

/**
 * GET /api/debug/r2-health
 *
 * R2 바인딩/권한/버킷 연결 상태 검증 엔드포인트.
 * ADMIN 토큰 필수.
 *
 * 검증 단계:
 *   1. getCloudflareContext 호출 가능 여부
 *   2. env.R2_BUCKET 존재 여부
 *   3. test key PUT 가능 여부
 *   4. 같은 key GET 가능 여부
 *   5. 같은 key DELETE 가능 여부
 */
export async function GET(req: NextRequest) {
  // 관리자 인증
  const authResult = await verifyAuthToken(req);
  if (authResult instanceof NextResponse) return authResult;
  if (authResult.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'ADMIN only' }, { status: 403 });
  }

  const report: {
    cloudflareContext: { ok: boolean; error?: string };
    r2Binding: { ok: boolean; type?: string; error?: string };
    put: { ok: boolean; key?: string; error?: string };
    get: { ok: boolean; size?: number; contentType?: string; error?: string };
    del: { ok: boolean; error?: string };
    envKeys: string[];
  } = {
    cloudflareContext: { ok: false },
    r2Binding: { ok: false },
    put: { ok: false },
    get: { ok: false },
    del: { ok: false },
    envKeys: [],
  };

  // Step 1: getCloudflareContext
  let env: Record<string, unknown>;
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    env = ctx.env as Record<string, unknown>;
    report.cloudflareContext = { ok: true };
    // env 내 바인딩 키 목록 (보안상 값은 생략)
    report.envKeys = Object.keys(env);
  } catch (e: any) {
    report.cloudflareContext = { ok: false, error: e?.message || String(e) };
    return NextResponse.json(report);
  }

  // Step 2: R2_BUCKET 바인딩 존재
  const r2 = env.R2_BUCKET as any;
  if (!r2) {
    report.r2Binding = { ok: false, error: 'env.R2_BUCKET is undefined/null', type: String(typeof env.R2_BUCKET) };
    return NextResponse.json(report);
  }
  report.r2Binding = { ok: true, type: typeof r2 };

  const testKey = `_health_check/${Date.now()}.txt`;
  const testBody = `r2-health-check-${Date.now()}`;

  // Step 3: PUT
  try {
    await r2.put(testKey, testBody, {
      httpMetadata: { contentType: 'text/plain' },
    });
    report.put = { ok: true, key: testKey };
  } catch (e: any) {
    report.put = { ok: false, key: testKey, error: e?.message || String(e) };
    return NextResponse.json(report);
  }

  // Step 4: GET
  try {
    const obj = await r2.get(testKey);
    if (!obj) {
      report.get = { ok: false, error: 'object returned null after put' };
    } else {
      const text = await obj.text();
      report.get = {
        ok: text === testBody,
        size: text.length,
        contentType: obj.httpMetadata?.contentType || 'unknown',
        error: text !== testBody ? `content mismatch: got ${text.length} chars` : undefined,
      };
    }
  } catch (e: any) {
    report.get = { ok: false, error: e?.message || String(e) };
  }

  // Step 5: DELETE
  try {
    await r2.delete(testKey);
    report.del = { ok: true };
  } catch (e: any) {
    report.del = { ok: false, error: e?.message || String(e) };
  }

  const allOk = report.cloudflareContext.ok
    && report.r2Binding.ok
    && report.put.ok
    && report.get.ok
    && report.del.ok;

  return NextResponse.json({ ok: allOk, ...report });
}
