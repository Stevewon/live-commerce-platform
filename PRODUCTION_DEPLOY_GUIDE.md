# 🚀 qrlive.io 프로덕션 배포 가이드

## 📋 배포 체크리스트

### ✅ 1단계: 환경 변수 설정

#### 필수 환경 변수 (Vercel 설정)

```bash
# 데이터베이스
DATABASE_URL="postgresql://user:password@host:5432/qrlive_production?schema=public"

# JWT 시크릿 (openssl rand -hex 32로 생성)
JWT_SECRET="프로덕션용_랜덤_시크릿_키_32자_이상"
NEXTAUTH_SECRET="프로덕션용_랜덤_시크릿_키_32자_이상"

# 앱 URL
NEXTAUTH_URL="https://qrlive.io"
NEXT_PUBLIC_APP_URL="https://qrlive.io"

# Node 환경
NODE_ENV="production"
```

#### 결제 시스템 (Toss Payments)

```bash
# 프로덕션 키로 변경 필요!
NEXT_PUBLIC_TOSS_CLIENT_KEY="live_ck_실제키입력"
TOSS_SECRET_KEY="live_sk_실제키입력"
```

#### 이메일 서비스 (선택: SendGrid 추천)

```bash
SMTP_HOST="smtp.sendgrid.net"
SMTP_PORT="587"
SMTP_USER="apikey"
SMTP_PASSWORD="SendGrid_API_키"
SMTP_FROM="QRLive <noreply@qrlive.io>"
```

#### 소셜 로그인 (OAuth)

```bash
# Google OAuth
GOOGLE_CLIENT_ID="구글_클라이언트_ID"
GOOGLE_CLIENT_SECRET="구글_시크릿"

# Kakao OAuth  
KAKAO_CLIENT_ID="카카오_REST_API_키"
KAKAO_CLIENT_SECRET="카카오_시크릿"
```

#### 이미지 스토리지 (Cloudinary 추천)

```bash
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME="클라우드_이름"
CLOUDINARY_API_KEY="API_키"
CLOUDINARY_API_SECRET="API_시크릿"
```

---

### ✅ 2단계: Vercel 배포

#### A. Vercel 프로젝트 생성

1. **Vercel 계정** 로그인: https://vercel.com
2. **New Project** 클릭
3. GitHub 저장소 연결: `Stevewon/live-commerce-platform`
4. 프로젝트 설정:
   - Framework Preset: **Next.js**
   - Root Directory: `./`
   - Build Command: `npm run build`
   - Output Directory: `.next`

#### B. 환경 변수 추가

Vercel Dashboard → Settings → Environment Variables에서:
- 위의 모든 환경 변수 입력
- **Production**, **Preview**, **Development** 모두 체크

#### C. 도메인 연결

1. Vercel Dashboard → Settings → Domains
2. **Add Domain** 클릭
3. `qrlive.io` 입력
4. DNS 설정 안내에 따라 설정:

```
Type: A
Name: @
Value: 76.76.21.21

Type: CNAME  
Name: www
Value: cname.vercel-dns.com
```

---

### ✅ 3단계: 데이터베이스 설정

#### 옵션 1: Vercel Postgres (추천)

1. Vercel Dashboard → Storage 탭
2. **Create Database** → Postgres 선택
3. 자동으로 `DATABASE_URL` 환경 변수 추가됨

#### 옵션 2: Railway PostgreSQL

1. https://railway.app 에서 프로젝트 생성
2. PostgreSQL 플러그인 추가
3. Connection String 복사 → Vercel 환경 변수에 추가

#### 데이터베이스 마이그레이션

```bash
# 로컬에서 프로덕션 DB에 스키마 적용
DATABASE_URL="프로덕션_DATABASE_URL" npx prisma db push

# 초기 데이터 시딩 (선택)
DATABASE_URL="프로덕션_DATABASE_URL" npx prisma db seed
```

---

### ✅ 4단계: 프로덕션 빌드 테스트

로컬에서 프로덕션 빌드 테스트:

```bash
# 빌드
npm run build

# 프로덕션 모드로 실행
npm start
```

오류 없이 실행되는지 확인!

