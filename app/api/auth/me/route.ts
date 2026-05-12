import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { getPrisma } from '@/lib/prisma';

// 토큰 검증 + userId 추출 헬퍼
async function getAuthUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded) return null;
  return decoded.userId;
}

// GET /api/auth/me - 현재 로그인한 사용자 정보 조회
export async function GET(request: NextRequest) {
  const prisma = await getPrisma();
  try {
    // 쿠키에서 토큰 가져오기 - Next.js cookies 사용
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    
    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: 'Not authenticated',
        },
        { status: 401 }
      );
    }
    
    // 토큰 검증
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid token',
        },
        { status: 401 }
      );
    }
    
    // 사용자 정보 조회
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });
    
    // 비밀번호 제거
    if (user) {
      delete (user as any).password;
    }
    
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
        },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    console.error('[GET_ME_ERROR]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get user info',
      },
      { status: 500 }
    );
  }
}

// PATCH /api/auth/me - 현재 로그인한 사용자 프로필 수정
export async function PATCH(request: NextRequest) {
  const prisma = await getPrisma();
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // 화이트리스트: 사용자가 직접 수정 허용된 필드만 허용
    // (role, password, nickname 등은 별도 endpoint에서 처리)
    const allowedFields: Record<string, any> = {};

    if (typeof body.name === 'string') {
      const name = body.name.trim();
      if (name.length < 1 || name.length > 50) {
        return NextResponse.json(
          { success: false, error: '이름은 1~50자 이내로 입력해주세요.' },
          { status: 400 }
        );
      }
      allowedFields.name = name;
    }

    if (typeof body.phone === 'string' || body.phone === null) {
      const phone = body.phone === null ? null : body.phone.trim();
      if (phone && !/^[0-9\-+\s()]{7,20}$/.test(phone)) {
        return NextResponse.json(
          { success: false, error: '연락처 형식이 올바르지 않습니다.' },
          { status: 400 }
        );
      }
      allowedFields.phone = phone || null;
    }

    if (typeof body.email === 'string' || body.email === null) {
      const email = body.email === null ? null : body.email.trim().toLowerCase();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json(
          { success: false, error: '이메일 형식이 올바르지 않습니다.' },
          { status: 400 }
        );
      }
      // 이메일 중복 체크 (다른 사용자가 이미 사용 중인지)
      if (email) {
        const existing = await prisma.user.findUnique({
          where: { email },
        });
        if (existing && existing.id !== userId) {
          return NextResponse.json(
            { success: false, error: '이미 사용 중인 이메일입니다.' },
            { status: 409 }
          );
        }
      }
      allowedFields.email = email || null;
    }

    if (Object.keys(allowedFields).length === 0) {
      return NextResponse.json(
        { success: false, error: '수정할 항목이 없습니다.' },
        { status: 400 }
      );
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: allowedFields,
    });

    // 비밀번호 제거
    delete (updated as any).password;

    return NextResponse.json({
      success: true,
      data: { user: updated },
      message: '회원 정보가 수정되었습니다.',
    });
  } catch (error: any) {
    console.error('[PATCH_ME_ERROR]', error);
    // Prisma unique constraint 충돌 (이메일 등)
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: '이미 사용 중인 값이 포함되어 있습니다.' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Failed to update user info' },
      { status: 500 }
    );
  }
}
