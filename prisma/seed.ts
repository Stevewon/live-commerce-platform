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
