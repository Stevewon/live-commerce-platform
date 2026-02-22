# 소셜 로그인 설정 가이드

## Google OAuth 설정

### 1. Google Cloud Console 설정

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트 생성 또는 선택
3. "API 및 서비스" → "OAuth 동의 화면" 클릭
4. 외부 사용자 선택 후 앱 정보 입력:
   - 앱 이름: `Live Commerce Platform`
   - 사용자 지원 이메일: your-email@gmail.com
   - 개발자 연락처 정보: your-email@gmail.com
5. "저장 후 계속" 클릭

### 2. OAuth 클라이언트 ID 생성

1. "사용자 인증 정보" → "+ 사용자 인증 정보 만들기" → "OAuth 클라이언트 ID"
2. 애플리케이션 유형: `웹 애플리케이션`
3. 이름: `Live Commerce Web`
4. 승인된 자바스크립트 원본:
   ```
   http://localhost:3015
   https://your-production-domain.com
   ```
5. 승인된 리디렉션 URI:
   ```
   http://localhost:3015/api/auth/callback/google
   https://your-production-domain.com/api/auth/callback/google
   ```
6. "만들기" 클릭
7. 클라이언트 ID와 클라이언트 보안 비밀 복사

### 3. 환경 변수 설정

`.env.local` 파일에 다음 추가:

```env
# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

---

## Kakao 로그인 설정

### 1. Kakao Developers 설정

1. [Kakao Developers](https://developers.kakao.com/) 접속
2. "내 애플리케이션" → "애플리케이션 추가하기"
3. 앱 이름: `Live Commerce Platform`
4. 회사명: 본인 이름 또는 회사명
5. "앱 만들기" 클릭

### 2. 플랫폼 설정

1. 앱 설정 → 플랫폼 → "Web 플랫폼 등록"
2. 사이트 도메인:
   ```
   http://localhost:3015
   https://your-production-domain.com
   ```

### 3. Kakao 로그인 활성화

1. 제품 설정 → Kakao 로그인
2. "Kakao 로그인 활성화" ON
3. Redirect URI 설정:
   ```
   http://localhost:3015/api/auth/callback/kakao
   https://your-production-domain.com/api/auth/callback/kakao
   ```

### 4. 동의 항목 설정

1. 제품 설정 → Kakao 로그인 → 동의 항목
2. 필수 동의:
   - 닉네임 (필수)
   - 프로필 사진 (선택)
   - 이메일 (필수) - **비즈니스 인증 필요**

> **참고**: 이메일 수집을 위해서는 비즈니스 인증이 필요합니다.
> 테스트 환경에서는 닉네임만으로도 로그인 가능합니다.

### 5. REST API 키 복사

1. 앱 설정 → 요약 정보
2. "REST API 키" 복사

### 6. 환경 변수 설정

`.env.local` 파일에 다음 추가:

```env
# Kakao OAuth
KAKAO_CLIENT_ID="your-kakao-rest-api-key"
KAKAO_CLIENT_SECRET="your-kakao-client-secret" # 선택사항
```

---

## NextAuth 설정 확인

`app/api/auth/[...nextauth]/route.ts` 파일이 다음과 같이 설정되어 있는지 확인:

```typescript
providers: [
  GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  }),
  KakaoProvider({
    clientId: process.env.KAKAO_CLIENT_ID!,
    clientSecret: process.env.KAKAO_CLIENT_SECRET || '',
  }),
  // ... 기타 providers
],
```

---

## 테스트

### 로컬 개발 환경

1. `.env.local` 파일에 모든 OAuth 키 설정
2. 개발 서버 재시작:
   ```bash
   npm run dev
   ```
3. 로그인 페이지 접속: http://localhost:3015/login
4. Google/Kakao 로그인 버튼 클릭
5. OAuth 인증 진행

### 프로덕션 환경

Railway 배포 시 환경 변수 설정:

```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
KAKAO_CLIENT_ID=your-kakao-client-id
KAKAO_CLIENT_SECRET=your-kakao-client-secret
NEXTAUTH_URL=https://your-railway-domain.railway.app
```

---

## 문제 해결

### Google OAuth 오류

- **Redirect URI 불일치**: Google Cloud Console에서 Redirect URI 확인
- **OAuth 동의 화면 미설정**: OAuth 동의 화면 설정 완료 확인

### Kakao 로그인 오류

- **Redirect URI 등록 안됨**: Kakao Developers에서 Redirect URI 등록 확인
- **이메일 수집 실패**: 비즈니스 인증 필요 (테스트 시 닉네임만 사용)

### NextAuth 세션 오류

- **NEXTAUTH_SECRET 미설정**: `.env.local`에 `NEXTAUTH_SECRET` 추가
- **NEXTAUTH_URL 미설정**: 프로덕션 환경에서 `NEXTAUTH_URL` 설정

---

## 로그인 플로우

1. 사용자가 로그인 페이지에서 "Google로 로그인" 또는 "Kakao로 로그인" 클릭
2. NextAuth가 OAuth 인증 페이지로 리다이렉트
3. 사용자가 OAuth 제공자에서 인증
4. NextAuth 콜백으로 리다이렉트 (email, name, image 정보 포함)
5. `signIn` 콜백에서 사용자 정보 확인:
   - 기존 사용자: 로그인 처리
   - 신규 사용자: 자동 회원가입 후 로그인
6. 역할에 따라 리다이렉트:
   - ADMIN → `/admin/dashboard`
   - PARTNER → `/partner/dashboard`
   - CUSTOMER → `/products`

---

## 보안 설정

### 프로덕션 환경

- HTTPS 필수
- `NEXTAUTH_SECRET` 강력한 키로 설정
- OAuth Redirect URI를 프로덕션 도메인으로만 제한

### 개발 환경

- `http://localhost:3015` 허용
- 테스트 계정 사용

---

## 추가 기능

### 소셜 계정 연결

기존 계정에 소셜 로그인 연결:

```typescript
// app/settings/page.tsx
<button onClick={() => signIn('google')}>
  Google 계정 연결
</button>
```

### 소셜 계정 연결 해제

```typescript
// Prisma에서 Account 삭제
await prisma.account.delete({
  where: {
    provider_providerAccountId: {
      provider: 'google',
      providerAccountId: user.id,
    },
  },
});
```

---

## 유용한 링크

- [Google Cloud Console](https://console.cloud.google.com/)
- [Kakao Developers](https://developers.kakao.com/)
- [NextAuth Documentation](https://next-auth.js.org/getting-started/introduction)
- [Google OAuth 설정 가이드](https://next-auth.js.org/providers/google)
- [Kakao OAuth 설정 가이드](https://next-auth.js.org/providers/kakao)
