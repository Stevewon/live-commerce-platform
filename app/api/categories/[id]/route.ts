import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';

// slug 정규화 (영문/숫자/한글 허용, 그 외는 하이픈)
function normalizeSlug(raw: string): string {
  return (raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-|-$/g, '');
}

// PATCH /api/categories/[id] - 카테고리 수정 (관리자 전용)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const prisma = await getPrisma();
  const { id } = await params;
  try {
    const auth = await verifyAuthToken(req);
    if (auth instanceof NextResponse) return auth;
    if (auth.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: '카테고리를 찾을 수 없습니다' }, { status: 404 });
    }

    const body = await req.json();
    const data: any = {};

    if (typeof body?.name === 'string') {
      const name = body.name.trim();
      if (!name) {
        return NextResponse.json({ success: false, error: '카테고리명을 입력하세요' }, { status: 400 });
      }
      data.name = name;
    }

    if (typeof body?.slug === 'string' && body.slug.trim()) {
      const slug = normalizeSlug(body.slug);
      if (slug && slug !== existing.slug) {
        const dup = await prisma.category.findUnique({ where: { slug } });
        if (dup && dup.id !== id) {
          return NextResponse.json({ success: false, error: '이미 존재하는 slug입니다' }, { status: 409 });
        }
        data.slug = slug;
      }
    }

    if (body?.description !== undefined) {
      data.description = body.description ? String(body.description).trim() : null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ success: false, error: '수정할 항목이 없습니다' }, { status: 400 });
    }

    const updated = await prisma.category.update({
      where: { id },
      data,
      select: { id: true, name: true, slug: true, description: true },
    });

    return NextResponse.json({ success: true, data: updated, message: '카테고리가 수정되었습니다' });
  } catch (error: any) {
    console.error('카테고리 수정 오류:', error);
    if (error?.code === 'P2002') {
      return NextResponse.json({ success: false, error: '이미 존재하는 slug입니다' }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: '카테고리 수정에 실패했습니다' }, { status: 500 });
  }
}

// DELETE /api/categories/[id] - 카테고리 삭제 (관리자 전용)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const prisma = await getPrisma();
  const { id } = await params;
  try {
    const auth = await verifyAuthToken(req);
    if (auth instanceof NextResponse) return auth;
    if (auth.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    const existing = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: '카테고리를 찾을 수 없습니다' }, { status: 404 });
    }

    // 연결된 상품이 있으면 삭제 방지 (데이터 보호)
    if (existing._count.products > 0) {
      return NextResponse.json(
        { success: false, error: `연결된 상품이 ${existing._count.products}개 있어 삭제할 수 없습니다` },
        { status: 400 }
      );
    }

    await prisma.category.delete({ where: { id } });

    return NextResponse.json({ success: true, message: '카테고리가 삭제되었습니다' });
  } catch (error: any) {
    console.error('카테고리 삭제 오류:', error);
    return NextResponse.json({ success: false, error: '카테고리 삭제에 실패했습니다' }, { status: 500 });
  }
}
