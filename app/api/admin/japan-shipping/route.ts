/**
 * 어드민 일본 해외배송비 관리 API
 * - GET  : 47개 도도부현 목록 + 각 현별 배송비(원) + 환율/기본배송비 설정
 * - PUT  : 현별 배송비 일괄 저장(upsert) + 환율(KRW_TO_JPY)/기본배송비 설정 저장
 *
 * 배송비는 원(KRW)으로 저장하고, 일본 고객 화면에서 엔(JPY)으로 환산 표시한다.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';
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

async function readSettings(prisma: any): Promise<{ rate: number; defaultFee: number }> {
  let rate = DEFAULT_KRW_TO_JPY;
  let defaultFee = JP_DEFAULT_SHIPPING_FEE;
  try {
    const rows = await prisma.siteSetting.findMany({
      where: { key: { in: [KEY_RATE, KEY_DEFAULT_FEE] } },
    });
    for (const s of rows) {
      if (s.key === KEY_RATE) {
        const v = parseFloat(s.value);
        if (!isNaN(v) && v > 0) rate = v;
      }
      if (s.key === KEY_DEFAULT_FEE) {
        const v = parseInt(s.value);
        if (!isNaN(v) && v >= 0) defaultFee = v;
      }
    }
  } catch { /* 기본값 사용 */ }
  return { rate, defaultFee };
}

async function upsertSetting(prisma: any, key: string, value: string) {
  const existing = await prisma.siteSetting.findUnique({ where: { key } });
  if (existing) {
    await prisma.siteSetting.update({ where: { key }, data: { value } });
  } else {
    await prisma.siteSetting.create({ data: { key, value } });
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAuthToken(req);
    if (auth instanceof NextResponse) return auth;
    if (auth.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    await ensureJapanShippingTable(await getD1());
    const prisma = await getPrisma();

    const [saved, settings] = await Promise.all([
      prisma.japanShippingFee.findMany({}),
      readSettings(prisma),
    ]);

    const savedMap: Record<string, any> = {};
    for (const r of saved) savedMap[r.prefectureCode] = r;

    // 47개 현 전체를 항상 내려준다 (미저장 현은 기본값/비활성으로)
    const prefectures = JAPAN_PREFECTURES.map((p) => {
      const row = savedMap[p.code];
      const feeKrw = row ? row.feeKrw : 0;
      return {
        code: p.code,
        ko: p.ko,
        ja: p.ja,
        region: p.region,
        feeKrw,
        feeJpy: krwToJpy(feeKrw, settings.rate),
        isActive: row ? !!row.isActive : true,
        configured: !!row,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        prefectures,
        rate: settings.rate,
        defaultFeeKrw: settings.defaultFee,
        defaultFeeJpy: krwToJpy(settings.defaultFee, settings.rate),
      },
    });
  } catch (e: any) {
    console.error('[GET /api/admin/japan-shipping] error:', e);
    return NextResponse.json({ success: false, error: '해외배송비 조회에 실패했습니다.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await verifyAuthToken(req);
    if (auth instanceof NextResponse) return auth;
    if (auth.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    await ensureJapanShippingTable(await getD1());
    const prisma = await getPrisma();

    const body = await req.json().catch(() => ({}));
    const fees: Array<{ code: string; feeKrw: number; isActive?: boolean }> = Array.isArray(body.fees) ? body.fees : [];
    const rate = body.rate !== undefined ? parseFloat(String(body.rate)) : null;
    const defaultFee = body.defaultFeeKrw !== undefined ? parseInt(String(body.defaultFeeKrw)) : null;

    // 환율/기본배송비 저장 (SiteSetting)
    if (rate !== null && !isNaN(rate) && rate > 0) {
      await upsertSetting(prisma, KEY_RATE, String(rate));
    }
    if (defaultFee !== null && !isNaN(defaultFee) && defaultFee >= 0) {
      await upsertSetting(prisma, KEY_DEFAULT_FEE, String(defaultFee));
    }

    // 현별 배송비 upsert
    let updated = 0;
    for (const f of fees) {
      const pref = JAPAN_PREFECTURE_MAP[f.code];
      if (!pref) continue; // 유효한 현 코드만
      const feeKrw = Math.max(0, Math.floor(Number(f.feeKrw) || 0));
      const isActive = f.isActive === false ? false : true;

      const existing = await prisma.japanShippingFee.findUnique({ where: { prefectureCode: f.code } });
      if (existing) {
        await prisma.japanShippingFee.update({
          where: { prefectureCode: f.code },
          data: { feeKrw, isActive, prefectureKo: pref.ko, prefectureJa: pref.ja },
        });
      } else {
        await prisma.japanShippingFee.create({
          data: {
            prefectureCode: f.code,
            prefectureKo: pref.ko,
            prefectureJa: pref.ja,
            feeKrw,
            isActive,
          },
        });
      }
      updated++;
    }

    return NextResponse.json({ success: true, data: { updated } });
  } catch (e: any) {
    console.error('[PUT /api/admin/japan-shipping] error:', e);
    return NextResponse.json({ success: false, error: '해외배송비 저장에 실패했습니다.' }, { status: 500 });
  }
}
