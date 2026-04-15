import { NextRequest, NextResponse } from 'next/server';

/**
 * /api/socket - Socket.io 엔드포인트 (Cloudflare Workers 호환)
 * 
 * Cloudflare Workers 환경에서는 전통적인 Socket.io가 지원되지 않으므로
 * 404 대신 적절한 응답을 반환합니다.
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: false,
    error: '실시간 채팅은 현재 점검 중입니다.',
    message: 'Socket.io is not available in Cloudflare Workers environment.',
  }, { status: 503 });
}

export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: false,
    error: '실시간 채팅은 현재 점검 중입니다.',
    message: 'Socket.io is not available in Cloudflare Workers environment.',
  }, { status: 503 });
}
