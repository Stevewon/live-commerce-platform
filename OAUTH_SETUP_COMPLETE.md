# 🚀 QRLIVE OAuth 완전 연동 가이드

OAuth가 설정되지 않아 현재는 **이메일 로그인만 표시**됩니다.
Google/Naver/Kakao 소셜 로그인을 활성화하려면 아래 단계를 따라주세요!

---

## ⚡ 빠른 시작 (5분)

### 🔵 **Google OAuth 설정**

#### 1. Google Cloud Console 접속
```
https://console.cloud.google.com/
```

#### 2. 새 프로젝트 생성
- 프로젝트 선택 → **새 프로젝트**
- 프로젝트 이름: `QRLIVE Platform`
- 만들기 클릭

#### 3. OAuth 동의 화면 설정
```
좌측 메뉴 → APIs & Services → OAuth consent screen
```

- User Type: **External** 선택
- 앱 이름: `QRLIVE`
- 사용자 지원 이메일: 본인 Gmail
- 승인된 도메인:
  - `qrlive.io`
  - `novita.ai` (샌드박스용)
- 저장 후 계속

#### 4. 테스트 사용자 추가 (개발 단계)
- **ADD USERS** 클릭
- 본인 Gmail 주소 입력
- 저장

#### 5. OAuth 2.0 클라이언트 ID 생성
```
좌측 메뉴 → Credentials → + CREATE CREDENTIALS → OAuth client ID
```

- 애플리케이션 유형: **Web application**
- 이름: `QRLIVE Web Client`

**승인된 자바스크립트 원본:**
```
http://localhost:3000
https://3000-iw573oqulzos23ae750sv-18e660f9.sandbox.novita.ai
https://qrlive.io
```

**승인된 리디렉션 URI:**
```
http://localhost:3000/api/auth/callback/google
https://3000-iw573oqulzos23ae750sv-18e660f9.sandbox.novita.ai/api/auth/callback/google
https://qrlive.io/api/auth/callback/google
```

- **만들기** 클릭

#### 6. 클라이언트 ID & Secret 복사
```
클라이언트 ID: 123456789-abc...apps.googleusercontent.com
클라이언트 Secret: GOCSPX-xyz...
```

#### 7. .env 파일 업데이트
```bash
cd /home/user/webapp/live-commerce-platform

# .env 파일 편집
nano .env

# 아래 라인을 실제 값으로 변경:
GOOGLE_CLIENT_ID="여기에-클라이언트-ID-붙여넣기"
GOOGLE_CLIENT_SECRET="여기에-시크릿-붙여넣기"

# 저장: Ctrl+O, Enter, Ctrl+X
```

#### 8. 서버 재시작
```bash
npm run dev
```

#### 9. 테스트
```
https://3000-iw573oqulzos23ae750sv-18e660f9.sandbox.novita.ai/register
```
→ **"Google로 계속하기"** 버튼이 자동으로 나타납니다! ✅

---

## 🟢 **Naver OAuth 설정** (5분)

#### 1. Naver Developers 접속
```
https://developers.naver.com/
```

#### 2. 애플리케이션 등록
- **Application** → **애플리케이션 등록**
- 애플리케이션 이름: `QRLIVE`
- 사용 API: **네아로(네이버 아이디로 로그인)**

#### 3. 제공 정보 선택
- 필수: **회원이름, 이메일 주소**
- 선택: **프로필 사진**

#### 4. 서비스 URL 설정
**PC 웹:**
```
서비스 URL: https://qrlive.io
Callback URL: https://qrlive.io/api/auth/callback/naver
```

**추가 (샌드박스):**
```
서비스 URL: https://3000-iw573oqulzos23ae750sv-18e660f9.sandbox.novita.ai
Callback URL: https://3000-iw573oqulzos23ae750sv-18e660f9.sandbox.novita.ai/api/auth/callback/naver
```

**로컬 개발:**
```
서비스 URL: http://localhost:3000
Callback URL: http://localhost:3000/api/auth/callback/naver
```

#### 5. 클라이언트 정보 복사
```
Client ID: abc123...
Client Secret: xyz789...
```

#### 6. .env 업데이트
```bash
NAVER_CLIENT_ID="여기에-클라이언트-ID"
NAVER_CLIENT_SECRET="여기에-시크릿"
```

---

## 🟡 **Kakao OAuth 설정** (5분)

#### 1. Kakao Developers 접속
```
https://developers.kakao.com/
```

#### 2. 애플리케이션 추가
- **내 애플리케이션** → **애플리케이션 추가하기**
- 앱 이름: `QRLIVE`
- 저장

#### 3. 플랫폼 설정
```
플랫폼 → Web 플랫폼 등록
```

