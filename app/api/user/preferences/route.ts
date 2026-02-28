import { NextRequest, NextResponse } from 'next/server';

// 알림 설정 조회 (GET)
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'User preferences system is not yet implemented',
    data: {
      notifications: {
        order: true,
        delivery: true,
        marketing: false
      }
    }
  });
}

// 알림 설정 업데이트 (PATCH)
export async function PATCH(request: NextRequest) {
  return NextResponse.json(
    { success: false, error: 'User preferences system is not yet implemented' },
    { status: 501 }
  );
}
