# 🚀 QR Live (qrlive.io) 프로덕션 런칭 가이드

## 📌 개요
도메인: **qrlive.io**  
플랫폼: Vercel (추천) 또는 Railway  
데이터베이스: PostgreSQL (Vercel Postgres 또는 Supabase)

---

## ✅ 배포 전 체크리스트

### 1. 환경 변수 설정
`.env.production` 파일의 모든 `REPLACE_WITH_*` 값을 실제 값으로 교체:

#### 필수 항목
- [ ] `DATABASE_URL` - PostgreSQL 연결 문자열
- [ ] `JWT_SECRET` - 보안 키 (32자 이상)
- [ ] `NEXTAUTH_SECRET` - NextAuth 보안 키
- [ ] `NEXTAUTH_URL` - https://qrlive.io
- [ ] `NEXT_PUBLIC_APP_URL` - https://qrlive.io

#### 소셜 로그인
- [ ] Google OAuth 설정 (Client ID, Secret)
- [ ] Kakao OAuth 설정 (REST API Key, Client Secret)

#### 결제
- [ ] Toss Payments 라이브 키 (Client Key, Secret Key)

#### 이메일
- [ ] SMTP 설정 (SendGrid 추천)

#### 이미지 스토리지
- [ ] Cloudinary 또는 AWS S3 설정

---

## 🔧 1단계: Vercel 프로젝트 생성

### A. Vercel CLI 설치 및 로그인
```bash
# Vercel CLI 설치
npm install -g vercel

# Vercel 로그인
vercel login
```

### B. 프로젝트 배포
```bash
cd /home/user/webapp/live-commerce-platform

# 첫 배포 (프로젝트 생성)
vercel

# 프로덕션 배포
vercel --prod
```

---

## 🗄️ 2단계: 데이터베이스 설정

### Option 1: Vercel Postgres (추천)
1. Vercel 대시보드에서 프로젝트 선택
2. **Storage** 탭 → **Create Database** → **Postgres**
3. 자동으로 `DATABASE_URL` 환경 변수 생성됨

### Option 2: Supabase
1. https://supabase.com/ 에서 프로젝트 생성
2. **Settings** → **Database** → Connection String 복사
3. Vercel 환경 변수에 `DATABASE_URL` 추가

### 데이터베이스 마이그레이션
```bash
# Prisma 마이그레이션 실행
npx prisma migrate deploy

# 시드 데이터 추가 (관리자 계정 등)
npx prisma db seed
```

---

## 🌐 3단계: 도메인 연결 (qrlive.io)

### Vercel에서 도메인 설정
1. Vercel 대시보드 → 프로젝트 선택
2. **Settings** → **Domains**
3. **Add** → `qrlive.io` 입력
4. DNS 레코드 설정 안내 표시됨

### DNS 설정 (도메인 제공업체)
아래 레코드를 DNS 제공업체에 추가:

```
Type: A
Name: @
Value: 76.76.21.21

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

또는 Vercel이 제공하는 네임서버 사용:
```
ns1.vercel-dns.com
ns2.vercel-dns.com
```

---

## 🔐 4단계: 환경 변수 설정 (Vercel)

Vercel 대시보드에서 환경 변수 추가:

1. **Settings** → **Environment Variables**
2. `.env.production` 파일의 모든 변수 추가
3. **Production** 환경 선택

### 핵심 환경 변수
```
DATABASE_URL=postgresql://...
JWT_SECRET=...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://qrlive.io
NEXT_PUBLIC_APP_URL=https://qrlive.io
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
KAKAO_CLIENT_ID=...
KAKAO_CLIENT_SECRET=...
NEXT_PUBLIC_TOSS_CLIENT_KEY=live_ck_...
TOSS_SECRET_KEY=live_sk_...
SMTP_HOST=smtp.sendgrid.net
SMTP_USER=apikey
SMTP_PASSWORD=...
NODE_ENV=production
```

---

## 💳 5단계: Toss Payments 설정

### 라이브 API 키 발급
1. https://developers.tosspayments.com/ 로그인
2. **개발자센터** → **API 키 관리**
3. **라이브 키** 발급 (사업자 등록 필요)
4. 발급받은 키를 환경 변수에 추가:
   - `NEXT_PUBLIC_TOSS_CLIENT_KEY`
   - `TOSS_SECRET_KEY`

### 테스트 결제
- 샌드박스 환경에서 충분히 테스트 후 라이브 전환

---

## 📧 6단계: 이메일 서비스 설정

### SendGrid 설정 (추천)
1. https://sendgrid.com/ 가입
2. **API Keys** → **Create API Key**
3. Full Access 권한으로 키 생성
4. 환경 변수 설정:
   ```
   SMTP_HOST=smtp.sendgrid.net
   SMTP_PORT=587
   SMTP_USER=apikey
   SMTP_PASSWORD=SG.your-sendgrid-api-key
   SMTP_FROM=QR Live <noreply@qrlive.io>
   ```

### 도메인 인증
- SendGrid에서 `qrlive.io` 도메인 인증
- SPF, DKIM 레코드 DNS에 추가

---

## 🖼️ 7단계: 이미지 스토리지 설정

### Cloudinary 설정 (추천)
1. https://cloudinary.com/ 가입
2. **Dashboard** → Cloud Name, API Key, API Secret 확인
3. 환경 변수 추가:
   ```
   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   ```

---

## 🔒 8단계: 소셜 로그인 설정

### Google OAuth
1. https://console.cloud.google.com/apis/credentials
2. **OAuth 2.0 클라이언트 ID** 생성
3. **승인된 리디렉션 URI** 추가:
   ```
   https://qrlive.io/api/auth/callback/google
   ```

### Kakao 로그인
1. https://developers.kakao.com/
2. 애플리케이션 생성
3. **플랫폼** → **Web** → 도메인 등록: `https://qrlive.io`
4. **Redirect URI** 설정:
   ```
   https://qrlive.io/api/auth/callback/kakao
   ```

