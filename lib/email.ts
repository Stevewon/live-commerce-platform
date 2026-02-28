// 이메일 전송 라이브러리
// Nodemailer 대신 간단한 fetch를 사용하여 외부 이메일 서비스 호출

export interface EmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * 이메일 전송 함수
 * 실제 프로덕션에서는 SendGrid, AWS SES, Nodemailer 등을 사용
 */
export async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    const { to, subject, html, text } = params;

    // 개발 환경에서는 콘솔에만 출력
    if (process.env.NODE_ENV === 'development' || !process.env.EMAIL_API_KEY) {
      console.log('📧 [EMAIL - Development Mode]');
      console.log('To:', to);
      console.log('Subject:', subject);
      console.log('HTML:', html.substring(0, 200) + '...');
      return true;
    }

    // 프로덕션: 실제 이메일 전송 서비스 호출
    // 예: SendGrid API
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.EMAIL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: process.env.EMAIL_FROM || 'noreply@qrlive.io' },
        subject,
        content: [
          { type: 'text/plain', value: text || html.replace(/<[^>]*>/g, '') },
          { type: 'text/html', value: html }
        ]
      })
    });

    return response.ok;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
}

/**
 * 주문 확인 이메일 템플릿
 */
export function orderConfirmationEmail(data: {
  customerName: string;
  orderNumber: string;
  orderDate: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  subtotal: number;
  shippingFee: number;
  total: number;
  shippingAddress: string;
}): string {
  const itemsHtml = data.items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}개</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₩${item.price.toLocaleString()}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>주문 확인</title>
    </head>
    <body style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">주문이 접수되었습니다!</h1>
        </div>
        
        <!-- Content -->
        <div style="padding: 30px;">
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            안녕하세요, <strong>${data.customerName}</strong>님!<br>
            주문해주셔서 감사합니다.
          </p>
          
          <!-- Order Info -->
          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="font-size: 18px; color: #333; margin-top: 0;">주문 정보</h2>
            <p style="margin: 5px 0; color: #666;">
              <strong>주문번호:</strong> ${data.orderNumber}<br>
              <strong>주문일시:</strong> ${data.orderDate}
            </p>
          </div>
          
          <!-- Order Items -->
          <h2 style="font-size: 18px; color: #333; margin-bottom: 15px;">주문 상품</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #f0f0f0;">
                <th style="padding: 10px; text-align: left;">상품명</th>
                <th style="padding: 10px; text-align: center;">수량</th>
                <th style="padding: 10px; text-align: right;">금액</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          
          <!-- Total -->
          <div style="border-top: 2px solid #333; padding-top: 15px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #666;">상품금액</span>
              <span style="color: #333;">₩${data.subtotal.toLocaleString()}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
              <span style="color: #666;">배송비</span>
              <span style="color: #333;">₩${data.shippingFee.toLocaleString()}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 20px; font-weight: bold;">
              <span style="color: #333;">총 결제금액</span>
              <span style="color: #667eea;">₩${data.total.toLocaleString()}</span>
            </div>
          </div>
          
          <!-- Shipping Address -->
          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin-top: 20px;">
            <h2 style="font-size: 18px; color: #333; margin-top: 0;">배송지 정보</h2>
            <p style="margin: 0; color: #666; line-height: 1.6;">
              ${data.shippingAddress}
            </p>
          </div>
          
          <!-- Button -->
          <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/orders" 
               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-weight: bold; font-size: 16px;">
              주문 상세 보기
            </a>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f5f5f5; padding: 20px; text-align: center; color: #999; font-size: 12px;">
          <p style="margin: 5px 0;">QRLIVE Platform</p>
          <p style="margin: 5px 0;">문의: support@qrlive.io</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * 배송 시작 이메일 템플릿
 */
export function shippingStartedEmail(data: {
  customerName: string;
  orderNumber: string;
  trackingNumber?: string;
  courier?: string;
  estimatedDelivery?: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>배송 시작</title>
    </head>
    <body style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🚚 배송이 시작되었습니다!</h1>
        </div>
        
        <!-- Content -->
        <div style="padding: 30px;">
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            안녕하세요, <strong>${data.customerName}</strong>님!<br>
            주문하신 상품이 배송 시작되었습니다.
          </p>
          
          <!-- Order Info -->
          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="font-size: 18px; color: #333; margin-top: 0;">배송 정보</h2>
            <p style="margin: 5px 0; color: #666;">
              <strong>주문번호:</strong> ${data.orderNumber}<br>
              ${data.trackingNumber ? `<strong>송장번호:</strong> ${data.trackingNumber}<br>` : ''}
              ${data.courier ? `<strong>택배사:</strong> ${data.courier}<br>` : ''}
              ${data.estimatedDelivery ? `<strong>예상 도착:</strong> ${data.estimatedDelivery}` : ''}
            </p>
          </div>
          
          <div style="background-color: #e8f5e9; padding: 20px; border-radius: 8px; border-left: 4px solid #4caf50;">
            <p style="margin: 0; color: #2e7d32; font-size: 14px;">
              💡 <strong>배송 안내</strong><br>
              상품은 2-3일 이내에 도착 예정입니다.<br>
              배송 추적은 주문 상세 페이지에서 확인하실 수 있습니다.
            </p>
          </div>
          
          <!-- Button -->
          <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/orders" 
               style="display: inline-block; background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-weight: bold; font-size: 16px;">
              배송 추적하기
            </a>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f5f5f5; padding: 20px; text-align: center; color: #999; font-size: 12px;">
          <p style="margin: 5px 0;">QRLIVE Platform</p>
          <p style="margin: 5px 0;">문의: support@qrlive.io</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
