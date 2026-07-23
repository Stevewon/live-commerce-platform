import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { getD1 } from '@/lib/balance';
import { normalizeWalletAddress } from '@/lib/utils/wallet';
import { hashPassword } from '@/lib/auth/password';

// POST /api/auth/reset-password - 퀀타리움 지갑주소로 비밀번호 재설정
export async function POST(request: NextRequest) {
  const prisma = await getPrisma();
  try {
    const body = await request.json();
    const { newPassword } = body;
    // 신규: quantariumWallet, 하위호환: securetQrUrl
    // EVM 주소는 대소문자를 구분하지 않으므로 소문자로 정규화한다.
    const walletAddress = normalizeWalletAddress(body.quantariumWallet ?? body.securetQrUrl ?? '');
    
    if (!walletAddress || !newPassword) {
      return NextResponse.json(
        {
          success: false,
          error: '퀀타리움 지갑주소와 새 비밀번호를 입력해주세요.',
        },
        { status: 400 }
      );
    }
    
    if (newPassword.length < 6) {
      return NextResponse.json(
        {
          success: false,
          error: '비밀번호는 최소 6자 이상이어야 합니다.',
        },
        { status: 400 }
      );
    }
    
    // 퀀타리움 지갑주소로 사용자 찾기 (대소문자 무시)
    // - 기존 DB 에 대소문자가 섞여 저장된 레코드까지 매칭되도록 LOWER() 로 비교한다.
    const db = await getD1();
    const user: any = await db
      .prepare(`SELECT "id" FROM "User" WHERE LOWER("securetQrUrl") = LOWER(?) LIMIT 1`)
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
    
    // 새 비밀번호 해싱
    const hashedPassword = await hashPassword(newPassword);
    
    // 비밀번호 업데이트
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
      },
    });
    
    return NextResponse.json({
      success: true,
      message: '비밀번호가 성공적으로 변경되었습니다.',
    });
  } catch (error) {
    console.error('[RESET_PASSWORD_ERROR]', error);
    return NextResponse.json(
      {
        success: false,
        error: '비밀번호 재설정 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
