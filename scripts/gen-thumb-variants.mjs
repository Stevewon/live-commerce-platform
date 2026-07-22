// 목록용 경량 썸네일(WebP) 변형을 샌드박스(sharp)에서 생성해 R2 에 업로드.
// 사용: node scripts/gen-thumb-variants.mjs <TOKEN> <WIDTH> [LIMIT]
import sharp from 'sharp';
import fs from 'fs';

const BASE = 'https://qrlive.io';
const TOKEN = process.argv[2] || fs.readFileSync('/tmp/admin_token.txt', 'utf8').trim();
const WIDTH = parseInt(process.argv[3] || '400', 10);
const LIMIT = parseInt(process.argv[4] || '9999', 10);

if (!TOKEN) { console.error('토큰 필요'); process.exit(1); }

const auth = { Authorization: `Bearer ${TOKEN}` };

async function main() {
  // 1) 전체 상품 목록에서 R2 썸네일 수집
  const res = await fetch(`${BASE}/api/admin/products?limit=500`, { headers: auth });
  const j = await res.json();
  const list = j.data?.products || j.products || j.data || [];
  const keys = new Set();
  for (const p of list) {
    const t = p.thumbnail || '';
    if (t.startsWith('/api/images/')) keys.add(t.split('?')[0]);
  }
  const all = [...keys].slice(0, LIMIT);
  console.log(`대상 썸네일: ${all.length}개 (width=${WIDTH})`);

  let done = 0, skip = 0, fail = 0, srcBytes = 0, outBytes = 0;
  for (const path of all) {
    try {
      // 이미 변형이 있으면 스킵
      const chk = await fetch(`${BASE}/api/admin/products/image-variant?width=${WIDTH}&checkKey=${encodeURIComponent(path)}`, { headers: auth });
      const chkj = await chk.json();
      if (chkj?.exists) { skip++; continue; }

      // 원본 다운로드
      const imgRes = await fetch(`${BASE}${path}`);
      if (!imgRes.ok) { fail++; console.log(`  FAIL fetch ${path} (${imgRes.status})`); continue; }
      const buf = Buffer.from(await imgRes.arrayBuffer());
      srcBytes += buf.length;

      // 리사이즈 + WebP
      const out = await sharp(buf)
        .resize({ width: WIDTH, withoutEnlargement: true })
        .webp({ quality: 78 })
        .toBuffer();
      outBytes += out.length;

      // 업로드
      const fd = new FormData();
      fd.append('key', path);
      fd.append('width', String(WIDTH));
      fd.append('file', new Blob([out], { type: 'image/webp' }), 'v.webp');
      const up = await fetch(`${BASE}/api/admin/products/image-variant`, { method: 'POST', headers: auth, body: fd });
      const upj = await up.json();
      if (upj?.success) {
        done++;
        if (done % 20 === 0) console.log(`  진행: ${done}개 완료 (${(buf.length/1024|0)}KB→${(out.length/1024|0)}KB)`);
      } else {
        fail++; console.log(`  FAIL upload ${path}: ${upj?.error}`);
      }
    } catch (e) {
      fail++; console.log(`  ERROR ${path}: ${e.message}`);
    }
  }
  console.log(`\n=== 완료 ===`);
  console.log(`생성=${done} 스킵(기존)=${skip} 실패=${fail}`);
  if (done > 0) {
    console.log(`원본 평균 ${(srcBytes/done/1024)|0}KB → 변형 평균 ${(outBytes/done/1024)|0}KB (${(100-outBytes/srcBytes*100)|0}% 감소)`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
