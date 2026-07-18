import { NextRequest, NextResponse } from 'next/server';

/**
 * [v1.0.22 SUSPENDED] KISPG 결제 확인 API — 전면 중단
 * 원본 백업: /.legacy-kispg-backup/app_api_payments_confirm_route.ts.v1021-backup
 */

const DISABLED = {
  success: false,
  error: 'PG 결제 확인이 중단되었습니다.',
  code: 'KISPG_SUSPENDED',
};

export async function POST(_req: NextRequest) {
  return NextResponse.json(DISABLED, { status: 410 });
}

export async function GET(_req: NextRequest) {
  return NextResponse.json(DISABLED, { status: 410 });
}