---

### ✅ 5단계: DNS 설정 (도메인 제공업체)

도메인 제공업체(GoDaddy, Namecheap 등)에서:

#### A레코드 추가:
```
Type: A
Host: @
Points to: 76.76.21.21
TTL: 자동 (또는 3600)
```

#### CNAME 레코드 추가:
```
Type: CNAME
Host: www
Points to: cname.vercel-dns.com
TTL: 자동 (또는 3600)
```

DNS 전파까지 최대 24-48시간 소요 (보통 10-30분)

---

### ✅ 6단계: SSL/TLS 인증서

Vercel이 자동으로 Let's Encrypt SSL 인증서 발급 (무료)
- 도메인 연결 후 자동 적용
- HTTPS 강제 리다이렉트 자동 설정

---

### ✅ 7단계: 배포 후 확인 사항

#### 필수 테스트:
- [ ] 메인 페이지 로드 (https://qrlive.io)
- [ ] 회원가입/로그인
- [ ] 소셜 로그인 (Google, Kakao)
- [ ] 상품 목록/상세 페이지
- [ ] 장바구니 추가
- [ ] 주문 프로세스
- [ ] 결제 테스트 (테스트 카드)
- [ ] 관리자 로그인
- [ ] 파트너 로그인
- [ ] 이메일 알림

#### 성능 체크:
- Google PageSpeed Insights: https://pagespeed.web.dev
- 목표: 모바일 90점 이상, 데스크톱 95점 이상

---

### ✅ 8단계: 모니터링 설정

#### Sentry (에러 추적)

1. https://sentry.io 가입
2. 프로젝트 생성
3. 환경 변수 추가:

```bash
NEXT_PUBLIC_SENTRY_DSN="Sentry_DSN_키"
```

4. `sentry.client.config.ts` 및 `sentry.server.config.ts` 생성

#### Vercel Analytics

Vercel Dashboard → Analytics 탭에서 활성화 (무료)

---

## 🔒 보안 체크리스트

- [ ] 모든 시크릿 키 변경됨 (개발 키 사용 금지)
- [ ] DATABASE_URL이 외부에 노출되지 않음
- [ ] CORS 설정 확인 (qrlive.io만 허용)
- [ ] Rate Limiting 설정
- [ ] XSS/CSRF 보호 활성화
- [ ] 민감한 API 라우트 인증 필수

---

## 📊 런칭 체크리스트

### 기술적 준비
- [ ] 프로덕션 환경 변수 설정 완료
- [ ] 데이터베이스 마이그레이션 완료
- [ ] Vercel 배포 성공
- [ ] 도메인 연결 완료
- [ ] SSL 인증서 적용 확료
- [ ] 결제 시스템 테스트 완료
- [ ] 이메일 발송 테스트 완료
- [ ] 에러 모니터링 설정 완료

### 콘텐츠 준비
- [ ] 메인 페이지 완성
- [ ] 약관 페이지 (이용약관, 개인정보처리방침)
- [ ] FAQ 페이지
- [ ] 고객센터 연락처
- [ ] 초기 상품 등록
- [ ] 파트너 모집 페이지

### 마케팅 준비
- [ ] Google Analytics 설정
- [ ] 네이버 웹마스터 도구 등록
- [ ] 카카오 채널 개설
- [ ] SNS 계정 개설 (인스타그램, 페이스북)
- [ ] 프로모션 준비

---

## 🚀 배포 명령어

```bash
# Git push (Vercel 자동 배포 트리거)
git add .
git commit -m "feat: Production ready deployment"
git push origin main

# Vercel CLI로 직접 배포 (선택사항)
npx vercel --prod
```

---

## 📞 런칭 후 지원

### 문제 발생 시:
1. Vercel 로그 확인: Dashboard → Deployments → Logs
2. Sentry 에러 확인
3. 데이터베이스 연결 확인

### 긴급 롤백:
Vercel Dashboard → Deployments → 이전 버전 → Promote to Production

---

## 🎉 런칭 준비 완료!

모든 체크리스트가 완료되면 **qrlive.io**로 접속 가능합니다!

**축하합니다! 🎊**
