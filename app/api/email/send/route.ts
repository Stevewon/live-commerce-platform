import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth/middleware';
import {
  sendOrderConfirmationEmail,
  sendShippingStartEmail,
  sendDeliveryCompleteEmail,
  sendPartnerApprovalEmail,
  sendSettlementCompleteEmail,
  testEmailConnection,
} from '@/lib/email/email-service';

// POST: 이메일 전송
export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const authResult = await verifyAuthToken(request);
    if (!authResult.valid || !authResult.user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { type, data } = body;

    if (!type || !data) {
      return NextResponse.json(
        { error: '이메일 타입과 데이터를 제공해주세요.' },
        { status: 400 }
      );
    }

    // 이메일 타입에 따라 전송
    switch (type) {
      case 'order_confirmation':
        await sendOrderConfirmationEmail(data);
        break;
      case 'shipping_start':
        await sendShippingStartEmail(data);
        break;
      case 'delivery_complete':
        await sendDeliveryCompleteEmail(data);
        break;
      case 'partner_approval':
        // 관리자 권한 확인
        if (authResult.user.role !== 'ADMIN') {
          return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
        }
        await sendPartnerApprovalEmail(data);
        break;
      case 'settlement_complete':
        // 관리자 권한 확인
        if (authResult.user.role !== 'ADMIN') {
          return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
        }
        await sendSettlementCompleteEmail(data);
        break;
      default:
        return NextResponse.json(
          { error: '지원하지 않는 이메일 타입입니다.' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message: '이메일이 전송되었습니다.',
    });
  } catch (error) {
    console.error('이메일 전송 오류:', error);
    return NextResponse.json(
      { error: '이메일 전송에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// GET: 이메일 연결 테스트
export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const authResult = await verifyAuthToken(request);
    if (!authResult.valid || !authResult.user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    // 관리자 권한 확인
    if (authResult.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const result = await testEmailConnection();

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
      });
    } else {
      return NextResponse.json(
        {
          error: 'SMTP 연결 실패',
          details: result.error,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('이메일 연결 테스트 오류:', error);
    return NextResponse.json(
      { error: '이메일 연결 테스트에 실패했습니다.' },
      { status: 500 }
    );
  }
}
