import nodemailer from 'nodemailer';

// 이메일 전송 설정
const createTransporter = () => {
  // Gmail SMTP 설정
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER, // Gmail 주소
      pass: process.env.SMTP_PASS, // Gmail 앱 비밀번호
    },
  });
};

// 이메일 템플릿 스타일
const emailStyles = `
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #9333EA 0%, #EC4899 100%);
      color: white;
      padding: 30px;
      text-align: center;
      border-radius: 10px 10px 0 0;
    }
    .content {
      background: #fff;
      padding: 30px;
      border: 1px solid #e5e7eb;
    }
    .footer {
      background: #f9fafb;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
      border-radius: 0 0 10px 10px;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #9333EA 0%, #EC4899 100%);
      color: white;
      padding: 12px 30px;
      text-decoration: none;
      border-radius: 8px;
      margin: 20px 0;
    }
    .order-info {
      background: #f9fafb;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .product-item {
      border-bottom: 1px solid #e5e7eb;
      padding: 15px 0;
    }
    .total {
      font-size: 20px;
      font-weight: bold;
      color: #9333EA;
      text-align: right;
      margin-top: 20px;
    }
  </style>
`;

// 주문 완료 이메일
export async function sendOrderConfirmationEmail(orderData: {
  email: string;
  name: string;
  orderNumber: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  shippingAddress: string;
}) {
  const transporter = createTransporter();

  const itemsHtml = orderData.items
    .map(
      (item) => `
    <div class="product-item">
      <strong>${item.name}</strong><br>
      수량: ${item.quantity}개 × ₩${item.price.toLocaleString()}
      = ₩${(item.quantity * item.price).toLocaleString()}
    </div>
  `
    )
    .join('');

  const html = `
    ${emailStyles}
    <div class="header">
      <h1>🎉 주문이 완료되었습니다!</h1>
    </div>
    <div class="content">
      <p>안녕하세요 ${orderData.name}님,</p>
      <p>주문해주셔서 감사합니다. 주문이 정상적으로 접수되었습니다.</p>
      
      <div class="order-info">
        <h3>📦 주문 정보</h3>
        <p><strong>주문번호:</strong> ${orderData.orderNumber}</p>
        <p><strong>배송지:</strong> ${orderData.shippingAddress}</p>
      </div>

      <h3>📋 주문 상품</h3>
      ${itemsHtml}

      <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #e5e7eb;">
        <p style="text-align: right;">소계: ₩${orderData.subtotal.toLocaleString()}</p>
        ${orderData.discount > 0 ? `<p style="text-align: right; color: #EF4444;">할인: -₩${orderData.discount.toLocaleString()}</p>` : ''}
        <p style="text-align: right;">배송비: ₩${orderData.shippingFee.toLocaleString()}</p>
        <div class="total">총 결제금액: ₩${orderData.total.toLocaleString()}</div>
      </div>

      <div style="text-align: center;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://qrlive.io'}/orders/${orderData.orderNumber}" class="button">
          주문 상세보기
        </a>
      </div>
    </div>
    <div class="footer">
      <p>본 메일은 발신 전용입니다. 문의사항이 있으시면 고객센터로 연락해주세요.</p>
      <p>&copy; 2024 QRLIVE Platform. All rights reserved.</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"QRLIVE" <${process.env.SMTP_USER}>`,
    to: orderData.email,
    subject: `[QRLIVE] 주문이 완료되었습니다 (${orderData.orderNumber})`,
    html,
  });
}

// 배송 시작 이메일
export async function sendShippingStartEmail(data: {
  email: string;
  name: string;
  orderNumber: string;
  trackingNumber?: string;
  shippingCompany?: string;
}) {
  const transporter = createTransporter();

  const trackingInfo = data.trackingNumber
    ? `
    <div class="order-info">
      <h3>🚚 배송 정보</h3>
      <p><strong>택배사:</strong> ${data.shippingCompany || '미정'}</p>
      <p><strong>송장번호:</strong> ${data.trackingNumber}</p>
    </div>
  `
    : '';

  const html = `
    ${emailStyles}
    <div class="header">
      <h1>📦 상품이 배송 중입니다!</h1>
    </div>
    <div class="content">
      <p>안녕하세요 ${data.name}님,</p>
      <p>주문하신 상품이 배송을 시작했습니다.</p>
      
      <div class="order-info">
        <h3>📋 주문 정보</h3>
        <p><strong>주문번호:</strong> ${data.orderNumber}</p>
      </div>

      ${trackingInfo}

      <p style="color: #6b7280; font-size: 14px;">
        배송은 일반적으로 2-3일 정도 소요됩니다.<br>
        배송 현황은 주문 상세 페이지에서 확인하실 수 있습니다.
      </p>

      <div style="text-align: center;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://qrlive.io'}/orders/${data.orderNumber}" class="button">
          배송 조회하기
        </a>
      </div>
    </div>
    <div class="footer">
      <p>본 메일은 발신 전용입니다. 문의사항이 있으시면 고객센터로 연락해주세요.</p>
      <p>&copy; 2024 QRLIVE Platform. All rights reserved.</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"QRLIVE" <${process.env.SMTP_USER}>`,
    to: data.email,
    subject: `[QRLIVE] 상품이 배송 중입니다 (${data.orderNumber})`,
    html,
  });
}

