import { NextRequest, NextResponse } from 'next/server';

/**
 * [v1.0.22 SUSPENDED] KISPG 결제 취소 API — 전면 중단
 * 원본 백업: /.legacy-kispg-backup/app_api_payments_cancel_route.ts.v1021-backup
 *
 * 신규 정책: 주문 취소 시 잔액 환불은 관리자 어드민에서 별도 처리.
 * 여기서는 KISPG API 호출을 하지 않고 410 반환.
 */

const DISABLED = {
  success: false,
  error: 'PG 결제 취소가 중단되었습니다. 잔액 환불은 관리자에게 문의해주세요.',
  code: 'KISPG_SUSPENDED',
};

export async function POST(_req: NextRequest) {
  return NextResponse.json(DISABLED, { status: 410 });
}

export async function GET(_req: NextRequest) {
  return NextResponse.json(DISABLED, { status: 410 });
}
