import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/password';

// POST /api/auth/reset-password - 시큐릿 QR 주소로 비밀번호 재설정
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { securetQrUrl, newPassword } = body;
    
    if (!securetQrUrl || !newPassword) {
      return NextResponse.json(
        {
          success: false,
          error: '시큐릿 QR 주소와 새 비밀번호를 입력해주세요.',
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
    
    // 시큐릿 QR 주소로 사용자 찾기
    const user = await prisma.user.findFirst({
      where: { securetQrUrl },
      select: {
        id: true,
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
