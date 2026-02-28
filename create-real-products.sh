#!/bin/bash

echo "========================================="
echo "QRLIVE 실제 상품 등록"
echo "========================================="
echo ""

# 관리자 로그인
echo "1. 관리자 로그인 중..."
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@qrlive.io","password":"admin123"}' \
  | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ 로그인 실패!"
  exit 1
fi
echo "✅ 로그인 성공!"
echo ""

# 카테고리 조회
echo "2. 카테고리 조회 중..."
CATEGORIES=$(curl -s http://localhost:3000/api/categories)
ELECTRONICS_ID=$(echo $CATEGORIES | grep -o '"slug":"electronics"[^}]*"id":"[^"]*' | grep -o '"id":"[^"]*' | cut -d'"' -f4)
BEAUTY_ID=$(echo $CATEGORIES | grep -o '"slug":"beauty"[^}]*"id":"[^"]*' | grep -o '"id":"[^"]*' | cut -d'"' -f4)
FASHION_ID=$(echo $CATEGORIES | grep -o '"slug":"fashion"[^}]*"id":"[^"]*' | grep -o '"id":"[^"]*' | cut -d'"' -f4)

echo "✅ 카테고리 ID 확인 완료"
echo ""

# 상품 1: 갤럭시 S24 Ultra
echo "3. 상품 등록 중..."
echo "   [1/5] 갤럭시 S24 Ultra..."
PRODUCT1=$(curl -s -X POST http://localhost:3000/api/admin/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"name\": \"갤럭시 S24 Ultra 자급제\",
    \"description\": \"최신 AI 기능이 탑재된 프리미엄 스마트폰. 200MP 카메라, S펜 지원, 5000mAh 배터리\",
    \"price\": 1398000,
    \"comparePrice\": 1698000,
    \"stock\": 50,
    \"categoryId\": \"$ELECTRONICS_ID\",
    \"isActive\": true,
    \"isFeatured\": true,
    \"imageUrl\": \"https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=800\",
    \"specifications\": \"{\\\"디스플레이\\\":\\\"6.8인치 QHD+\\\",\\\"RAM\\\":\\\"12GB\\\",\\\"저장공간\\\":\\\"256GB\\\",\\\"배터리\\\":\\\"5000mAh\\\"}\",
    \"shippingInfo\": \"무료배송 (영업일 기준 1-2일 소요)\",
    \"returnInfo\": \"단순변심 시 7일 이내 반품 가능\"
  }")

# 상품 2: 에어팟 프로 2세대
echo "   [2/5] 에어팟 프로 2세대..."
PRODUCT2=$(curl -s -X POST http://localhost:3000/api/admin/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"name\": \"에어팟 프로 2세대 (USB-C)\",
    \"description\": \"적응형 오디오와 투명 모드, 능동형 소음 차단 기능이 강화된 프리미엄 무선 이어폰\",
    \"price\": 359000,
    \"comparePrice\": 399000,
    \"stock\": 100,
    \"categoryId\": \"$ELECTRONICS_ID\",
    \"isActive\": true,
    \"isFeatured\": true,
    \"imageUrl\": \"https://images.unsplash.com/photo-1606841837239-c5a1a4a07af7?w=800\",
    \"shippingInfo\": \"무료배송 (당일배송 가능)\",
    \"returnInfo\": \"7일 이내 교환/반품 가능\"
  }")

# 상품 3: 다이슨 에어랩
echo "   [3/5] 다이슨 에어랩..."
PRODUCT3=$(curl -s -X POST http://localhost:3000/api/admin/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"name\": \"다이슨 에어랩 멀티스타일러 컴플리트\",
    \"description\": \"손상 없는 스타일링, 6가지 어태치먼트 포함. 컬링, 웨이브, 드라이 모두 가능\",
    \"price\": 699000,
    \"comparePrice\": 799000,
    \"stock\": 30,
    \"categoryId\": \"$BEAUTY_ID\",
    \"isActive\": true,
    \"isFeatured\": true,
    \"imageUrl\": \"https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=800\",
    \"shippingInfo\": \"무료배송\",
    \"returnInfo\": \"개봉 후 7일 이내 단순변심 반품 불가\"
  }")

# 상품 4: 샤넬 가브리엘 향수
echo "   [4/5] 샤넬 가브리엘 향수..."
PRODUCT4=$(curl -s -X POST http://localhost:3000/api/admin/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"name\": \"샤넬 가브리엘 오드퍼퓸 50ml\",
    \"description\": \"우아하고 관능적인 플로럴 향수. 자스민, 일랑일랑, 오렌지 블라썸, 그라스 튜베로즈의 조화\",
    \"price\": 185000,
    \"comparePrice\": 210000,
    \"stock\": 80,
    \"categoryId\": \"$BEAUTY_ID\",
    \"isActive\": true,
    \"imageUrl\": \"https://images.unsplash.com/photo-1541643600914-78b084683601?w=800\",
    \"shippingInfo\": \"무료배송\",
    \"returnInfo\": \"향수 특성상 개봉 후 교환/반품 불가\"
  }")

# 상품 5: 나이키 에어포스
echo "   [5/5] 나이키 에어포스..."
PRODUCT5=$(curl -s -X POST http://localhost:3000/api/admin/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"name\": \"나이키 에어포스 1 '07 화이트\",
    \"description\": \"클래식한 디자인의 아이코닉 스니커즈. 깔끔한 화이트 컬러로 어떤 스타일에도 매치 가능\",
    \"price\": 139000,
    \"comparePrice\": 159000,
    \"stock\": 120,
    \"categoryId\": \"$FASHION_ID\",
    \"isActive\": true,
    \"isFeatured\": true,
    \"imageUrl\": \"https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800\",
    \"specifications\": \"{\\\"사이즈\\\":\\\"230-290mm\\\",\\\"소재\\\":\\\"천연가죽+합성섬유\\\"}\",
    \"shippingInfo\": \"무료배송 (영업일 기준 2-3일)\",
    \"returnInfo\": \"착용 전 7일 이내 교환 가능\"
  }")

echo ""
echo "========================================="
echo "✅ 5개 상품 등록 완료!"
echo "========================================="
echo ""
echo "등록된 상품:"
echo "1. 갤럭시 S24 Ultra (전자제품) - ₩1,398,000"
echo "2. 에어팟 프로 2세대 (전자제품) - ₩359,000"
echo "3. 다이슨 에어랩 (뷰티) - ₩699,000"
echo "4. 샤넬 가브리엘 향수 (뷰티) - ₩185,000"
echo "5. 나이키 에어포스 (패션) - ₩139,000"
echo ""
echo "관리자 페이지: https://qrlive.io/admin/products"
echo "쇼핑몰 페이지: https://qrlive.io/products"
