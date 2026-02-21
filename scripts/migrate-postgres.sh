#!/bin/bash

# PostgreSQL 마이그레이션 스크립트
# Railway 배포 후 실행

echo "🔄 Starting PostgreSQL migration..."

# 1. DATABASE_URL 확인
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL is not set!"
  exit 1
fi

echo "✅ DATABASE_URL is set"

# 2. Prisma Generate
echo "📦 Generating Prisma Client..."
npx prisma generate

# 3. Database Push (스키마 동기화)
echo "🔄 Pushing schema to PostgreSQL..."
npx prisma db push --accept-data-loss

# 4. 데이터 시딩 (선택 사항)
# echo "🌱 Seeding database..."
# npx prisma db seed

echo "✅ Migration completed successfully!"
