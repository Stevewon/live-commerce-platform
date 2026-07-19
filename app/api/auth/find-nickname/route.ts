import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

// POST /api/auth/find-nickname - 퀀타리움 지갑주소로 닉네임 찾기
export async function POST(request: NextRequest) {
  const prisma = await getPrisma();
  try {
    const body = await request.json();
    // 신규: quantariumWallet, 하위호환: securetQrUrl
    const walletAddress = (body.quantariumWallet ?? body.securetQrUrl ?? '').trim();
    
    if (!walletAddress) {
      return NextResponse.json(
        {
          success: false,
          error: '퀀타리움 지갑주소를 입력해주세요.',
        },
        { status: 400 }
      );
    }
    
    // 퀀타리움 지갑주소로 사용자 찾기
    const user = await prisma.user.findFirst({
      where: { securetQrUrl: walletAddress },
      select: {
        nickname: true,
      },
    });
    
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: '해당 퀀타리움 지갑주소로 등록된 계정을 찾을 수 없습니다.',
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
