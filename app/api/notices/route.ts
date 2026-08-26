import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { ensureNoticeTable } from '@/lib/ensureNoticeTable';

// 공개 공지사항 목록 (발행된 것만, 고정 우선 → 최신순)
export async function GET(_req: NextRequest) {
  const prisma = await getPrisma();
  try {
    await ensureNoticeTable();
    const notices = await prisma.notice.findMany({
      where: { isPublished: true },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, title: true, content: true, isPinned: true, createdAt: true },
    });
    return NextResponse.json({ success: true, data: notices });
  } catch (error: any) {
    console.error('공지사항 조회 실패:', error);
    // 테이블이 아직 없거나 오류여도 빈 목록으로 안전 반환
    return NextResponse.json({ success: true, data: [] });
  }
}
