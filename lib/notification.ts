// 알림 전송 헬퍼 (사용자 설정 확인 포함)
import { sendEmail } from './email';
import { sendSMS } from './sms';
import { getPrisma } from './prisma';

/**
 * 사용자 설정을 확인하고 이메일 전송
 */
export async function sendEmailWithPreferences(params: {
  userId: string;
  to: string;
  subject: string;
  html: string;
  notificationType: 'order' | 'shipping' | 'promotion' | 'review';
}) {
  try {
    // 사용자 알림 설정 조회
    const prisma = await getPrisma();
    const preferences = await (prisma as any).userPreferences?.findUnique?.({
      where: { userId: params.userId }
    });

    // 설정이 없거나 이메일 알림이 꺼져있으면 전송하지 않음
    if (!preferences || !preferences.emailNotifications) {
      console.log(`📧 Email notifications disabled for user ${params.userId}`);
      return false;
    }

    // 알림 타입별 설정 확인
    const typeMap: Record<string, keyof typeof preferences> = {
      order: 'orderNotifications',
      shipping: 'shippingNotifications',
      promotion: 'promotionNotifications',
      review: 'reviewNotifications'
    };

    const settingKey = typeMap[params.notificationType];
    if (settingKey && !preferences[settingKey]) {
      console.log(`📧 ${params.notificationType} notifications disabled for user ${params.userId}`);
      return false;
    }

    // 알림 전송
    return await sendEmail({
      to: params.to,
      subject: params.subject,
      html: params.html
    });

  } catch (error) {
    console.error('Send email with preferences error:', error);
    return false;
  }
}

/**
 * 사용자 설정을 확인하고 SMS 전송
 */
export async function sendSMSWithPreferences(params: {
  userId: string;
  to: string;
  message: string;
  notificationType: 'order' | 'shipping' | 'promotion' | 'review';
}) {
  try {
    // 사용자 알림 설정 조회
    const prisma = await getPrisma();
    const preferences = await (prisma as any).userPreferences?.findUnique?.({
      where: { userId: params.userId }
    });

    // 설정이 없거나 SMS 알림이 꺼져있으면 전송하지 않음
    if (!preferences || !preferences.smsNotifications) {
      console.log(`📱 SMS notifications disabled for user ${params.userId}`);
      return false;
    }

    // 알림 타입별 설정 확인
    const typeMap: Record<string, keyof typeof preferences> = {
      order: 'orderNotifications',
      shipping: 'shippingNotifications',
      promotion: 'promotionNotifications',
      review: 'reviewNotifications'
    };

    const settingKey = typeMap[params.notificationType];
    if (settingKey && !preferences[settingKey]) {
      console.log(`📱 ${params.notificationType} notifications disabled for user ${params.userId}`);
      return false;
    }

    // 알림 전송
    return await sendSMS({
      to: params.to,
      message: params.message
    });

  } catch (error) {
    console.error('Send SMS with preferences error:', error);
    return false;
  }
}
