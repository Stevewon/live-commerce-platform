# Railway 배포 가이드

## 사전 준비

### 1. Railway 계정 생성

1. [Railway 웹사이트](https://railway.app/) 접속
2. "Start a New Project" 클릭
3. GitHub 계정으로 로그인
4. Railway 앱 권한 승인

### 2. 프로젝트 생성

1. Railway 대시보드에서 "New Project" 클릭
2. "Deploy from GitHub repo" 선택
3. `live-commerce-platform` 리포지토리 선택
4. "Deploy Now" 클릭

---

## PostgreSQL 데이터베이스 추가

### 1. 데이터베이스 서비스 추가

1. 프로젝트 대시보드에서 "+ New" 클릭
2. "Database" → "Add PostgreSQL" 선택
3. PostgreSQL 인스턴스가 자동 생성됨

### 2. DATABASE_URL 자동 연결

- Railway가 자동으로 `DATABASE_URL` 환경 변수 생성
- Next.js 앱이 자동으로 PostgreSQL에 연결됨

---

## 환경 변수 설정

### 1. Railway 환경 변수 추가

프로젝트 → Settings → Variables에서 다음 환경 변수 추가:

```env
# 기본 설정
NODE_ENV=production
PORT=3000

# Next.js
NEXT_PUBLIC_API_URL=${{ RAILWAY_PUBLIC_DOMAIN }}

# JWT & NextAuth
JWT_SECRET=your-strong-secret-key-here-change-in-production
NEXTAUTH_SECRET=your-nextauth-secret-key-here
NEXTAUTH_URL=${{ RAILWAY_PUBLIC_DOMAIN }}

# Email (Gmail SMTP)
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
NEXT_PUBLIC_APP_URL=${{ RAILWAY_PUBLIC_DOMAIN }}

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Kakao OAuth
KAKAO_CLIENT_ID=your-kakao-rest-api-key
KAKAO_CLIENT_SECRET=

# Toss Payments (프로덕션 키로 변경)
NEXT_PUBLIC_TOSS_CLIENT_KEY=your-toss-production-client-key
TOSS_SECRET_KEY=your-toss-production-secret-key
```

> **참고**: `${{ RAILWAY_PUBLIC_DOMAIN }}`은 Railway가 자동으로 생성한 도메인으로 대체됩니다.
> 예: `https://your-project-name.up.railway.app`

### 2. 강력한 시크릿 키 생성

```bash
# JWT_SECRET 생성
openssl rand -base64 32

# NEXTAUTH_SECRET 생성
openssl rand -base64 32
```

---

## 데이터베이스 마이그레이션

### 1. Prisma 스키마 확인

`prisma/schema.prisma` 파일에서 `provider`가 PostgreSQL로 설정되어 있는지 확인:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### 2. 마이그레이션 스크립트 추가

`package.json`에 다음 스크립트 추가:

```json
{
  "scripts": {
    "build": "prisma generate && prisma migrate deploy && next build",
    "postinstall": "prisma generate"
  }
}
```

### 3. 배포 시 자동 실행

- Railway가 `build` 스크립트를 자동 실행
- Prisma가 데이터베이스 마이그레이션 자동 수행
- Next.js 프로덕션 빌드 생성

---

## 시드 데이터 삽입

### 1. 시드 스크립트 작성

`prisma/seed.ts` 파일 생성:

```typescript
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // 관리자 계정
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password: adminPassword,
      name: '관리자',
      role: 'ADMIN',
    },
  });

  // 파트너 계정
  const partnerPassword = await bcrypt.hash('partner123', 10);
  const partnerUser = await prisma.user.upsert({
    where: { email: 'partner@example.com' },
    update: {},
    create: {
      email: 'partner@example.com',
      password: partnerPassword,
      name: '김스트리머',
      phone: '010-9876-5432',
      role: 'PARTNER',
    },
  });

  const partner = await prisma.partner.upsert({
    where: { userId: partnerUser.id },
    update: {},
    create: {
      userId: partnerUser.id,
      storeName: '김스트리머 샵',
      storeSlug: 'kim-streamer',
      description: '최고의 제품을 소개합니다!',
      commissionRate: 30.0,
      isActive: true,
    },
  });

  // 고객 계정
  const customerPassword = await bcrypt.hash('test123', 10);
  const customer = await prisma.user.upsert({
    where: { email: 'test2@example.com' },
    update: {},
    create: {
      email: 'test2@example.com',
      password: customerPassword,
      name: '테스트 고객',
      phone: '010-1234-5678',
      role: 'CUSTOMER',
    },
  });

  // 카테고리 생성
  const categories = [
    { name: '패션', slug: 'fashion' },
    { name: '뷰티', slug: 'beauty' },
    { name: '푸드', slug: 'food' },
    { name: '리빙', slug: 'living' },
    { name: '디지털', slug: 'digital' },
    { name: '스포츠', slug: 'sports' },
    { name: '키즈', slug: 'kids' },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }

  console.log('✅ 시드 데이터 삽입 완료!');
  console.log('관리자:', admin.email);
  console.log('파트너:', partnerUser.email);
  console.log('고객:', customer.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### 2. package.json에 시드 설정 추가

```json
{
  "prisma": {
    "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
  },
  "scripts": {
    "seed": "prisma db seed"
  }
}
```

### 3. 시드 실행

```bash
# 로컬 환경
npm run seed

# Railway CLI (배포 후)
railway run npm run seed
```

---

## OAuth Redirect URI 업데이트

### Google OAuth

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. OAuth 클라이언트 ID 설정 → 편집
3. 승인된 리디렉션 URI에 추가:
   ```
   https://your-railway-domain.up.railway.app/api/auth/callback/google
   ```

### Kakao OAuth

1. [Kakao Developers](https://developers.kakao.com/) 접속
2. 내 애플리케이션 → 앱 선택
3. Kakao 로그인 → Redirect URI에 추가:
   ```
   https://your-railway-domain.up.railway.app/api/auth/callback/kakao
   ```

---

## 배포 확인

### 1. 배포 로그 확인

- Railway 대시보드 → Deployments → 최신 배포 클릭
- 빌드 로그 확인
- 에러 발생 시 로그에서 원인 확인

### 2. 애플리케이션 URL 확인

- Railway 대시보드 → Settings → Domains
- 자동 생성된 URL: `https://your-project-name.up.railway.app`
- 커스텀 도메인 설정 가능

### 3. 테스트

```bash
# 헬스 체크
curl https://your-railway-domain.up.railway.app/

# 로그인 API 테스트
curl -X POST https://your-railway-domain.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'
```

---

## 커스텀 도메인 설정 (선택)

### 1. 도메인 구매

- Namecheap, GoDaddy 등에서 도메인 구매

### 2. Railway 커스텀 도메인 추가

1. Railway 대시보드 → Settings → Domains
2. "Custom Domain" 클릭
3. 구매한 도메인 입력 (예: `livecommerce.com`)

### 3. DNS 설정

도메인 등록업체에서 다음 레코드 추가:

```
Type: CNAME
Name: www
Value: your-project-name.up.railway.app
```

또는

```
Type: A
Name: @
Value: (Railway가 제공하는 IP 주소)
```

### 4. SSL 인증서 자동 발급

- Railway가 Let's Encrypt SSL 인증서 자동 발급
- HTTPS 자동 활성화

---

## 모니터링 & 로그

### 1. 애플리케이션 로그

```bash
# Railway CLI 설치
npm i -g @railway/cli

# 로그인
railway login

# 프로젝트 연결
railway link

# 실시간 로그 보기
railway logs
```

### 2. 데이터베이스 모니터링

- Railway 대시보드 → PostgreSQL 서비스 → Metrics
- CPU, 메모리, 디스크 사용량 확인

### 3. 배포 알림

- Railway 대시보드 → Settings → Notifications
- Slack/Discord 웹훅 연동 가능

---

## 비용 최적화

### 1. Railway 무료 플랜

- 매월 $5 크레딧 제공
- 경량 앱 무료 운영 가능

### 2. 유료 플랫폼 ($5/월)

- 크레딧 소진 시 자동 과금
- 사용량에 따라 비용 청구

### 3. 비용 절감 팁

- 유휴 시간 설정 (자동 sleep)
- 데이터베이스 최적화 (인덱스 추가)
- CDN 활용 (Cloudflare)

---

## 트러블슈팅

### 빌드 실패

- **Prisma 마이그레이션 실패**: `DATABASE_URL` 환경 변수 확인
- **Node.js 버전 불일치**: `package.json`에 `engines` 추가
- **메모리 부족**: Railway 플랜 업그레이드

### 런타임 에러

- **500 에러**: 환경 변수 누락 확인
- **데이터베이스 연결 실패**: PostgreSQL 서비스 상태 확인
- **OAuth 로그인 실패**: Redirect URI 설정 확인

### 성능 최적화

- Next.js 이미지 최적화
- 데이터베이스 쿼리 최적화
- Redis 캐싱 추가 (선택)

---

## 백업 & 복구

### 데이터베이스 백업

```bash
# Railway CLI로 백업
railway run pg_dump $DATABASE_URL > backup.sql

# 복구
railway run psql $DATABASE_URL < backup.sql
```

---

## CI/CD 자동 배포

Railway는 Git push 시 자동 배포:

1. 코드 수정 후 Git push
2. Railway가 자동으로 감지
3. 자동 빌드 & 배포
4. 배포 완료 알림

---

## 유용한 링크

- [Railway 공식 문서](https://docs.railway.app/)
- [Prisma PostgreSQL 가이드](https://www.prisma.io/docs/concepts/database-connectors/postgresql)
- [Next.js 배포 가이드](https://nextjs.org/docs/deployment)
- [Railway CLI](https://docs.railway.app/develop/cli)

---

## 배포 체크리스트

- [ ] Railway 프로젝트 생성
- [ ] PostgreSQL 데이터베이스 추가
- [ ] 환경 변수 설정 (JWT_SECRET, SMTP, OAuth 등)
- [ ] Prisma 스키마 PostgreSQL로 변경
- [ ] 데이터베이스 마이그레이션 실행
- [ ] 시드 데이터 삽입
- [ ] Google OAuth Redirect URI 업데이트
- [ ] Kakao OAuth Redirect URI 업데이트
- [ ] 배포 확인 및 테스트
- [ ] 로그인 기능 테스트
- [ ] 주문 생성 테스트
- [ ] 이메일 전송 테스트
- [ ] 커스텀 도메인 설정 (선택)

---

**모든 설정이 완료되면 프로덕션 레벨의 라이브 커머스 플랫폼이 완성됩니다!** 🎉
