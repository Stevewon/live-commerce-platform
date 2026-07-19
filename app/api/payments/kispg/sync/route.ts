import { NextRequest, NextResponse } from 'next/server';

/**
 * [v1.0.22 SUSPENDED] KISPG paymentKey sync — 전면 중단
 * 원본 백업: /.legacy-kispg-backup/app_api_payments_kispg_sync_route.ts.v1021-backup
 */

const DISABLED = {
  ok: false,
  success: false,
  error: 'PG 결제 시스템이 중단되었습니다.',
  code: 'KISPG_SUSPENDED',
  skipped: true, // 프론트 sync 재시도 방지용 (skipped=true 면 정상 처리로 간주)
};

export async function POST(_req: NextRequest) {
  return NextResponse.json(DISABLED, { status: 410 });
}

export async function GET(_req: NextRequest) {
  return NextResponse.json(DISABLED, { status: 410 });
}
