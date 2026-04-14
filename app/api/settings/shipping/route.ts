import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

// 배송비 설정 키 상수
const SHIPPING_FEE_KEY = 'SHIPPING_FEE';
const FREE_SHIPPING_THRESHOLD_KEY = 'FREE_SHIPPING_THRESHOLD';

// SiteSetting 테이블 자동 생성 (D1에서 테이블이 없을 때)
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
    // 무시 (로컬 개발 또는 이미 존재하는 경우)
  }
}

// GET /api/settings/shipping - 배송비 설정 공개 조회 (인증 불필요)
export async function GET(req: NextRequest) {
  try {
    // 테이블 자동 생성
    await ensureSiteSettingTable();
    
    const prisma = await getPrisma();
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
    console.error('Get public shipping settings error:', error);
    // DB 오류 시 기본값 반환
    return NextResponse.json({
      success: true,
      data: {
        shippingFee: 3000,
        freeShippingThreshold: 50000,
      },
    });
  }
}
