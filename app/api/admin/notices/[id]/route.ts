import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';
import { ensureNoticeTable } from '@/lib/ensureNoticeTable';

// 관리자 공지사항 수정 (PATCH)
export async function PATCH(
  req: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  const prisma = await getPrisma();
  try {
    const { id } = await segmentData.params;
    const authResult = await verifyAuthToken(req);
    if (authResult instanceof NextResponse) return authResult;
    if (authResult.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    await ensureNoticeTable();

    const existing = await prisma.notice.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: '공지사항을 찾을 수 없습니다' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const updateData: any = {};
    if (body?.title !== undefined) updateData.title = String(body.title).trim();
    if (body?.content !== undefined) updateData.content = String(body.content).trim();
    if (body?.isPinned !== undefined) updateData.isPinned = body.isPinned === true;
    if (body?.isPublished !== undefined) updateData.isPublished = body.isPublished === true;

    if (updateData.title === '' || updateData.content === '') {
      return NextResponse.json({ success: false, error: '제목과 내용은 비울 수 없습니다' }, { status: 400 });
    }

    const notice = await prisma.notice.update({ where: { id }, data: updateData });
    return NextResponse.json({ success: true, data: notice, message: '공지사항이 수정되었습니다' });
  } catch (error: any) {
    console.error('공지사항 수정 실패:', error);
    return NextResponse.json(
      { success: false, error: '공지사항 수정에 실패했습니다', detail: error?.message || String(error) },
      { status: 500 }
    );
  }
}

// 관리자 공지사항 삭제 (DELETE)
export async function DELETE(
  req: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  const prisma = await getPrisma();
  try {
    const { id } = await segmentData.params;
    const authResult = await verifyAuthToken(req);
    if (authResult instanceof NextResponse) return authResult;
    if (authResult.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    await ensureNoticeTable();

    const existing = await prisma.notice.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: '공지사항을 찾을 수 없습니다' }, { status: 404 });
    }

    await prisma.notice.delete({ where: { id } });
    return NextResponse.json({ success: true, message: '공지사항이 삭제되었습니다' });
  } catch (error: any) {
    console.error('공지사항 삭제 실패:', error);
    return NextResponse.json(
      { success: false, error: '공지사항 삭제에 실패했습니다', detail: error?.message || String(error) },
      { status: 500 }
    );
  }
}
