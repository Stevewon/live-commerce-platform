import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';
import { migrateImageToR2, needsMigration, parseImageList } from '@/lib/utils/migrateImage';

export const dynamic = 'force-dynamic';

// GET: 남은 이전 대상(외부 이미지) 상품 개수 조회 (진행 상황 확인용)
export async function GET(req: NextRequest) {
  const prisma = await getPrisma();
  const authResult = await verifyAuthToken(req);
  if (authResult instanceof NextResponse) return authResult;
  if (authResult.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'ADMIN only' }, { status: 403 });
  }

  try {
    // 외부(http) 썸네일을 가진 상품 = 아직 이전 안 된 것
    const products = await prisma.product.findMany({
      select: { id: true, thumbnail: true },
    });
    let pending = 0;
    for (const p of products) {
      if (needsMigration(p.thumbnail)) pending++;
    }
    return NextResponse.json({ success: true, total: products.length, pending });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}

// POST: 이전 대상 상품을 batch 개수만큼 R2 로 이전 (썸네일 + 갤러리 + 상세이미지)
export async function POST(req: NextRequest) {
  const prisma = await getPrisma();
  const authResult = await verifyAuthToken(req);
  if (authResult instanceof NextResponse) return authResult;
  if (authResult.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'ADMIN only' }, { status: 403 });
  }

  let batch = 5;
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.batch) batch = Math.min(20, Math.max(1, parseInt(body.batch)));
  } catch { /* 기본값 사용 */ }

  // R2 바인딩
  let r2: any = null;
  let r2PublicUrl: string | undefined;
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    r2 = (ctx.env as any).R2_BUCKET;
    r2PublicUrl = (ctx.env as any).R2_PUBLIC_URL as string | undefined;
  } catch { /* 무시 */ }

  if (!r2) {
    return NextResponse.json({ success: false, error: 'R2_BUCKET 바인딩 없음' }, { status: 500 });
  }

  try {
    // 이전 대상(외부 썸네일) 상품을 batch*4 개 후보로 가져와, 실제 대상만 batch 개 처리
    const candidates = await prisma.product.findMany({
      select: { id: true, thumbnail: true, images: true, detailImages: true },
      orderBy: { createdAt: 'desc' },
      take: batch * 6,
    });

    const targets = candidates.filter((p: any) => needsMigration(p.thumbnail)).slice(0, batch);

    let processed = 0;
    let migratedImages = 0;
    let savedBytes = 0;

    for (const p of targets) {
      const update: any = {};

      // 1) 썸네일
      if (needsMigration(p.thumbnail)) {
        const r = await migrateImageToR2(p.thumbnail, r2, r2PublicUrl);
        if (r.migrated) {
          update.thumbnail = r.url;
          migratedImages++;
          savedBytes += r.bytes || 0;
        }
      }

      // 2) 갤러리 images
      const imgs = parseImageList(p.images);
      if (imgs.length > 0 && imgs.some((u) => needsMigration(u))) {
        const newImgs: string[] = [];
        for (const u of imgs) {
          if (needsMigration(u)) {
            const r = await migrateImageToR2(u, r2, r2PublicUrl);
            newImgs.push(r.url);
            if (r.migrated) { migratedImages++; savedBytes += r.bytes || 0; }
          } else {
            newImgs.push(u);
          }
        }
        update.images = JSON.stringify(newImgs);
      }

      // 3) 상세 detailImages
      const details = parseImageList(p.detailImages);
      if (details.length > 0 && details.some((u) => needsMigration(u))) {
        const newDetails: string[] = [];
        for (const u of details) {
          if (needsMigration(u)) {
            const r = await migrateImageToR2(u, r2, r2PublicUrl);
            newDetails.push(r.url);
            if (r.migrated) { migratedImages++; savedBytes += r.bytes || 0; }
          } else {
            newDetails.push(u);
          }
        }
        update.detailImages = JSON.stringify(newDetails);
      }

      if (Object.keys(update).length > 0) {
        await prisma.product.update({ where: { id: p.id }, data: update });
        processed++;
      }
    }

    // 남은 개수
    const all = await prisma.product.findMany({ select: { thumbnail: true } });
    const pending = all.filter((p: any) => needsMigration(p.thumbnail)).length;

    return NextResponse.json({
      success: true,
      processed,
      migratedImages,
      savedBytes,
      pending,
      done: pending === 0,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}
