#!/bin/bash

# ==================================
# 🔄 PostgreSQL 마이그레이션 스크립트
# ==================================
# Railway 배포 후 실행
# 
# 실행 방법:
#   railway run bash scripts/migrate-postgres.sh
#
# 또는 로컬에서:
#   DATABASE_URL="postgresql://..." bash scripts/migrate-postgres.sh
# ==================================

set -e  # 에러 발생 시 즉시 중단

echo "════════════════════════════════════════"
echo "🚀 PostgreSQL Migration Script"
echo "════════════════════════════════════════"
echo ""

# ----------------------------------
# 1. 환경변수 확인
# ----------------------------------
echo "📋 Step 1: Checking environment variables..."

if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL is not set!"
  echo "   Please set DATABASE_URL environment variable."
  exit 1
fi

echo "✅ DATABASE_URL is set"

# PostgreSQL 연결인지 확인
if [[ $DATABASE_URL != postgresql://* ]] && [[ $DATABASE_URL != postgres://* ]]; then
  echo "⚠️  WARNING: DATABASE_URL does not appear to be a PostgreSQL connection string"
  echo "   Current: $DATABASE_URL"
  read -p "   Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

echo ""

# ----------------------------------
# 2. Prisma Client 생성
# ----------------------------------
echo "📋 Step 2: Generating Prisma Client..."
npx prisma generate

if [ $? -eq 0 ]; then
  echo "✅ Prisma Client generated successfully"
else
  echo "❌ Failed to generate Prisma Client"
  exit 1
fi

echo ""

# ----------------------------------
# 3. 데이터베이스 스키마 동기화
# ----------------------------------
echo "📋 Step 3: Pushing schema to PostgreSQL..."
echo "⚠️  This will synchronize the database schema"
echo ""

# 프로덕션 환경 체크
if [ "$NODE_ENV" == "production" ]; then
  echo "🔴 PRODUCTION MODE DETECTED"
  echo "   This operation may cause data loss!"
  read -p "   Are you sure you want to continue? (yes/no) " -r
  echo
  if [[ ! $REPLY == "yes" ]]; then
    echo "❌ Migration cancelled"
    exit 1
  fi
fi

npx prisma db push --accept-data-loss

if [ $? -eq 0 ]; then
  echo "✅ Schema pushed successfully"
else
  echo "❌ Failed to push schema"
  exit 1
fi

echo ""

# ----------------------------------
# 4. 데이터베이스 확인
# ----------------------------------
echo "📋 Step 4: Verifying database connection..."
npx prisma db execute --stdin <<EOF
SELECT 1;
EOF

if [ $? -eq 0 ]; then
  echo "✅ Database connection verified"
else
  echo "⚠️  Could not verify database connection"
fi

echo ""

# ----------------------------------
# 5. 완료
# ----------------------------------
echo "════════════════════════════════════════"
echo "✅ Migration completed successfully!"
echo "════════════════════════════════════════"
echo ""
echo "📝 Next steps:"
echo "   1. Verify your application is running"
echo "   2. Check database tables: npx prisma studio"
echo "   3. Test API endpoints"
echo ""

