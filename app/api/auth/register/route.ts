import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/password';
import { generateToken } from '@/lib/auth/jwt';

// POST /api/auth/register - 회원가입
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      email, 
      password, 
      name, 
      phone, 
      role = 'CUSTOMER',
      // 파트너 전용 필드
      storeName,
      storeSlug,
      description
    } = body;
    
    // 입력 검증
    if (!email || !password || !name) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email, password, and name are required',
        },
        { status: 400 }
      );
    }
    
    // 파트너 등록 시 storeName, storeSlug 필수
    if (role === 'PARTNER' && (!storeName || !storeSlug)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Store name and slug are required for partners',
        },
        { status: 400 }
      );
    }
    
    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid email format',
        },
        { status: 400 }
      );
    }
    
    // 비밀번호 길이 검증 (최소 6자)
    if (password.length < 6) {
      return NextResponse.json(
        {
          success: false,
          error: 'Password must be at least 6 characters',
        },
        { status: 400 }
      );
    }
    
    // 이메일 중복 확인
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    
    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email already exists',
        },
        { status: 409 }
      );
    }
    
    // 파트너인 경우 storeSlug 중복 확인
    if (role === 'PARTNER') {
      const existingPartner = await prisma.partner.findUnique({
        where: { storeSlug }
      });
      
      if (existingPartner) {
        return NextResponse.json(
          {
            success: false,
            error: 'Store slug already exists',
          },
          { status: 409 }
        );
      }
    }
    
    // 비밀번호 해싱
    const hashedPassword = await hashPassword(password);
    
    // 트랜잭션으로 사용자 및 파트너 생성
    const result = await prisma.$transaction(async (tx) => {
      // 사용자 생성
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          phone: phone || null,
          role,
        },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          createdAt: true,
        },
      });
      
      // 파트너인 경우 Partner 레코드 생성
      let partner = null;
      if (role === 'PARTNER') {
        partner = await tx.partner.create({
          data: {
            userId: user.id,
            storeName,
            storeSlug,
            description: description || null,
            commissionRate: 30.0, // 기본 수수료율 30%
            isActive: true
          }
        });
      }
      
      return { user, partner };
    });
    
    // JWT 토큰 생성
    const token = generateToken({
      userId: result.user.id,
      email: result.user.email,
      role: result.user.role,
      name: result.user.name,
    });
    
    return NextResponse.json({
      success: true,
      data: {
        user: result.user,
        partner: result.partner,
        token,
      },
      message: 'Registration successful',
    });
  } catch (error) {
    console.error('[REGISTER_ERROR]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Registration failed',
      },
      { status: 500 }
    );
  }
}
