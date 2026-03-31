import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getPrisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth/password';
import { generateToken } from '@/lib/auth/jwt';

// POST /api/auth/login - 닉네임/이메일 + 비밀번호 로그인
export async function POST(request: NextRequest) {
  const prisma = await getPrisma();
  try {
    const body = await request.json();
    const { nickname, password } = body;
    
    // 입력 검증
    if (!nickname || !password) {
      return NextResponse.json(
        {
          success: false,
          error: '닉네임/이메일과 비밀번호를 입력해주세요.',
        },
        { status: 400 }
      );
    }
    
    const selectFields = {
      id: true,
      email: true,
      nickname: true,
      password: true,
      name: true,
      phone: true,
      role: true,
      createdAt: true,
    };
    
    // 사용자 조회 (닉네임으로 먼저, 없으면 이메일로)
    let user = await prisma.user.findUnique({
      where: { nickname },
      select: selectFields,
    });
    
    // 닉네임으로 못 찾으면 이메일로 검색
    if (!user && nickname.includes('@')) {
      user = await prisma.user.findUnique({
        where: { email: nickname },
        select: selectFields,
      });
    }
    
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: '닉네임/이메일 또는 비밀번호가 올바르지 않습니다.',
        },
        { status: 401 }
      );
    }
    
    // 비밀번호 검증
    const isPasswordValid = await verifyPassword(password, user.password);
    
    if (!isPasswordValid) {
      return NextResponse.json(
        {
          success: false,
          error: '닉네임 또는 비밀번호가 올바르지 않습니다.',
        },
        { status: 401 }
      );
    }
    
    // JWT 토큰 생성
    const token = generateToken({
      userId: user.id,
      nickname: user.nickname || user.email || user.id,
      role: user.role,
      name: user.name,
    });
    
    // 비밀번호 제외하고 반환
    const { password: _, ...userWithoutPassword } = user;
    
    // HTTP-only 쿠키 설정 (30일 유효)
    const cookieStore = await cookies();
    cookieStore.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30일
      path: '/',
    });
    
    // 사용자 역할도 쿠키에 저장 (클라이언트에서 읽을 수 있도록)
    cookieStore.set('user-role', user.role, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
    
    return NextResponse.json({
      success: true,
      data: {
        user: userWithoutPassword,
        token,
      },
      message: '로그인 성공',
    });
  } catch (error) {
    console.error('[LOGIN_ERROR]', error);
    return NextResponse.json(
      {
        success: false,
        error: '로그인 처리 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
