# 🔐 간편 회원가입 및 로그인 시스템

## ✨ 주요 특징

### 1. **시큐릿 QR 주소 기반 인증**
- 시큐릿 보안 메신저의 QR 주소를 계정 식별자로 사용
- QR 주소 형식: `https://securet.kr/securet.php?key=idcard&nick=...&token=...&voip=...&os=...`
- 닉네임/비밀번호 찾기의 기준으로 활용

### 2. **간편한 회원가입**
- **필수 입력 항목 (4개만!)**
  - ✅ 시큐릿 QR 주소
  - ✅ 닉네임
  - ✅ 비밀번호
  - ✅ 비밀번호 확인

### 3. **간편한 로그인**
- **필수 입력 항목 (2개만!)**
  - ✅ 닉네임
  - ✅ 비밀번호

---

## 📍 주요 페이지 URL

### 회원가입 & 로그인
- **회원가입**: https://qrlive.io/register
- **로그인**: https://qrlive.io/login

### 계정 복구
- **닉네임 찾기**: https://qrlive.io/auth/find-nickname
- **비밀번호 찾기**: https://qrlive.io/auth/find-password

---

## 🔄 사용자 플로우

### 1️⃣ 회원가입 플로우
```
1. /register 접속
2. 시큐릿 QR 주소 입력
3. 닉네임 입력 (고유해야 함)
4. 비밀번호 입력 (최소 6자)
5. 비밀번호 확인
6. 회원가입 완료 → 자동 로그인
7. 역할에 따라 자동 리다이렉트:
   - ADMIN → /admin/dashboard
   - PARTNER → /partner/dashboard
   - CUSTOMER → /products
```

### 2️⃣ 로그인 플로우
```
1. /login 접속
2. 닉네임 입력
3. 비밀번호 입력
4. 로그인 완료
5. 역할에 따라 자동 리다이렉트:
   - ADMIN → /admin/dashboard
   - PARTNER → /partner/dashboard
   - CUSTOMER → /products
```

### 3️⃣ 닉네임 찾기 플로우
```
1. /auth/find-nickname 접속
2. 회원가입 시 입력한 시큐릿 QR 주소 입력
3. 닉네임 찾기 버튼 클릭
4. 등록된 닉네임 표시
```

### 4️⃣ 비밀번호 찾기 플로우
```
1. /auth/find-password 접속
2. 회원가입 시 입력한 시큐릿 QR 주소 입력
3. 새 비밀번호 입력 (최소 6자)
4. 비밀번호 확인
5. 비밀번호 재설정 완료
6. 로그인 페이지로 이동
```

---

## 🔌 API 엔드포인트

### 회원가입
```typescript
POST /api/auth/register
Body: {
  nickname: string;        // 필수
  password: string;        // 필수, 최소 6자
  securetQrUrl: string;   // 필수, 시큐릿 QR 형식 검증
  name?: string;          // 선택 (없으면 nickname 사용)
  phone?: string;         // 선택
  role?: string;          // 선택 (기본값: CUSTOMER)
}

Response: {
  success: boolean;
  data: {
    user: User;
    token: string;
  }
}
```

### 로그인
```typescript
POST /api/auth/login
Body: {
  nickname: string;  // 필수
  password: string;  // 필수
}

Response: {
  success: boolean;
  data: {
    user: User;
    token: string;
  }
}
```

### 닉네임 찾기
```typescript
POST /api/auth/find-nickname
Body: {
  securetQrUrl: string;  // 필수
}

Response: {
  success: boolean;
  data: {
    nickname: string;
  }
}
```

### 비밀번호 재설정
```typescript
POST /api/auth/reset-password
Body: {
  securetQrUrl: string;  // 필수
  newPassword: string;   // 필수, 최소 6자
}

Response: {
  success: boolean;
  message: string;
}
```

---

## 🗄️ 데이터베이스 스키마 변경

### User 모델 업데이트
```prisma
model User {
  id            String    @id @default(uuid())
  email         String?   @unique // Optional
  nickname      String?   @unique // 로그인 식별자
  password      String    // 해시된 비밀번호
  name          String
  phone         String?
  role          String    @default("CUSTOMER")
  
  // 🆕 시큐릿 QR 주소 (계정 복구용)
  securetQrUrl  String?
  
  // NextAuth fields (소셜 로그인 - 선택)
  emailVerified DateTime?
  image         String?
  
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  // Relations
  partner       Partner?
  orders        Order[]
  cartItems     CartItem[]
  wishlistItems WishlistItem[]
  reviews       Review[]
  notifications Notification[]
  chatMessages  LiveChat[]
  accounts      Account[]
  sessions      Session[]
}
```

---

## ✅ 입력 검증

### 시큐릿 QR 주소 형식 검증
```typescript
const securetUrlPattern = /^https:\/\/securet\.kr\/securet\.php\?key=idcard&nick=.+&token=.+&voip=.+&os=.+$/;
```

### 회원가입 검증 규칙
1. ✅ 닉네임: 필수, 고유해야 함
2. ✅ 비밀번호: 필수, 최소 6자
3. ✅ 시큐릿 QR 주소: 필수, 형식 검증
4. ✅ 비밀번호 확인: 일치 여부 확인

### 로그인 검증 규칙
1. ✅ 닉네임: 필수, 존재하는 닉네임
2. ✅ 비밀번호: 필수, 올바른 비밀번호

---

## 🎨 UI/UX 특징

### 디자인
- 그라디언트 배경 (파란색 → 흰색 → 보라색)
- 깔끔한 카드 형태의 폼
- 반응형 디자인 (모바일 최적화)
- QRLIVE 브랜드 로고 표시

### 사용자 경험
- 실시간 입력 검증
- 명확한 에러 메시지
- 로딩 상태 표시
- 성공/실패 피드백
- 간편한 페이지 간 이동 링크

---

## 🚀 배포 상태

### Vercel 배포
- ✅ 빌드 성공
- ✅ TypeScript 오류 해결
- ✅ 모든 페이지 정상 작동
- 🔄 자동 배포 대기 중

### 접속 URL (배포 후)
- Production: https://qrlive.io
- 회원가입: https://qrlive.io/register
- 로그인: https://qrlive.io/login

---

## 📝 다음 단계

1. ✅ Vercel 배포 완료 대기
2. ✅ 프로덕션 환경 테스트
3. ✅ 사용자 피드백 수집
4. ⏳ 필요시 UI/UX 개선

---

## 🔧 기술 스택

- **Frontend**: Next.js 15 (App Router)
- **Backend**: Next.js API Routes
- **Database**: Prisma + SQLite (개발) / PostgreSQL (프로덕션)
- **Authentication**: JWT (JSON Web Token)
- **Password**: bcryptjs (해싱)
- **Deployment**: Vercel

---

## 📞 문의

문제가 발생하거나 개선사항이 있으면 언제든지 말씀해주세요! 🚀
