# v1.0.22 잔액 결제 — D1 마이그레이션 & 배포 가이드

> ⚠️ 이 저장소에 push 하는 GitHub App 토큰에는 `workflows` 권한이 없어
> `.github/workflows/deploy-worker.yml` 을 자동 커밋할 수 없습니다.
> 아래 스텝은 **사장님(권한 보유자)** 이 직접 워크플로에 추가하거나, 로컬에서 수동 실행하셔야 합니다.

## 마이그레이션 파일
| 파일 | 내용 | 멱등성 |
|------|------|--------|
| `scripts/v1_0_22_add_balance_columns.sql` | `User.krwBalance`, `User.qkeyBalance` 컬럼 추가 | ❌ **최초 1회만** (재실행 시 duplicate column 에러) |
| `scripts/v1_0_22_balance_migration.sql` | BalanceRequest / BalanceLedger 테이블·인덱스, 기존 KISPG PENDING 주문 auto-cancel | ✅ 여러 번 실행 안전 |

## 옵션 A (권장) — 배포 워크플로 자동화
`.github/workflows/deploy-worker.yml` 의 **"Show versions"** 스텝과 **"Deploy to Cloudflare Workers"** 스텝 사이에 아래를 삽입:

```yaml
      - name: D1 migrate - add balance columns (tolerate duplicate)
        continue-on-error: true
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        run: npx wrangler d1 execute qrlive-production --remote --file=scripts/v1_0_22_add_balance_columns.sql

      - name: D1 migrate - balance tables & order cleanup (idempotent)
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        run: npx wrangler d1 execute qrlive-production --remote --file=scripts/v1_0_22_balance_migration.sql
```

- `continue-on-error: true` 덕분에 컬럼이 이미 있어도(2번째 배포부터) 실패 없이 진행됩니다.
- 그 후 PR #94 를 `main` 에 병합하면 GitHub Actions 가 **마이그레이션 → 배포**를 자동 수행합니다.

## 옵션 B — 로컬 수동 마이그레이션 (Cloudflare 로그인 되어 있는 PC)
```bash
# 1) 잔액 컬럼 추가 (최초 1회만)
npx wrangler d1 execute qrlive-production --remote --file=scripts/v1_0_22_add_balance_columns.sql

# 2) 테이블/인덱스/주문정리 (여러 번 안전)
npx wrangler d1 execute qrlive-production --remote --file=scripts/v1_0_22_balance_migration.sql
```
그 후 PR #94 병합 → 기존 deploy 워크플로가 배포 수행.

## 마이그레이션 완료 확인
```bash
npx wrangler d1 execute qrlive-production --remote --command \
  'SELECT COUNT(*) AS users, SUM("krwBalance") AS krw, SUM("qkeyBalance") AS qkey FROM "User";'
npx wrangler d1 execute qrlive-production --remote --command \
  'SELECT COUNT(*) AS cancelled FROM "Order" WHERE "paymentMethod" LIKE "%v1.0.22 auto-cancel%";'
```
