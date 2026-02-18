# Vercel 배포 가이드

## ✅ GitHub 푸시 완료!

**저장소 URL**: https://github.com/Stevewon/live-commerce-platform

모든 코드가 성공적으로 GitHub에 푸시되었습니다! (11개 커밋, 29개 파일)

---

## 🚀 Vercel 배포 단계별 가이드

### 1단계: Vercel 로그인

1. https://vercel.com 접속
2. **GitHub 계정**으로 로그인
3. GitHub 연동 승인

### 2단계: 새 프로젝트 생성

1. Vercel 대시보드에서 **"New Project"** 클릭
2. **"Import Git Repository"** 선택
3. GitHub에서 **"Stevewon/live-commerce-platform"** 선택
4. **"Import"** 클릭

### 3단계: 프로젝트 설정

#### Framework Preset
- 자동으로 **Next.js** 감지됨 ✅
- Build Command: `next build` (자동)
- Output Directory: `.next` (자동)
- Install Command: `npm install` (자동)

#### Root Directory
- **그대로 두기** (root에서 배포)

### 4단계: 환경 변수 설정 (중요!)

**Environment Variables** 섹션에서 다음 3개 변수 추가:

#### 1. `NODE_ENV`
```
NODE_ENV=production
```

#### 2. `JWT_SECRET` (강력한 랜덤 문자열, 64자 이상 권장)
```bash
# 터미널에서 생성:
openssl rand -base64 48
# 또는
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

예시:
```
JWT_SECRET=Xk9pL2mN4qR7sT8vW1yZ3aB5cD6eF7gH9iJ0kL1mN2oP3qR4sT5uV6wX7yZ8aB9cD0e
```

#### 3. `DATABASE_URL` (PostgreSQL 데이터베이스 URL)

**옵션 A: Neon (추천, 무료)**
1. https://neon.tech 접속
2. 무료 계정 생성
3. 새 프로젝트 생성
4. Connection String 복사
```
DATABASE_URL=postgresql://user:password@ep-xxx.neon.tech/dbname?sslmode=require
```

**옵션 B: Supabase (무료)**
1. https://supabase.com 접속
2. 새 프로젝트 생성
3. Settings → Database → Connection String 복사
```
DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres
```

**옵션 C: Railway (무료 5$/월)**
1. https://railway.app 접속
2. PostgreSQL 플러그인 추가
3. DATABASE_URL 복사

### 5단계: 배포 시작

1. 모든 환경 변수 입력 확인 ✅
2. **"Deploy"** 버튼 클릭
3. 배포 진행 상황 확인 (약 2-3분 소요)

### 6단계: 데이터베이스 초기화

배포가 완료되면 **첫 배포 후 1회만** 실행:

```bash
# 로컬에서 프로덕션 DB에 스키마 적용
DATABASE_URL="postgresql://..." npx prisma db push

# 초기 데이터 삽입 (관리자 계정, 테스트 데이터)
DATABASE_URL="postgresql://..." npx tsx prisma/seed.ts
```

또는 Vercel 대시보드에서:
1. **Settings** → **Domains** → 배포된 URL 복사
2. **Project** → **Functions** → 터미널에서:
```bash
vercel env pull .env.production
npm run db:push
npm run seed
```

---

## 🎉 배포 완료!

### 배포된 URL 확인
- Vercel 대시보드에서 **"Visit"** 클릭
- 예시: `https://live-commerce-platform.vercel.app`

### 테스트 계정으로 확인

#### 관리자 계정
- URL: `https://your-domain.vercel.app/admin/login`
- 이메일: `admin@livecommerce.com`
- 비밀번호: `admin123`

#### 파트너 계정
- URL: `https://your-domain.vercel.app/partner/login`
- 이메일: `partner@example.com`
- 비밀번호: `partner123`

---

## 📊 배포 후 체크리스트

- [ ] 홈페이지 정상 작동 확인
- [ ] 관리자 로그인 테스트
- [ ] 관리자 대시보드 데이터 확인
- [ ] 파트너 로그인 테스트
- [ ] 파트너 회원가입 테스트
- [ ] 제품 관리 기능 테스트
- [ ] 주문 관리 기능 테스트
- [ ] 모바일 반응형 확인

---

## 🔧 Vercel CLI로 배포하기 (대안)

터미널에서 직접 배포하려면:

```bash
# Vercel CLI 설치
npm install -g vercel

# Vercel 로그인
vercel login

# 프로젝트 디렉토리에서
cd /home/user/webapp/live-commerce-platform

# 배포
vercel

# 프로덕션 배포
vercel --prod
```

---

## 🐛 트러블슈팅

### 문제 1: 빌드 실패 (Module not found)
```bash
# 해결: package.json 의존성 확인
npm install
```

### 문제 2: 환경 변수 에러
```bash
# 해결: Vercel 대시보드 → Settings → Environment Variables 확인
# 모든 환경 변수가 올바르게 입력되었는지 확인
```

### 문제 3: 데이터베이스 연결 에러
```bash
# 해결: DATABASE_URL 형식 확인
# PostgreSQL URL 형식: postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
```

### 문제 4: Prisma 스키마 에러
```bash
# 해결: 배포 후 DB 초기화
DATABASE_URL="..." npx prisma db push
DATABASE_URL="..." npx tsx prisma/seed.ts
```

---

## 📱 커스텀 도메인 연결 (선택사항)

1. Vercel 대시보드 → **Settings** → **Domains**
2. **Add Domain** 클릭
3. 도메인 입력 (예: `livecommerce.shop`)
4. DNS 설정 가이드 따라하기
5. SSL 인증서 자동 발급 ✅

---

## 🔄 자동 배포 설정

Vercel은 **자동으로** GitHub와 연동되어 있습니다:

- `main` 브랜치에 푸시 → **자동 프로덕션 배포**
- 다른 브랜치에 푸시 → **자동 프리뷰 배포**
- Pull Request 생성 → **자동 프리뷰 URL 생성**

---

## 📈 다음 단계

배포가 완료되면 다음 기능을 추가할 수 있습니다:

### Phase 2: 정산 시스템
- 파트너 정산 요청
- 관리자 정산 승인
- 정산 내역 조회

### Phase 3: 멀티 테넌트 쇼핑몰
- 파트너별 독립 쇼핑몰 URL
- 커스텀 테마 설정
- 파트너 브랜딩

### Phase 4: 결제 시스템
- 토스페이먼츠 연동
- 아임포트 연동
- 실시간 결제 알림

### Phase 5: 라이브 스트림 연동
- YouTube Live API
- 아프리카TV API
- TikTok Live API

---

## 📞 지원

문제가 발생하면:
1. Vercel 대시보드 → **Logs** 확인
2. GitHub Issues 생성
3. Vercel 커뮤니티 문의

---

**배포 성공을 기원합니다! 🚀**
