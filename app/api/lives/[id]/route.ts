// app/api/lives/[id]/route.ts
// 공개 라이브 상세 API

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/lives/[id] - 라이브 상세 (공개)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 라이브 조회
    const live = await prisma.liveStream.findUnique({
      where: { id },
      include: {
        partner: {
          select: {
            id: true,
            storeName: true,
            storeSlug: true,
            logo: true,
            description: true,
          },
        },
        _count: {
          select: {
            chatMessages: true,
            orders: true,
          },
        },
      },
    });

    if (!live) {
      return NextResponse.json(
        { success: false, error: '라이브를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 조회수 증가
    await prisma.liveStream.update({
      where: { id },
      data: {
        viewCount: { increment: 1 },
      },
    });

    // 연결된 상품 조회
    let products: any[] = [];
    if (live.productIds) {
      try {
        const productIdsArray = JSON.parse(live.productIds);
        products = await prisma.product.findMany({
          where: {
            id: { in: productIdsArray },
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            slug: true,
            thumbnail: true,
            price: true,
            comparePrice: true,
            stock: true,
          },
        });
      } catch (e) {
        console.error('상품 조회 오류:', e);
      }
    }

    return NextResponse.json({
      success: true,
      live: {
        ...live,
        products,
      },
    });
  } catch (error: any) {
    console.error('라이브 상세 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '라이브를 불러올 수 없습니다' },
      { status: 500 }
    );
  }
}
