#!/bin/bash
# Google OAuth 자동 설정 스크립트
# Google Cloud 프로젝트에서 OAuth 클라이언트 ID를 수동으로 생성해야 합니다

echo "======================================"
echo "🔑 Google OAuth 설정 가이드"
echo "======================================"
echo ""
echo "1️⃣ Google Cloud Console 접속:"
echo "   https://console.cloud.google.com/"
echo ""
echo "2️⃣ 프로젝트 생성 (이미 있다면 스킵):"
echo "   - 상단 프로젝트 드롭다운 클릭"
echo "   - '새 프로젝트' 클릭"
echo "   - 프로젝트 이름: QRLIVE Platform"
echo ""
echo "3️⃣ OAuth 동의 화면 설정:"
echo "   - APIs & Services → OAuth consent screen"
echo "   - User Type: External 선택"
echo "   - 앱 이름: QRLIVE"
echo "   - 지원 이메일: $(whoami)@gmail.com"
echo "   - 승인된 도메인: qrlive.io"
echo ""
echo "4️⃣ OAuth 2.0 클라이언트 ID 생성:"
echo "   - APIs & Services → Credentials"
echo "   - '+ CREATE CREDENTIALS' → 'OAuth client ID'"
echo "   - 애플리케이션 유형: Web application"
echo "   - 이름: QRLIVE Web Client"
echo ""
echo "5️⃣ 승인된 자바스크립트 원본 추가:"
echo "   http://localhost:3000"
echo "   https://3000-iw573oqulzos23ae750sv-18e660f9.sandbox.novita.ai"
echo "   https://qrlive.io"
echo ""
echo "6️⃣ 승인된 리디렉션 URI 추가:"
echo "   http://localhost:3000/api/auth/callback/google"
echo "   https://3000-iw573oqulzos23ae750sv-18e660f9.sandbox.novita.ai/api/auth/callback/google"
echo "   https://qrlive.io/api/auth/callback/google"
echo ""
echo "7️⃣ 생성 후 클라이언트 ID와 Secret 복사"
echo ""
echo "======================================"
echo ""
read -p "클라이언트 ID를 입력하세요: " CLIENT_ID
read -p "클라이언트 Secret을 입력하세요: " CLIENT_SECRET

if [ -z "$CLIENT_ID" ] || [ -z "$CLIENT_SECRET" ]; then
  echo "❌ 클라이언트 ID 또는 Secret이 비어있습니다."
  exit 1
fi

# .env 파일 업데이트
cd /home/user/webapp/live-commerce-platform
sed -i "s|GOOGLE_CLIENT_ID=\".*\"|GOOGLE_CLIENT_ID=\"$CLIENT_ID\"|" .env
sed -i "s|GOOGLE_CLIENT_SECRET=\".*\"|GOOGLE_CLIENT_SECRET=\"$CLIENT_SECRET\"|" .env

echo ""
echo "✅ Google OAuth 설정 완료!"
echo "📝 .env 파일이 업데이트되었습니다."
echo ""
echo "🔄 서버를 재시작하세요:"
echo "   npm run dev"
echo ""
