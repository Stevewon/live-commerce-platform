import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/debug
 * 서버의 외부 IP 주소를 확인하는 임시 디버그 엔드포인트
 */
export async function GET(request: NextRequest) {
  try {
    // 여러 IP 확인 서비스를 사용하여 서버의 outbound IP 확인
    const results: Record<string, string> = {};

    try {
      const res1 = await fetch('https://api.ipify.org?format=json');
      const data1 = await res1.json();
      results.ipify = data1.ip;
    } catch (e: any) {
      results.ipify = `error: ${e.message}`;
    }

    try {
      const res2 = await fetch('https://ifconfig.me/ip');
      results.ifconfig = await res2.text();
    } catch (e: any) {
      results.ifconfig = `error: ${e.message}`;
    }

    try {
      const res3 = await fetch('https://ipinfo.io/ip');
      results.ipinfo = await res3.text();
    } catch (e: any) {
      results.ipinfo = `error: ${e.message}`;
    }

    // KISPG 운영 API 직접 테스트 (방화벽 차단 여부 확인)
    const kispgTest: Record<string, any> = {};
    try {
      const kispgRes = await fetch('https://api.kispg.co.kr/v2/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        redirect: 'manual', // 리다이렉트 따라가지 않음
        body: JSON.stringify({
          mid: 'quanta001m',
          tid: 'test_debug_check',
          goodsAmt: '1000',
          ediDate: '20260414120000',
          encData: 'debug_test',
          charset: 'utf-8',
        }),
      });
      kispgTest.status = kispgRes.status;
      kispgTest.statusText = kispgRes.statusText;
      kispgTest.headers = Object.fromEntries(kispgRes.headers.entries());
      
      // 리다이렉트인 경우
      if (kispgRes.status >= 300 && kispgRes.status < 400) {
        kispgTest.redirectUrl = kispgRes.headers.get('location');
        kispgTest.isFirewallBlocked = true;
        kispgTest.message = 'KISPG 방화벽에 의해 차단됨 - IP 등록 필요';
      } else {
        const bodyText = await kispgRes.text();
        kispgTest.body = bodyText.substring(0, 500);
        kispgTest.isFirewallBlocked = bodyText.includes('firewall') || bodyText.includes('kisvan') || bodyText.includes('비정상적인 접근');
        if (kispgTest.isFirewallBlocked) {
          kispgTest.message = 'KISPG 방화벽에 의해 차단됨 (HTML 응답) - IP 등록 필요';
        } else {
          kispgTest.message = 'KISPG API 정상 응답';
        }
      }
    } catch (e: any) {
      kispgTest.error = e.message;
      kispgTest.isFirewallBlocked = e.message?.includes('redirect') || e.message?.includes('firewall');
    }

    return NextResponse.json({
      message: 'Server outbound IP addresses',
      ips: results,
      kispgApiTest: kispgTest,
      timestamp: new Date().toISOString(),
      note: 'KISPG 방화벽에 등록해야 할 IP입니다',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
