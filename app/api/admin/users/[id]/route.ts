import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

// PATCH: 회원 권한 변경
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const prisma = await getPrisma();
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다' },
        { status: 403 }
      );
    }

    const { role } = await request.json();
    const userId = id;

    // 본인의 권한은 변경할 수 없음
    if (userId === decoded.userId) {
      return NextResponse.json(
        { error: '본인의 권한은 변경할 수 없습니다' },
        { status: 400 }
      );
    }

    // 권한 업데이트
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true
      }
    });

    return NextResponse.json({
      success: true,
      data: updatedUser
    });

  } catch (error) {
    console.error('권한 변경 실패:', error);
    return NextResponse.json(
      { error: '권한 변경 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// DELETE: 회원 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const prisma = await getPrisma();
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다' },
        { status: 403 }
      );
    }

    const userId = id;

    // 본인은 삭제할 수 없음
    if (userId === decoded.userId) {
      return NextResponse.json(
        { error: '본인의 계정은 삭제할 수 없습니다' },
        { status: 400 }
      );
    }

    // 회원 삭제 (관련 데이터도 함께 삭제)
    await prisma.user.delete({
      where: { id: userId }
    });

    return NextResponse.json({
      success: true,
      message: '회원이 삭제되었습니다'
    });

  } catch (error) {
    console.error('회원 삭제 실패:', error);
    return NextResponse.json(
      { error: '회원 삭제 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
