/**
 * 고객 문의 API (상품 Q&A / 1:1 문의)
 * - GET  : 상품별(또는 전체) 문의 목록 조회. 비밀글은 내용 마스킹.
 * - POST : 문의 작성 (회원/비회원 모두 가능)
 */
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyAuthToken } from '@/lib/auth/middleware';
import { getD1, ensureInquiryTable } from '@/lib/balance';

const prisma = new PrismaClient();

// 로그인 사용자 식별(옵셔널). 토큰 없거나 무효면 null 반환(에러 아님).
async function getOptionalUser(req: NextRequest) {
  try {
    const result = await verifyAuthToken(req);
    if (result instanceof NextResponse) return null;
    return result;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    await ensureInquiryTable(await getD1());

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('productId');
    const limit = Math.min(Number(searchParams.get('limit')) || 20, 100);
    const page = Math.max(Number(searchParams.get('page')) || 1, 1);

    const user = await getOptionalUser(req);
    const viewerId = user?.userId || null;
    const isAdmin = user?.role === 'ADMIN';

    const where: any = {};
    if (productId) where.productId = productId;

    const [rows, total] = await Promise.all([
      prisma.inquiry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          productId: true,
          userId: true,
          authorName: true,
          title: true,
          content: true,
          isSecret: true,
          status: true,
          answer: true,
          answeredAt: true,
          createdAt: true,
        },
      }),
      prisma.inquiry.count({ where }),
    ]);

    // 비밀글은 작성자 본인/관리자만 내용 열람 가능
    const items = rows.map((r) => {
      const canView = isAdmin || (!!viewerId && r.userId === viewerId) || !r.isSecret;
      // 작성자 이름 마스킹 (개인정보 보호): 홍길동 → 홍*동
      const maskName = (n: string) => {
        if (!n) return '고객';
        if (n.length <= 1) return n;
        if (n.length === 2) return n[0] + '*';
        return n[0] + '*'.repeat(n.length - 2) + n[n.length - 1];
      };
      return {
        id: r.id,
        productId: r.productId,
        authorName: maskName(r.authorName),
        title: r.isSecret && !canView ? '비밀글입니다.' : r.title,
        content: r.isSecret && !canView ? '작성자와 관리자만 볼 수 있는 비밀글입니다.' : r.content,
        isSecret: r.isSecret,
        locked: r.isSecret && !canView,
        status: r.status,
        answer: r.isSecret && !canView ? null : r.answer,
        answeredAt: r.answeredAt,
        createdAt: r.createdAt,
        isMine: !!viewerId && r.userId === viewerId,
      };
    });

    return NextResponse.json({ success: true, data: { items, total, page, limit } });
  } catch (e: any) {
    console.error('[GET /api/inquiries] error:', e);
    return NextResponse.json({ success: false, error: '문의 목록 조회에 실패했습니다.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureInquiryTable(await getD1());

    const body = await req.json().catch(() => ({}));
    const productId: string | null = body.productId || null;
    const title = String(body.title || '').trim();
    const content = String(body.content || '').trim();
    const isSecret = !!body.isSecret;

    if (!title) {
      return NextResponse.json({ success: false, error: '제목을 입력해주세요.' }, { status: 400 });
    }
    if (!content) {
      return NextResponse.json({ success: false, error: '문의 내용을 입력해주세요.' }, { status: 400 });
    }
    if (title.length > 200) {
      return NextResponse.json({ success: false, error: '제목은 200자 이내로 입력해주세요.' }, { status: 400 });
    }

    const user = await getOptionalUser(req);

    // 작성자 정보: 회원이면 계정 정보, 비회원이면 body 입력값
    let authorName = String(body.authorName || '').trim();
    let authorEmail = String(body.authorEmail || '').trim() || null;
    let authorPhone = String(body.authorPhone || '').trim() || null;
    let userId: string | null = null;

    if (user?.userId) {
      userId = user.userId;
      if (!authorName) authorName = user.nickname || user.name || '회원';
      if (!authorEmail) authorEmail = user.email || null;
    }
    if (!authorName) {
      // 비회원인데 이름도 없으면 거부
      return NextResponse.json({ success: false, error: '작성자 이름을 입력해주세요.' }, { status: 400 });
    }

    // 상품 문의인 경우 상품 존재 확인 (없으면 productId만 null 처리하고 진행하지 않고 에러)
    if (productId) {
      const exists = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
      if (!exists) {
        return NextResponse.json({ success: false, error: '존재하지 않는 상품입니다.' }, { status: 400 });
      }
    }

    const created = await prisma.inquiry.create({
      data: {
        productId,
        userId,
        authorName,
        authorEmail,
        authorPhone,
        title,
        content,
        isSecret,
        status: 'PENDING',
      },
      select: { id: true, createdAt: true },
    });

    return NextResponse.json({ success: true, data: { id: created.id, createdAt: created.createdAt } });
  } catch (e: any) {
    console.error('[POST /api/inquiries] error:', e);
    return NextResponse.json({ success: false, error: '문의 등록에 실패했습니다.' }, { status: 500 });
  }
}
