import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth/middleware';
import { getD1 } from '@/lib/balance';
import { linkQrchatWallet } from '@/lib/qrchat-bridge';

/**
 * [진단/복구] /api/admin/diagnose/qrchat-uid-drift
 * ============================================================================
 * "오로로 사건" 재발 방지 — D1 에 저장된 qrchatUid 가 QRChat Firebase 의 실제
 * uid 와 어긋난 계정을 전부 찾아내고, 필요시 정정한다.
 *
 * 발생 원인:
 *   큐알쳇 앱을 재설치/재가입한 사용자는 Firebase uid 가 새로 발급된다.
 *   지갑주소·닉네임은 그대로지만 D1 은 옛 uid 를 그대로 들고 있어서
 *   마이페이지 큐알쳇 쿠키 잔액이 0 으로 표시되고 QKEY 결제가 막힌다.
 *
 * 사용법:
 *   GET  ?dryRun=1&limit=200   → 스캔만 (드리프트 목록/카운트만 반환)
 *   POST                       → 스캔 + 실제 D1 qrchatUid 정정
 *                                (지갑+닉으로 Firebase 실제 uid 확정된 케이스만)
 *
 * 안전장치:
 *   - 관리자(ADMIN) 만 호출 가능.
 *   - origin=QRCHAT (B회원) 계정 중 지갑·닉이 채워진 것만 대상.
 *     (A회원 QRLIVE 는 자동병합 대상 아님 — 사장님 원칙 준수)
 *   - Firebase 조회 성공(ok=true) + 반환 uid 가 D1 값과 다를 때만 정정.
 *   - Firebase 조회 실패는 그대로 통과 (닉/지갑 변경, 미가입 등 — 손대지 않음).
 */

interface DriftRow {
  id: string;
  nickname: string | null;
  name: string | null;
  securetQrUrl: string | null;
  d1QrchatUid: string | null;
  firebaseQrchatUid: string;
  qkeyBalance: number | null;
}

async function scanDrift(limit: number): Promise<{
  scanned: number;
  drift: DriftRow[];
  linkFailed: number;
  linkOkSameUid: number;
}> {
  const db = await getD1();
  const res = await db
    .prepare(
      `SELECT "id","nickname","name","origin","qrchatUid",
              "qkeyBalance","securetQrUrl"
         FROM "User"
        WHERE "origin" = 'QRCHAT'
          AND "securetQrUrl" IS NOT NULL AND TRIM("securetQrUrl") <> ''
          AND "nickname"    IS NOT NULL AND TRIM("nickname")    <> ''
        ORDER BY "createdAt" DESC
        LIMIT ?`
    )
    .bind(limit)
    .all();

  const rows: any[] = (res?.results as any[]) || [];
  const drift: DriftRow[] = [];
  let linkFailed = 0;
  let linkOkSameUid = 0;

  for (const u of rows) {
    const wallet = String(u.securetQrUrl || '').trim();
    const nick = String(u.nickname || '').trim();
    if (!wallet || !nick) continue;

    const link = await linkQrchatWallet(wallet, nick);
    if (!link.ok || !link.uid) {
      linkFailed += 1;
      continue;
    }
    const d1Uid = String(u.qrchatUid || '');
    const fbUid = String(link.uid);
    if (d1Uid === fbUid) {
      linkOkSameUid += 1;
      continue;
    }
    drift.push({
      id: String(u.id),
      nickname: nick,
      name: u.name ? String(u.name) : null,
      securetQrUrl: wallet,
      d1QrchatUid: d1Uid || null,
      firebaseQrchatUid: fbUid,
      qkeyBalance: u.qkeyBalance ?? null,
    });
  }

  return { scanned: rows.length, drift, linkFailed, linkOkSameUid };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAuthToken(req);
    if (auth instanceof NextResponse) return auth;
    if (auth.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다' },
        { status: 403 }
      );
    }
    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || '200', 10) || 200, 1),
      1000
    );

    const { scanned, drift, linkFailed, linkOkSameUid } = await scanDrift(limit);

    return NextResponse.json(
      {
        success: true,
        mode: 'dryRun',
        scanned,
        driftCount: drift.length,
        linkFailed,
        linkOkSameUid,
        drift,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e: any) {
    console.error('[GET /api/admin/diagnose/qrchat-uid-drift] error:', e);
    return NextResponse.json(
      { success: false, error: e?.message || '스캔 실패' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuthToken(req);
    if (auth instanceof NextResponse) return auth;
    if (auth.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다' },
        { status: 403 }
      );
    }
    const body = await req.json().catch(() => ({} as any));
    const limit = Math.min(
      Math.max(parseInt(String(body?.limit || '200'), 10) || 200, 1),
      1000
    );

    const { scanned, drift, linkFailed, linkOkSameUid } = await scanDrift(limit);

    const db = await getD1();
    const fixed: Array<{ id: string; from: string | null; to: string }> = [];
    const failed: Array<{ id: string; error: string }> = [];

    for (const d of drift) {
      try {
        await db
          .prepare(
            `UPDATE "User"
                SET "qrchatUid" = ?, "updatedAt" = CURRENT_TIMESTAMP
              WHERE "id" = ?`
          )
          .bind(d.firebaseQrchatUid, d.id)
          .run();
        fixed.push({
          id: d.id,
          from: d.d1QrchatUid,
          to: d.firebaseQrchatUid,
        });
      } catch (err: any) {
        // qrchatUid UNIQUE 충돌 등 → 다른 계정에 이미 새 uid 가 붙어있음.
        // 안전을 위해 개별 케이스는 사람이 직접 확인.
        failed.push({ id: d.id, error: err?.message || 'update_failed' });
      }
    }

    return NextResponse.json(
      {
        success: true,
        mode: 'apply',
        scanned,
        driftCount: drift.length,
        fixedCount: fixed.length,
        failedCount: failed.length,
        linkFailed,
        linkOkSameUid,
        fixed,
        failed,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e: any) {
    console.error('[POST /api/admin/diagnose/qrchat-uid-drift] error:', e);
    return NextResponse.json(
      { success: false, error: e?.message || '정정 실패' },
      { status: 500 }
    );
  }
}
