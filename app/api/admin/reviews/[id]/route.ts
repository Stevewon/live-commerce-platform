import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';

// DELETE /api/admin/reviews/[id] - 리뷰 삭제 (부적절/스팸 리뷰 제거)
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const prisma = await getPrisma();
  try {
    const authResult = await verifyAuthToken(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    if (authResult.role !== 'ADMIN') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    const { id } = await context.params;

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) {
      return NextResponse.json({ success: false, error: '리뷰를 찾을 수 없습니다' }, { status: 404 });
    }

    await prisma.review.delete({ where: { id } });

    return NextResponse.json({ success: true, message: '리뷰가 삭제되었습니다' });
  } catch (error) {
    console.error('Admin delete review error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '리뷰 삭제 중 오류가 발생했습니다',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/reviews/[id] - 신고 처리 토글(isReported)
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const prisma = await getPrisma();
  try {
    const authResult = await verifyAuthToken(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    if (authResult.role !== 'ADMIN') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const { isReported } = body as { isReported?: boolean };

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) {
      return NextResponse.json({ success: false, error: '리뷰를 찾을 수 없습니다' }, { status: 404 });
    }

    const updated = await prisma.review.update({
      where: { id },
      data: { isReported: typeof isReported === 'boolean' ? isReported : !review.isReported },
    });

    return NextResponse.json({ success: true, data: { id: updated.id, isReported: updated.isReported } });
  } catch (error) {
    console.error('Admin patch review error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '리뷰 상태 변경 중 오류가 발생했습니다',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
