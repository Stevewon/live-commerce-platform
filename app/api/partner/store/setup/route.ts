import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { getPrisma } from '@/lib/prisma';



// POST /api/partner/store/setup - 파트너 스토어 생성 (개발용)
export async function POST(request: NextRequest) {
  const prisma = await getPrisma();
  try {
    // 쿠키에서 토큰 가져오기
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // 토큰 검증
    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== 'PARTNER') {
      return NextResponse.json(
        { success: false, error: 'Partner authentication required' },
        { status: 403 }
      );
    }

    // 기존 스토어 확인
    const existingStore = await prisma.partner.findUnique({
      where: { userId: decoded.userId }
    });

    if (existingStore) {
      return NextResponse.json({
        success: true,
        message: '스토어가 이미 존재합니다.',
        data: existingStore,
      });
    }

    // 스토어 생성
    const store = await prisma.partner.create({
      data: {
        userId: decoded.userId,
        storeName: `${decoded.name}의 스토어`,
        storeSlug: `store-${decoded.userId.substring(0, 8)}`,
        description: '테스트 파트너 스토어입니다.',
        commissionRate: 30.0,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: '스토어가 생성되었습니다.',
      data: store,
    });
  } catch (error) {
    console.error('[STORE_SETUP_ERROR]', error);
    return NextResponse.json(
      {
        success: false,
        error: '스토어 생성에 실패했습니다.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
