import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 시드 데이터 생성 시작...')

  // 1. 관리자 계정 생성
  console.log('👤 관리자 계정 생성...')
  const adminPassword = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@livecommerce.com' },
    update: {},
    create: {
      email: 'admin@livecommerce.com',
      password: adminPassword,
      name: '플랫폼 관리자',
      phone: '010-1234-5678',
      role: 'ADMIN'
    }
  })
  console.log('✅ 관리자 계정 생성 완료:', admin.email)

  // 2. 파트너 계정 및 쇼핑몰 생성
  console.log('👤 파트너 계정 생성...')
  const partnerPassword = await bcrypt.hash('partner123', 10)
  const partnerUser = await prisma.user.upsert({
    where: { email: 'partner@example.com' },
    update: {},
    create: {
      email: 'partner@example.com',
      password: partnerPassword,
      name: '김스트리머',
      phone: '010-9876-5432',
      role: 'PARTNER'
    }
  })

  const partner = await prisma.partner.upsert({
    where: { userId: partnerUser.id },
    update: {},
    create: {
      userId: partnerUser.id,
      storeName: '김스트리머의 라이브샵',
      storeSlug: 'kimstreamer',
      description: '라이브로 소통하며 판매하는 즐거운 쇼핑!',
      commissionRate: 30.0,
      youtubeUrl: 'https://youtube.com/@kimstreamer',
      africaTvUrl: 'https://afreecatv.com/kimstreamer',
      isActive: true
    }
  })
  console.log('✅ 파트너 생성 완료:', partner.storeName)

  // 3. 카테고리 생성
  console.log('📁 카테고리 생성...')
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'electronics' },
      update: {},
      create: {
        name: '전자제품',
        slug: 'electronics',
        description: '최신 전자제품 모음'
      }
    }),
    prisma.category.upsert({
      where: { slug: 'fashion' },
      update: {},
      create: {
        name: '패션',
        slug: 'fashion',
        description: '트렌디한 패션 아이템'
      }
    }),
    prisma.category.upsert({
      where: { slug: 'beauty' },
      update: {},
      create: {
        name: '뷰티',
        slug: 'beauty',
        description: '뷰티 제품 모음'
      }
    }),
    prisma.category.upsert({
      where: { slug: 'food' },
      update: {},
      create: {
        name: '식품',
        slug: 'food',
        description: '신선한 식품'
      }
    })
  ])
  console.log(`✅ ${categories.length}개 카테고리 생성 완료`)

  // 4. 제품 생성
  console.log('📦 제품 생성...')
  const products = await Promise.all([
    prisma.product.upsert({
      where: { slug: 'wireless-earbuds-pro' },
      update: {},
      create: {
        name: '무선 이어버드 Pro',
        slug: 'wireless-earbuds-pro',
        description: '노이즈 캔슬링 기능이 있는 프리미엄 무선 이어버드',
        price: 129000,
        comparePrice: 159000,
        stock: 100,
        sku: 'WEB-001',
        images: JSON.stringify(['/images/earbuds-1.jpg', '/images/earbuds-2.jpg']),
        thumbnail: '/images/earbuds-thumb.jpg',
        categoryId: categories[0].id,
        isActive: true,
        isFeatured: true
      }
    }),
    prisma.product.upsert({
      where: { slug: 'smart-watch-x1' },
      update: {},
      create: {
        name: '스마트워치 X1',
        slug: 'smart-watch-x1',
        description: '건강 관리 기능이 강화된 스마트워치',
        price: 249000,
        comparePrice: 299000,
        stock: 50,
        sku: 'SMW-001',
        images: JSON.stringify(['/images/watch-1.jpg', '/images/watch-2.jpg']),
        thumbnail: '/images/watch-thumb.jpg',
        categoryId: categories[0].id,
        isActive: true,
        isFeatured: true
      }
    }),
    prisma.product.upsert({
      where: { slug: 'premium-hoodie' },
      update: {},
      create: {
        name: '프리미엄 후드티',
        slug: 'premium-hoodie',
        description: '편안한 착용감의 프리미엄 후드티',
        price: 59000,
        comparePrice: 79000,
        stock: 200,
        sku: 'FSH-001',
        images: JSON.stringify(['/images/hoodie-1.jpg', '/images/hoodie-2.jpg']),
        thumbnail: '/images/hoodie-thumb.jpg',
        categoryId: categories[1].id,
        isActive: true,
        isFeatured: false
      }
    }),
    prisma.product.upsert({
      where: { slug: 'vitamin-c-serum' },
      update: {},
      create: {
        name: '비타민C 세럼',
        slug: 'vitamin-c-serum',
        description: '피부 톤 개선에 효과적인 비타민C 세럼',
        price: 39000,
        comparePrice: 49000,
        stock: 150,
        sku: 'BTY-001',
        images: JSON.stringify(['/images/serum-1.jpg', '/images/serum-2.jpg']),
        thumbnail: '/images/serum-thumb.jpg',
        categoryId: categories[2].id,
        isActive: true,
        isFeatured: true
      }
    }),
    prisma.product.upsert({
      where: { slug: 'organic-honey' },
      update: {},
      create: {
        name: '유기농 꿀',
        slug: 'organic-honey',
        description: '100% 국내산 유기농 꿀',
        price: 45000,
        comparePrice: 55000,
        stock: 80,
        sku: 'FD-001',
        images: JSON.stringify(['/images/honey-1.jpg', '/images/honey-2.jpg']),
        thumbnail: '/images/honey-thumb.jpg',
        categoryId: categories[3].id,
        isActive: true,
        isFeatured: false
      }
    })
  ])
  console.log(`✅ ${products.length}개 제품 생성 완료`)

  // 5. 파트너 제품 연결
  console.log('🔗 파트너 제품 연결...')
  await Promise.all(
    products.slice(0, 3).map(product =>
      prisma.partnerProduct.upsert({
        where: {
          partnerId_productId: {
            partnerId: partner.id,
            productId: product.id
          }
        },
        update: {},
        create: {
          partnerId: partner.id,
          productId: product.id,
          isActive: true
        }
      })
    )
  )
  console.log('✅ 파트너 제품 연결 완료')

  // 6. 테스트 고객 생성
  console.log('👤 테스트 고객 생성...')
  const customerPassword = await bcrypt.hash('customer123', 10)
  const customer = await prisma.user.upsert({
    where: { email: 'customer@example.com' },
    update: {},
    create: {
      email: 'customer@example.com',
      password: customerPassword,
      name: '홍길동',
      phone: '010-1111-2222',
      role: 'CUSTOMER'
    }
  })
  console.log('✅ 테스트 고객 생성 완료:', customer.email)

  // 7. 샘플 주문 생성
  console.log('📝 샘플 주문 생성...')
  const sampleOrder = await prisma.order.create({
    data: {
      orderNumber: `ORD-${Date.now()}`,
      userId: customer.id,
      partnerId: partner.id,
      subtotal: 129000,
      discount: 0,
      shippingFee: 3000,
      total: 132000,
      partnerRevenue: 39600, // 30%
      platformRevenue: 92400, // 70%
      status: 'CONFIRMED',
      shippingName: '홍길동',
      shippingPhone: '010-1111-2222',
      shippingAddress: '서울시 강남구 테헤란로 123',
      shippingZipCode: '06234',
      paymentMethod: 'card',
      paidAt: new Date(),
      items: {
        create: [
          {
            productId: products[0].id,
            quantity: 1,
            price: 129000
          }
        ]
      }
    }
  })
  console.log('✅ 샘플 주문 생성 완료:', sampleOrder.orderNumber)

  console.log('\n🎉 시드 데이터 생성 완료!\n')
  console.log('📋 생성된 계정:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('👨‍💼 관리자:')
  console.log('   이메일: admin@livecommerce.com')
  console.log('   비밀번호: admin123')
  console.log('')
  console.log('👨‍💻 파트너:')
  console.log('   이메일: partner@example.com')
  console.log('   비밀번호: partner123')
  console.log('   쇼핑몰: 김스트리머의 라이브샵')
  console.log('')
  console.log('👤 고객:')
  console.log('   이메일: customer@example.com')
  console.log('   비밀번호: customer123')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main()
  .catch((e) => {
    console.error('❌ 시드 데이터 생성 중 오류:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
