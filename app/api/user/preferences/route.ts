import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth/middleware';
import prisma from '@/lib/prisma';

// 알림 설정 조회 (GET)
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuthToken(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { userId } = authResult;
    if (authResult.error) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      );
    }

    // 사용자 알림 설정 조회
    let preferences = await prisma.userPreferences.findUnique({
      where: { userId: userId }
    });

    // 설정이 없으면 기본값으로 생성
    if (!preferences) {
      preferences = await prisma.userPreferences.create({
        data: {
          userId: userId,
          emailNotifications: true,
          smsNotifications: true,
          orderNotifications: true,
          shippingNotifications: true,
          promotionNotifications: true,
          reviewNotifications: true
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: preferences
    });

  } catch (error) {
    console.error('Get preferences error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '알림 설정 조회 중 오류가 발생했습니다',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// 알림 설정 업데이트 (PATCH)
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await verifyAuthToken(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { userId } = authResult;
    if (authResult.error) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      );
    }

    const body = await request.json();
    const {
      emailNotifications,
      smsNotifications,
      orderNotifications,
      shippingNotifications,
      promotionNotifications,
      reviewNotifications
    } = body;

    // 알림 설정 업데이트 (없으면 생성)
    const preferences = await prisma.userPreferences.upsert({
      where: { userId: userId },
      update: {
        ...(emailNotifications !== undefined && { emailNotifications }),
        ...(smsNotifications !== undefined && { smsNotifications }),
        ...(orderNotifications !== undefined && { orderNotifications }),
        ...(shippingNotifications !== undefined && { shippingNotifications }),
        ...(promotionNotifications !== undefined && { promotionNotifications }),
        ...(reviewNotifications !== undefined && { reviewNotifications })
      },
      create: {
        userId: userId,
        emailNotifications: emailNotifications ?? true,
        smsNotifications: smsNotifications ?? true,
        orderNotifications: orderNotifications ?? true,
        shippingNotifications: shippingNotifications ?? true,
        promotionNotifications: promotionNotifications ?? true,
        reviewNotifications: reviewNotifications ?? true
      }
    });

    return NextResponse.json({
      success: true,
      message: '알림 설정이 업데이트되었습니다',
      data: preferences
    });

  } catch (error) {
    console.error('Update preferences error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '알림 설정 업데이트 중 오류가 발생했습니다',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
