# 🚀 프로덕션 배포 가이드 - Railway

## 📋 빠른 시작

### 1. Railway 프로젝트 생성
1. [Railway](https://railway.app) 접속
2. "New Project" → "Deploy from GitHub repo"
3. `Stevewon/live-commerce-platform` 선택

### 2. PostgreSQL 추가
1. "New" → "Database" → "Add PostgreSQL"
2. `DATABASE_URL` 자동 생성됨

### 3. 환경 변수 설정 (Settings → Variables)

```bash
DATABASE_URL=postgresql://...  # Railway 자동 생성
JWT_SECRET=your-32-char-secret  # openssl rand -hex 32
NEXT_PUBLIC_TOSS_CLIENT_KEY=live_ck_...
TOSS_SECRET_KEY=live_sk_...
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-app.railway.app
PORT=${{RAILWAY_PORT}}
```

### 4. 마이그레이션 실행

```bash
# Railway CLI 설치
npm install -g @railway/cli

# 로그인 및 연결
railway login
railway link

# 마이그레이션
railway run bash scripts/migrate-postgres.sh
```

### 5. 배포 확인
- URL: https://your-app.railway.app
- 관리자: admin@example.com / admin123

## 📚 상세 가이드

상세한 배포 절차는 프로젝트 README.md 참조

## 🔧 문제 해결

### 빌드 실패
```bash
npm run build  # 로컬 테스트
```

### DB 연결 오류
```bash
railway run npx prisma db push
```

### 로그 확인
```bash
railway logs --tail 100
```

---

**배포 완료!** 🎉
