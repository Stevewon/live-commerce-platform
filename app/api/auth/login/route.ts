import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth/password';
import { generateToken } from '@/lib/auth/jwt';

// POST /api/auth/login - 로그인
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;
    
    // 입력 검증
    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email and password are required',
        },
        { status: 400 }
      );
    }
    
    // 사용자 조회
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });
    
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid email or password',
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
          error: 'Invalid email or password',
        },
        { status: 401 }
      );
    }
    
    // JWT 토큰 생성
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });
    
    // 비밀번호 제외하고 반환
    const { password: _, ...userWithoutPassword } = user;
    
    // HTTP-only 쿠키 설정 (30일 유효) - Next.js cookies 사용
    const cookieStore = cookies();
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
      message: 'Login successful',
    });
  } catch (error) {
    console.error('[LOGIN_ERROR]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Login failed',
      },
      { status: 500 }
    );
  }
}
