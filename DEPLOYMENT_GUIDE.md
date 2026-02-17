# 🚀 배포 가이드

## 📦 GitHub 저장소 생성 및 푸시

### 1단계: GitHub 저장소 생성

1. **GitHub 웹사이트 접속**
   - https://github.com 로그인

2. **새 저장소 생성**
   - 우측 상단 `+` → "New repository" 클릭
   
3. **저장소 설정**
   ```
   Repository name: live-commerce-platform
   Description: 🛍️ 라이브 커머스 분양형 쇼핑몰 플랫폼 | Live Commerce B2B2C Platform
   Visibility: Public (또는 Private)
   ```
   
   ⚠️ **중요**: 다음 옵션들을 **체크 해제**하세요
   - [ ] Add a README file
   - [ ] Add .gitignore
   - [ ] Choose a license

4. **"Create repository" 클릭**

### 2단계: 로컬 저장소 푸시

저장소가 생성되면, 다음 명령어를 실행하세요:

```bash
cd /home/user/webapp/live-commerce-platform

# 리모트 확인 (이미 설정됨)
git remote -v

# GitHub에 푸시
git push -u origin main
```

### 3단계: 푸시 확인

GitHub 저장소 페이지를 새로고침하면 모든 코드가 업로드된 것을 확인할 수 있습니다!

✅ **푸시된 내용:**
- 9개 커밋
- 26개 파일
- 완전한 프로젝트 소스코드
- 문서 (README, PROJECT_REPORT, FINAL_REPORT)

---

## 🚀 Vercel 배포

### 1단계: Vercel 계정 준비

1. **Vercel 웹사이트 접속**
   - https://vercel.com

2. **로그인/가입**
   - GitHub 계정으로 로그인 (권장)
   - 또는 이메일로 가입

### 2단계: 프로젝트 Import

1. **New Project 클릭**
   - Vercel 대시보드에서 "Add New..." → "Project" 클릭

2. **GitHub 저장소 연결**
   - "Import Git Repository" 섹션
   - GitHub 계정 연결 (처음인 경우)
   - `live-commerce-platform` 저장소 선택
   - "Import" 클릭

### 3단계: 프로젝트 설정

#### Framework Preset
```
Framework: Next.js
Build Command: npm run build (자동 감지됨)
Output Directory: .next (자동 감지됨)
Install Command: npm install (자동 감지됨)
```

#### 환경 변수 설정 (중요! ⚠️)

**Environment Variables** 섹션에서 다음 변수들을 추가하세요:

```env
# 필수 환경 변수
NODE_ENV=production

# JWT 시크릿 (⚠️ 반드시 변경하세요)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-64-chars

# 데이터베이스 (⚠️ PostgreSQL로 변경 필요)
DATABASE_URL=postgresql://user:password@host:5432/database

# API URL (자동으로 Vercel URL 사용)
NEXT_PUBLIC_API_URL=https://your-app.vercel.app
```

#### 환경 변수 설명

1. **JWT_SECRET**
   - 랜덤한 64자 이상의 문자열
   - 온라인 생성기 사용: https://randomkeygen.com/
   - 예시: `a9f3k2m5n8p1q4r7s0t3v6w9x2y5z8b1c4e7f0g3h6j9k2l5m8n1o4p7q0r3s6t9u2v5w8x1y4z7`

2. **DATABASE_URL**
   - 개발 환경: SQLite (현재 사용 중)
   - **프로덕션 환경: PostgreSQL 필수!**
   
   추천 서비스:
   - **Neon** (무료): https://neon.tech
   - **Supabase** (무료): https://supabase.com
   - **Railway** (무료): https://railway.app
   
   연결 문자열 형식:
   ```
   postgresql://username:password@host:5432/database?sslmode=require
   ```

3. **NEXT_PUBLIC_API_URL**
   - Vercel이 자동으로 할당하는 URL 사용
   - 커스텀 도메인 연결 시 해당 도메인으로 변경

### 4단계: 데이터베이스 설정 (PostgreSQL)

#### Option 1: Neon (추천)

1. **Neon 가입**
   - https://neon.tech 접속
   - GitHub로 로그인

2. **새 프로젝트 생성**
   - "Create a project" 클릭
   - Project name: `live-commerce-db`
   - Region: Asia Pacific (Tokyo) 선택

3. **연결 문자열 복사**
   - Dashboard에서 "Connection string" 복사
   - 형식: `postgresql://user:password@host/database?sslmode=require`

4. **Vercel에 환경 변수 추가**
   - Vercel 프로젝트 설정 → Environment Variables
   - `DATABASE_URL` 값으로 붙여넣기

5. **데이터베이스 마이그레이션**
   - 로컬에서 실행:
   ```bash
   DATABASE_URL="your-neon-connection-string" npx prisma db push
   ```
   
   - 또는 Vercel 배포 후 자동 실행:
   ```bash
   # package.json에 추가
   "scripts": {
     "build": "prisma generate && prisma db push && next build"
   }
   ```

#### Option 2: Supabase

1. **Supabase 가입**
   - https://supabase.com 접속

