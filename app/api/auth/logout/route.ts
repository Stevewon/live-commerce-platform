import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// POST /api/auth/logout - 로그아웃
export async function POST() {
  try {
    // 쿠키 삭제 - Next.js cookies 사용
    const cookieStore = await cookies();
    cookieStore.delete('auth-token');
    cookieStore.delete('user-role');
    
    return NextResponse.json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    console.error('[LOGOUT_ERROR]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Logout failed',
      },
      { status: 500 }
    );
  }
}
