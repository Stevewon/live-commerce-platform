# 🛍️ 라이브 커머스 플랫폼 - 분양형 쇼핑몰

라이브 스트리머를 위한 B2B2C 분양형 쇼핑몰 플랫폼입니다.

## 📋 프로젝트 개요

### 비즈니스 모델
- **플랫폼 역할**: 제품 공급, 재고 관리, 주문 처리, 배송
- **파트너 역할**: 라이브 방송, 고객 유치, 판매 촉진
- **수익 분배**: 판매액에서 자동으로 수익 분배

### 주요 기능
- ✅ 멀티 테넌트 시스템 (파트너별 독립 쇼핑몰)
- ✅ 파트너 대시보드 (판매 현황, 수익 확인)
- ✅ 관리자 대시보드 (전체 통계, 파트너 관리)
- ✅ 제품 관리 시스템
- ✅ 주문 처리 시스템
- ✅ 자동 수익 분배 및 정산
- ✅ 라이브 스트림 연동
- ✅ 반응형 디자인 (모바일/PC)

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
- **Next.js 15** - React 프레임워크
- **TypeScript** - 타입 안정성
- **TailwindCSS** - 스타일링
- **React Hooks** - 상태 관리

### Backend
- **Next.js API Routes** - 서버리스 API
- **Prisma** - ORM
- **SQLite** - 개발용 데이터베이스 (프로덕션: PostgreSQL)
- **JWT** - 인증
- **bcryptjs** - 비밀번호 암호화

## 🎯 주요 페이지

### 공개 페이지
- `/` - 홈페이지
- `/partner/login` - 파트너 로그인
- `/admin/login` - 관리자 로그인

### 파트너 페이지 (인증 필요)
- `/partner/dashboard` - 대시보드 (판매 통계)
- `/partner/products` - 제품 관리
- `/partner/orders` - 주문 관리
- `/partner/settlement` - 정산 내역
- `/partner/live` - 라이브 관리

### 관리자 페이지 (인증 필요)
- `/admin/dashboard` - 전체 통계
- `/admin/partners` - 파트너 관리
- `/admin/products` - 제품 관리
- `/admin/orders` - 주문 관리
- `/admin/settlements` - 정산 관리

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

### 구현 예정 기능
- [ ] 파트너 회원가입 페이지
- [ ] 관리자 대시보드
- [ ] 제품 관리 UI
- [ ] 주문 관리 UI
- [ ] 결제 시스템 연동 (토스페이먼츠, 아임포트)
- [ ] 라이브 스트림 연동
- [ ] 이메일 알림
- [ ] 푸시 알림
- [ ] 데이터 분석 및 리포트
- [ ] 파트너 쇼핑몰 커스터마이징

## 🤝 기여

이 프로젝트는 Stevewon이 개발하고 있습니다.

## 📄 라이선스

ISC License

---

**프로젝트 시작일**: 2024-02-17
**개발자**: Stevewon
**버전**: 1.0.0
