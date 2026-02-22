import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 시드 데이터 삽입 시작...');

  // 관리자 계정
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password: adminPassword,
      name: '관리자',
      role: 'ADMIN',
    },
  });
  console.log('✅ 관리자 계정 생성:', admin.email);

  // 파트너 계정
  const partnerPassword = await bcrypt.hash('partner123', 10);
  const partnerUser = await prisma.user.upsert({
    where: { email: 'partner@example.com' },
    update: {},
    create: {
      email: 'partner@example.com',
      password: partnerPassword,
      name: '김스트리머',
      phone: '010-9876-5432',
      role: 'PARTNER',
    },
  });
  console.log('✅ 파트너 계정 생성:', partnerUser.email);

  const partner = await prisma.partner.upsert({
    where: { userId: partnerUser.id },
    update: {},
    create: {
      userId: partnerUser.id,
      storeName: '김스트리머 샵',
      storeSlug: 'kim-streamer',
      description: '최고의 제품을 소개합니다!',
      commissionRate: 30.0,
      isActive: true,
    },
  });
  console.log('✅ 파트너 스토어 생성:', partner.storeName);

  // 고객 계정
  const customerPassword = await bcrypt.hash('test123', 10);
  const customer = await prisma.user.upsert({
    where: { email: 'test2@example.com' },
    update: {},
    create: {
      email: 'test2@example.com',
      password: customerPassword,
      name: '테스트 고객',
      phone: '010-1234-5678',
      role: 'CUSTOMER',
    },
  });
  console.log('✅ 고객 계정 생성:', customer.email);

  // 카테고리 생성
  const categories = [
    { name: '패션', slug: 'fashion' },
    { name: '뷰티', slug: 'beauty' },
    { name: '푸드', slug: 'food' },
    { name: '리빙', slug: 'living' },
    { name: '디지털', slug: 'digital' },
    { name: '스포츠', slug: 'sports' },
    { name: '키즈', slug: 'kids' },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }
  console.log('✅ 카테고리 생성: 7개');

  // 샘플 상품 생성
  const fashionCategory = await prisma.category.findUnique({
    where: { slug: 'fashion' },
  });

  if (fashionCategory) {
    const product1 = await prisma.product.upsert({
      where: { slug: 'sample-product-1' },
      update: {},
      create: {
        name: '데일리 베이직 티셔츠',
        slug: 'sample-product-1',
        description: '편안한 착용감의 데일리 베이직 티셔츠입니다.',
        price: 29900,
        comparePrice: 39900,
        stock: 100,
        sku: 'PROD-001',
        images: JSON.stringify([
          'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800',
        ]),
        thumbnail: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400',
        categoryId: fashionCategory.id,
        isActive: true,
        isFeatured: true,
      },
    });
    console.log('✅ 샘플 상품 생성:', product1.name);

    // 파트너 상품 연결
    await prisma.partnerProduct.upsert({
      where: {
        partnerId_productId: {
          partnerId: partner.id,
          productId: product1.id,
        },
      },
      update: {},
      create: {
        partnerId: partner.id,
        productId: product1.id,
        isActive: true,
      },
    });
    console.log('✅ 파트너 상품 연결 완료');
  }

  // 샘플 쿠폰 생성
  const coupon1 = await prisma.coupon.upsert({
    where: { code: 'WELCOME2024' },
    update: {},
    create: {
      code: 'WELCOME2024',
      name: '신규 회원 환영 쿠폰',
      description: '첫 구매 시 10% 할인',
      type: 'PERCENT',
      value: 10,
      minAmount: 30000,
      maxDiscount: 10000,
      validFrom: new Date('2024-01-01'),
      validUntil: new Date('2025-12-31'),
      usageLimit: 1000,
      isActive: true,
    },
  });
  console.log('✅ 샘플 쿠폰 생성:', coupon1.code);

  console.log('\n🎉 시드 데이터 삽입 완료!');
  console.log('\n📋 테스트 계정 정보:');
  console.log('  관리자: admin@example.com / admin123');
  console.log('  파트너: partner@example.com / partner123');
  console.log('  고객: test2@example.com / test123');
  console.log('\n🎫 샘플 쿠폰: WELCOME2024 (10% 할인)');
}

main()
  .catch((e) => {
    console.error('❌ 시드 데이터 삽입 실패:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
