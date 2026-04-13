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

    return NextResponse.json({
      message: 'Server outbound IP addresses',
      ips: results,
      timestamp: new Date().toISOString(),
      note: 'KISPG 방화벽에 등록해야 할 IP입니다',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