// 배송 완료 이메일
export async function sendDeliveryCompleteEmail(data: {
  email: string;
  name: string;
  orderNumber: string;
}) {
  const transporter = createTransporter();

  const html = `
    ${emailStyles}
    <div class="header">
      <h1>✅ 배송이 완료되었습니다!</h1>
    </div>
    <div class="content">
      <p>안녕하세요 ${data.name}님,</p>
      <p>주문하신 상품이 무사히 배송 완료되었습니다!</p>
      
      <div class="order-info">
        <h3>📋 주문 정보</h3>
        <p><strong>주문번호:</strong> ${data.orderNumber}</p>
      </div>

      <p>상품을 받으셨다면, 리뷰를 작성해주세요!<br>
      다른 고객님들께 큰 도움이 됩니다. 😊</p>

      <div style="text-align: center;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://qrlive.io'}/orders/${data.orderNumber}/review" class="button">
          리뷰 작성하기
        </a>
      </div>

      <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
        상품에 문제가 있으신가요? 고객센터로 문의해주세요.
      </p>
    </div>
    <div class="footer">
      <p>본 메일은 발신 전용입니다. 문의사항이 있으시면 고객센터로 연락해주세요.</p>
      <p>&copy; 2024 QRLIVE Platform. All rights reserved.</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"QRLIVE" <${process.env.SMTP_USER}>`,
    to: data.email,
    subject: `[QRLIVE] 배송이 완료되었습니다 (${data.orderNumber})`,
    html,
  });
}

// 파트너 가입 승인 이메일
export async function sendPartnerApprovalEmail(data: {
  email: string;
  name: string;
  storeName: string;
}) {
  const transporter = createTransporter();

  const html = `
    ${emailStyles}
    <div class="header">
      <h1>🎉 파트너 가입이 승인되었습니다!</h1>
    </div>
    <div class="content">
      <p>안녕하세요 ${data.name}님,</p>
      <p>QRLIVE 플랫폼 파트너 가입이 승인되었습니다!</p>
      
      <div class="order-info">
        <h3>🏪 스토어 정보</h3>
        <p><strong>스토어명:</strong> ${data.storeName}</p>
      </div>

      <p>이제 다음 기능을 사용하실 수 있습니다:</p>
      <ul>
        <li>✅ 상품 등록 및 관리</li>
        <li>✅ 라이브 방송 진행</li>
        <li>✅ 주문 관리</li>
        <li>✅ 정산 요청</li>
      </ul>

      <div style="text-align: center;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://qrlive.io'}/partner/dashboard" class="button">
          파트너 대시보드 바로가기
        </a>
      </div>
    </div>
    <div class="footer">
      <p>본 메일은 발신 전용입니다. 문의사항이 있으시면 고객센터로 연락해주세요.</p>
      <p>&copy; 2024 QRLIVE Platform. All rights reserved.</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"QRLIVE" <${process.env.SMTP_USER}>`,
    to: data.email,
    subject: `[QRLIVE] 파트너 가입이 승인되었습니다`,
    html,
  });
}

// 정산 완료 이메일
export async function sendSettlementCompleteEmail(data: {
  email: string;
  name: string;
  amount: number;
  settlementId: string;
  bankAccount: string;
}) {
  const transporter = createTransporter();

  const html = `
    ${emailStyles}
    <div class="header">
      <h1>💰 정산이 완료되었습니다!</h1>
    </div>
    <div class="content">
      <p>안녕하세요 ${data.name}님,</p>
      <p>요청하신 정산이 완료되었습니다.</p>
      
      <div class="order-info">
        <h3>💳 정산 정보</h3>
        <p><strong>정산 ID:</strong> ${data.settlementId}</p>
        <p><strong>정산 금액:</strong> <span style="color: #9333EA; font-size: 24px; font-weight: bold;">₩${data.amount.toLocaleString()}</span></p>
        <p><strong>입금 계좌:</strong> ${data.bankAccount}</p>
      </div>

      <p style="color: #6b7280; font-size: 14px;">
        정산 금액은 영업일 기준 1-2일 내에 입금됩니다.<br>
        입금이 완료되면 계좌를 확인해주세요.
      </p>

      <div style="text-align: center;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://qrlive.io'}/partner/settlements" class="button">
          정산 내역 보기
        </a>
      </div>
    </div>
    <div class="footer">
      <p>본 메일은 발신 전용입니다. 문의사항이 있으시면 고객센터로 연락해주세요.</p>
      <p>&copy; 2024 QRLIVE Platform. All rights reserved.</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"QRLIVE" <${process.env.SMTP_USER}>`,
    to: data.email,
    subject: `[QRLIVE] 정산이 완료되었습니다`,
    html,
  });
}

// 이메일 전송 테스트 함수
export async function testEmailConnection() {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    return { success: true, message: 'SMTP 연결 성공' };
  } catch (error) {
    return { success: false, error };
  }
}
