import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';

// [이미지 최적화 백필] 관리자가 기존 상품 이미지를 리사이즈+WebP 로 재변환할 때
// 사용할 대상 목록을 반환한다. (실제 변환은 브라우저 Canvas 에서 수행 후 PATCH 로 저장)
//
// - thumbnail / images(갤러리) / detailImages(상세) 의 URL 목록을 상품별로 제공
// - 이미 .webp 인 URL 은 프론트에서 걸러낼 수 있도록 원본 그대로 반환
export async function GET(req: NextRequest) {
  const prisma = await getPrisma();
  try {
    const authResult = await verifyAuthToken(req);
    if (authResult instanceof NextResponse) return authResult;
    if (authResult.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    // 모든 상품의 이미지 필드만 경량 조회
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        thumbnail: true,
        images: true,
        detailImages: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const parseArr = (v: any): string[] => {
      if (!v) return [];
      if (Array.isArray(v)) return v.filter((x) => typeof x === 'string');
      try {
        const p = JSON.parse(String(v));
        return Array.isArray(p) ? p.filter((x) => typeof x === 'string') : [];
      } catch {
        return [];
      }
    };

    const data = (products as any[]).map((p) => ({
      id: p.id,
      name: p.name,
      thumbnail: p.thumbnail || '',
      images: parseArr(p.images),
      detailImages: parseArr(p.detailImages),
    }));

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('[optimize-images] 목록 조회 실패:', error);
    return NextResponse.json(
      { success: false, error: error?.message || '조회 실패' },
      { status: 500 }
    );
  }
}
