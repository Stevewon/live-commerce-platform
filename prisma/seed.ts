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
      description: '최신 갤럭시 스마트폰 - 뛰어난 성능과 카메라',
      detailContent: `
        <h2>제품 소개</h2>
        <p>삼성 갤럭시 S24는 최첨단 기술과 세련된 디자인이 완벽하게 조화된 프리미엄 스마트폰입니다.</p>
        <h3>주요 특징</h3>
        <ul>
          <li>🔋 5,000mAh 대용량 배터리로 하루 종일 사용 가능</li>
          <li>📸 200MP 메인 카메라 + AI 사진 보정</li>
          <li>⚡ Snapdragon 8 Gen 3 프로세서 탑재</li>
          <li>📱 6.8인치 Dynamic AMOLED 2X 디스플레이</li>
          <li>🎮 120Hz 주사율로 부드러운 게이밍</li>
        </ul>
        <h3>혁신적인 AI 기능</h3>
        <p>Galaxy AI가 탑재되어 실시간 통역, AI 사진 편집, 똑똑한 텍스트 요약 등 다양한 기능을 제공합니다.</p>
      `,
      price: 990000,
      comparePrice: 1200000,
      stock: 50,
      isFeatured: true,
      categoryId: categories[0].id,
      thumbnail: '/images/products/phone1.jpg',
      images: JSON.stringify(['/images/products/phone1.jpg', '/images/products/phone2.jpg', '/images/products/phone3.jpg']),
      detailImages: JSON.stringify(['/images/products/phone-detail1.jpg', '/images/products/phone-detail2.jpg']),
      specifications: JSON.stringify({
        '화면 크기': '6.8인치',
        '해상도': 'QHD+ (3120 x 1440)',
        '프로세서': 'Snapdragon 8 Gen 3',
        '메모리': '12GB RAM',
        '저장 용량': '256GB',
        '배터리': '5,000mAh',
        '카메라': '200MP + 12MP + 10MP',
        '운영체제': 'Android 14',
        '색상': '팬텀 블랙, 크림, 그린',
        '무게': '232g',
      }),
      shippingInfo: '평균 배송일: 1-2일 (주말/공휴일 제외)\n제주/도서산간: 추가 1일 소요\n새벽 배송 가능 지역: 서울/경기 일부',
      returnInfo: '상품 수령 후 7일 이내 무료 반품 가능\n단순 변심 시 왕복 배송비 고객 부담\n제품 하자 시 무료 교환/반품',
    },
    {
      name: '맥북 프로 M3',
      slug: 'macbook-pro-m3',
      description: 'Apple의 최강 노트북 - M3 칩 탑재',
      detailContent: `
        <h2>강력한 성능의 MacBook Pro</h2>
        <p>M3 칩이 탑재된 MacBook Pro는 전문가를 위한 최고의 선택입니다.</p>
        <h3>M3 칩의 혁신</h3>
        <ul>
          <li>💪 8코어 CPU + 10코어 GPU</li>
          <li>🚀 이전 세대 대비 최대 2배 빠른 성능</li>
          <li>🎨 4K 비디오 편집도 거뜬</li>
          <li>⏱️ 최대 22시간 배터리 수명</li>
        </ul>
        <h3>프로급 디스플레이</h3>
        <p>Liquid Retina XDR 디스플레이로 완벽한 색재현과 명암비를 제공합니다.</p>
      `,
      price: 2200000,
      comparePrice: 2500000,
      stock: 30,
      isFeatured: true,
      categoryId: categories[0].id,
      thumbnail: '/images/products/laptop1.jpg',
      images: JSON.stringify(['/images/products/laptop1.jpg', '/images/products/laptop2.jpg']),
      detailImages: JSON.stringify(['/images/products/laptop-detail1.jpg']),
      specifications: JSON.stringify({
        '화면': '14.2인치 Liquid Retina XDR',
        '해상도': '3024 x 1964',
        '칩셋': 'Apple M3',
        'CPU': '8코어',
        'GPU': '10코어',
        '메모리': '16GB 통합 메모리',
        '저장 용량': '512GB SSD',
        '배터리': '최대 22시간',
        '무게': '1.55kg',
        '색상': '스페이스 그레이, 실버',
      }),
      shippingInfo: '평균 배송일: 2-3일\n정품 인증서 포함\n애플 케어 가입 가능',
      returnInfo: '14일 이내 무료 반품\n개봉 후에도 반품 가능 (정상 작동 시)',
    },
    {
      name: '프리미엄 스킨케어 세트',
      slug: 'skincare-set',
      description: '럭셔리 스킨케어 풀 세트 - 피부 고민 해결',
      detailContent: `
        <h2>프리미엄 스킨케어 솔루션</h2>
        <p>피부과 전문의가 추천하는 럭셔리 스킨케어 라인입니다.</p>
        <h3>세트 구성</h3>
        <ul>
          <li>💧 클렌징 폼 150ml</li>
          <li>💦 토너 200ml</li>
          <li>✨ 에센스 50ml</li>
          <li>🧴 모이스처라이저 80ml</li>
          <li>🌞 선크림 SPF50+ 50ml</li>
        </ul>
        <h3>핵심 성분</h3>
        <p>히알루론산, 나이아신아마이드, 레티놀 등 피부에 좋은 성분만 엄선했습니다.</p>
      `,
      price: 150000,
      comparePrice: 180000,
      stock: 100,
      isFeatured: false,
      categoryId: categories[1].id,
      thumbnail: '/images/products/beauty1.jpg',
      images: JSON.stringify(['/images/products/beauty1.jpg']),
      specifications: JSON.stringify({
        '용량': '총 530ml',
        '피부 타입': '모든 피부',
        '주요 효능': '보습, 미백, 주름개선',
        '사용 기한': '개봉 후 12개월',
        '원산지': '대한민국',
        '제조사': '프리미엄뷰티',
      }),
      shippingInfo: '냉장 배송\n평균 배송일: 1-2일',
      returnInfo: '미개봉 시에만 반품 가능\n7일 이내 무료 반품',
    },
    {
      name: '유기농 견과류 선물세트',
      slug: 'organic-nuts',
      description: '건강한 유기농 견과류 프리미엄 세트',
      detailContent: `
        <h2>100% 유기농 견과류</h2>
        <p>엄선된 프리미엄 견과류만을 담았습니다.</p>
        <h3>세트 구성</h3>
        <ul>
          <li>🥜 유기농 아몬드 200g</li>
          <li>🌰 유기농 호두 200g</li>
          <li>🥜 유기농 캐슈넛 150g</li>
          <li>🌰 유기농 마카다미아 150g</li>
        </ul>
        <h3>영양 성분</h3>
        <p>오메가3, 비타민E, 단백질이 풍부하여 건강한 간식으로 최고입니다.</p>
      `,
      price: 45000,
      comparePrice: 50000,
      stock: 200,
      isFeatured: false,
      categoryId: categories[2].id,
      thumbnail: '/images/products/food1.jpg',
      images: JSON.stringify(['/images/products/food1.jpg']),
      specifications: JSON.stringify({
        '총 중량': '700g',
        '원산지': '미국, 호주',
        '유통 기한': '제조일로부터 6개월',
        '보관 방법': '직사광선을 피해 서늘한 곳에 보관',
        '인증': '유기농 인증, HACCP',
      }),
      shippingInfo: '실온 배송\n평균 배송일: 1-2일\n선물 포장 무료',
      returnInfo: '식품 특성상 단순 변심 반품 불가\n상품 하자 시 교환 가능',
    },
    {
      name: '명품 레더 재킷',
      slug: 'leather-jacket',
      description: '이탈리아 수입 천연 가죽 재킷',
      detailContent: `
        <h2>이탈리아 정통 레더</h2>
        <p>이탈리아에서 직수입한 최고급 천연 가죽으로 제작되었습니다.</p>
        <h3>제품 특징</h3>
        <ul>
          <li>🎨 100% 천연 가죽 사용</li>
          <li>✂️ 장인의 손길로 제작</li>
          <li>🎯 슬림핏 디자인</li>
          <li>🌟 사계절 착용 가능</li>
        </ul>
        <h3>관리 방법</h3>
        <p>전문 가죽 관리점에서 정기적으로 관리하시면 오래 착용 가능합니다.</p>
      `,
      price: 790000,
      comparePrice: 890000,
      stock: 20,
      isFeatured: true,
      categoryId: categories[3].id,
      thumbnail: '/images/products/fashion1.jpg',
      images: JSON.stringify(['/images/products/fashion1.jpg']),
      specifications: JSON.stringify({
        '소재': '천연 양가죽 100%',
        '색상': '블랙, 브라운',
        '사이즈': 'S, M, L, XL',
        '안감': '폴리에스터',
        '원산지': '이탈리아',
        '세탁 방법': '전문 드라이클리닝만 가능',
      }),
      shippingInfo: '평균 배송일: 2-3일\n고급 박스 포장',
      returnInfo: '착용 전 택 제거 금지\n상품 수령 후 7일 이내 반품 가능\n맞춤 제작 상품은 반품 불가',
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
