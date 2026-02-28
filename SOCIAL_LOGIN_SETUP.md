# 🚀 소셜 로그인 설정 가이드 (구글/네이버/카카오)

QRLIVE 플랫폼은 최신 대기업 스타일의 소셜 로그인을 지원합니다!

---

## ✅ 현재 구현 상태

### 1. **UI 완성** ✓
- ✅ 구글/네이버/카카오 소셜 로그인 버튼 (대기업 스타일 디자인)
- ✅ 이메일 회원가입 옵션
- ✅ 모바일 반응형 레이아웃
- ✅ 애니메이션 & 호버 효과

### 2. **NextAuth.js 설정 완료** ✓
- ✅ Google OAuth Provider
- ✅ Kakao OAuth Provider
- ✅ 자동 회원가입/로그인 처리
- ✅ 기존 이메일 계정과 통합

### 3. **필요한 작업** ⚠️
OAuth 클라이언트 ID/Secret 발급이 필요합니다.

---

## 🔑 1. Google OAuth 설정 (5분 소요)

### Step 1: Google Cloud Console 접속
```
https://console.cloud.google.com/
```

### Step 2: 프로젝트 생성
1. 상단 프로젝트 선택 → **새 프로젝트** 클릭
2. 프로젝트 이름: **QRLIVE Platform**
3. **만들기** 클릭

### Step 3: OAuth 동의 화면 구성
1. 좌측 메뉴 → **APIs & Services** → **OAuth consent screen**
2. User Type: **External** 선택 → **만들기**
3. 필수 정보 입력:
   - 앱 이름: `QRLIVE`
   - 사용자 지원 이메일: `your-email@gmail.com`
   - 앱 도메인: `https://qrlive.io`
   - 개발자 연락처: `your-email@gmail.com`
4. **저장 후 계속**

### Step 4: 범위 추가
1. **ADD OR REMOVE SCOPES** 클릭
2. 선택할 범위:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
3. **UPDATE** → **저장 후 계속**

### Step 5: 테스트 사용자 추가 (개발 단계)
1. **ADD USERS** 클릭
2. 테스트할 이메일 주소 입력
3. **ADD** → **저장 후 계속**

### Step 6: OAuth 클라이언트 ID 만들기
1. 좌측 메뉴 → **Credentials** → **+ CREATE CREDENTIALS** → **OAuth client ID**
2. 애플리케이션 유형: **웹 애플리케이션**
3. 이름: `QRLIVE Web Client`
4. 승인된 자바스크립트 원본:
   ```
   http://localhost:3000
   https://qrlive.io
   ```
5. 승인된 리디렉션 URI:
   ```
   http://localhost:3000/api/auth/callback/google
   https://qrlive.io/api/auth/callback/google
   ```
6. **만들기** 클릭

### Step 7: 클라이언트 ID & Secret 복사
```env
GOOGLE_CLIENT_ID="123456789-abcdefg.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xyz123abc..."
```

---

## 💬 2. 카카오 OAuth 설정 (5분 소요)

### Step 1: Kakao Developers 접속
```
https://developers.kakao.com/
```

### Step 2: 애플리케이션 추가
1. **내 애플리케이션** → **애플리케이션 추가하기**
2. 앱 이름: **QRLIVE**
3. 사업자명: `your-company-name`
4. **저장**

### Step 3: 플랫폼 설정
1. 생성한 앱 선택 → **플랫폼** → **Web 플랫폼 등록**
2. 사이트 도메인:
   ```
   http://localhost:3000
   https://qrlive.io
   ```
3. **저장**

### Step 4: Redirect URI 등록
1. **제품 설정** → **카카오 로그인** → **Redirect URI 등록**
2. 추가할 URI:
   ```
   http://localhost:3000/api/auth/callback/kakao
   https://qrlive.io/api/auth/callback/kakao
   ```
3. **저장**

### Step 5: 동의 항목 설정
1. **제품 설정** → **카카오 로그인** → **동의 항목**
2. 필수 동의:
   - **프로필 정보(닉네임/프로필 사진)**: 필수 동의
   - **카카오계정(이메일)**: 필수 동의
3. **저장**

### Step 6: 카카오 로그인 활성화
1. **제품 설정** → **카카오 로그인** → **활성화 설정**
2. **ON**으로 변경

