# ✅ 프로덕션 배포 체크리스트

## 📋 배포 전 준비 (Pre-Deployment)

### 코드 준비
- [ ] `npm run build` 로컬 빌드 성공 확인
- [ ] `npm run type-check` TypeScript 에러 없음
- [ ] Git 모든 변경사항 커밋 완료
- [ ] GitHub에 최신 코드 푸시 완료

### 환경 설정 준비
- [ ] `.env.example` 파일 확인
- [ ] JWT 시크릿 키 생성 완료 (`openssl rand -hex 32`)
- [ ] 토스페이먼츠 실제 API 키 발급 완료
  - [ ] `NEXT_PUBLIC_TOSS_CLIENT_KEY` (live_ck_...)
  - [ ] `TOSS_SECRET_KEY` (live_sk_...)

### 계정 준비
- [ ] Railway 계정 생성 (https://railway.app)
- [ ] GitHub 계정 Railway에 연동
- [ ] 토스페이먼츠 개발자 계정 (https://developers.tosspayments.com)

---

## 🚂 Railway 배포 (Deployment)

### 프로젝트 생성
- [ ] Railway "New Project" 생성
- [ ] GitHub 저장소 연동 (`Stevewon/live-commerce-platform`)
- [ ] 자동 배포 시작 확인 (첫 배포는 실패 예상, 정상)

### 데이터베이스 설정
- [ ] PostgreSQL 플러그인 추가
- [ ] `DATABASE_URL` 환경변수 자동 생성 확인

### 환경변수 설정 (Settings → Variables)
- [ ] `DATABASE_URL` - PostgreSQL 플러그인이 자동 생성 (확인만)
- [ ] `JWT_SECRET` - 생성한 32자 시크릿 키 입력
- [ ] `NEXT_PUBLIC_TOSS_CLIENT_KEY` - 토스 클라이언트 키 입력
- [ ] `TOSS_SECRET_KEY` - 토스 시크릿 키 입력
- [ ] `NODE_ENV` - `production` 입력
- [ ] `NEXT_PUBLIC_APP_URL` - Railway 도메인 입력 (예: https://your-app.railway.app)
- [ ] `PORT` - `${{RAILWAY_PORT}}` 입력

### 재배포
- [ ] 환경변수 설정 후 "Redeploy" 클릭
- [ ] 빌드 로그 확인 (약 3-5분 소요)
- [ ] 배포 성공 확인 ✅

---

## 🗄️ 데이터베이스 마이그레이션

### Railway CLI 설치 및 설정
- [ ] Railway CLI 설치: `npm install -g @railway/cli`
- [ ] Railway 로그인: `railway login`
- [ ] 프로젝트 연결: `railway link`

### 마이그레이션 실행
- [ ] 마이그레이션 스크립트 실행: `railway run bash scripts/migrate-postgres.sh`
- [ ] Prisma 클라이언트 생성 확인
- [ ] 데이터베이스 스키마 푸시 확인
- [ ] 마이그레이션 성공 메시지 확인 ✅

### 데이터베이스 확인
- [ ] Prisma Studio로 테이블 확인: `railway run npx prisma studio` (선택사항)
- [ ] 15개 테이블 생성 확인
  - User, Partner, Product, Category, Order, OrderItem
  - CartItem, WishlistItem, Review, Coupon, Settlement
  - Notification, LiveStream, LiveChat, Payment

---

## ✅ 배포 후 테스트 (Post-Deployment)

### 기본 접속 테스트
- [ ] Railway 도메인 URL 접속 (예: https://your-app.railway.app)
- [ ] 홈페이지 정상 로딩 확인
- [ ] 404 페이지 없는지 확인

### 관리자 기능 테스트
- [ ] 관리자 로그인 (`admin@example.com` / `admin123`)
- [ ] 대시보드 접속 (`/admin/dashboard`)
- [ ] 차트 데이터 로딩 확인
- [ ] 주문 관리 페이지 (`/admin/orders`)
- [ ] 상품 관리 페이지 (`/admin/products`)
- [ ] 파트너 관리 페이지 (`/admin/partners`)
- [ ] 정산 관리 페이지 (`/admin/settlements`)

### 고객 기능 테스트
- [ ] 회원가입 테스트
- [ ] 로그인 테스트
- [ ] 상품 목록 조회 (`/shop`)
- [ ] 상품 상세 페이지
- [ ] 장바구니 추가
- [ ] 위시리스트 추가
- [ ] 주문 프로세스 테스트 (소액 실제 결제 권장)

### 파트너 기능 테스트
- [ ] 파트너 로그인 (`partner@example.com` / `partner123`)
- [ ] 파트너 대시보드 (`/partner/dashboard`)
- [ ] 상품 등록
- [ ] 라이브 스트리밍 생성 (`/partner/lives`)

### 라이브 스트리밍 & Socket.io 테스트
- [ ] 라이브 목록 페이지 (`/lives`)
- [ ] 라이브 스트리밍 페이지 접속
- [ ] Socket.io 연결 확인 (브라우저 콘솔 확인)
- [ ] 실시간 채팅 전송 테스트
- [ ] 온라인 사용자 수 표시 확인
- [ ] 타이핑 인디케이터 작동 확인

### 이미지 업로드 테스트
- [ ] 관리자 상품 등록 시 이미지 업로드
- [ ] 드래그 앤 드롭 기능 테스트
- [ ] 이미지 미리보기 확인
- [ ] 업로드된 이미지 public URL 접근 가능 확인

### 모바일 반응형 테스트
- [ ] 모바일 브라우저에서 접속
- [ ] 주요 페이지 레이아웃 확인
- [ ] 터치 인터랙션 테스트

---

## 🔐 보안 체크리스트

### 환경변수 보안
- [ ] `.env` 파일이 `.gitignore`에 포함되어 있는지 확인
- [ ] GitHub에 실제 환경변수가 커밋되지 않았는지 확인
- [ ] Railway 환경변수가 외부에 노출되지 않는지 확인

### JWT 및 인증
- [ ] `JWT_SECRET`이 32자 이상 강력한 랜덤 문자열인지 확인
- [ ] 프로덕션에서 개발용 시크릿 키 사용하지 않는지 확인

### API 키
- [ ] 토스페이먼츠 실제 키 (`live_ck_`, `live_sk_`) 사용 확인
- [ ] 테스트 키 (`test_ck_`, `test_sk_`)가 프로덕션에 없는지 확인

### HTTPS 및 도메인
- [ ] HTTPS가 적용되었는지 확인 (Railway 자동 적용)
- [ ] HTTP에서 HTTPS로 리다이렉트 확인
- [ ] 커스텀 도메인 사용 시 SSL 인증서 확인

### CORS 및 WebSocket
- [ ] `NEXT_PUBLIC_APP_URL`이 올바르게 설정되었는지 확인
- [ ] Socket.io CORS 설정 확인
- [ ] WebSocket 연결 가능 확인

---

## 📊 성능 체크리스트

### 로딩 속도
- [ ] 홈페이지 로딩 시간 (3초 이내 권장)
- [ ] 상품 목록 로딩 시간
- [ ] 이미지 로딩 최적화 확인

### 데이터베이스 성능
- [ ] 주요 쿼리 응답 시간 확인
- [ ] 인덱스 적용 확인
- [ ] N+1 쿼리 문제 없는지 확인

### 메모리 및 CPU
- [ ] Railway 리소스 사용량 확인
- [ ] 메모리 누수 없는지 확인
- [ ] CPU 사용률 모니터링

---

## 📈 모니터링 설정 (선택사항)

### 로그 모니터링
- [ ] Railway 로그 확인 방법 숙지
- [ ] 에러 로그 모니터링 설정
- [ ] Sentry 또는 Datadog 연동 (선택사항)

### 알림 설정
- [ ] Railway 프로젝트 다운타임 알림 활성화
- [ ] 데이터베이스 연결 실패 알림
- [ ] 배포 실패 이메일 알림

### 백업 전략
- [ ] PostgreSQL 자동 백업 설정 (Railway Pro 플랜)
- [ ] 주기적인 수동 백업 계획
- [ ] 백업 복원 테스트

---

## 🌐 커스텀 도메인 (선택사항)

### 도메인 연결
- [ ] Railway에서 Custom Domain 추가
- [ ] DNS CNAME 레코드 설정
- [ ] SSL 인증서 자동 발급 확인 (Let's Encrypt)
- [ ] `NEXT_PUBLIC_APP_URL` 환경변수 업데이트

### DNS 전파 확인
- [ ] 도메인 접속 가능 확인
- [ ] HTTPS 리다이렉트 확인
- [ ] www 서브도메인 리다이렉트 설정 (선택사항)

---

## 📝 문서화

### 운영 문서
- [ ] 배포 URL 기록
- [ ] 관리자 계정 정보 안전하게 보관
- [ ] 환경변수 목록 문서화
- [ ] API 엔드포인트 목록 정리

### 팀 공유
- [ ] 배포 완료 팀 공유
- [ ] 접속 정보 공유 (안전한 채널 사용)
- [ ] 문제 해결 가이드 공유

---

## 🎉 최종 확인

### 필수 체크
- [ ] 모든 환경변수 설정 완료
- [ ] 데이터베이스 마이그레이션 완료
- [ ] 관리자 로그인 성공
- [ ] 주요 기능 정상 작동
- [ ] 보안 설정 완료

### 배포 완료!
- [ ] 배포 완료 시각 기록: ________________
- [ ] 배포 URL: ________________
- [ ] 담당자: ________________

---

## 📚 추가 작업 (Post-Launch)

### 초기 데이터 입력
- [ ] 실제 카테고리 추가
- [ ] 파트너 계정 생성
- [ ] 샘플 상품 등록
- [ ] 라이브 스트리밍 테스트

### 운영 준비
- [ ] 고객 지원 채널 설정
- [ ] 이용약관 및 개인정보처리방침 업데이트
- [ ] FAQ 페이지 작성
- [ ] 공지사항 시스템 활용

### 마케팅 준비
- [ ] SEO 메타 태그 최적화
- [ ] Google Analytics 연동 (선택사항)
- [ ] 소셜 미디어 연동
- [ ] 오픈 이벤트 기획

---

**배포 체크리스트 완료를 축하합니다!** 🎉

성공적인 라이브 커머스 플랫폼 운영을 기원합니다!
