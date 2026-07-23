import { NextRequest, NextResponse } from 'next/server';
import { getD1 } from '@/lib/balance';
import { normalizeWalletAddress } from '@/lib/utils/wallet';

// POST /api/auth/find-nickname - 퀀타리움 지갑주소로 닉네임 찾기
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // 신규: quantariumWallet, 하위호환: securetQrUrl
    // EVM 주소는 대소문자를 구분하지 않으므로 소문자로 정규화한다.
    const walletAddress = normalizeWalletAddress(body.quantariumWallet ?? body.securetQrUrl ?? '');
    
    if (!walletAddress) {
      return NextResponse.json(
        {
          success: false,
          error: '퀀타리움 지갑주소를 입력해주세요.',
        },
        { status: 400 }
      );
    }
    
    // 퀀타리움 지갑주소로 사용자 찾기 (대소문자 무시)
    // - 기존 DB 에 대소문자가 섞여 저장된 레코드까지 매칭되도록 LOWER() 로 비교한다.
    const db = await getD1();
    const user: any = await db
      .prepare(`SELECT "nickname" FROM "User" WHERE LOWER("securetQrUrl") = LOWER(?) LIMIT 1`)
      .bind(walletAddress)
      .first();
    
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
