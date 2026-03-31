import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

// GET /api/categories - 카테고리 목록 조회
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
