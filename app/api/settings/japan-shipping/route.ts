/**
 * 일본 해외배송비 공개 조회 API (인증 불필요) — 결제 화면에서 사용
 * - GET : 활성화된 도도부현 목록 + 배송비(원/엔) + 환율. code 쿼리 시 단일 현 배송비 반환.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { getD1, ensureJapanShippingTable } from '@/lib/balance';
import {
  JAPAN_PREFECTURES,
  JAPAN_PREFECTURE_MAP,
  JP_DEFAULT_SHIPPING_FEE,
  DEFAULT_KRW_TO_JPY,
  krwToJpy,
} from '@/lib/japan-prefectures';

const KEY_RATE = 'KRW_TO_JPY';
const KEY_DEFAULT_FEE = 'JP_DEFAULT_SHIPPING_FEE';

export async function GET(req: NextRequest) {
  try {
    await ensureJapanShippingTable(await getD1());
    const prisma = await getPrisma();

    let rate = DEFAULT_KRW_TO_JPY;
    let defaultFee = JP_DEFAULT_SHIPPING_FEE;
    try {
      const settingRows = await prisma.siteSetting.findMany({
        where: { key: { in: [KEY_RATE, KEY_DEFAULT_FEE] } },
      });
      for (const s of settingRows) {
        if (s.key === KEY_RATE) { const v = parseFloat(s.value); if (!isNaN(v) && v > 0) rate = v; }
        if (s.key === KEY_DEFAULT_FEE) { const v = parseInt(s.value); if (!isNaN(v) && v >= 0) defaultFee = v; }
      }
    } catch { /* 기본값 */ }

    const saved = await prisma.japanShippingFee.findMany({});
    const savedMap: Record<string, any> = {};
    for (const r of saved) savedMap[r.prefectureCode] = r;

    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');

    // 단일 현 배송비 조회
    if (code) {
      const pref = JAPAN_PREFECTURE_MAP[code];
      if (!pref) {
        return NextResponse.json({ success: false, error: '유효하지 않은 지역입니다.' }, { status: 400 });
      }
      const row = savedMap[code];
      const feeKrw = row && row.isActive ? row.feeKrw : defaultFee;
      return NextResponse.json({
        success: true,
        data: { code, ko: pref.ko, ja: pref.ja, feeKrw, feeJpy: krwToJpy(feeKrw, rate), rate },
      });
    }

    // 전체 목록 (활성 현만 노출, 미설정 현은 기본배송비로 노출)
    const prefectures = JAPAN_PREFECTURES.map((p) => {
      const row = savedMap[p.code];
      const active = row ? !!row.isActive : true; // 미설정도 기본배송비로 배송 가능
      const feeKrw = row && row.isActive ? row.feeKrw : defaultFee;
      return {
        code: p.code,
        ko: p.ko,
        ja: p.ja,
        region: p.region,
        feeKrw,
        feeJpy: krwToJpy(feeKrw, rate),
        active,
      };
    }).filter((p) => p.active);

    return NextResponse.json({
      success: true,
      data: { prefectures, rate, defaultFeeKrw: defaultFee, defaultFeeJpy: krwToJpy(defaultFee, rate) },
    });
  } catch (e: any) {
    console.error('[GET /api/settings/japan-shipping] error:', e);
    return NextResponse.json({ success: false, error: '해외배송비 조회에 실패했습니다.' }, { status: 500 });
  }
}
