import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getPrisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/password';
import { generateToken } from '@/lib/auth/jwt';
import { getD1 } from '@/lib/balance';
import { normalizeWalletAddress } from '@/lib/utils/wallet';

// POST /api/auth/register - 간편 회원가입 (닉네임 + 비밀번호 + 퀀타리움 지갑주소)
export async function POST(request: NextRequest) {
  const prisma = await getPrisma();
  try {
    const body = await request.json();
    const { 
      nickname,
      password, 
      securetQrUrl,
      quantariumWallet,
      email,
      name, 
      phone, 
      role = 'CUSTOMER',
      // 파트너 전용 필드
      storeName,
      storeSlug,
      description
    } = body;
    
    // 퀀타리움 지갑주소 (신규: quantariumWallet, 하위호환: securetQrUrl)
    // EVM 주소는 대소문자를 구분하지 않으므로 항상 소문자로 정규화하여 저장/비교한다.
    const walletAddress = normalizeWalletAddress(quantariumWallet ?? securetQrUrl ?? '');

    // 입력 검증
    if (!nickname || !password || !walletAddress) {
      return NextResponse.json(
        {
          success: false,
          error: '닉네임, 비밀번호, 퀀타리움 지갑주소는 필수입니다.',
        },
        { status: 400 }
      );
    }
    
    // 퀀타리움 지갑주소 형식 검증 (0x + 40 hex)
    const walletPattern = /^0x[a-fA-F0-9]{40}$/;
    if (!walletPattern.test(walletAddress)) {
      return NextResponse.json(
        {
          success: false,
          error: '올바른 퀀타리움 지갑주소 형식이 아닙니다. (0x로 시작하는 42자리 주소)',
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
    
    // 퀀타리움 지갑주소 중복 확인 (대소문자 무시)
    // - EVM 주소는 대소문자를 구분하지 않으므로, 이미 등록된 주소면 대소문자가 달라도 무조건 튕겨낸다.
    // - 기존 DB 에 대소문자가 섞여 저장된 레코드까지 매칭되도록 LOWER() 로 비교한다.
    try {
      const db = await getD1();
      if (db) {
        const dupRow: any = await db
          .prepare(
            `SELECT "id" FROM "User" WHERE LOWER("securetQrUrl") = LOWER(?) LIMIT 1`
          )
          .bind(walletAddress)
          .first();
        if (dupRow) {
          return NextResponse.json(
            {
              success: false,
              error: '이미 등록된 지갑주소입니다.',
            },
            { status: 409 }
          );
        }
      }
    } catch (dupErr) {
      console.error('[REGISTER_WALLET_DUP_CHECK_ERROR]', dupErr);
      // 중복 검사 실패 시 안전하게 진행을 막는다 (지갑주소 유일성 보장 우선)
      return NextResponse.json(
        {
          success: false,
          error: '회원가입 처리 중 오류가 발생했습니다.',
        },
        { status: 500 }
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
          securetQrUrl: walletAddress,
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
            isActive: false // 관리자 승인 전까지 비활성화
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
