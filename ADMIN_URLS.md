# 관리자 페이지 URL 목록

## 🔐 인증
- **관리자 로그인**: `/admin/login`

## 📊 대시보드
- **메인 대시보드**: `/admin` 또는 `/admin/dashboard`

## 👥 사용자 관리
- **사용자 목록**: `/admin/users`

## 🤝 파트너 관리
- **파트너 목록**: `/admin/partners`

## 📦 상품 관리
- **상품 목록**: `/admin/products`

## 🛒 주문 관리
- **주문 목록**: `/admin/orders`

## 💰 정산 관리
- **정산 내역**: `/admin/settlements`

## 🎟️ 쿠폰 관리
- **쿠폰 목록**: `/admin/coupons`

---

## 📍 전체 URL 리스트:

```
/admin
/admin/login
/admin/dashboard
/admin/users
/admin/partners
/admin/products
/admin/orders
/admin/settlements
/admin/coupons
```

## 🌐 프로덕션 URL (Cloudflare Workers):

배포 완료 후 다음 형식으로 접근:
```
https://qrlive.io/admin
https://qrlive.io/admin/login
https://qrlive.io/admin/dashboard
등등...
```

## 🔑 접근 권한:

모든 `/admin/*` 페이지는 **ADMIN 역할**을 가진 사용자만 접근 가능합니다.

