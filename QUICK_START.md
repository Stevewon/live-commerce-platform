# 🚀 빠른 시작 가이드

**백업 파일**: `live-commerce-platform-backup-20260221-120820.tar.gz`

---

## ⚡ 5분 안에 시작하기

### 1️⃣ 압축 해제 (10초)
```bash
tar -xzf live-commerce-platform-backup-20260221-120820.tar.gz
cd live-commerce-platform
```

### 2️⃣ 의존성 설치 (1~2분)
```bash
npm install
```

### 3️⃣ 환경변수 설정 (30초)
```bash
cp .env.example .env
```

**`.env` 파일 편집** (최소 설정):
```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-super-secret-jwt-key-min-32-characters-long"
NEXT_PUBLIC_TOSS_CLIENT_KEY="test_ck_..."
TOSS_SECRET_KEY="test_sk_..."
```

### 4️⃣ 데이터베이스 초기화 (30초)
```bash
npx prisma generate
npx prisma db push
npx prisma db seed  # 선택사항: 테스트 데이터 생성
```

### 5️⃣ 서버 실행 (10초)
```bash
npm run dev
```

**접속**: http://localhost:3000

---

## 🎯 테스트 계정

### 관리자
- URL: http://localhost:3000/admin/dashboard
- 이메일: `admin@example.com`
- 비밀번호: `admin123`

### 파트너
- URL: http://localhost:3000/partner/dashboard
- 이메일: `partner@example.com`
- 비밀번호: `partner123`

### 고객
- URL: http://localhost:3000/products
- 이메일: `test2@example.com`
- 비밀번호: `test123`

---

## 🔧 고급 설정 (선택사항)

### Socket.io 서버 (실시간 기능)
```bash
# 별도 터미널에서 실행
PORT=3015 npm run dev
```

### 소셜 로그인 활성화
1. Google Cloud Console에서 OAuth 2.0 클라이언트 ID 발급
2. Kakao Developers에서 앱 등록 및 REST API 키 발급
3. `.env` 파일에 추가:
```env
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
KAKAO_CLIENT_ID="your-kakao-rest-api-key"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret"
```

### 이메일 알림 활성화
```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-gmail-app-password"
```

---

## 📦 프로덕션 배포 (Railway)

### 1️⃣ Railway 프로젝트 생성
```bash
npm install -g @railway/cli
railway login
railway init
```

### 2️⃣ PostgreSQL 추가
Railway 대시보드에서 "New" → "Database" → "PostgreSQL"

### 3️⃣ 환경변수 설정
```bash
railway variables set DATABASE_URL="postgresql://..."
railway variables set JWT_SECRET="your-secret"
railway variables set NEXT_PUBLIC_TOSS_CLIENT_KEY="test_ck_..."
railway variables set TOSS_SECRET_KEY="test_sk_..."
railway variables set NODE_ENV="production"
```

### 4️⃣ 마이그레이션 및 배포
```bash
railway run bash scripts/migrate-postgres.sh
railway up
```

**상세 가이드**: `DEPLOYMENT.md` 참조

---

## 🐛 문제 해결

### 데이터베이스 연결 오류
```bash
# Prisma 클라이언트 재생성
npx prisma generate

# 스키마 재동기화
npx prisma db push --force-reset
```

### 포트 충돌
```bash
# 다른 포트 사용
PORT=3001 npm run dev
```

### 빌드 오류
```bash
# 캐시 삭제 후 재빌드
rm -rf .next node_modules package-lock.json
npm install
npm run build
```

---

## 📚 추가 문서

- `README.md` - 프로젝트 개요
- `DEPLOYMENT.md` - 배포 가이드
- `SOCIAL_EMAIL_GUIDE.md` - 소셜 로그인 & 이메일 설정
- `PRODUCTION_CHECKLIST.md` - 프로덕션 체크리스트
- `BACKUP_SUMMARY_20260221.md` - 백업 상세 정보

---

## 🎉 완료!

이제 라이브 커머스 플랫폼이 실행 중입니다!

- **고객 페이지**: http://localhost:3000/products
- **파트너 대시보드**: http://localhost:3000/partner/dashboard
- **관리자 패널**: http://localhost:3000/admin/dashboard

**Happy Coding! 🚀**
