/**
 * Notice(공지사항) 테이블 자동 생성 (셀프 힐링 마이그레이션).
 *
 * 프로덕션 D1 에는 Prisma 마이그레이션 스텝이 없으므로, 공지사항 관련 최초 접근 시
 * 테이블이 없으면 CREATE TABLE IF NOT EXISTS 로 자동 생성한다. (멱등)
 */

let _noticeTableEnsured = false;

async function getD1(): Promise<any> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    return (ctx.env as any).DB;
  } catch {
    return null;
  }
}

export async function ensureNoticeTable(db?: any): Promise<void> {
  if (_noticeTableEnsured) return;
  const d1 = db || (await getD1());
  if (!d1) return;
  const statements = [
    `CREATE TABLE IF NOT EXISTS "Notice" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "title" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "isPinned" INTEGER NOT NULL DEFAULT 0,
      "isPublished" INTEGER NOT NULL DEFAULT 1,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS "Notice_isPublished_idx" ON "Notice" ("isPublished")`,
    `CREATE INDEX IF NOT EXISTS "Notice_isPinned_idx" ON "Notice" ("isPinned")`,
    `CREATE INDEX IF NOT EXISTS "Notice_createdAt_idx" ON "Notice" ("createdAt")`,
  ];
  try {
    for (const sql of statements) {
      try {
        await d1.prepare(sql).run();
      } catch (e: any) {
        const msg = String(e?.message || e || '');
        if (!/already exists/i.test(msg)) {
          console.warn('[ensureNoticeTable] 실행 실패(무시):', msg);
        }
      }
    }
  } finally {
    _noticeTableEnsured = true;
  }
}
