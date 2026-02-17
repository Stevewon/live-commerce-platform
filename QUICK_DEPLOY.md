# 🚀 빠른 배포 가이드 (Quick Reference)

## 📦 1. GitHub 저장소 생성 (5분)

### 웹에서 생성
1. https://github.com → 로그인
2. `+` → "New repository"
3. 이름: `live-commerce-platform`
4. Public 선택
5. ⚠️ README, .gitignore 체크 **해제**
6. "Create repository" 클릭

### 푸시
```bash
cd /home/user/webapp/live-commerce-platform
git push -u origin main
```

✅ **완료!** GitHub에서 코드 확인

---

## 🌐 2. Vercel 배포 (10분)

### Step 1: Import
1. https://vercel.com → 로그인
2. "New Project" → GitHub 연결
3. `live-commerce-platform` 선택 → Import

### Step 2: 환경 변수 (중요!)
```env
NODE_ENV=production
JWT_SECRET=[64자 랜덤 문자열]
DATABASE_URL=[PostgreSQL 연결 문자열]
NEXT_PUBLIC_API_URL=[자동 설정됨]
```

### Step 3: 데이터베이스 (Neon 추천)
1. https://neon.tech → 가입
2. 프로젝트 생성 → 연결 문자열 복사
3. Vercel에 `DATABASE_URL` 추가

### Step 4: 배포
"Deploy" 클릭 → 2-3분 대기

✅ **완료!** URL: `https://your-app.vercel.app`

---

## ⚡ 한 줄 요약

```bash
# GitHub
https://github.com → New repo → Push

# Vercel  
https://vercel.com → Import → 환경변수 → Deploy

# 데이터베이스
https://neon.tech → 생성 → 연결
```

---

## 🔑 필수 환경 변수

| 변수 | 설명 | 예시 |
|------|------|------|
| `JWT_SECRET` | 인증 토큰 시크릿 | `a9f3k2m5n8p1q4r7s0...` (64자+) |
| `DATABASE_URL` | PostgreSQL 연결 | `postgresql://user:pwd@host/db` |
| `NODE_ENV` | 환경 | `production` |

---

## ✅ 배포 체크리스트

- [ ] GitHub 저장소 생성 완료
- [ ] 코드 푸시 완료
- [ ] Vercel 프로젝트 생성
- [ ] 환경 변수 3개 설정
- [ ] PostgreSQL 데이터베이스 생성
- [ ] 배포 성공
- [ ] URL 접속 확인
- [ ] 로그인 테스트

---

## 🆘 문제 발생 시

### 빌드 실패
→ `npm install` 후 재푸시

### DB 연결 실패
→ `DATABASE_URL` 확인

### 환경 변수 인식 안 됨
→ Vercel 재배포

---

## 📞 도움말

- **Vercel 문서**: vercel.com/docs
- **Neon 문서**: neon.tech/docs
- **Next.js 배포**: nextjs.org/docs/deployment

---

**배포 예상 시간**: 15분  
**난이도**: ⭐⭐☆☆☆ (쉬움)

상세 가이드: `DEPLOYMENT_GUIDE.md` 참고
