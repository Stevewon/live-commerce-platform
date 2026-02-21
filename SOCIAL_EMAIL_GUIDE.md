# 🔐 소셜 로그인 & 📧 이메일 알림 설정 가이드

## 📋 목차
1. [소셜 로그인 설정](#소셜-로그인-설정)
2. [이메일 알림 설정](#이메일-알림-설정)
3. [환경변수 설정](#환경변수-설정)
4. [테스트 방법](#테스트-방법)

---

## 🔐 소셜 로그인 설정

### 1. Google OAuth 설정

#### Step 1: Google Cloud Console 접속
1. https://console.cloud.google.com 접속
2. 프로젝트 생성 또는 선택

#### Step 2: OAuth 동의 화면 설정
1. "API 및 서비스" → "OAuth 동의 화면"
2. 외부(External) 선택
3. 앱 정보 입력:
   - 앱 이름: Live Commerce Platform
   - 사용자 지원 이메일: your-email@gmail.com
   - 개발자 연락처: your-email@gmail.com

#### Step 3: OAuth 클라이언트 ID 생성
1. "API 및 서비스" → "사용자 인증 정보"
2. "+ 사용자 인증 정보 만들기" → "OAuth 클라이언트 ID"
3. 애플리케이션 유형: 웹 애플리케이션
4. 승인된 리디렉션 URI 추가:
   ```
   http://localhost:3000/api/auth/callback/google
   https://your-app.railway.app/api/auth/callback/google
   ```
5. 클라이언트 ID와 클라이언트 시크릿 복사

#### Step 4: 환경변수 설정
```bash
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
```

---

### 2. Kakao OAuth 설정

#### Step 1: Kakao Developers 접속
1. https://developers.kakao.com 접속
2. 로그인 후 "내 애플리케이션" 이동

#### Step 2: 애플리케이션 추가
1. "애플리케이션 추가하기" 클릭
2. 앱 이름: Live Commerce Platform
3. 사업자명: 개인 (또는 회사명)

#### Step 3: 플랫폼 설정
1. 앱 설정 → 플랫폼
2. "Web 플랫폼 등록"
3. 사이트 도메인:
   ```
   http://localhost:3000
   https://your-app.railway.app
   ```

#### Step 4: Kakao 로그인 활성화
1. 제품 설정 → Kakao 로그인
2. 활성화 설정 ON
3. Redirect URI 등록:
   ```
   http://localhost:3000/api/auth/callback/kakao
   https://your-app.railway.app/api/auth/callback/kakao
   ```

#### Step 5: 동의항목 설정
1. 제품 설정 → Kakao 로그인 → 동의항목
2. 필수 동의:
   - 닉네임
   - 프로필 이미지
   - 카카오계정 (이메일)

#### Step 6: 환경변수 설정
```bash
# 앱 키 → REST API 키
KAKAO_CLIENT_ID="your-rest-api-key"

# 제품 설정 → Kakao 로그인 → 보안 → Client Secret (활성화 후 생성)
KAKAO_CLIENT_SECRET="your-client-secret"
```

---

## 📧 이메일 알림 설정

### 1. Gmail SMTP 설정 (권장)

#### Step 1: Google 계정 2단계 인증 활성화
1. https://myaccount.google.com/security 접속
2. "2단계 인증" 활성화

#### Step 2: 앱 비밀번호 생성
1. https://myaccount.google.com/apppasswords 접속
2. "앱 선택" → "메일"
3. "기기 선택" → "기타 (맞춤 이름)" → "Live Commerce"
4. 생성된 16자리 비밀번호 복사

#### Step 3: 환경변수 설정
```bash
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-16-digit-app-password"
SMTP_FROM="Live Commerce <noreply@gmail.com>"
```

---

### 2. SendGrid 설정 (대안)

#### Step 1: SendGrid 계정 생성
1. https://sendgrid.com 접속 및 가입
2. 무료 플랜 (하루 100통)

#### Step 2: API Key 생성
1. Settings → API Keys
2. "Create API Key"
3. Full Access 선택
4. API Key 복사

#### Step 3: 발신자 인증
1. Settings → Sender Authentication
2. "Verify a Single Sender"
3. 이메일 주소 및 정보 입력
4. 인증 이메일 확인

#### Step 4: 환경변수 설정
```bash
SMTP_HOST="smtp.sendgrid.net"
SMTP_PORT="587"
SMTP_USER="apikey"
SMTP_PASSWORD="your-sendgrid-api-key"
SMTP_FROM="Live Commerce <noreply@yourdomain.com>"
```

---

## ⚙️ 환경변수 설정

### 개발 환경 (.env)
```bash
# NextAuth
NEXTAUTH_SECRET="dev-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-secret"

# Kakao OAuth
KAKAO_CLIENT_ID="your-kakao-rest-api-key"
KAKAO_CLIENT_SECRET="your-kakao-secret"

# Email (Gmail)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-16-digit-app-password"
SMTP_FROM="Live Commerce <noreply@gmail.com>"
```

### 프로덕션 환경 (Railway)
Railway Settings → Variables에서 동일한 환경변수 설정

---

## 🧪 테스트 방법

### 1. 소셜 로그인 테스트

#### Google 로그인
1. http://localhost:3000/login 접속
2. "Google로 로그인" 버튼 클릭
3. Google 계정 선택 및 권한 승인
4. 자동 로그인 및 리다이렉트 확인

#### Kakao 로그인
1. http://localhost:3000/login 접속
2. "카카오로 로그인" 버튼 클릭
3. Kakao 계정 로그인 및 동의
4. 자동 로그인 및 리다이렉트 확인

### 2. 이메일 알림 테스트

#### 회원가입 환영 이메일
```bash
# API 테스트 (Postman 또는 curl)
POST /api/auth/register
{
  "email": "test@example.com",
  "password": "password123",
  "name": "Test User"
}

# 이메일 수신 확인 (test@example.com)
```

#### 주문 확인 이메일
```bash
# 관리자 페이지에서 주문 상태를 CONFIRMED로 변경
# 해당 고객 이메일로 주문 확인 이메일 발송 확인
```

#### 배송 시작 이메일
```bash
# 관리자 페이지에서 주문 상태를 SHIPPING으로 변경
# 해당 고객 이메일로 배송 시작 이메일 발송 확인
```

---

## 🔧 문제 해결

### 소셜 로그인 오류

#### "Redirect URI Mismatch" 에러
- Google/Kakao 콘솔에서 Redirect URI 정확히 확인
- `http://localhost:3000/api/auth/callback/google` (Google)
- `http://localhost:3000/api/auth/callback/kakao` (Kakao)

#### 로그인 후 리다이렉트 안 됨
- `NEXTAUTH_URL` 환경변수 확인
- 프로덕션: `https://your-app.railway.app`

### 이메일 전송 오류

#### Gmail "Less secure app" 에러
- 2단계 인증 활성화
- 앱 비밀번호 생성 (16자리)
- 일반 비밀번호 대신 앱 비밀번호 사용

#### SMTP 연결 실패
```bash
# 환경변수 확인
echo $SMTP_HOST
echo $SMTP_PORT
echo $SMTP_USER
```

#### 이메일 발송되지 않음
- SMTP 자격 증명 확인
- 방화벽/보안 그룹에서 SMTP 포트 (587) 허용
- SendGrid의 경우 발신자 인증 완료 확인

---

## 📊 이메일 템플릿 종류

| 템플릿 | 트리거 | 설명 |
|--------|--------|------|
| **환영 이메일** | 회원가입 | 가입 축하 및 서비스 소개 |
| **주문 확인** | 주문 → CONFIRMED | 주문 내역 및 예상 배송일 |
| **배송 시작** | 주문 → SHIPPING | 배송 시작 알림 및 운송장 번호 |
| **배송 완료** | 주문 → DELIVERED | 배송 완료 및 리뷰 작성 요청 |
| **비밀번호 재설정** | 비밀번호 찾기 | 재설정 링크 (1시간 유효) |

---

## 🎨 커스터마이징

### 이메일 템플릿 수정
파일: `lib/email.ts`

```typescript
export const emailTemplates = {
  welcome: (name: string, email: string) => ({
    subject: '커스텀 제목',
    html: `<html>...</html>`,
    text: '텍스트 버전'
  })
}
```

### 새 이메일 템플릿 추가
```typescript
// lib/email.ts
export const emailTemplates = {
  // ... 기존 템플릿
  
  customEmail: (name: string, data: any) => ({
    subject: '커스텀 이메일',
    html: `...`,
    text: `...`
  })
}

// 사용 예시
import { sendEmail, emailTemplates } from '@/lib/email'

const template = emailTemplates.customEmail('홍길동', {...})
await sendEmail({
  to: 'user@example.com',
  ...template
})
```

---

## ✅ 체크리스트

### 소셜 로그인
- [ ] Google OAuth 클라이언트 ID 생성
- [ ] Kakao 애플리케이션 등록
- [ ] Redirect URI 설정
- [ ] 환경변수 설정 (GOOGLE_, KAKAO_)
- [ ] NEXTAUTH_SECRET 설정
- [ ] Prisma 스키마 마이그레이션

### 이메일 알림
- [ ] Gmail 앱 비밀번호 생성 (또는 SendGrid API Key)
- [ ] 환경변수 설정 (SMTP_)
- [ ] 발신자 이메일 인증
- [ ] 테스트 이메일 발송 확인

---

## 🚀 배포 시 주의사항

### Railway 환경변수 설정
```bash
# 필수 추가 환경변수
NEXTAUTH_SECRET=<openssl rand -hex 32>
NEXTAUTH_URL=https://your-app.railway.app
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
KAKAO_CLIENT_ID=...
KAKAO_CLIENT_SECRET=...
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_FROM="Live Commerce <noreply@...>"
```

### OAuth Redirect URI 업데이트
- Google Console: `https://your-app.railway.app/api/auth/callback/google`
- Kakao Developers: `https://your-app.railway.app/api/auth/callback/kakao`

---

**설정 완료!** 🎉

문제가 발생하면 GitHub Issues에 등록해주세요.