---

## 📊 9단계: 모니터링 설정 (선택 사항)

### Sentry.io (에러 추적)
1. https://sentry.io/ 가입
2. Next.js 프로젝트 생성
3. DSN 복사 후 환경 변수 추가:
   ```
   NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
   ```

### Vercel Analytics
- Vercel 대시보드에서 자동으로 활성화됨
- 트래픽, 성능 지표 모니터링 가능

---

## 🚀 10단계: 최종 배포

### 배포 명령
```bash
# 프로덕션 배포
vercel --prod

# 또는 Git 자동 배포
git push origin main
# Vercel이 자동으로 main 브랜치 배포
```

### 배포 확인
1. https://qrlive.io 접속
2. 관리자 로그인: `admin@example.com` / `admin123`
3. 파트너 가입 테스트
4. 상품 등록 테스트
5. 결제 테스트 (소액)

---

## 📋 11단계: 런칭 후 체크리스트

### 기능 테스트
- [ ] 회원 가입/로그인
- [ ] 소셜 로그인 (Google, Kakao)
- [ ] 상품 등록 및 목록 조회
- [ ] 장바구니 기능
- [ ] 주문 및 결제
- [ ] 파트너 대시보드
- [ ] 관리자 대시보드
- [ ] 이메일 알림
- [ ] 라이브 스트리밍 (Socket.io)

### 보안 점검
- [ ] HTTPS 적용 확인
- [ ] CORS 설정 확인
- [ ] API Rate Limiting
- [ ] SQL Injection 방어
- [ ] XSS 방어

### 성능 최적화
- [ ] 이미지 최적화 (Next.js Image)
- [ ] 코드 스플리팅
- [ ] CDN 활용
- [ ] 데이터베이스 인덱싱

---

## 🔄 업데이트 및 재배포

### 코드 업데이트
```bash
# 코드 수정 후
git add .
git commit -m "feat: 새로운 기능 추가"
git push origin main

# Vercel이 자동으로 재배포
```

### 환경 변수 변경
1. Vercel 대시보드 → Environment Variables
2. 변수 수정
3. **Redeploy** 버튼 클릭

---

## 📞 트러블슈팅

### 데이터베이스 연결 오류
- `DATABASE_URL` 확인
- Prisma 마이그레이션 실행 확인
- 방화벽 설정 확인

### 결제 오류
- Toss Payments API 키 확인
- 라이브 키로 전환 확인
- 사업자 등록 상태 확인

### 이메일 발송 실패
- SMTP 설정 확인
- SendGrid API 키 확인
- 도메인 인증 확인

### 도메인 연결 안 됨
- DNS 전파 대기 (최대 48시간)
- `nslookup qrlive.io` 명령으로 확인
- Vercel DNS 레코드 재확인

---

## 📚 추가 문서
- [PRODUCTION_DEPLOY_GUIDE.md](./PRODUCTION_DEPLOY_GUIDE.md) - 환경 변수 상세 가이드
- [SOCIAL_EMAIL_GUIDE.md](./SOCIAL_EMAIL_GUIDE.md) - 소셜 로그인 및 이메일 설정
- [TOSS_PAYMENTS_GUIDE.md](./TOSS_PAYMENTS_GUIDE.md) - 토스 결제 연동 가이드
- [DEPLOYMENT.md](./DEPLOYMENT.md) - 일반 배포 가이드

---

## 🎉 완료!

✅ qrlive.io 배포 완료  
✅ 프로덕션 환경 설정 완료  
✅ 모든 기능 테스트 완료

**이제 라이브 커머스 플랫폼을 정식으로 운영할 수 있습니다!** 🎊
