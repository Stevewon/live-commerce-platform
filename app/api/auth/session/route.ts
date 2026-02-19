import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken, extractToken } from '@/lib/auth/jwt';

// GET /api/auth/session - 현재 로그인한 사용자 정보 조회
export async function GET(request: NextRequest) {
  try {
    // Authorization 헤더에서 토큰 추출
    const authHeader = request.headers.get('authorization');
    const token = extractToken(authHeader);
    
    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: 'No token provided',
        },
        { status: 401 }
      );
    }
    
    // 토큰 검증
    const payload = verifyToken(token);
    
    if (!payload) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or expired token',
        },
        { status: 401 }
      );
    }
    
    // 사용자 정보 조회
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
        },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    console.error('[SESSION_ERROR]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get session',
      },
      { status: 500 }
    );
  }
}
