import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/password';

/**
 * [일회용 관리자 부트스트랩] — 사장님 요청(옵션 C: 새 ADMIN 계정 생성).
 *
 * ⚠️ 이 엔드포인트는 계정 생성 직후 즉시 제거(다음 배포)한다.
 *    - 아래 SETUP_KEY 를 아는 요청만 통과 (아무나 관리자 생성 불가).
 *    - 비밀번호는 절대 로그로 남기지 않으며 bcrypt 해시로만 저장.
 *    - 이미 같은 nickname 이 있으면 → 해당 계정을 ADMIN 으로 승격 + 비번 재설정(멱등).
 */
const SETUP_KEY = '332be5c6fd4a5f440a95aee149aff34f50c85aaf8313478c';

export async function POST(req: NextRequest) {
  const prisma = await getPrisma();
  try {
    const url = new URL(req.url);
    const key = url.searchParams.get('key') || req.headers.get('x-setup-key') || '';
    if (key !== SETUP_KEY) {
      return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const nickname = String(body?.nickname || '').trim();
    const password = String(body?.password || '');
    const name = String(body?.name || '관리자').trim() || '관리자';
    const email = body?.email ? String(body.email).trim() : null;

    if (!nickname || !password) {
      return NextResponse.json(
        { success: false, error: 'nickname 과 password 는 필수입니다' },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: '비밀번호는 최소 6자 이상' },
        { status: 400 }
      );
    }

    const hashed = await hashPassword(password);

    // 기존 동일 nickname 있으면 ADMIN 승격 + 비번 재설정 (멱등)
    const existing = await prisma.user.findUnique({ where: { nickname } });
    if (existing) {
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: { password: hashed, role: 'ADMIN', name: existing.name || name },
        select: { id: true, nickname: true, role: true, name: true, createdAt: true },
      });
      return NextResponse.json({
        success: true,
        action: 'promoted_and_reset',
        message: '기존 계정을 ADMIN 으로 승격하고 비밀번호를 재설정했습니다',
        user: updated,
      });
    }

    // 신규 ADMIN 계정 생성 (지갑주소 없이 생성 — securetQrUrl 은 nullable)
    const created = await prisma.user.create({
      data: {
        nickname,
        email,
        password: hashed,
        name,
        role: 'ADMIN',
        origin: 'QRLIVE',
      },
      select: { id: true, nickname: true, role: true, name: true, createdAt: true },
    });

    return NextResponse.json({
      success: true,
      action: 'created',
      message: '새 ADMIN 계정을 생성했습니다',
      user: created,
    });
  } catch (error: any) {
    // 비밀번호가 로그에 남지 않도록 message 만 기록
    console.error('[ADMIN_BOOTSTRAP_ERROR]', error?.message || String(error));
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: '이미 존재하는 nickname 또는 email 입니다' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: '처리 중 오류', detail: error?.message || String(error) },
      { status: 500 }
    );
  }
}
