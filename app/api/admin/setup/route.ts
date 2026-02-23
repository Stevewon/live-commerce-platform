import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// POST /api/admin/setup - 테스트 계정 생성 (개발용)
export async function POST(request: NextRequest) {
  try {
    console.log('🔐 테스트 계정 생성 시작...\n');

    const results = {
      admin: null as any,
      partner: null as any,
      store: null as any,
    };

    // 1. Admin 계정 생성
    console.log('1️⃣ Admin 계정 확인/생성...');
    const adminEmail = 'admin@livecommerce.com';
    const adminPassword = 'admin123';
    
    let existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail }
    });

    if (existingAdmin) {
      console.log('   Admin 계정이 이미 존재합니다.');
      results.admin = { existing: true, email: existingAdmin.email, role: existingAdmin.role };
    } else {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      const admin = await prisma.user.create({
        data: {
          email: adminEmail,
          password: hashedPassword,
          name: '관리자',
          role: 'ADMIN',
          phone: '010-0000-0000',
        },
      });
      console.log('   Admin 계정 생성 완료!');
      results.admin = { created: true, email: admin.email, role: admin.role };
    }

    // 2. Partner 계정 생성
    console.log('2️⃣ Partner 계정 확인/생성...');
    const partnerEmail = 'partner@livecommerce.com';
    const partnerPassword = 'partner123';
    
    let existingPartner = await prisma.user.findUnique({
      where: { email: partnerEmail }
    });

    let partnerId: string;
    if (existingPartner) {
      console.log('   Partner 계정이 이미 존재합니다.');
      partnerId = existingPartner.id;
      results.partner = { existing: true, email: existingPartner.email, role: existingPartner.role };
    } else {
      const hashedPassword = await bcrypt.hash(partnerPassword, 10);
      const partner = await prisma.user.create({
        data: {
          email: partnerEmail,
          password: hashedPassword,
          name: '파트너',
          role: 'PARTNER',
          phone: '010-1111-1111',
        },
      });
      partnerId = partner.id;
      console.log('   Partner 계정 생성 완료!');
      results.partner = { created: true, email: partner.email, role: partner.role };
    }

    // 3. Partner Store 생성
    console.log('3️⃣ Partner Store 확인/생성...');
    const existingStore = await prisma.partnerStore.findUnique({
      where: { userId: partnerId }
    });

    if (existingStore) {
      console.log('   Partner Store가 이미 존재합니다.');
      results.store = { existing: true, storeName: existingStore.storeName };
    } else {
      const store = await prisma.partnerStore.create({
        data: {
          userId: partnerId,
          storeName: '파트너 테스트 스토어',
          businessNumber: '123-45-67890',
          bankAccount: '신한은행 110-123-456789',
          status: 'ACTIVE',
        },
      });
      console.log('   Partner Store 생성 완료!');
      results.store = { created: true, storeName: store.storeName };
    }

    console.log('🎉 모든 테스트 계정 생성 완료!');

    return NextResponse.json({
      success: true,
      message: '테스트 계정이 생성되었습니다.',
      data: results,
      accounts: {
        admin: {
          email: 'admin@livecommerce.com',
          password: 'admin123',
          url: '/admin/login',
        },
        partner: {
          email: 'partner@livecommerce.com',
          password: 'partner123',
          url: '/partner/login',
        },
        customer: {
          email: 'hbcu00987@gmail.com',
          password: 'hb669900',
          url: '/login',
        },
      },
    });
  } catch (error) {
    console.error('[SETUP_ERROR]', error);
    return NextResponse.json(
      {
        success: false,
        error: '계정 생성에 실패했습니다.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