**사이트 도메인:**
```
http://localhost:3000
https://3000-iw573oqulzos23ae750sv-18e660f9.sandbox.novita.ai
https://qrlive.io
```

#### 4. Redirect URI 등록
```
제품 설정 → 카카오 로그인 → Redirect URI 등록
```

**URI 추가:**
```
http://localhost:3000/api/auth/callback/kakao
https://3000-iw573oqulzos23ae750sv-18e660f9.sandbox.novita.ai/api/auth/callback/kakao
https://qrlive.io/api/auth/callback/kakao
```

#### 5. 동의 항목 설정
```
제품 설정 → 카카오 로그인 → 동의 항목
```

- **프로필 정보(닉네임/프로필 사진)**: 필수 동의
- **카카오계정(이메일)**: 필수 동의

#### 6. 카카오 로그인 활성화
```
제품 설정 → 카카오 로그인 → 활성화 설정 → ON
```

#### 7. 앱 키 복사
```
앱 설정 → 앱 키
```

- **REST API 키**: abc123...
- **보안** → Client Secret 생성: xyz789...

#### 8. .env 업데이트
```bash
KAKAO_CLIENT_ID="여기에-REST-API-키"
KAKAO_CLIENT_SECRET="여기에-Client-Secret"
```

---

## ✅ **설정 완료 확인**

### 1. Providers API 테스트
```bash
curl http://localhost:3000/api/auth/providers
```

**예상 결과:**
```json
{
  "providers": ["google", "naver", "kakao"],
  "email": true
}
```

### 2. 회원가입 페이지 확인
```
https://3000-iw573oqulzos23ae750sv-18e660f9.sandbox.novita.ai/register
```

**보여야 할 것:**
- ✅ Google로 계속하기 (초록색 체크)
- ✅ 네이버로 계속하기
- ✅ 카카오로 계속하기
- ✅ 이메일로 가입하기

### 3. 실제 로그인 테스트
1. **Google로 계속하기** 클릭
2. Google 계정 선택
3. 권한 승인
4. 자동으로 회원가입 → 홈으로 이동 ✅

---

## 🎯 **현재 상태**

```bash
✅ OAuth 설정 안내 완료
✅ Dynamic provider detection 구현
✅ Smart UI (설정된 OAuth만 표시)
⏳ Google OAuth 클라이언트 ID 발급 필요
⏳ Naver OAuth 클라이언트 ID 발급 필요
⏳ Kakao OAuth 클라이언트 ID 발급 필요
```

---

## 🛠️ **자동 설정 스크립트**

```bash
# Google OAuth 대화형 설정
cd /home/user/webapp/live-commerce-platform
./setup-google-oauth.sh
```

입력할 것:
1. Google 클라이언트 ID
2. Google 클라이언트 Secret

→ .env 파일 자동 업데이트 ✅

---

## 📱 **현재 UI 동작**

### OAuth 미설정 시 (현재):
```
┌─────────────────────────────┐
│   🔵 QRLIVE 로고            │
│  "간편하게 시작하기"         │
│ "이메일로 간편하게 가입"     │
├─────────────────────────────┤
│ ℹ️ 소셜 로그인 준비 중      │
│  관리자가 OAuth 설정 완료시  │
│  사용 가능합니다.            │
│                             │
│ [✉️ 이메일로 가입하기]       │
│                             │
│  이미 계정이 있으신가요?    │
│       [로그인]              │
└─────────────────────────────┘
```

### OAuth 설정 후:
```
┌─────────────────────────────┐
│   🔵 QRLIVE 로고            │
│  "간편하게 시작하기"         │
│  "SNS 계정으로 3초만에"     │
├─────────────────────────────┤
│ [🔵 Google로 계속하기]       │
│ [🟢 네이버로 계속하기]       │
│ [🟡 카카오로 계속하기]       │
│    ────── 또는 ──────       │
│ [✉️ 이메일로 가입하기]       │
│                             │
│  이미 계정이 있으신가요?    │
│       [로그인]              │
└─────────────────────────────┘
```

---

## 🚨 **트러블슈팅**

### "invalid_client" 오류
→ 클라이언트 ID/Secret이 잘못되었거나 .env에 제대로 설정되지 않음
→ .env 파일 재확인 후 서버 재시작

### "redirect_uri_mismatch" 오류
→ OAuth 콘솔에서 Redirect URI가 정확히 등록되지 않음
→ URI 끝에 슬래시(/) 유무 주의

### 버튼이 나타나지 않음
→ `/api/auth/providers` 호출하여 providers 배열 확인
→ .env 파일에서 플레이스홀더 제거 확인

---

**OAuth 설정 완료 후 즉시 사용 가능합니다!** 🎉

Test URL: https://3000-iw573oqulzos23ae750sv-18e660f9.sandbox.novita.ai/register
