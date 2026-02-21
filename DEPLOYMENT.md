# 🚀 프로덕션 배포 가이드 - Railway

## 📋 목차
1. [사전 준비](#사전-준비)
2. [Railway 배포](#railway-배포)
3. [데이터베이스 마이그레이션](#데이터베이스-마이그레이션)
4. [환경 변수 설정](#환경-변수-설정)
5. [배포 확인](#배포-확인)
6. [커스텀 도메인 설정](#커스텀-도메인-설정)
7. [문제 해결](#문제-해결)

---

## 📝 사전 준비

### 1. 필요한 계정 및 도구
- ✅ [Railway](https://railway.app) 계정 (GitHub 연동 권장)
- ✅ [토스페이먼츠](https://developers.tosspayments.com) 실제 API 키
- ✅ Git 설치 및 GitHub 저장소 연결
- ✅ Railway CLI (선택사항, 마이그레이션 시 필요)

### 2. 로컬 빌드 테스트
배포 전에 로컬에서 프로덕션 빌드가 정상 작동하는지 확인:

```bash
# 프로덕션 빌드 테스트
npm run build

# 빌드 결과 실행 (선택사항)
npm start
```

---

## 🚂 Railway 배포

### Step 1: Railway 프로젝트 생성

1. **Railway 접속**
   - https://railway.app 방문
   - "Start a New Project" 클릭

2. **GitHub 연동 배포**
   - "Deploy from GitHub repo" 선택
   - 저장소 `Stevewon/live-commerce-platform` 선택
   - Railway가 자동으로 `railway.json` 설정 인식

3. **자동 배포 시작**
   - Railway가 자동으로 빌드 시작
   - 첫 배포는 **환경변수 미설정으로 실패** (정상)

### Step 2: PostgreSQL 데이터베이스 추가

1. **데이터베이스 플러그인 추가**
   - 프로젝트 대시보드에서 "New" 클릭
   - "Database" → "Add PostgreSQL" 선택

2. **자동 생성 확인**
   - `DATABASE_URL` 환경변수 자동 생성됨
   - 서비스 재시작 필요 (자동 트리거)

---

## 🔐 환경 변수 설정

### Step 3: 필수 환경변수 설정

프로젝트 Settings → Variables 메뉴에서 다음 변수 추가:

#### 1️⃣ 데이터베이스 (자동 생성)
```bash
DATABASE_URL=postgresql://...  # PostgreSQL 플러그인이 자동 생성
```

#### 2️⃣ JWT 시크릿 키 (필수)
```bash
# 강력한 랜덤 문자열 생성
# 터미널에서 실행: openssl rand -hex 32
JWT_SECRET=your-generated-32-character-secret-key-here
```

#### 3️⃣ 토스페이먼츠 API (필수)
```bash
# 개발 키에서 실제 키로 변경
NEXT_PUBLIC_TOSS_CLIENT_KEY=live_ck_실제클라이언트키
TOSS_SECRET_KEY=live_sk_실제시크릿키
```

#### 4️⃣ Node 환경 (필수)
```bash
NODE_ENV=production
```

#### 5️⃣ 애플리케이션 URL (필수)
```bash
# Railway 생성 URL 사용 (Settings → Domains에서 확인)
NEXT_PUBLIC_APP_URL=https://your-app.railway.app

# 또는 커스텀 도메인
# NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

#### 6️⃣ 포트 (자동 설정)
```bash
PORT=${{RAILWAY_PORT}}  # Railway가 자동으로 설정
```

### 환경변수 설정 완료 후
- "Deploy" 버튼 클릭하여 재배포
- 또는 자동 재배포 대기 (약 1-2분)

---

## 🗄️ 데이터베이스 마이그레이션

### Step 4: Prisma 스키마 동기화

배포가 완료되면 데이터베이스에 테이블을 생성해야 합니다.

#### 방법 1: Railway CLI 사용 (권장)

```bash
# 1. Railway CLI 설치
npm install -g @railway/cli

# 2. Railway 로그인
railway login

# 3. 프로젝트 연결
railway link

# 4. 마이그레이션 스크립트 실행
railway run bash scripts/migrate-postgres.sh
```

#### 방법 2: Railway 대시보드에서 직접 실행

1. 프로젝트 → Service → "Deployments" 탭
2. "..." 메뉴 → "Open Shell"
3. 다음 명령어 실행:

```bash
npx prisma generate
npx prisma db push --accept-data-loss
```

#### 마이그레이션 확인

```bash
# Prisma Studio로 데이터베이스 확인 (로컬)
railway run npx prisma studio
```

---

## ✅ 배포 확인

### Step 5: 애플리케이션 테스트

1. **URL 접속**
   - Railway 대시보드 → Settings → Domains
   - 생성된 URL 클릭 (예: `https://live-commerce-platform-production.up.railway.app`)

2. **관리자 로그인 테스트**
   ```
   URL: https://your-app.railway.app/admin/login
   이메일: admin@example.com
   비밀번호: admin123
   ```

3. **주요 기능 확인**
   - ✅ 홈페이지 로딩
   - ✅ 상품 목록 조회
   - ✅ 장바구니 기능
   - ✅ 주문 프로세스
   - ✅ 라이브 스트리밍 페이지
   - ✅ Socket.io 실시간 채팅
   - ✅ 관리자 대시보드

4. **로그 확인**
   ```bash
   railway logs --tail 100
   ```

---

## 🌐 커스텀 도메인 설정 (선택사항)

### Step 6: 도메인 연결

1. **Railway에서 도메인 추가**
   - Settings → Domains
   - "Custom Domain" 클릭
   - 도메인 입력 (예: `shop.yourdomain.com`)

2. **DNS 레코드 설정**
   Railway가 제공하는 CNAME 레코드를 도메인 DNS 설정에 추가:
   ```
   CNAME: shop
   Value: yourapp.up.railway.app
   ```

3. **HTTPS 자동 설정**
   - Railway가 Let's Encrypt SSL 인증서 자동 발급
   - 보통 5-10분 소요

4. **환경변수 업데이트**
   ```bash
   NEXT_PUBLIC_APP_URL=https://shop.yourdomain.com
   ```

---

## 🔧 문제 해결

### 빌드 실패 시

```bash
# 로컬에서 빌드 테스트
npm run build

# TypeScript 에러 확인
npm run type-check

# 의존성 재설치
rm -rf node_modules package-lock.json
npm install
```

### 데이터베이스 연결 오류

```bash
# Railway CLI로 연결 테스트
railway run npx prisma db push

# 환경변수 확인
railway variables

# 데이터베이스 로그 확인
railway logs --service postgresql
```

### Socket.io 연결 실패

1. **CORS 설정 확인**
   - `NEXT_PUBLIC_APP_URL` 환경변수가 올바른지 확인
   - `server.js`의 CORS 설정 확인

2. **WebSocket 지원 확인**
   - Railway는 기본적으로 WebSocket 지원
   - 프록시나 CDN 사용 시 WebSocket 활성화 필요

### 환경변수 미적용

```bash
# 재배포 트리거
railway redeploy

# 또는 코드 푸시
git commit --allow-empty -m "Trigger redeploy"
git push
```

### 성능 문제

1. **메모리 부족**
   - Railway Settings → Resources
   - 메모리 할당량 증가

2. **응답 시간 느림**
   - 데이터베이스 쿼리 최적화
   - Next.js Image 최적화 확인
   - CDN 사용 고려

### 로그 확인 명령어

```bash
# 실시간 로그 보기
railway logs --tail

# 특정 서비스 로그
railway logs --service web

# 데이터베이스 로그
railway logs --service postgresql

# 최근 100줄 로그
railway logs --tail 100
```

---

## 📊 프로덕션 체크리스트

### 배포 전 확인사항
- [ ] 로컬 빌드 성공 (`npm run build`)
- [ ] 환경변수 `.env.example` 참고하여 준비
- [ ] 토스페이먼츠 실제 API 키 발급
- [ ] JWT 시크릿 키 생성 (`openssl rand -hex 32`)

### 배포 중 확인사항
- [ ] Railway 프로젝트 생성
- [ ] PostgreSQL 데이터베이스 추가
- [ ] 모든 환경변수 설정
- [ ] 배포 성공 확인
- [ ] 데이터베이스 마이그레이션 실행

### 배포 후 확인사항
- [ ] 애플리케이션 URL 접속 가능
- [ ] 관리자 로그인 테스트
- [ ] 주요 페이지 로딩 확인
- [ ] Socket.io 실시간 기능 테스트
- [ ] 결제 테스트 (소액 실제 결제)
- [ ] 모바일 반응형 확인

### 보안 체크리스트
- [ ] JWT_SECRET이 강력한 랜덤 문자열인지 확인
- [ ] DATABASE_URL이 외부에 노출되지 않았는지 확인
- [ ] 토스페이먼츠 실제 키 사용 확인
- [ ] HTTPS 적용 확인
- [ ] 환경변수가 Git에 커밋되지 않았는지 확인

---

## 📚 추가 리소스

### Railway 공식 문서
- [Railway Docs](https://docs.railway.app)
- [PostgreSQL Plugin](https://docs.railway.app/databases/postgresql)
- [Custom Domains](https://docs.railway.app/deploy/deployments#custom-domains)

### 프로젝트 문서
- [README.md](./README.md) - 프로젝트 개요
- [.env.example](./.env.example) - 환경변수 예시
- [DEMO_ACCESS.md](./DEMO_ACCESS.md) - 데모 접속 정보

### 문제 해결
- Railway Discord: https://discord.gg/railway
- GitHub Issues: https://github.com/Stevewon/live-commerce-platform/issues

---

## 🎉 배포 완료!

축하합니다! 라이브 커머스 플랫폼이 프로덕션 환경에 배포되었습니다.

**다음 단계**:
1. 실제 데이터 입력 (카테고리, 상품, 파트너)
2. 도메인 연결 및 브랜딩
3. SEO 최적화
4. 모니터링 및 로그 분석
5. 백업 전략 수립

**운영 권장사항**:
- 주기적인 데이터베이스 백업
- Railway 플랜 업그레이드 (트래픽 증가 시)
- CDN 연동 (이미지 최적화)
- 에러 모니터링 (Sentry 등)

---

**Need help?** 이슈가 발생하면 GitHub Issues에 등록해주세요!