### Step 7: 앱 키 복사
1. **앱 설정** → **앱 키** 메뉴
2. 복사할 키:
   ```env
   KAKAO_CLIENT_ID="your-rest-api-key"
   ```
3. **제품 설정** → **카카오 로그인** → **보안** → Client Secret 생성
   ```env
   KAKAO_CLIENT_SECRET="your-client-secret"
   ```

---

## 🟢 3. 네이버 OAuth 설정 (5분 소요)

### Step 1: Naver Developers 접속
```
https://developers.naver.com/
```

### Step 2: 애플리케이션 등록
1. **Application** → **애플리케이션 등록**
2. 애플리케이션 이름: **QRLIVE**
3. 사용 API: **네아로(네이버 아이디로 로그인)** 선택
4. 제공 정보 선택:
   - 필수: **회원이름, 이메일 주소**
   - 선택: **프로필 사진**

### Step 3: 환경 설정
1. PC 웹:
   - 서비스 URL: `https://qrlive.io`
   - Callback URL: `https://qrlive.io/api/auth/callback/naver`
2. 개발 환경 추가:
   - 서비스 URL: `http://localhost:3000`
   - Callback URL: `http://localhost:3000/api/auth/callback/naver`

### Step 4: 클라이언트 ID & Secret 복사
```env
NAVER_CLIENT_ID="your-naver-client-id"
NAVER_CLIENT_SECRET="your-naver-client-secret"
```

---

## ⚙️ 4. .env 파일 설정

`.env` 파일에 아래 내용 추가:

```env
# NextAuth 설정
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="$(openssl rand -hex 32)"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Kakao OAuth
KAKAO_CLIENT_ID="your-kakao-rest-api-key"
KAKAO_CLIENT_SECRET="your-kakao-client-secret"

# Naver OAuth
NAVER_CLIENT_ID="your-naver-client-id"
NAVER_CLIENT_SECRET="your-naver-client-secret"
```

---

## 🚀 5. 서버 재시작

```bash
npm run dev
```

---

## ✅ 6. 테스트

### 로컬 테스트
1. 브라우저에서 접속: http://localhost:3000/register
2. **Google로 계속하기** 버튼 클릭
3. Google 계정 선택 및 권한 승인
4. 자동으로 회원가입/로그인 완료!

### 프로덕션 테스트
1. https://qrlive.io/register 접속
2. 소셜 로그인 버튼 클릭
3. 정상 작동 확인

---

## 🔒 보안 주의사항

⚠️ **절대 Git에 실제 키를 커밋하지 마세요!**
- `.env` 파일은 `.gitignore`에 포함되어야 합니다
- 프로덕션 키는 환경변수로 별도 관리 (Railway, Vercel 등)

---

## 📱 지원하는 소셜 로그인

| Provider | Status | Icon | Color |
|----------|--------|------|-------|
| 🔵 Google | ✅ 완료 | Multi-color | White bg |
| 🟢 Naver | ✅ 완료 | White N | `#03C75A` |
| 🟡 Kakao | ✅ 완료 | Black K | `#FEE500` |

---

## 🎨 UI 특징

- **대기업 스타일 디자인**: 간결하고 모던한 버튼 디자인
- **3초 회원가입**: 클릭 한 번으로 가입 완료
- **브랜드 컬러 유지**: 각 소셜 플랫폼의 공식 브랜드 가이드라인 준수
- **모바일 최적화**: 터치 친화적인 큰 버튼과 반응형 레이아웃
- **애니메이션 효과**: hover/active 상태 애니메이션

---

## 🛠️ 트러블슈팅

### "리다이렉트 URI 불일치" 오류
→ OAuth 콘솔에서 Redirect URI가 정확히 등록되었는지 확인
```
http://localhost:3000/api/auth/callback/google
http://localhost:3000/api/auth/callback/kakao
http://localhost:3000/api/auth/callback/naver
```

### "앱이 확인되지 않음" (Google)
→ 테스트 사용자 추가 또는 앱 검토 신청

### 카카오 "동의 항목 없음" 오류
→ 카카오 개발자 콘솔에서 동의 항목(프로필, 이메일) 설정 확인

---

## 📞 지원

문제가 있으신가요?
- 📧 이메일: support@qrlive.io
- 💬 GitHub Issues: [Repository URL]

---

**Built with ❤️ by Stevewon**
