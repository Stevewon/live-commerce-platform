import { NextRequest, NextResponse } from 'next/server';

/**
 * [v1.0.22 SUSPENDED] KISPG PG 결제 시스템 전면 중단
 *
 * 사장님 지시 (2026-05-14): "PG 부분은 다 주석달아서 처리하고 일단 중지!"
 * QKEY 잔액 + KRW(현금 무통장입금) 잔액 병행 결제로 전환.
 *
 * 원본 코드 백업: /.legacy-kispg-backup/app_api_payments_kispg_request_route.ts.v1021-backup
 *
 * 어떤 메서드 호출이든 410 Gone 응답. 프론트가 아직 남아있는 코드로 호출해도 안전하게 실패.
 */

const DISABLED_RESPONSE = {
  success: false,
  error: 'PG 결제 시스템이 잠시 중단되었습니다. 잔액 결제(KRW/QKEY)를 이용해주세요.',
  code: 'KISPG_SUSPENDED',
  redirect: '/my/balance',
};

export async function GET(_req: NextRequest) {
  return NextResponse.json(DISABLED_RESPONSE, { status: 410 });
}

export async function POST(_req: NextRequest) {
  return NextResponse.json(DISABLED_RESPONSE, { status: 410 });
}

export async function PUT(_req: NextRequest) {
  return NextResponse.json(DISABLED_RESPONSE, { status: 410 });
}

export async function DELETE(_req: NextRequest) {
  return NextResponse.json(DISABLED_RESPONSE, { status: 410 });
}

export async function PATCH(_req: NextRequest) {
  return NextResponse.json(DISABLED_RESPONSE, { status: 410 });
}
