import { NextRequest, NextResponse } from 'next/server';

/**
 * [v1.0.22 SUSPENDED] KISPG PG 결제 return 콜백 — 전면 중단
 *
 * 사장님 지시 (2026-05-14): PG 결제 중단
 * 원본 코드 백업: /.legacy-kispg-backup/app_api_payments_kispg_return_route.ts.v1021-backup
 *
 * KISPG 서버가 여전히 콜백을 보내면 사용자를 결제 실패 페이지로 리다이렉트.
 */

export async function POST(_req: NextRequest) {
  const target = new URL('/payment/fail', 'https://qrlive.io');
  target.searchParams.set('code', 'KISPG_SUSPENDED');
  target.searchParams.set('message', 'PG 결제가 중단되었습니다. 잔액 결제를 이용해주세요.');

  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${target.toString()}"></head><body>결제 시스템이 변경되었습니다. 리다이렉트 중...</body></html>`,
    {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    }
  );
}

export async function GET(_req: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error: 'PG 결제가 중단되었습니다. 잔액 결제를 이용해주세요.',
      code: 'KISPG_SUSPENDED',
    },
    { status: 410 }
  );
}
