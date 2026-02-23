import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 카테고리 생성
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'electronics' },
      update: {},
      create: {
        name: '전자기기',
        slug: 'electronics',
        description: '스마트폰, 노트북, 태블릿 등',
      },
    }),
    prisma.category.upsert({
      where: { slug: 'beauty' },
      update: {},
      create: {
        name: '뷰티',
        slug: 'beauty',
        description: '화장품, 스킨케어, 향수',
      },
    }),
    prisma.category.upsert({
      where: { slug: 'food' },
      update: {},
      create: {
        name: '식품',
        slug: 'food',
        description: '건강식품, 간식, 음료',
      },
    }),
    prisma.category.upsert({
      where: { slug: 'fashion' },
      update: {},
      create: {
        name: '패션',
        slug: 'fashion',
        description: '의류, 신발, 액세서리',
      },
    }),
  ]);

  console.log('✅ Categories created:', categories.length);

  // 샘플 상품 생성
  const products = [
    {
      name: '갤럭시 스마트폰 S24',
      slug: 'galaxy-s24',
      description: '최신 갤럭시 스마트폰',
      price: 990000,
      comparePrice: 1200000,
      stock: 50,
      isFeatured: true,
      categoryId: categories[0].id,
      thumbnail: '/images/products/phone1.jpg',
      images: JSON.stringify(['/images/products/phone1.jpg']),
    },
    {
      name: '맥북 프로 M3',
      slug: 'macbook-pro-m3',
      description: 'Apple 맥북 프로',
      price: 2200000,
      comparePrice: 2500000,
      stock: 30,
      isFeatured: true,
      categoryId: categories[0].id,
      thumbnail: '/images/products/laptop1.jpg',
      images: JSON.stringify(['/images/products/laptop1.jpg']),
    },
    {
      name: '프리미엄 스킨케어 세트',
      slug: 'skincare-set',
      description: '럭셔리 스킨케어',
      price: 150000,
      comparePrice: 180000,
      stock: 100,
      isFeatured: false,
      categoryId: categories[1].id,
      thumbnail: '/images/products/beauty1.jpg',
      images: JSON.stringify(['/images/products/beauty1.jpg']),
    },
    {
      name: '유기농 견과류 선물세트',
      slug: 'organic-nuts',
      description: '건강한 유기농 견과류',
      price: 45000,
      comparePrice: 50000,
      stock: 200,
      isFeatured: false,
      categoryId: categories[2].id,
      thumbnail: '/images/products/food1.jpg',
      images: JSON.stringify(['/images/products/food1.jpg']),
    },
    {
      name: '명품 레더 재킷',
      slug: 'leather-jacket',
      description: '이탈리아 수입 레더',
      price: 790000,
      comparePrice: 890000,
      stock: 20,
      isFeatured: true,
      categoryId: categories[3].id,
      thumbnail: '/images/products/fashion1.jpg',
      images: JSON.stringify(['/images/products/fashion1.jpg']),
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: {},
      create: product,
    });
  }

  console.log('✅ Products created:', products.length);

  // 샘플 유저 생성 (파트너용)
  const partnerUsers = [
    {
      email: 'partner1@example.com',
      name: '김판매',
      password: 'password123', // 실제로는 해시화해야 함
      role: 'PARTNER',
    },
    {
      email: 'partner2@example.com',
      name: '이스트림',
      password: 'password123',
      role: 'PARTNER',
    },
    {
      email: 'partner3@example.com',
      name: '박라이브',
      password: 'password123',
      role: 'PARTNER',
    },
  ];

  const createdUsers = [];
  for (const userData of partnerUsers) {
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        email: userData.email,
        name: userData.name,
        password: userData.password,
        role: userData.role,
      },
    });
    createdUsers.push(user);
  }

  console.log('✅ Partner users created:', createdUsers.length);

  // 파트너 스토어 생성
  const partners = [
    {
      userId: createdUsers[0].id,
      storeName: '김판매 스토어',
      storeSlug: 'kim-store',
      description: '최저가 보장! 믿을 수 있는 정품만 판매합니다',
      commissionRate: 25.0,
      youtubeUrl: 'https://youtube.com/@kimstore',
      instagramUrl: 'https://instagram.com/kimstore',
    },
    {
      userId: createdUsers[1].id,
      storeName: '이스트림 샵',
      storeSlug: 'lee-shop',
      description: '라이브 방송으로 더 저렴하게! 실시간 특가 진행중',
      commissionRate: 30.0,
      africaTvUrl: 'https://afreecatv.com/leeshop',
      naverShoppingUrl: 'https://smartstore.naver.com/leeshop',
    },
    {
      userId: createdUsers[2].id,
      storeName: '박라이브 마켓',
      storeSlug: 'park-market',
      description: '검증된 상품만! 100% 정품 인증',
      commissionRate: 28.0,
      tiktokUrl: 'https://tiktok.com/@parkmarket',
      coupangUrl: 'https://coupang.com/vp/vendors/parkmarket',
    },
  ];

  const createdPartners = [];
  for (const partnerData of partners) {
    const partner = await prisma.partner.upsert({
      where: { storeSlug: partnerData.storeSlug },
      update: {},
      create: partnerData,
    });
    createdPartners.push(partner);
  }

  console.log('✅ Partners created:', createdPartners.length);

  // 상품 조회
  const allProducts = await prisma.product.findMany();

  // 파트너 상품 연결 (각 상품마다 2-3개의 파트너가 판매)
  const partnerProductData = [
    // 갤럭시 S24
    { partnerId: createdPartners[0].id, productId: allProducts.find(p => p.slug === 'galaxy-s24')?.id, customPrice: 980000 },
    { partnerId: createdPartners[1].id, productId: allProducts.find(p => p.slug === 'galaxy-s24')?.id, customPrice: 990000 },
    { partnerId: createdPartners[2].id, productId: allProducts.find(p => p.slug === 'galaxy-s24')?.id, customPrice: 995000 },
    
    // 맥북 프로 M3
    { partnerId: createdPartners[0].id, productId: allProducts.find(p => p.slug === 'macbook-pro-m3')?.id, customPrice: 2180000 },
    { partnerId: createdPartners[2].id, productId: allProducts.find(p => p.slug === 'macbook-pro-m3')?.id, customPrice: 2200000 },
    
    // 스킨케어 세트
    { partnerId: createdPartners[1].id, productId: allProducts.find(p => p.slug === 'skincare-set')?.id, customPrice: 145000 },
    { partnerId: createdPartners[2].id, productId: allProducts.find(p => p.slug === 'skincare-set')?.id, customPrice: 150000 },
    
    // 유기농 견과류
    { partnerId: createdPartners[0].id, productId: allProducts.find(p => p.slug === 'organic-nuts')?.id, customPrice: 43000 },
    { partnerId: createdPartners[1].id, productId: allProducts.find(p => p.slug === 'organic-nuts')?.id, customPrice: 45000 },
    { partnerId: createdPartners[2].id, productId: allProducts.find(p => p.slug === 'organic-nuts')?.id, customPrice: 44000 },
    
    // 명품 레더 재킷
    { partnerId: createdPartners[0].id, productId: allProducts.find(p => p.slug === 'leather-jacket')?.id, customPrice: 780000 },
    { partnerId: createdPartners[1].id, productId: allProducts.find(p => p.slug === 'leather-jacket')?.id, customPrice: 790000 },
  ];

  for (const ppData of partnerProductData.filter(pp => pp.productId)) {
    await prisma.partnerProduct.upsert({
      where: {
        partnerId_productId: {
          partnerId: ppData.partnerId!,
          productId: ppData.productId!,
        },
      },
      update: {},
      create: ppData as any,
    });
  }

  console.log('✅ Partner products created:', partnerProductData.filter(pp => pp.productId).length);
  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
