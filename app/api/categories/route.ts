import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';
import { translateTextsServer } from '@/lib/translateCache';

async function getEnv(): Promise<any> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    return ctx.env as any;
  } catch {
    return null;
  }
}

// GET /api/categories - 카테고리 목록 조회
// ?locale=ja 등을 주면 서버에서 카테고리명을 미리 번역해 name 에 실어 보낸다
// (클라이언트 async 번역 타이밍 이슈 제거 → 첫 렌더부터 번역 상태로 노출)
export async function GET(req: NextRequest) {
  const prisma = await getPrisma();
  try {
    const categories = await prisma.category.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    // 언어 요청 시 서버 번역 적용
    const locale = String(req.nextUrl.searchParams.get('locale') || '').trim();
    if (locale && locale !== 'ko') {
      try {
        const env = await getEnv();
        const map = await translateTextsServer(env, categories.map((c: any) => c.name), locale, 'ko');
        for (const c of categories as any[]) {
          c.nameOriginal = c.name;
          c.name = map.get(c.name) || c.name;
        }
      } catch { /* 번역 실패 시 원문 유지 */ }
    }

    return NextResponse.json({
      success: true,
      data: categories,
    });
  } catch (error: any) {
    console.error('카테고리 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '카테고리를 불러올 수 없습니다' },
      { status: 500 }
    );
  }
}

// slug 정규화 (영문/숫자/한글 허용, 그 외는 하이픈)
function normalizeSlug(raw: string): string {
  return (raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-|-$/g, '');
}

// POST /api/categories - 카테고리 생성 (관리자 전용)
export async function POST(req: NextRequest) {
  const prisma = await getPrisma();
  try {
    const auth = await verifyAuthToken(req);
    if (auth instanceof NextResponse) return auth;
    if (auth.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    const body = await req.json();
    const name = String(body?.name || '').trim();
    if (!name) {
      return NextResponse.json({ success: false, error: '카테고리명을 입력하세요' }, { status: 400 });
    }
    const slug = normalizeSlug(body?.slug) || normalizeSlug(name);
    if (!slug) {
      return NextResponse.json({ success: false, error: 'slug를 생성할 수 없습니다' }, { status: 400 });
    }
    const description = body?.description ? String(body.description).trim() : null;

    // slug 중복 확인
    const existing = await prisma.category.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ success: false, error: '이미 존재하는 slug입니다' }, { status: 409 });
    }

    const created = await prisma.category.create({
      data: { name, slug, description },
      select: { id: true, name: true, slug: true, description: true },
    });

    return NextResponse.json({ success: true, data: created, message: '카테고리가 등록되었습니다' });
  } catch (error: any) {
    console.error('카테고리 생성 오류:', error);
    if (error?.code === 'P2002') {
      return NextResponse.json({ success: false, error: '이미 존재하는 slug입니다' }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: '카테고리 생성에 실패했습니다' }, { status: 500 });
  }
}
