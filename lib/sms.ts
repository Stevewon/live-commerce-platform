// SMS 전송 라이브러리
// 네이버 클라우드 SENS, 카카오 알림톡, 또는 Twilio 등을 사용

export interface SMSParams {
  to: string;
  message: string;
}

/**
 * SMS 전송 함수
 * 실제 프로덕션에서는 네이버 SENS, Twilio, 카카오 알림톡 등을 사용
 */
export async function sendSMS(params: SMSParams): Promise<boolean> {
  try {
    const { to, message } = params;

    // 개발 환경에서는 콘솔에만 출력
    if (process.env.NODE_ENV === 'development' || !process.env.SMS_API_KEY) {
      console.log('📱 [SMS - Development Mode]');
      console.log('To:', to);
      console.log('Message:', message);
      return true;
    }

    // 프로덕션: 실제 SMS 전송 서비스 호출
    // 예: 네이버 클라우드 SENS API
    const response = await fetch(`https://sens.apigw.ntruss.com/sms/v2/services/${process.env.SMS_SERVICE_ID}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ncp-apigw-timestamp': Date.now().toString(),
        'x-ncp-iam-access-key': process.env.SMS_ACCESS_KEY || '',
        'x-ncp-apigw-signature-v2': generateSignature(), // HMAC SHA256 서명 필요
      },
      body: JSON.stringify({
        type: 'SMS',
        contentType: 'COMM',
        countryCode: '82',
        from: process.env.SMS_FROM || '01012345678',
        content: message,
        messages: [{ to: to.replace(/^0/, '82') }]
      })
    });

    return response.ok;
  } catch (error) {
    console.error('SMS send error:', error);
    return false;
  }
}

function generateSignature(): string {
  // 실제 구현에서는 HMAC SHA256 서명 생성
  // const crypto = require('crypto');
  // const hmac = crypto.createHmac('sha256', process.env.SMS_SECRET_KEY);
  // return hmac.update(message).digest('base64');
  return '';
}

/**
 * 주문 확인 SMS 템플릿
 */
export function orderConfirmationSMS(data: {
  customerName: string;
  orderNumber: string;
  total: number;
}): string {
  return `[Live Commerce] ${data.customerName}님, 주문이 접수되었습니다.\n주문번호: ${data.orderNumber}\n결제금액: ₩${data.total.toLocaleString()}\n배송은 2-3일 소요됩니다.`;
}

/**
 * 배송 시작 SMS 템플릿
 */
export function shippingStartedSMS(data: {
  customerName: string;
  orderNumber: string;
  trackingNumber?: string;
}): string {
  const tracking = data.trackingNumber ? `\n송장번호: ${data.trackingNumber}` : '';
  return `[Live Commerce] ${data.customerName}님, 상품이 발송되었습니다.\n주문번호: ${data.orderNumber}${tracking}\n배송 추적: livecommerce.com/orders`;
}

/**
 * 배송 완료 SMS 템플릿
 */
export function deliveryCompletedSMS(data: {
  customerName: string;
  orderNumber: string;
}): string {
  return `[Live Commerce] ${data.customerName}님, 상품이 배송 완료되었습니다.\n주문번호: ${data.orderNumber}\n구매 후기를 남겨주세요!`;
}
