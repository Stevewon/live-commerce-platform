# 🚀 프로덕션 배포 가이드 - 소셜 로그인 활성화

## ⚠️ 중요: 프로덕션 서버 설정 필수

현재 개발 환경에서는 소셜 로그인이 정상 작동하지만, **프로덕션(qrlive.io)에서는 서버 환경 변수가 올바르게 설정되어야 합니다.**

## 🔧 프로덕션 서버에서 해야 할 작업

### 1단계: SSH로 프로덕션 서버 접속
```bash
ssh user@qrlive.io
# 또는 Railway/Vercel/기타 호스팅 대시보드 접속
```

### 2단계: 환경 변수 설정

#### Railway 사용 시:
```bash
# Railway 대시보드에서:
# Settings → Variables → 다음 변수 추가
```

#### 직접 서버 관리 시:
```bash
cd /path/to/qrlive/project
nano .env.production
```

다음 내용을 **정확하게** 입력:

```bash
# NextAuth 기본 설정
NEXTAUTH_URL=https://qrlive.io
NEXTAUTH_SECRET=your-production-secret-key-min-32-chars

# Google OAuth (반드시 실제 값으로 교체)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Naver OAuth (반드시 실제 값으로 교체)
NAVER_CLIENT_ID=your-naver-client-id
NAVER_CLIENT_SECRET=your-naver-client-secret

# Kakao OAuth (반드시 실제 값으로 교체)
KAKAO_CLIENT_ID=your-kakao-client-id
KAKAO_CLIENT_SECRET=your-kakao-client-secret
```

### 3단계: OAuth 제공자 설정 확인

#### Google Cloud Console
1. https://console.cloud.google.com 접속
2. QRLIVE 프로젝트 선택
3. APIs & Services → Credentials
4. QRLIVE Web Client 클릭
5. **Authorized redirect URIs**에 다음 추가:
   ```
   https://qrlive.io/api/auth/callback/google
   ```

#### Naver Developers
1. https://developers.naver.com 접속
2. 내 애플리케이션 → QRLIVE 선택
3. **Callback URL**에 다음 추가:
   ```
   https://qrlive.io/api/auth/callback/naver
   ```

#### Kakao Developers
1. https://developers.kakao.com 접속
2. 내 애플리케이션 → QRLIVE 선택
3. 제품 설정 → 카카오 로그인
4. **Redirect URI**에 다음 추가:
   ```
   https://qrlive.io/api/auth/callback/kakao
   ```

### 4단계: 빌드 및 재시작

```bash
# 프로덕션 빌드
npm run build

# PM2 사용 시
pm2 restart qrlive

# Systemd 사용 시
sudo systemctl restart qrlive

# Railway/Vercel
# 자동 재배포됨 (환경 변수 변경 시)
```

### 5단계: 테스트

```bash
# Provider API 테스트
curl https://qrlive.io/api/auth/providers

# 예상 응답:
# {"providers":["google","naver","kakao"],"email":true}
```

브라우저에서 테스트:
```
https://qrlive.io/register
```

## ⚡ 빠른 해결 방법

### 방법 1: Railway 사용 시
1. Railway 대시보드 열기
2. qrlive 프로젝트 클릭
3. Variables 탭 클릭
4. Raw Editor 클릭
5. 다음을 복사-붙여넣기:

```
NEXTAUTH_URL=https://qrlive.io
GOOGLE_CLIENT_ID=<실제값>
GOOGLE_CLIENT_SECRET=<실제값>
NAVER_CLIENT_ID=<실제값>
NAVER_CLIENT_SECRET=<실제값>
KAKAO_CLIENT_ID=<실제값>
KAKAO_CLIENT_SECRET=<실제값>
```

6. Save 클릭
7. 자동 재배포 대기

### 방법 2: Vercel 사용 시
1. Vercel 대시보드 열기
2. qrlive 프로젝트 클릭
3. Settings → Environment Variables
4. 각 변수 개별 추가
5. Redeploy 클릭

### 방법 3: 직접 서버
```bash
# SSH 접속
ssh user@your-server

# 환경 변수 파일 편집
cd /var/www/qrlive
nano .env

# 변수 추가 후 저장
# Ctrl+O, Enter, Ctrl+X

# 빌드 및 재시작
npm run build
pm2 restart all
```

## 🧪 디버깅

### 로그 확인
```bash
# PM2 로그
pm2 logs qrlive --lines 100

# Railway 로그
# 대시보드에서 Deployments → Latest → View Logs

# Vercel 로그
# 대시보드에서 Deployments → Latest → View Function Logs
```

### 환경 변수 확인
```bash
# 프로덕션 서버에서
printenv | grep GOOGLE
printenv | grep NAVER
printenv | grep KAKAO
printenv | grep NEXTAUTH
```

## ❌ 흔한 문제들

### 문제 1: "Configuration error" 또는 redirect 실패
**원인**: `NEXTAUTH_URL`이 `https://qrlive.io`로 설정되지 않음
**해결**: 환경 변수 확인 및 서버 재시작

### 문제 2: "invalid_client" 에러
**원인**: Client ID/Secret이 잘못됨
**해결**: 개발자 콘솔에서 올바른 값 복사

### 문제 3: "redirect_uri_mismatch" 에러
**원인**: OAuth 제공자에 redirect URI 미등록
**해결**: 각 개발자 콘솔에서 `https://qrlive.io/api/auth/callback/{provider}` 추가

## ✅ 체크리스트

프로덕션 배포 전 확인:

- [ ] Google Cloud Console에 `https://qrlive.io/api/auth/callback/google` 등록
- [ ] Naver Developers에 `https://qrlive.io/api/auth/callback/naver` 등록  
- [ ] Kakao Developers에 `https://qrlive.io/api/auth/callback/kakao` 등록
- [ ] 프로덕션 서버에 모든 환경 변수 설정
- [ ] `NEXTAUTH_URL=https://qrlive.io` 설정
- [ ] 프로덕션 빌드 완료 (`npm run build`)
- [ ] 서버 재시작 완료
- [ ] `https://qrlive.io/api/auth/providers` API 테스트
- [ ] 브라우저에서 각 소셜 로그인 버튼 테스트

## 📞 추가 지원

문제가 계속되면 다음 정보를 제공해주세요:
1. 호스팅 플랫폼 (Railway/Vercel/직접 서버)
2. `curl https://qrlive.io/api/auth/providers` 결과
3. 브라우저 개발자 도구의 Console 에러 메시지
4. 프로덕션 서버 로그

---

**작성일**: 2026-02-28
**목적**: qrlive.io 프로덕션 환경에서 소셜 로그인 활성화
