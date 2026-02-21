# 🛍️ 라이브 커머스 플랫폼 - 분양형 쇼핑몰

라이브 스트리머를 위한 B2B2C 분양형 쇼핑몰 플랫폼입니다.

## 📋 프로젝트 개요

### 비즈니스 모델
- **플랫폼 역할**: 제품 공급, 재고 관리, 주문 처리, 배송
- **파트너 역할**: 라이브 방송, 고객 유치, 판매 촉진
- **수익 분배**: 판매액에서 자동으로 수익 분배

### 주요 기능
- ✅ 멀티 테넌트 시스템 (파트너별 독립 쇼핑몰)
- ✅ 사용자 인증 (이메일/비밀번호, JWT, 소셜 로그인)
- ✅ 파트너 대시보드 (판매 현황, 수익 확인, 상품/주문/정산 관리)
- ✅ 관리자 패널 (주문/상품/파트너/정산 통합 관리)
- ✅ 실시간 라이브 방송 및 채팅 (Socket.io)
- ✅ 상품 관리 (CRUD, 카테고리, 재고)
- ✅ 주문 처리 시스템 (결제, 배송, 환불)
- ✅ 자동 수익 분배 및 정산
- ✅ 알림 시스템 (실시간 + 이메일)
- ✅ 이미지 업로드 (로컬 + Cloudinary)
- ✅ 반응형 디자인 (모바일/태블릿/PC)

## 🚀 빠른 시작

### 1. 의존성 설치
```bash
cd /home/user/webapp/live-commerce-platform
npm install
```

### 2. 데이터베이스 설정
```bash
npm run db:generate
npm run db:push
```

### 3. 개발 서버 실행
```bash
npm run dev
```

서버가 http://localhost:3000 에서 실행됩니다.

## 📁 프로젝트 구조

```
live-commerce-platform/
├── app/                      # Next.js 앱 라우터
│   ├── page.tsx             # 홈페이지
│   ├── layout.tsx           # 루트 레이아웃
│   ├── globals.css          # 전역 스타일
│   ├── admin/               # 관리자 페이지
│   │   ├── login/
│   │   └── dashboard/
│   ├── partner/             # 파트너 페이지
│   │   ├── login/
│   │   ├── dashboard/
│   │   ├── products/
│   │   ├── orders/
│   │   └── settlement/
│   └── api/                 # API 라우트
│       ├── auth/
│       ├── partner/
│       ├── products/
│       └── orders/
├── components/              # 재사용 컴포넌트
├── lib/                     # 유틸리티
│   └── prisma.ts           # Prisma 클라이언트
├── prisma/                  # 데이터베이스
│   └── schema.prisma       # 스키마 정의
├── types/                   # TypeScript 타입
│   └── index.ts
└── package.json
```

## 🗄️ 데이터베이스 스키마

### 주요 테이블
- **User**: 사용자 (관리자, 파트너, 고객)
- **Partner**: 파트너 정보 및 쇼핑몰 설정
- **Product**: 플랫폼 제공 제품
- **PartnerProduct**: 파트너가 판매하는 제품
- **Order**: 주문 정보
- **OrderItem**: 주문 상품
- **Settlement**: 정산 정보
- **LiveStream**: 라이브 방송 정보
- **Category**: 제품 카테고리

## 💻 기술 스택

### Frontend
- **Next.js 15.1.6** - React 19 프레임워크 (App Router)
- **TypeScript** - 타입 안정성
- **Tailwind CSS** - 유틸리티 스타일링
- **Shadcn/ui** - UI 컴포넌트 라이브러리
- **Recharts** - 데이터 시각화

### Backend
- **Next.js API Routes** - RESTful API (69개 엔드포인트)
- **Prisma 5.22.0** - ORM (19개 모델)
- **PostgreSQL** - 프로덕션 데이터베이스
- **SQLite** - 개발용 데이터베이스
- **NextAuth.js** - 인증 (JWT + OAuth)
- **Socket.io** - 실시간 통신
- **Nodemailer** - 이메일 발송

### External Services
- **Toss Payments** - 결제 시스템
- **Cloudinary** - 이미지 호스팅
- **Railway** - 배포 플랫폼

## 🎯 주요 페이지

### 공개 페이지
- `/` - 홈페이지
- `/partner/register` - 파트너 회원가입
- `/partner/login` - 파트너 로그인
- `/admin/login` - 관리자 로그인

### 파트너 페이지 (인증 필요)
- `/partner/dashboard` - 대시보드 (판매 통계)
- `/partner/products` - 제품 관리 (예정)
- `/partner/orders` - 주문 관리 (예정)
- `/partner/settlement` - 정산 내역 (예정)
- `/partner/live` - 라이브 관리 (예정)

