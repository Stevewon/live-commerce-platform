/**
 * 어드민 고객 문의 관리 API
 * - GET   : 전체 문의 목록 (상태 필터/검색/페이지네이션), 상품명 포함
 * - PATCH : 답변 작성/수정 (status → ANSWERED)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';
import { getD1, ensureInquiryTable } from '@/lib/balance';

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAuthToken(req);
    if (auth instanceof NextResponse) return auth;
    if (auth.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    await ensureInquiryTable(await getD1());
    const prisma = await getPrisma();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status'); // PENDING | ANSWERED | (all)
    const q = String(searchParams.get('q') || '').trim();
    const limit = Math.min(Number(searchParams.get('limit')) || 30, 200);
    const page = Math.max(Number(searchParams.get('page')) || 1, 1);

    const where: any = {};
    if (status === 'PENDING' || status === 'ANSWERED') where.status = status;
    if (q) {
      where.OR = [
        { title: { contains: q } },
        { content: { contains: q } },
        { authorName: { contains: q } },
        { authorEmail: { contains: q } },
        { authorPhone: { contains: q } },
      ];
    }

    const [rows, total, pendingCount] = await Promise.all([
      prisma.inquiry.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], // PENDING(대기) 먼저, 최신순
        skip: (page - 1) * limit,
        take: limit,
        include: {
          product: { select: { id: true, name: true, slug: true, thumbnail: true } },
          user: { select: { id: true, nickname: true, name: true, email: true } },
        },
      }),
      prisma.inquiry.count({ where }),
      prisma.inquiry.count({ where: { status: 'PENDING' } }),
    ]);

    const items = rows.map((r) => ({
      id: r.id,
      productId: r.productId,
      productName: r.product?.name || null,
      productSlug: r.product?.slug || null,
      productThumbnail: r.product?.thumbnail || null,
      isMember: !!r.userId,
      authorName: r.authorName,
      authorEmail: r.authorEmail,
      authorPhone: r.authorPhone,
      memberNickname: r.user?.nickname || r.user?.name || null,
      title: r.title,
      content: r.content,
      isSecret: r.isSecret,
      status: r.status,
      answer: r.answer,
      answeredBy: r.answeredBy,
      answeredAt: r.answeredAt,
      createdAt: r.createdAt,
    }));

    return NextResponse.json({ success: true, data: { items, total, page, limit, pendingCount } });
  } catch (e: any) {
    console.error('[GET /api/admin/inquiries] error:', e);
    return NextResponse.json({ success: false, error: '문의 목록 조회에 실패했습니다.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await verifyAuthToken(req);
    if (auth instanceof NextResponse) return auth;
    if (auth.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    await ensureInquiryTable(await getD1());
    const prisma = await getPrisma();

    const body = await req.json().catch(() => ({}));
    const id = String(body.id || '').trim();
    const answer = String(body.answer || '').trim();

    if (!id) {
      return NextResponse.json({ success: false, error: '문의 ID가 필요합니다.' }, { status: 400 });
    }

    const existing = await prisma.inquiry.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      return NextResponse.json({ success: false, error: '존재하지 않는 문의입니다.' }, { status: 404 });
    }

    // 답변 삭제(빈 답변) 지원: 답변 비우면 다시 대기 상태로
    if (!answer) {
      const updated = await prisma.inquiry.update({
        where: { id },
        data: { answer: null, answeredBy: null, answeredAt: null, status: 'PENDING' },
        select: { id: true, status: true },
      });
      return NextResponse.json({ success: true, data: updated });
    }

    const updated = await prisma.inquiry.update({
      where: { id },
      data: {
        answer,
        answeredBy: auth.nickname || auth.name || auth.email || '관리자',
        answeredAt: new Date(),
        status: 'ANSWERED',
      },
      select: { id: true, status: true, answer: true, answeredAt: true, answeredBy: true },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (e: any) {
    console.error('[PATCH /api/admin/inquiries] error:', e);
    return NextResponse.json({ success: false, error: '답변 저장에 실패했습니다.' }, { status: 500 });
  }
}
