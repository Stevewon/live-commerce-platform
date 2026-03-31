import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

// POST /api/auth/find-nickname - 시큐릿 QR 주소로 닉네임 찾기
export async function POST(request: NextRequest) {
  const prisma = await getPrisma();
  try {
    const body = await request.json();
    const { securetQrUrl } = body;
    
    if (!securetQrUrl) {
      return NextResponse.json(
        {
          success: false,
          error: '시큐릿 QR 주소를 입력해주세요.',
        },
        { status: 400 }
      );
    }
    
    // 시큐릿 QR 주소로 사용자 찾기
    const user = await prisma.user.findFirst({
      where: { securetQrUrl },
      select: {
        nickname: true,
      },
    });
    
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: '해당 시큐릿 QR 주소로 등록된 계정을 찾을 수 없습니다.',
        },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: {
        nickname: user.nickname,
      },
      message: '닉네임을 찾았습니다.',
    });
  } catch (error) {
    console.error('[FIND_NICKNAME_ERROR]', error);
    return NextResponse.json(
      {
        success: false,
        error: '닉네임 찾기 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
