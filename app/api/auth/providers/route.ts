// app/api/auth/providers/route.ts
// 활성화된 OAuth 제공자 목록 API

import { NextResponse } from 'next/server';

export async function GET() {
  const providers: string[] = [];

  // Google OAuth 활성화 여부
  if (
    process.env.GOOGLE_CLIENT_ID && 
    process.env.GOOGLE_CLIENT_ID !== 'your-google-client-id' &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_CLIENT_SECRET !== 'your-google-secret'
  ) {
    providers.push('google');
  }

  // Naver OAuth 활성화 여부
  if (
    process.env.NAVER_CLIENT_ID && 
    process.env.NAVER_CLIENT_ID !== 'your-naver-client-id' &&
    process.env.NAVER_CLIENT_SECRET &&
    process.env.NAVER_CLIENT_SECRET !== 'your-naver-secret'
  ) {
    providers.push('naver');
  }

  // Kakao OAuth 활성화 여부
  if (
    process.env.KAKAO_CLIENT_ID && 
    process.env.KAKAO_CLIENT_ID !== 'your-kakao-client-id' &&
    process.env.KAKAO_CLIENT_SECRET &&
    process.env.KAKAO_CLIENT_SECRET !== 'your-kakao-secret'
  ) {
    providers.push('kakao');
  }

  return NextResponse.json({
    providers,
    email: true, // 이메일 로그인은 항상 활성화
  });
}
