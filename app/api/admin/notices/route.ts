import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';
import { ensureNoticeTable } from '@/lib/ensureNoticeTable';

// 관리자 공지사항 목록 (GET) — 발행/미발행 전체
export async function GET(req: NextRequest) {
  const prisma = await getPrisma();
  try {
    const authResult = await verifyAuthToken(req);
    if (authResult instanceof NextResponse) return authResult;
    if (authResult.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    await ensureNoticeTable();

    const notices = await prisma.notice.findMany({
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({ success: true, data: notices });
  } catch (error: any) {
    console.error('공지사항 조회 실패:', error);
    return NextResponse.json(
      { success: false, error: '공지사항 조회에 실패했습니다', detail: error?.message || String(error) },
      { status: 500 }
    );
  }
}

// 관리자 공지사항 등록 (POST)
export async function POST(req: NextRequest) {
  const prisma = await getPrisma();
  try {
    const authResult = await verifyAuthToken(req);
    if (authResult instanceof NextResponse) return authResult;
    if (authResult.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const title = String(body?.title || '').trim();
    const content = String(body?.content || '').trim();
    const isPinned = body?.isPinned === true;
    const isPublished = body?.isPublished !== false; // 기본 발행

    if (!title || !content) {
      return NextResponse.json({ success: false, error: '제목과 내용을 입력해주세요' }, { status: 400 });
    }

    await ensureNoticeTable();

    const notice = await prisma.notice.create({
      data: { title, content, isPinned, isPublished },
    });

    return NextResponse.json({ success: true, data: notice, message: '공지사항이 등록되었습니다' });
  } catch (error: any) {
    console.error('공지사항 등록 실패:', error);
    return NextResponse.json(
      { success: false, error: '공지사항 등록에 실패했습니다', detail: error?.message || String(error) },
      { status: 500 }
    );
  }
}
