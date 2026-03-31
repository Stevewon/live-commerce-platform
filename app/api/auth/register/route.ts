import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getPrisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/password';
import { generateToken } from '@/lib/auth/jwt';

// POST /api/auth/register - 간편 회원가입 (닉네임 + 비밀번호 + Securet QR 주소)
export async function POST(request: NextRequest) {
  const prisma = await getPrisma();
  try {
    const body = await request.json();
    const { 
      nickname,
      password, 
      securetQrUrl,
      email,
      name, 
      phone, 
      role = 'CUSTOMER',
      // 파트너 전용 필드
      storeName,
      storeSlug,
      description
    } = body;
    
    // 입력 검증
    if (!nickname || !password || !securetQrUrl) {
      return NextResponse.json(
        {
          success: false,
          error: '닉네임, 비밀번호, 시큐릿 QR 주소는 필수입니다.',
        },
        { status: 400 }
      );
    }
    
    // Securet QR URL 형식 검증
    const securetUrlPattern = /^https:\/\/securet\.kr\/securet\.php\?key=idcard&nick=.+&token=.+&voip=.+&os=.+$/;
    if (!securetUrlPattern.test(securetQrUrl)) {
      return NextResponse.json(
        {
          success: false,
          error: '올바른 시큐릿 QR 주소 형식이 아닙니다.',
        },
        { status: 400 }
      );
    }
    
    // 파트너 등록 시 storeName, storeSlug 필수
    if (role === 'PARTNER' && (!storeName || !storeSlug)) {
      return NextResponse.json(
        {
          success: false,
          error: '파트너 등록 시 상점 이름과 슬러그가 필요합니다.',
        },
        { status: 400 }
      );
    }
    
    // 비밀번호 길이 검증 (최소 6자)
    if (password.length < 6) {
      return NextResponse.json(
        {
          success: false,
          error: '비밀번호는 최소 6자 이상이어야 합니다.',
        },
        { status: 400 }
      );
    }
    
    // 닉네임 중복 확인
    const existingUser = await prisma.user.findUnique({
      where: { nickname },
    });
    
    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: '이미 사용 중인 닉네임입니다.',
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
            error: '이미 사용 중인 상점 슬러그입니다.',
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
          nickname,
          password: hashedPassword,
          securetQrUrl,
          email: email || null,
          name: name || nickname, // name이 없으면 nickname 사용
          phone: phone || null,
          role,
        },
        select: {
          id: true,
          nickname: true,
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
      nickname: result.user.nickname!,
      role: result.user.role,
      name: result.user.name,
    });
    
    // HTTP-only 쿠키 설정 (30일 유효)
    const cookieStore = await cookies();
    cookieStore.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30일
      path: '/',
    });
    
    // 사용자 역할도 쿠키에 저장 (클라이언트에서 읽을 수 있도록)
    cookieStore.set('user-role', result.user.role, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
    
    // password 해시는 응답에서 제거
    const { password: _pw, securetQrUrl: _qr, ...safeUser } = result.user as any;
    
    return NextResponse.json({
      success: true,
      data: {
        user: safeUser,
        partner: result.partner,
        token,
      },
      message: '회원가입이 완료되었습니다.',
    });
  } catch (error) {
    console.error('[REGISTER_ERROR]', error);
    return NextResponse.json(
      {
        success: false,
        error: '회원가입 처리 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
