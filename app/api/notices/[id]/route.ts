import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { ensureNoticeTable } from '@/lib/ensureNoticeTable';

// 공개 공지사항 단건 조회 (발행된 것만)
export async function GET(
  _req: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  const prisma = await getPrisma();
  try {
    const { id } = await segmentData.params;
    await ensureNoticeTable();
    const notice = await prisma.notice.findFirst({
      where: { id, isPublished: true },
      select: { id: true, title: true, content: true, isPinned: true, createdAt: true },
    });
    if (!notice) {
      return NextResponse.json({ success: false, error: '공지사항을 찾을 수 없습니다' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: notice });
  } catch (error: any) {
    console.error('공지사항 조회 실패:', error);
    return NextResponse.json({ success: false, error: '조회 실패' }, { status: 500 });
  }
}