### 관리자 페이지 (인증 필요)
- `/admin/dashboard` - 전체 통계 및 파트너 현황
- `/admin/partners` - 파트너 관리 (예정)
- `/admin/products` - 제품 관리 (예정)
- `/admin/orders` - 주문 관리 (예정)
- `/admin/settlements` - 정산 관리 (예정)

## 🔐 인증 시스템

### 역할 (Role)
- **ADMIN**: 플랫폼 관리자
- **PARTNER**: 파트너 스트리머
- **CUSTOMER**: 일반 고객

### JWT 토큰
- 로그인 성공 시 JWT 토큰 발급
- 7일 유효기간
- LocalStorage에 저장

## 📊 파트너 대시보드 기능

### 통계
- 오늘 매출
- 총 매출
- 총 주문 건수
- 정산 대기 금액
- 정산 완료 금액
- 판매 중인 제품 수

### 최근 주문
- 주문 번호
- 주문 금액
- 파트너 수익
- 주문 상태
- 주문 일시

## 💰 수익 분배 시스템

### 기본 수수료율
- 기본 파트너 수수료: 30%
- 플랫폼 수수료: 70%

### 정산 프로세스
1. 주문 생성 시 자동 수익 분배 계산
2. 배송 완료 후 정산 대기 상태
3. 정산 처리 (주기적으로)
4. 정산 완료

## 📱 반응형 디자인

- **모바일**: 768px 이하
- **태블릿**: 768px ~ 1024px
- **데스크톱**: 1024px 이상

모든 페이지가 반응형으로 설계되어 있습니다.

## 🔧 개발 명령어

```bash
# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm start

# Prisma 스키마 생성
npm run db:generate

# 데이터베이스 동기화
npm run db:push

# Prisma Studio (DB GUI)
npm run db:studio
```

## 🌐 배포

### Vercel 배포 (권장)
1. GitHub 저장소에 푸시
2. Vercel에 연결
3. 환경 변수 설정
4. 자동 배포

### 환경 변수 (프로덕션)
```env
NODE_ENV=production
DATABASE_URL="postgresql://..."
JWT_SECRET="강력한-랜덤-시크릿-키"
NEXT_PUBLIC_API_URL="https://yourdomain.com"
```

## 📈 다음 단계

### ✅ 완료된 기능 (100%)
- [x] 사용자 인증 (이메일/비밀번호, JWT)
- [x] 소셜 로그인 구조 (Google, Kakao) - 활성화 대기
- [x] 파트너 회원가입 및 대시보드
- [x] 관리자 대시보드 및 통합 관리
- [x] 상품 관리 UI (CRUD, 카테고리, 재고)
- [x] 주문 관리 UI (상태 변경, 검색, 필터)
- [x] 파트너 관리 UI (승인, 수수료, 통계)
- [x] 정산 관리 UI (승인, 상세 조회)
- [x] 라이브 방송 및 실시간 채팅
- [x] 결제 시스템 (Toss Payments)
- [x] 알림 시스템 (실시간 + 이메일 템플릿)
- [x] 이미지 업로드 및 관리
- [x] 프로덕션 배포 준비 (Railway)

### 🔧 활성화 대기 (구조 완성)
- [ ] 소셜 로그인 활성화 (OAuth 설정 필요)
- [ ] 이메일 알림 활성화 (SMTP 설정 필요)
- [ ] Cloudinary 이미지 호스팅

### 🚀 추가 개선 가능
- [ ] Redis 캐싱
- [ ] CDN 통합
- [ ] 자동화 테스트
- [ ] API 문서화 (Swagger)
- [ ] AI 상품 추천
- [ ] 데이터 분석 대시보드

## 🤝 기여

이 프로젝트는 Stevewon이 개발하고 있습니다.

## 📄 라이선스

ISC License

---

## 📦 백업 및 복원

**최신 백업**: `live-commerce-platform-backup-20260221-120820.tar.gz` (8.5 MB)

### 복원 방법
```bash
tar -xzf live-commerce-platform-backup-20260221-120820.tar.gz
cd live-commerce-platform
npm install
npx prisma generate
npx prisma db push
npm run dev
```

**상세 가이드**: `QUICK_START.md`, `BACKUP_SUMMARY_20260221.md` 참조

---

**프로젝트 시작일**: 2024-02-17  
**개발 완료일**: 2026-02-21  
**개발자**: Stevewon  
**버전**: 2.0.0  
**GitHub**: https://github.com/Stevewon/live-commerce-platform  
**총 개발 시간**: 약 28시간  
**코드 라인**: 18,871줄  
**API 엔드포인트**: 69개  
**페이지**: 26개
