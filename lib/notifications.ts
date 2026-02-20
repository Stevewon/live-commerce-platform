// lib/notifications.ts
// 알림 발송 헬퍼 함수

import prisma from '@/lib/prisma';

export type NotificationType = 
  | 'ORDER_STATUS' // 주문 상태 변경
  | 'SETTLEMENT'   // 정산 관련
  | 'LIVE_START'   // 라이브 시작
  | 'REVIEW'       // 리뷰 관련
  | 'ANNOUNCEMENT'; // 공지사항

interface SendNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  link?: string;
}

/**
 * 알림 발송 함수
 */
export async function sendNotification(params: SendNotificationParams) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        content: params.content,
        link: params.link,
      },
    });
    
    console.log(`✅ 알림 발송 성공: ${params.userId} - ${params.title}`);
    return notification;
  } catch (error: any) {
    console.error('❌ 알림 발송 실패:', error);
    return null;
  }
}

/**
 * 주문 상태 변경 알림
 */
export async function notifyOrderStatusChange(
  userId: string,
  orderNumber: string,
  oldStatus: string,
  newStatus: string
) {
  const statusMap: Record<string, string> = {
    PENDING: '주문 대기',
    CONFIRMED: '주문 확인',
    SHIPPING: '배송 중',
    DELIVERED: '배송 완료',
    CANCELLED: '주문 취소',
    REFUNDED: '환불 완료',
  };
  
  await sendNotification({
    userId,
    type: 'ORDER_STATUS',
    title: `주문 상태가 변경되었습니다`,
    content: `주문 ${orderNumber}이(가) "${statusMap[oldStatus]}"에서 "${statusMap[newStatus]}"(으)로 변경되었습니다.`,
    link: `/my/orders`,
  });
}

/**
 * 정산 상태 변경 알림
 */
export async function notifySettlementStatusChange(
  userId: string,
  amount: number,
  status: string
) {
  const statusMap: Record<string, string> = {
    PENDING: '정산 대기',
    APPROVED: '정산 승인',
    REJECTED: '정산 거부',
    COMPLETED: '정산 완료',
  };
  
  await sendNotification({
    userId,
    type: 'SETTLEMENT',
    title: `정산 상태가 변경되었습니다`,
    content: `${amount.toLocaleString()}원 정산이 "${statusMap[status]}"(으)로 변경되었습니다.`,
    link: `/partner/settlements`,
  });
}

/**
 * 배송 완료 후 리뷰 작성 알림
 */
export async function notifyReviewRequest(
  userId: string,
  orderNumber: string,
  productName: string
) {
  await sendNotification({
    userId,
    type: 'REVIEW',
    title: `상품 리뷰를 작성해주세요`,
    content: `주문 ${orderNumber}의 "${productName}" 상품이 배송 완료되었습니다. 리뷰를 남겨주시면 감사하겠습니다!`,
    link: `/my/orders`,
  });
}
