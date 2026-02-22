import { NextResponse } from 'next/server';

// POST /api/auth/logout - 로그아웃
export async function POST() {
  try {
    const response = NextResponse.json({
      success: true,
      message: 'Logout successful',
    });
    
    // 쿠키 삭제
    response.cookies.delete('auth-token');
    response.cookies.delete('user-role');
    
    return response;
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