2. **새 프로젝트 생성**
   - Database password 설정

3. **연결 문자열 가져오기**
   - Settings → Database → Connection string
   - "URI" 모드 선택하고 복사

4. **Vercel에 적용**
   - 동일하게 `DATABASE_URL` 환경 변수 추가

### 5단계: 배포 시작

1. **Deploy 버튼 클릭**
   - 모든 설정 확인 후 "Deploy" 클릭

2. **배포 진행 상황 확인**
   - 빌드 로그를 실시간으로 확인
   - 약 2-3분 소요

3. **배포 완료!** 🎉
   - Vercel이 자동으로 URL 생성
   - 예시: `https://live-commerce-platform.vercel.app`

### 6단계: 배포 후 확인

1. **웹사이트 접속**
   - Vercel이 제공한 URL로 접속
   - 홈페이지가 정상적으로 표시되는지 확인

2. **테스트 계정으로 로그인**
   - 관리자: `admin@livecommerce.com` / `admin123`
   - 파트너: `partner@example.com` / `partner123`

3. **기능 테스트**
   - 대시보드 접속
   - 제품 목록 확인
   - 주문 목록 확인

### 7단계: 시드 데이터 추가 (선택)

배포 후 테스트 데이터가 필요하다면:

```bash
# 로컬에서 프로덕션 DB에 시드 데이터 추가
DATABASE_URL="your-production-db-url" npx tsx prisma/seed.ts
```

---

## 🌐 커스텀 도메인 연결 (선택)

### 1단계: 도메인 구매

- **추천 도메인 등록 업체**
  - 가비아: https://gabia.com
  - 후이즈: https://whois.co.kr
  - Cloudflare: https://cloudflare.com
  - Namecheap: https://namecheap.com

### 2단계: Vercel에 도메인 추가

1. **Vercel 프로젝트 설정**
   - Settings → Domains

2. **도메인 입력**
   - 예시: `livecommerce.shop`
   - "Add" 클릭

3. **DNS 레코드 설정**
   - Vercel이 제공하는 값으로 DNS 레코드 추가
   - Type: `A` / Value: `76.76.21.21`
   - Type: `CNAME` / Value: `cname.vercel-dns.com`

4. **SSL 인증서 자동 발급**
   - 약 10-30분 소요
   - Let's Encrypt 무료 SSL

### 3단계: 환경 변수 업데이트

```env
NEXT_PUBLIC_API_URL=https://your-custom-domain.com
```

---

## 🔄 자동 배포 설정 (CI/CD)

Vercel은 자동으로 CI/CD를 설정합니다:

### Git 브랜치별 배포

- **main 브랜치**: 프로덕션 배포
  - 푸시할 때마다 자동 배포
  - URL: `https://your-app.vercel.app`

- **다른 브랜치**: 프리뷰 배포
  - PR 생성 시 자동 프리뷰 생성
  - URL: `https://your-app-git-branch.vercel.app`

### 배포 알림

- GitHub PR에 자동으로 배포 URL 코멘트
- Slack/Discord 연동 가능

---

## 📊 배포 후 모니터링

### Vercel Analytics (무료)

1. **Vercel 대시보드**
   - Analytics 탭 클릭

2. **확인 가능한 지표**
   - 페이지 뷰
   - 고유 방문자
   - 페이지 로드 시간
   - 지역별 통계

### 에러 모니터링

- Vercel Logs에서 실시간 에러 확인
- Runtime Logs 섹션

---

## ⚠️ 중요 체크리스트

배포 전 반드시 확인하세요:

- [ ] JWT_SECRET 변경 (64자 이상)
- [ ] DATABASE_URL을 PostgreSQL로 변경
- [ ] 환경 변수 모두 설정
- [ ] .env 파일이 .gitignore에 포함되어 있는지 확인
- [ ] 시드 데이터 준비 (선택)

배포 후 확인:

- [ ] 홈페이지 정상 작동
- [ ] 로그인 기능 작동
- [ ] 대시보드 접속 가능
- [ ] API 응답 정상
- [ ] 이미지 로드 정상

---

## 🐛 트러블슈팅

### 문제 1: 빌드 실패
```
Error: Cannot find module 'xyz'
```
**해결**: `npm install` 후 다시 푸시

### 문제 2: 데이터베이스 연결 실패
```
Error: Can't reach database server
```
**해결**: 
1. DATABASE_URL 확인
2. PostgreSQL 서버 실행 확인
3. 방화벽 설정 확인

### 문제 3: 환경 변수 인식 안 됨
**해결**:
1. Vercel 대시보드 → Settings → Environment Variables 확인
2. "Production", "Preview", "Development" 모두 체크
3. 재배포 (Deployments → ... → Redeploy)

---

## 📞 도움말

- **Vercel 문서**: https://vercel.com/docs
- **Next.js 배포**: https://nextjs.org/docs/deployment
- **Prisma 프로덕션**: https://www.prisma.io/docs/guides/deployment

---

**축하합니다! 🎉**

이제 전 세계 어디서나 접속 가능한 라이브 커머스 플랫폼을 운영하고 계십니다!
