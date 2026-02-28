#!/bin/bash

echo "========================================="
echo "QRLIVE 상품 등록 테스트"
echo "========================================="
echo ""

# 1. 관리자 로그인
echo "1. 관리자 로그인 중..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@qrlive.io",
    "password": "admin123"
  }')

# 토큰 추출
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ 로그인 실패!"
  echo "응답: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ 로그인 성공!"
echo ""

# 2. 카테고리 목록 조회
echo "2. 카테고리 목록 조회 중..."
CATEGORIES=$(curl -s http://localhost:3000/api/categories)

# 첫 번째 카테고리 ID 추출
CATEGORY_ID=$(echo $CATEGORIES | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
CATEGORY_NAME=$(echo $CATEGORIES | grep -o '"name":"[^"]*' | head -1 | cut -d'"' -f4)
echo "✅ 사용할 카테고리: $CATEGORY_NAME ($CATEGORY_ID)"
echo ""

# 3. 테스트 상품 등록 (Authorization Bearer 사용)
echo "3. 테스트 상품 등록 중..."
PRODUCT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/admin/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"name\": \"큐라이브 테스트 상품\",
    \"description\": \"QR 코드를 통해 실시간으로 구매 가능한 테스트 상품입니다.\",
    \"price\": 29900,
    \"stock\": 100,
    \"categoryId\": \"$CATEGORY_ID\",
    \"isActive\": true,
    \"imageUrl\": \"https://via.placeholder.com/800x800.png?text=QRLIVE+Test+Product\"
  }")

echo "응답: $PRODUCT_RESPONSE"
echo ""

# 4. 결과 확인
if echo "$PRODUCT_RESPONSE" | grep -q '"success":true'; then
  PRODUCT_ID=$(echo $PRODUCT_RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)
  PRODUCT_NAME=$(echo $PRODUCT_RESPONSE | grep -o '"name":"[^"]*' | cut -d'"' -f4)
  echo "========================================="
  echo "✅ 상품 등록 테스트 성공!"
  echo "========================================="
  echo "상품 ID: $PRODUCT_ID"
  echo "상품명: $PRODUCT_NAME"
  echo ""
  echo "관리자 페이지에서 확인:"
  echo "https://qrlive.io/admin/products"
else
  echo "========================================="
  echo "❌ 상품 등록 실패!"
  echo "========================================="
  exit 1
fi

echo ""
echo "✅ 전체 테스트 완료!"
