import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';

// 배송비 설정 키 상수
const SHIPPING_FEE_KEY = 'SHIPPING_FEE';
const FREE_SHIPPING_THRESHOLD_KEY = 'FREE_SHIPPING_THRESHOLD';

// SiteSetting 테이블 자동 생성
async function ensureSiteSettingTable() {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    const db = (ctx.env as any).DB;
    if (db) {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS "SiteSetting" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "key" TEXT NOT NULL,
          "value" TEXT NOT NULL,
          "description" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
      await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS "SiteSetting_key_key" ON "SiteSetting"("key")`).run();
      await db.prepare(`CREATE INDEX IF NOT EXISTS "SiteSetting_key_idx" ON "SiteSetting"("key")`).run();
    }
  } catch (e) {
    // 무시
  }
}

// GET /api/admin/settings/shipping - 배송비 설정 조회
export async function GET(req: NextRequest) {
  await ensureSiteSettingTable();
  const prisma = await getPrisma();
  try {
    const authResult = await verifyAuthToken(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (authResult.role !== 'ADMIN') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    const settings = await prisma.siteSetting.findMany({
      where: {
        key: { in: [SHIPPING_FEE_KEY, FREE_SHIPPING_THRESHOLD_KEY] },
      },
    });

    const settingsMap: Record<string, string> = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }

    return NextResponse.json({
      success: true,
      data: {
        shippingFee: settingsMap[SHIPPING_FEE_KEY] ? parseInt(settingsMap[SHIPPING_FEE_KEY]) : 3000,
        freeShippingThreshold: settingsMap[FREE_SHIPPING_THRESHOLD_KEY] ? parseInt(settingsMap[FREE_SHIPPING_THRESHOLD_KEY]) : 50000,
      },
    });
  } catch (error: any) {
    console.error('Get shipping settings error:', error);
    return NextResponse.json({ error: '배송비 설정 조회 실패' }, { status: 500 });
  }
}

// PUT /api/admin/settings/shipping - 배송비 설정 변경
export async function PUT(req: NextRequest) {
  await ensureSiteSettingTable();
  const prisma = await getPrisma();
  try {
    const authResult = await verifyAuthToken(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (authResult.role !== 'ADMIN') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    const body = await req.json();
    const { shippingFee, freeShippingThreshold } = body;

    // 유효성 검사
    if (shippingFee !== undefined && (typeof shippingFee !== 'number' || shippingFee < 0)) {
      return NextResponse.json({ error: '배송비는 0 이상의 숫자여야 합니다' }, { status: 400 });
    }
    if (freeShippingThreshold !== undefined && (typeof freeShippingThreshold !== 'number' || freeShippingThreshold < 0)) {
      return NextResponse.json({ error: '무료배송 기준금액은 0 이상의 숫자여야 합니다' }, { status: 400 });
    }

    const results: any[] = [];

    // 배송비 설정 업데이트 (upsert)
    if (shippingFee !== undefined) {
      const updated = await prisma.siteSetting.upsert({
        where: { key: SHIPPING_FEE_KEY },
        update: { value: shippingFee.toString() },
        create: {
          key: SHIPPING_FEE_KEY,
          value: shippingFee.toString(),
          description: '기본 배송비 (원)',
        },
      });
      results.push(updated);
    }

    // 무료배송 기준금액 설정 업데이트 (upsert)
    if (freeShippingThreshold !== undefined) {
      const updated = await prisma.siteSetting.upsert({
        where: { key: FREE_SHIPPING_THRESHOLD_KEY },
        update: { value: freeShippingThreshold.toString() },
        create: {
          key: FREE_SHIPPING_THRESHOLD_KEY,
          value: freeShippingThreshold.toString(),
          description: '무료배송 기준금액 (원) - 이 금액 이상 주문 시 배송비 무료',
        },
      });
      results.push(updated);
    }

    return NextResponse.json({
      success: true,
      message: '배송비 설정이 변경되었습니다',
      data: {
        shippingFee: shippingFee !== undefined ? shippingFee : undefined,
        freeShippingThreshold: freeShippingThreshold !== undefined ? freeShippingThreshold : undefined,
      },
    });
  } catch (error: any) {
    console.error('Update shipping settings error:', error);
    return NextResponse.json({ error: '배송비 설정 변경 실패' }, { status: 500 });
  }
}
