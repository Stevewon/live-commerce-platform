// 병렬 경량 WebP 변형 생성 (샌드박스 sharp). 시간예산 내에서 처리하고 남으면 재실행.
// 사용: node scripts/gen-variants-fast.mjs <TOKEN> <WIDTH> <MAX_SECONDS> <CONCURRENCY>
import sharp from 'sharp';
import fs from 'fs';

const BASE = 'https://qrlive.io';
const TOKEN = process.argv[2] || fs.readFileSync('/tmp/admin_token.txt', 'utf8').trim();
const WIDTH = parseInt(process.argv[3] || '400', 10);
const MAX_SEC = parseInt(process.argv[4] || '240', 10);
const CONC = parseInt(process.argv[5] || '8', 10);
const auth = { Authorization: `Bearer ${TOKEN}` };

const keys = fs.readFileSync('/tmp/allimgkeys.txt', 'utf8').trim().split('\n').filter(Boolean);
const start = Date.now();
let done = 0, skip = 0, fail = 0, idx = 0, srcB = 0, outB = 0, stop = false;

async function worker() {
  while (!stop) {
    const i = idx++;
    if (i >= keys.length) return;
    if ((Date.now() - start) / 1000 > MAX_SEC) { stop = true; return; }
    const path = keys[i];
    try {
      const chk = await fetch(`${BASE}/api/admin/products/image-variant?width=${WIDTH}&checkKey=${encodeURIComponent(path)}`, { headers: auth });
      const cj = await chk.json();
      if (cj?.exists) { skip++; continue; }
      const r = await fetch(`${BASE}${path}`);
      if (!r.ok) { fail++; continue; }
      const buf = Buffer.from(await r.arrayBuffer());
      srcB += buf.length;
      // 기본: WebP. 아주 긴(세로가 매우 큰) 상세 이미지는 WebP 최대치(16383px) 초과로 실패 →
      // 그 경우 JPEG 로 폴백(길이 제한 없음). 저장 확장자/타입도 그에 맞게.
      let out, ctype;
      try {
        out = await sharp(buf).resize({ width: WIDTH, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
        ctype = 'image/webp';
      } catch (e) {
        out = await sharp(buf).resize({ width: WIDTH, withoutEnlargement: true }).jpeg({ quality: 72, mozjpeg: true }).toBuffer();
        ctype = 'image/jpeg';
      }
      outB += out.length;
      const fd = new FormData();
      fd.append('key', path); fd.append('width', String(WIDTH));
      fd.append('contentType', ctype);
      fd.append('file', new Blob([out], { type: ctype }), ctype === 'image/webp' ? 'v.webp' : 'v.jpg');
      const up = await fetch(`${BASE}/api/admin/products/image-variant`, { method: 'POST', headers: auth, body: fd });
      const uj = await up.json();
      if (uj?.success) { done++; if (done % 30 === 0) console.log(`  진행 ${done} (스킵 ${skip})`); }
      else fail++;
    } catch { fail++; }
  }
}

await Promise.all(Array.from({ length: CONC }, worker));
console.log(`[width=${WIDTH}] 생성=${done} 스킵=${skip} 실패=${fail} / 전체 ${keys.length}  경과 ${((Date.now()-start)/1000)|0}s`);
if (done > 0) console.log(`  평균 ${(srcB/done/1024)|0}KB → ${(outB/done/1024)|0}KB`);
const remaining = keys.length - idx + (idx > keys.length ? 0 : 0);
console.log(`  처리위치 idx=${Math.min(idx,keys.length)}/${keys.length} ${idx>=keys.length?'(전량완료)':'(미완 - 재실행 필요)'}`);
