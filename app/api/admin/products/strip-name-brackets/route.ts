import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

// 상품명에 있는 모든 대괄호 [ ... ] + 안의 텍스트를 위치(앞/중간/뒤) 상관없이 전부 제거
// 예) "[루비토] 프리미엄 세제 90개입 [447344]" -> "프리미엄 세제 90개입"
//     "씨없는 홍시 500g*2팩[파인애플바 증정] [447529]" -> "씨없는 홍시 500g*2팩"
const ANY_BRACKET = /\[[^\]]*\]/g;

function stripAllBrackets(name: string): string {
  if (!name) return name;
  // 대괄호+내용 제거 후 남은 공백 정리
  const next = name.replace(ANY_BRACKET, ' ').replace(/\s+/g, ' ').trim();
  // 안전장치: 제거 후 빈 문자열이 되면 원본 유지
  if (!next) return name;
  return next;
}

function hasBracket(name: string): boolean {
  return /\[[^\]]*\]/.test(name);
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
      if (hasBracket(p.name)) {
        const after = stripAllBrackets(p.name);
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
      if (!hasBracket(p.name)) {
        skipped++;
        continue;
      }
      const after = stripAllBrackets(p.name);
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
