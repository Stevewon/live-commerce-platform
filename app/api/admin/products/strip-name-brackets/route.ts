import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

// 상품명 맨앞 대괄호 [ ... ] 1개 + 뒤따르는 공백 제거
// 예) "[데코아르] 멜로우 스냅백..." -> "멜로우 스냅백..."
// 두번째 대괄호(예: "[생면]", "[2개세트]")나 맨뒤 상품코드(예: "[438250]")는 건드리지 않음
const LEAD_BRACKET = /^\s*\[[^\]]*\]\s*/;

function stripLeadingBracket(name: string): string {
  if (!name) return name;
  const next = name.replace(LEAD_BRACKET, '');
  // 안전장치: 제거 후 빈 문자열이 되면 원본 유지
  if (!next.trim()) return name;
  return next;
}

// GET: 미리보기 (dry-run) — 어떤 상품명이 어떻게 바뀌는지 확인만 하고 DB 는 변경하지 않음
export async function GET(req: NextRequest) {
  const prisma = await getPrisma();
  const authResult = await verifyAuthToken(req);
  if (authResult instanceof NextResponse) return authResult;
  if (authResult.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'ADMIN only' }, { status: 403 });
  }

  try {
    const products = await prisma.product.findMany({
      select: { id: true, name: true },
    });

    const changes: { id: string; before: string; after: string }[] = [];
    for (const p of products) {
      if (LEAD_BRACKET.test(p.name)) {
        const after = stripLeadingBracket(p.name);
        if (after !== p.name) {
          changes.push({ id: p.id, before: p.name, after });
        }
      }
    }

    return NextResponse.json({
      success: true,
      dryRun: true,
      total: products.length,
      willChange: changes.length,
      preview: changes.slice(0, 30),
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}

// POST: 실제 적용 — 맨앞 대괄호가 있는 모든 상품명을 정리
export async function POST(req: NextRequest) {
  const prisma = await getPrisma();
  const authResult = await verifyAuthToken(req);
  if (authResult instanceof NextResponse) return authResult;
  if (authResult.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'ADMIN only' }, { status: 403 });
  }

  try {
    const products = await prisma.product.findMany({
      select: { id: true, name: true },
    });

    let updated = 0;
    let skipped = 0;
    const failed: { id: string; error: string }[] = [];

    for (const p of products) {
      if (!LEAD_BRACKET.test(p.name)) {
        skipped++;
        continue;
      }
      const after = stripLeadingBracket(p.name);
      if (after === p.name) {
        skipped++;
        continue;
      }
      try {
        await prisma.product.update({
          where: { id: p.id },
          data: { name: after },
        });
        updated++;
      } catch (e: any) {
        failed.push({ id: p.id, error: e?.message || String(e) });
      }
    }

    return NextResponse.json({
      success: true,
      total: products.length,
      updated,
      skipped,
      failed,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}
