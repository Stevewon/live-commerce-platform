#!/bin/bash
BASE_URL="https://3015-iw573oqulzos23ae750sv-18e660f9.sandbox.novita.ai"

echo "==================================="
echo "🔍 전체 페이지 접근성 테스트"
echo "==================================="
echo ""

# 공개 페이지 테스트
echo "📌 공개 페이지 (로그인 불필요)"
echo "-----------------------------------"

pages=(
  "/:홈페이지"
  "/login:통합 로그인"
  "/register:회원가입"
  "/partner/login:파트너 로그인"
  "/partner/register:파트너 가입"
  "/products:상품 목록"
  "/lives:라이브 방송 목록"
  "/cart:장바구니"
)

for page in "${pages[@]}"; do
  path="${page%%:*}"
  name="${page##*:}"
  status=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}${path}")
  if [ "$status" = "200" ]; then
    echo "✅ ${name} (${path}): ${status}"
  else
    echo "❌ ${name} (${path}): ${status}"
  fi
done

echo ""
echo "📌 관리자 페이지 (admin@example.com)"
echo "-----------------------------------"

admin_pages=(
  "/admin/dashboard:관리자 대시보드"
  "/admin/orders:주문 관리"
  "/admin/products:상품 관리"
  "/admin/partners:파트너 관리"
  "/admin/settlements:정산 관리"
  "/admin/coupons:쿠폰 관리"
)

for page in "${admin_pages[@]}"; do
  path="${page%%:*}"
  name="${page##*:}"
  status=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}${path}")
  if [ "$status" = "200" ]; then
    echo "✅ ${name} (${path}): ${status}"
  else
    echo "❌ ${name} (${path}): ${status}"
  fi
done

echo ""
echo "📌 파트너 페이지 (partner@example.com)"
echo "-----------------------------------"

partner_pages=(
  "/partner/dashboard:파트너 대시보드"
  "/partner/products:상품 관리"
  "/partner/orders:주문 관리"
  "/partner/lives:라이브 관리"
  "/partner/settlements:정산 관리"
)

for page in "${partner_pages[@]}"; do
  path="${page%%:*}"
  name="${page##*:}"
  status=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}${path}")
  if [ "$status" = "200" ]; then
    echo "✅ ${name} (${path}): ${status}"
  else
    echo "❌ ${name} (${path}): ${status}"
  fi
done

echo ""
echo "==================================="
echo "✅ 테스트 완료!"
echo "==================================="
