import { NextResponse } from 'next/server';
import { isInAppTrackingEnabled } from '@/lib/tracking/delivery-tracker';

/**
 * GET /api/tracking/health — 인앱 배송추적 설정 진단 (안전)
 * ---------------------------------------------------------------------------
 * secret 값 자체는 절대 노출하지 않는다. "설정됨/안됨"과, 실제 Delivery Tracker
 * OAuth2 인증이 통과하는지(액세스 토큰 발급 성공 여부)만 반환한다.
 * secret 반영 확인용. 값 노출이 없으므로 공개 접근 허용.
 */
export async function GET() {
  const configured = isInAppTrackingEnabled();

  if (!configured) {
    return NextResponse.json({
      configured: false,
      oauthOk: false,
      message: 'DELIVERY_TRACKER_CLIENT_ID / SECRET 미설정 — 외부 링크로 폴백됩니다.',
    });
  }

  // OAuth2 client_credentials 로 액세스 토큰만 시도 (조회는 안 함)
  const id = process.env.DELIVERY_TRACKER_CLIENT_ID as string;
  const secret = process.env.DELIVERY_TRACKER_CLIENT_SECRET as string;

  try {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: id,
      client_secret: secret,
    });
    const resp = await fetch('https://auth.tracker.delivery/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const json: any = await resp.json().catch(() => ({}));
    const oauthOk = resp.ok && !!json?.access_token;

    return NextResponse.json({
      configured: true,
      oauthOk,
      httpStatus: resp.status,
      message: oauthOk
        ? '인앱 배송추적 정상 — Delivery Tracker 인증 성공.'
        : '키는 설정됐으나 인증 실패 — Client ID/Secret 값을 확인하세요.',
      // 값 노출 방지: client id 는 앞 4자만
      clientIdPrefix: id ? id.slice(0, 4) + '…' : null,
    });
  } catch (err: any) {
    return NextResponse.json({
      configured: true,
      oauthOk: false,
      message: '인증 서버 호출 중 오류.',
      detail: String(err?.message || err).slice(0, 200),
    });
  }
}
