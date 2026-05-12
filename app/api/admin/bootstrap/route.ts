import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/password';

/**
 * GET/POST /api/admin/bootstrap
 *
 * 어드민 계정 진단 + 비번 리셋 + 진단 데이터 조회 1회용 라우트.
 * 토큰 시크릿 가드: query/header 의 `t` 값이 BOOTSTRAP_TOKEN 과 일치해야 동작.
 *
 * 1) GET ?t=...&mode=check                 — ADMIN 계정 목록 조회 (비번 미노출)
 * 2) GET ?t=...&mode=reset&nickname=admin&newpw=...  — 비번 리셋
 * 3) GET ?t=...&mode=create&nickname=admin&pw=...&email=...  — ADMIN 신규 생성
 * 4) GET ?t=...&mode=diag&amount=3010      — 진단 (3010원 주문 조회)
 *
 * 토큰: 코드에 하드코딩 (1회용, 사용 후 PR로 제거)
 */
const BOOTSTRAP_TOKEN = 'qrlive-boss-emergency-2026-05-12-x9k3p7';

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const t = searchParams.get('t') || req.headers.get('x-bootstrap-token') || '';
  if (t !== BOOTSTRAP_TOKEN) {
    return NextResponse.json({ success: false, error: 'invalid token' }, { status: 401 });
  }

  const mode = searchParams.get('mode') || 'check';
  const prisma = await getPrisma();

  try {
    if (mode === 'check') {
      // ADMIN 권한 계정 전부 조회 (비번 제외)
      const admins: any = await prisma.$queryRawUnsafe(
        `SELECT id, email, nickname, name, phone, role, createdAt
         FROM "User"
         WHERE role = 'ADMIN'
         ORDER BY createdAt ASC`
      );
      // 전체 사용자 수 + role 분포
      const stats: any = await prisma.$queryRawUnsafe(
        `SELECT role, COUNT(*) as cnt FROM "User" GROUP BY role`
      );
      return NextResponse.json({ success: true, admins, stats });
    }

    if (mode === 'reset') {
      const nickname = searchParams.get('nickname') || '';
      const newpw = searchParams.get('newpw') || '';
      if (!nickname || !newpw) {
        return NextResponse.json(
          { success: false, error: 'nickname & newpw required' },
          { status: 400 }
        );
      }
      const hashed = await hashPassword(newpw);
      const nowIso = new Date().toISOString();
      // raw SQL — silent fail 방지
      const changes = await prisma.$executeRawUnsafe(
        `UPDATE "User" SET "password" = ?, "updatedAt" = ? WHERE "nickname" = ? AND "role" = 'ADMIN'`,
        hashed, nowIso, nickname
      );
      const verify: any = await prisma.$queryRawUnsafe(
        `SELECT id, email, nickname, role FROM "User" WHERE nickname = ? LIMIT 1`,
        nickname
      );
      return NextResponse.json({
        success: changes > 0,
        changes,
        nickname,
        verify: Array.isArray(verify) ? verify[0] : verify,
        message: changes > 0 ? `비번 리셋 완료. nickname=${nickname} 새 비번으로 로그인 가능` : '대상 계정 없음 (nickname/role 확인)',
      });
    }

    if (mode === 'create') {
      const nickname = searchParams.get('nickname') || 'admin';
      const pw = searchParams.get('pw') || '';
      const email = searchParams.get('email') || `${nickname}@qrlive.io`;
      const name = searchParams.get('name') || 'Administrator';
      if (!pw) {
        return NextResponse.json({ success: false, error: 'pw required' }, { status: 400 });
      }
      // 기존 nickname 있는지
      const existing: any = await prisma.$queryRawUnsafe(
        `SELECT id, role FROM "User" WHERE nickname = ? OR email = ? LIMIT 1`,
        nickname, email
      );
      if (Array.isArray(existing) && existing.length > 0) {
        return NextResponse.json({
          success: false,
          error: 'already exists',
          existing: existing[0],
          hint: '기존 계정을 리셋하려면 mode=reset 사용',
        });
      }
      const hashed = await hashPassword(pw);
      const nowIso = new Date().toISOString();
      // id 는 cuid 비슷하게 timestamp 기반 (Prisma cuid 모방 — 충돌 가능성 낮음)
      const id = 'adm_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
      const changes = await prisma.$executeRawUnsafe(
        `INSERT INTO "User" (id, email, nickname, password, name, role, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, 'ADMIN', ?, ?)`,
        id, email, nickname, hashed, name, nowIso, nowIso
      );
      return NextResponse.json({
        success: changes > 0,
        changes,
        id,
        nickname,
        email,
        message: changes > 0 ? `ADMIN 신규 생성 완료. nickname=${nickname}` : '생성 실패',
      });
    }

    if (mode === 'diag') {
      const amount = parseInt(searchParams.get('amount') || '0');
      const hours = parseInt(searchParams.get('hours') || '24');
      const result: any = { hours };
      result.stats = await prisma.$queryRawUnsafe(
        `SELECT paymentMethod, status, COUNT(*) as cnt
         FROM "Order"
         WHERE createdAt > datetime('now', '-${hours} hours')
         GROUP BY paymentMethod, status
         ORDER BY cnt DESC`
      );
      if (amount > 0) {
        result.orders = await prisma.$queryRawUnsafe(
          `SELECT id, orderNumber, status, paymentMethod, paymentKey, paidAt, total,
                  guestPhone, guestEmail, shippingName, shippingPhone,
                  createdAt, updatedAt
           FROM "Order"
           WHERE total = ?
           ORDER BY createdAt DESC
           LIMIT 10`,
          amount
        );
      }
      result.recentPending = await prisma.$queryRawUnsafe(
        `SELECT id, orderNumber, status, paymentMethod, paymentKey, total, createdAt
         FROM "Order"
         WHERE status = 'PENDING'
           AND createdAt > datetime('now', '-${hours} hours')
         ORDER BY createdAt DESC
         LIMIT 10`
      );
      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json(
      { success: false, error: 'unknown mode', validModes: ['check', 'reset', 'create', 'diag'] },
      { status: 400 }
    );
  } catch (err: any) {
    console.error('[admin/bootstrap] error:', err?.message || err);
    return NextResponse.json(
      { success: false, error: err?.message || 'unknown error' },
      { status: 500 }
    );
  }
}
