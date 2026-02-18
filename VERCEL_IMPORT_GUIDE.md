# Vercel Import 가이드

## 🎯 현재 단계: Import Git Repository

### 방법 1: GitHub 저장소 URL 직접 입력 (추천)

1. 화면 상단의 입력창에 다음 URL 입력:
   ```
   https://github.com/Stevewon/live-commerce-platform
   ```

2. **"Continue"** 버튼 클릭

3. GitHub 로그인 요청이 나오면 로그인

4. Vercel이 저장소에 접근할 수 있도록 권한 승인

---

### 방법 2: GitHub 앱 설치

1. **"Install"** 버튼 클릭

2. GitHub 페이지로 이동

3. 권한 부여 화면에서:
   - **All repositories** 선택 (또는)
   - **Only select repositories** → `live-commerce-platform` 선택

4. **"Install & Authorize"** 클릭

5. Vercel로 돌아오면 저장소 목록에서 `live-commerce-platform` 선택

---

## 📋 다음 단계: 프로젝트 설정

Import가 완료되면 다음 설정 화면이 나타납니다:

### 1. Framework Preset
- 자동 감지됨: **Next.js** ✅

### 2. Root Directory
- 그대로 두기: `./` ✅

### 3. Build Settings
- Build Command: `next build` (자동)
- Output Directory: `.next` (자동)
- Install Command: `npm install` (자동)

### 4. Environment Variables (중요!)

**반드시 추가해야 할 환경 변수 3개:**

#### ① NODE_ENV
```
NODE_ENV=production
```

#### ② JWT_SECRET
```
JWT_SECRET=lw4buq77eUOpDghfC2UiIOP8xSAeocdmMSQRIp0yKTdHinsLywXD6BH2/4TDDeiP
```

#### ③ DATABASE_URL

**옵션 A: Vercel Postgres (가장 쉬움)**
- 일단 환경 변수 없이 배포
- 배포 후 Storage 탭에서 Postgres 생성
- 자동으로 DATABASE_URL 연결됨

**옵션 B: Neon (무료)**
1. https://neon.tech 접속
2. 새 프로젝트 생성
3. Connection String 복사
```
DATABASE_URL=postgresql://user:password@ep-xxx.neon.tech/dbname?sslmode=require
```

**옵션 C: Supabase (무료)**
1. https://supabase.com 접속
2. 새 프로젝트 생성
3. Settings → Database → Connection String 복사
```
DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres
```

---

## 🎯 환경 변수 입력 방법

1. **Environment Variables** 섹션 확장

2. 각 변수마다:
   - **Name** 입력 (예: `NODE_ENV`)
   - **Value** 입력 (예: `production`)
   - **Add** 버튼 클릭

3. 3개 변수 모두 추가 완료 확인

4. **"Deploy"** 버튼 클릭!

---

## ⏱️ 배포 시간

- 초기 빌드: 약 2-3분
- 상태 확인: 실시간 로그 제공
- 완료 후: 자동으로 URL 생성

---

## 🎉 배포 완료 후

### 1. 배포 URL 확인
예시: `https://live-commerce-platform-xxx.vercel.app`

### 2. 데이터베이스 초기화

**Vercel Postgres 사용 시:**
1. 프로젝트 대시보드 → **Storage** 탭
2. Postgres 데이터베이스 클릭
3. **"Query"** 탭에서 SQL 실행 가능

또는 로컬에서:
```bash
# 환경 변수 설정
export DATABASE_URL="postgresql://..."

# 스키마 적용
npx prisma db push

# 시드 데이터 삽입
npx tsx prisma/seed.ts
```

### 3. 테스트 계정으로 로그인

#### 관리자
- URL: `https://your-domain.vercel.app/admin/login`
- 이메일: `admin@livecommerce.com`
- 비밀번호: `admin123`

#### 파트너
- URL: `https://your-domain.vercel.app/partner/login`
- 이메일: `partner@example.com`
- 비밀번호: `partner123`

---

## 🐛 문제 해결

### 빌드 실패
- 로그 확인
- 환경 변수 재확인
- `package.json` 의존성 확인

### 데이터베이스 연결 실패
- `DATABASE_URL` 형식 확인
- PostgreSQL URL 형식: `postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require`
- SSL 모드 필수: `?sslmode=require`

### 페이지 404 에러
- 데이터베이스 초기화 확인
- Prisma 스키마 적용 확인

---

## 📞 도움이 필요하신가요?

- Vercel 문서: https://vercel.com/docs
- Prisma 문서: https://www.prisma.io/docs
- Next.js 문서: https://nextjs.org/docs

---

**성공적인 배포를 기원합니다! 🚀**
