#!/bin/bash
# 큐라이브 Cloudflare Workers 배포 스크립트
# 사용법: CLOUDFLARE_API_TOKEN=<토큰> bash deploy.sh

set -e

if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
  echo "❌ CLOUDFLARE_API_TOKEN을 설정해주세요."
  echo "사용법: CLOUDFLARE_API_TOKEN=<토큰> bash deploy.sh"
  exit 1
fi

echo "🔨 빌드 중... (OpenNext + Cloudflare)"
rm -rf .open-next .next
DATABASE_URL="file:./prisma/dev.db" npx opennextjs-cloudflare build

echo "🚀 Cloudflare Workers 배포 중..."
npx wrangler deploy

echo "✅ 배포 완료! → https://qrlive.io"
