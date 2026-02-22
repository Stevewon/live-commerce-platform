# ⚡ Railway Quick Deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

## 원클릭 배포

Railway 배포 버튼을 클릭하여 즉시 배포하세요!

## 배포 후 설정

### 1. 환경 변수 설정 (필수)

Railway 대시보드 → 프로젝트 → Variables에서 다음 환경 변수 추가:

```env
# JWT & NextAuth
JWT_SECRET=your-strong-secret-key
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=${{ RAILWAY_PUBLIC_DOMAIN }}

# Email (Gmail SMTP) - 선택사항
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password

# Google OAuth - 선택사항
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Kakao OAuth - 선택사항
KAKAO_CLIENT_ID=your-kakao-client-id
```

### 2. 시드 데이터 삽입

배포 완료 후 테스트 계정 생성:

```bash
# Railway CLI 설치
npm install -g @railway/cli

# 로그인 및 프로젝트 연결
railway login
railway link

# 시드 데이터 삽입
railway run npm run seed
```

### 3. 테스트 계정

```
관리자: admin@example.com / admin123
파트너: partner@example.com / partner123
고객: test2@example.com / test123
```

### 4. OAuth Redirect URI 업데이트

**Google OAuth:**
https://console.cloud.google.com/
→ OAuth 클라이언트 ID → Redirect URI 추가:
```
https://your-railway-domain.up.railway.app/api/auth/callback/google
```

**Kakao OAuth:**
https://developers.kakao.com/
→ Kakao 로그인 → Redirect URI 추가:
```
https://your-railway-domain.up.railway.app/api/auth/callback/kakao
```

---

## 자세한 배포 가이드

📖 [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md)

---

## 기능

- ✅ 완전한 라이브 커머스 플랫폼
- ✅ PostgreSQL 데이터베이스 (자동 프로비저닝)
- ✅ 관리자 / 파트너 / 고객 대시보드
- ✅ 주문 관리 시스템
- ✅ 쿠폰 관리 시스템
- ✅ 이메일 알림 (Gmail SMTP)
- ✅ 소셜 로그인 (Google, Kakao)
- ✅ 실시간 라이브 방송 관리
- ✅ 정산 시스템
- ✅ 상품 관리
- ✅ 장바구니 & 위시리스트

---

## 라이센스

ISC License

## 작성자

Stevewon
