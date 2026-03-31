#!/bin/bash
# 큐라이브 즉시 배포 스크립트
# 사용법: CLOUDFLARE_API_TOKEN=여기토큰입력 bash quick-deploy.sh

set -e

if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
  echo "❌ CLOUDFLARE_API_TOKEN 필요!"
  echo ""
  echo "토큰 생성 방법:"
  echo "1. https://dash.cloudflare.com/profile/api-tokens 접속"
  echo "2. 'Create Token' 클릭"
  echo "3. 'Edit Cloudflare Workers' 템플릿 선택"
  echo "4. Account Resources → Hbcu00987@gmail.com's Account 선택"
  echo "5. Zone Resources → All Zones 선택"  
  echo "6. 'Continue to summary' → 'Create Token'"
  echo ""
  echo "실행: CLOUDFLARE_API_TOKEN=생성된토큰 bash quick-deploy.sh"
  exit 1
fi

echo "✅ Cloudflare 인증 확인 중..."
export CLOUDFLARE_API_TOKEN
npx wrangler whoami

echo ""
echo "📦 D1 스키마 업데이트 (비회원 주문 컬럼 추가)..."
# 비회원 주문 관련 컬럼 추가 (이미 있으면 무시)
npx wrangler d1 execute qrlive-production --remote --command "ALTER TABLE \"Order\" ADD COLUMN \"guestEmail\" TEXT;" 2>/dev/null || echo "  → guestEmail 이미 존재"
npx wrangler d1 execute qrlive-production --remote --command "ALTER TABLE \"Order\" ADD COLUMN \"guestPhone\" TEXT;" 2>/dev/null || echo "  → guestPhone 이미 존재"
npx wrangler d1 execute qrlive-production --remote --command "ALTER TABLE \"Order\" ADD COLUMN \"guestOrderToken\" TEXT;" 2>/dev/null || echo "  → guestOrderToken 이미 존재"

echo ""
echo "🚀 Cloudflare에 배포 중..."
npx wrangler deploy

echo ""
echo "✅ 배포 완료! https://www.qrlive.io 에서 확인하세요"
echo ""
echo "검증 순서:"
echo "1. https://www.qrlive.io/products → 상품 목록 확인"
echo "2. 아무 상품 '담기' 클릭"
echo "3. 하단 장바구니 탭 → 장바구니 확인"
echo "4. '주문하기' 클릭 → /checkout 이동"
echo "5. 배송정보 입력 → '결제하기' → 토스 결제창"
