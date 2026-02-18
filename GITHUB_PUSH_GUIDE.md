# 🔐 GitHub 푸시 가이드

## ✅ GitHub 저장소가 생성되었습니다!

**저장소 URL**: https://github.com/Stevewon/live-commerce-platform

현재 상태:
- ✅ 저장소 생성 완료
- ✅ 로컬 코드 준비 완료 (10개 커밋)
- 🔄 푸시 대기 중

---

## 🔑 Personal Access Token 생성 (필수)

GitHub는 보안을 위해 비밀번호 대신 Personal Access Token을 사용합니다.

### 1단계: Token 생성

1. **GitHub 웹사이트 접속**
   - https://github.com 로그인

2. **Settings 이동**
   - 우측 상단 프로필 사진 클릭
   - "Settings" 클릭

3. **Developer settings**
   - 왼쪽 메뉴 맨 아래 "Developer settings" 클릭

4. **Personal access tokens**
   - "Personal access tokens" → "Tokens (classic)" 클릭
   - "Generate new token" → "Generate new token (classic)" 클릭

5. **Token 설정**
   ```
   Note: Live Commerce Platform Deploy
   Expiration: 90 days (또는 No expiration)
   
   ✅ Select scopes:
   [x] repo (전체 체크)
       [x] repo:status
       [x] repo_deployment
       [x] public_repo
       [x] repo:invite
       [x] security_events
   ```

6. **Generate token 클릭**
   - Token이 생성됩니다 (한 번만 표시됨!)
   - 예시: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - ⚠️ **반드시 복사해두세요!** (다시 볼 수 없습니다)

---

## 📤 코드 푸시하기

### 방법 1: HTTPS with Token (권장)

Token을 복사한 후, 다음 명령어를 실행하세요:

```bash
cd /home/user/webapp/live-commerce-platform

# Git 자격 증명 헬퍼 설정
git config credential.helper store

# 푸시 (Token 입력 필요)
git push -u origin main
```

**입력 프롬프트가 나타나면:**
```
Username: Stevewon
Password: [여기에 Token 붙여넣기]
```

⚠️ Password에는 GitHub 비밀번호가 아닌 **Token**을 입력하세요!

---

### 방법 2: Token을 URL에 포함 (빠른 방법)

```bash
cd /home/user/webapp/live-commerce-platform

# Token을 포함한 URL로 리모트 변경
git remote set-url origin https://[YOUR_TOKEN]@github.com/Stevewon/live-commerce-platform.git

# 푸시
git push -u origin main
```

**예시:**
```bash
# [YOUR_TOKEN] 부분을 실제 Token으로 교체
git remote set-url origin https://ghp_abcdefghijklmnopqrstuvwxyz1234567890@github.com/Stevewon/live-commerce-platform.git
```

---

## ✅ 푸시 성공 확인

푸시가 성공하면 다음과 같은 메시지가 표시됩니다:

```
Enumerating objects: 50, done.
Counting objects: 100% (50/50), done.
Delta compression using up to 8 threads
Compressing objects: 100% (45/45), done.
Writing objects: 100% (50/50), 15.23 KiB | 3.81 MiB/s, done.
Total 50 (delta 10), reused 0 (delta 0)
remote: Resolving deltas: 100% (10/10), done.
To https://github.com/Stevewon/live-commerce-platform.git
 * [new branch]      main -> main
Branch 'main' set up to track remote branch 'main' from 'origin'.
```

---

## 🌐 GitHub에서 확인

1. **저장소 페이지 새로고침**
   - https://github.com/Stevewon/live-commerce-platform

2. **확인 사항**
   - ✅ 10개 커밋 표시
   - ✅ 28개 파일 표시
   - ✅ README.md 내용 표시
   - ✅ 최근 커밋: "docs: 빠른 배포 가이드 추가"

---

## 🐛 트러블슈팅

### 문제 1: "Authentication failed"
**원인**: Token이 잘못되었거나 만료됨
**해결**: 
1. Token 재생성
2. Token 권한 확인 (repo 체크 필요)

### 문제 2: "Repository not found"
**원인**: 저장소 이름이나 권한 문제
**해결**:
1. 저장소 존재 확인
2. Public/Private 설정 확인

### 문제 3: "Permission denied"
**원인**: Token 권한 부족
**해결**:
1. Token 재생성 시 `repo` 전체 체크
2. Organization 저장소인 경우 `write:org` 권한 추가

---

## 🔄 대체 방법: GitHub Desktop

Token 설정이 어려우시다면 GitHub Desktop 앱을 사용하세요:

1. **GitHub Desktop 다운로드**
   - https://desktop.github.com

2. **저장소 열기**
   - File → Add Local Repository
   - `/home/user/webapp/live-commerce-platform` 선택

3. **Publish repository**
   - "Publish repository" 버튼 클릭
   - GitHub 계정으로 자동 로그인

---

## 📞 다음 단계

푸시 성공 후:

1. ✅ GitHub 저장소 확인
2. ✅ README.md 확인
3. 🚀 Vercel 배포 시작
4. 🌍 전 세계에 서비스 오픈!

---

## 💡 유용한 Git 명령어

```bash
# 현재 상태 확인
git status

# 리모트 확인
git remote -v

# 커밋 히스토리
git log --oneline

# 마지막 커밋 확인
git show HEAD

# 브랜치 확인
git branch -a
```

---

## 🎯 요약

1. GitHub에서 Personal Access Token 생성
2. Token 복사
3. `git push -u origin main` 실행
4. Username: `Stevewon`, Password: `[Token]` 입력
5. 성공! 🎉

---

**도움이 필요하시면 GitHub 문서를 참고하세요:**
- Token 생성: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token
- Git 인증: https://docs.github.com/en/get-started/getting-started-with-git/about-remote-repositories

**푸시 준비 완료!** 🚀
