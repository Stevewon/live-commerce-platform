import { NextRequest, NextResponse } from 'next/server';

// 포인트 내역 조회 (GET)
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Points system is not yet implemented',
    data: {
      balance: 0,
      history: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0
      }
    }
  });
}

// 포인트 지급/차감 (POST) - 관리자 전용
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { success: false, error: 'Points system is not yet implemented' },
    { status: 501 }
  );
}
