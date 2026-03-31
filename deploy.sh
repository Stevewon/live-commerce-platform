#!/bin/bash
# 큐라이브 배포 스크립트
# 사용법: CLOUDFLARE_API_TOKEN=새토큰 bash deploy.sh

if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
  echo "❌ CLOUDFLARE_API_TOKEN을 설정해주세요."
  echo "사용법: CLOUDFLARE_API_TOKEN=새토큰 bash deploy.sh"
  exit 1
fi

echo "🔨 빌드 중..."
rm -rf .open-next .next
DATABASE_URL="file:./prisma/dev.db" npx opennextjs-cloudflare build

echo "🚀 배포 중..."
npx wrangler deploy

echo "✅ 배포 완료!"
