import nodemailer from 'nodemailer'

// SMTP 설정
const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
})

// 이메일 전송 타입
interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

// 이메일 전송 함수
export async function sendEmail({ to, subject, html, text }: EmailOptions) {
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Live Commerce" <noreply@livecommerce.com>',
      to,
      subject,
      text,
      html,
    })

    console.log('Email sent:', info.messageId)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error('Email send error:', error)
    return { success: false, error }
  }
}

// 이메일 템플릿 헬퍼
export const emailTemplates = {
  // 회원가입 환영 이메일
  welcome: (name: string, email: string) => ({
    subject: '라이브 커머스 플랫폼에 오신 것을 환영합니다! 🎉',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 환영합니다!</h1>
          </div>
          <div class="content">
            <h2>안녕하세요, ${name}님!</h2>
            <p>라이브 커머스 플랫폼에 가입해주셔서 감사합니다.</p>
            <p>이제 다음과 같은 기능을 이용하실 수 있습니다:</p>
            <ul>
              <li>🛍️ 다양한 상품 쇼핑</li>
              <li>📺 실시간 라이브 스트리밍 시청</li>
              <li>💬 실시간 채팅 참여</li>
              <li>🎁 특별 할인 혜택</li>
            </ul>
            <p style="text-align: center;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}" class="button">쇼핑 시작하기</a>
            </p>
            <p>궁금한 점이 있으시면 언제든지 문의해주세요!</p>
          </div>
          <div class="footer">
            <p>© 2024 Live Commerce Platform. All rights reserved.</p>
            <p>이메일: ${email}</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `안녕하세요, ${name}님! 라이브 커머스 플랫폼에 가입해주셔서 감사합니다. ${process.env.NEXT_PUBLIC_APP_URL}에서 쇼핑을 시작하세요!`
  }),

  // 주문 확인 이메일
  orderConfirmed: (name: string, orderNumber: string, totalAmount: number, items: any[]) => ({
    subject: `주문이 확인되었습니다 (주문번호: ${orderNumber})`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
          .order-info { background: #f9fafb; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .items { margin: 20px 0; }
          .item { padding: 10px 0; border-bottom: 1px solid #e0e0e0; }
          .total { font-size: 18px; font-weight: bold; color: #10b981; margin-top: 20px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ 주문 확인</h1>
          </div>
          <div class="content">
            <h2>안녕하세요, ${name}님!</h2>
            <p>주문이 성공적으로 확인되었습니다.</p>
            
            <div class="order-info">
              <p><strong>주문번호:</strong> ${orderNumber}</p>
              <p><strong>주문일시:</strong> ${new Date().toLocaleString('ko-KR')}</p>
            </div>

            <div class="items">
              <h3>주문 상품</h3>
              ${items.map(item => `
                <div class="item">
                  <p><strong>${item.product?.name || '상품'}</strong></p>
                  <p>수량: ${item.quantity}개 × ${item.price.toLocaleString()}원</p>
                </div>
              `).join('')}
            </div>

            <div class="total">
              <p>총 결제금액: ${totalAmount.toLocaleString()}원</p>
            </div>

            <p style="margin-top: 30px;">
              주문하신 상품은 빠르게 배송 준비하겠습니다.<br>
              배송이 시작되면 다시 안내 드리겠습니다.
            </p>
          </div>
          <div class="footer">
            <p>© 2024 Live Commerce Platform. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `주문이 확인되었습니다. 주문번호: ${orderNumber}, 총 금액: ${totalAmount.toLocaleString()}원`
  }),

  // 배송 시작 이메일
  shippingStarted: (name: string, orderNumber: string, trackingNumber?: string) => ({
    subject: `배송이 시작되었습니다 (주문번호: ${orderNumber})`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3b82f6; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px; }
          .tracking { background: #f0f9ff; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📦 배송 시작</h1>
          </div>
          <div class="content">
            <h2>안녕하세요, ${name}님!</h2>
            <p>주문하신 상품의 배송이 시작되었습니다.</p>
            
            <div class="tracking">
              <p><strong>주문번호:</strong> ${orderNumber}</p>
              ${trackingNumber ? `<p><strong>운송장번호:</strong> ${trackingNumber}</p>` : ''}
            </div>

            <p>곧 상품을 받아보실 수 있습니다. 조금만 기다려주세요! 😊</p>
          </div>
          <div class="footer">
            <p>© 2024 Live Commerce Platform. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `배송이 시작되었습니다. 주문번호: ${orderNumber}${trackingNumber ? `, 운송장번호: ${trackingNumber}` : ''}`
  }),

  // 배송 완료 이메일
  delivered: (name: string, orderNumber: string) => ({
    subject: `배송이 완료되었습니다 (주문번호: ${orderNumber})`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #10b981; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 배송 완료!</h1>
          </div>
          <div class="content">
            <h2>안녕하세요, ${name}님!</h2>
            <p>주문하신 상품이 배송 완료되었습니다.</p>
            <p>상품을 받아보셨나요? 만족스러우셨다면 리뷰를 남겨주세요! ⭐</p>
            
            <p style="text-align: center;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/my/orders" class="button">리뷰 작성하기</a>
            </p>

            <p>앞으로도 더 나은 서비스로 보답하겠습니다. 감사합니다!</p>
          </div>
          <div class="footer">
            <p>© 2024 Live Commerce Platform. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `배송이 완료되었습니다. 주문번호: ${orderNumber}. 리뷰를 남겨주세요!`
  }),

  // 비밀번호 재설정 이메일
  resetPassword: (name: string, resetLink: string) => ({
    subject: '비밀번호 재설정 요청',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #ef4444; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #ef4444; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .warning { background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔒 비밀번호 재설정</h1>
          </div>
          <div class="content">
            <h2>안녕하세요, ${name}님!</h2>
            <p>비밀번호 재설정을 요청하셨습니다.</p>
            <p>아래 버튼을 클릭하여 비밀번호를 재설정하세요:</p>
            
            <p style="text-align: center;">
              <a href="${resetLink}" class="button">비밀번호 재설정하기</a>
            </p>

            <div class="warning">
              <p><strong>⚠️ 주의사항</strong></p>
              <p>• 이 링크는 1시간 동안만 유효합니다.</p>
              <p>• 요청하지 않으셨다면 이 이메일을 무시하세요.</p>
            </div>
          </div>
          <div class="footer">
            <p>© 2024 Live Commerce Platform. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `비밀번호를 재설정하려면 다음 링크를 클릭하세요: ${resetLink} (1시간 동안 유효)`
  })
}

// 주문 상태별 이메일 전송
export async function sendOrderStatusEmail(
  userEmail: string,
  userName: string,
  orderNumber: string,
  status: string,
  orderData?: any
) {
  let template

  switch (status) {
    case 'CONFIRMED':
      template = emailTemplates.orderConfirmed(
        userName,
        orderNumber,
        orderData?.total || 0,
        orderData?.items || []
      )
      break
    case 'SHIPPING':
      template = emailTemplates.shippingStarted(userName, orderNumber, orderData?.trackingNumber)
      break
    case 'DELIVERED':
      template = emailTemplates.delivered(userName, orderNumber)
      break
    default:
      return { success: false, error: 'Invalid status' }
  }

  return await sendEmail({
    to: userEmail,
    subject: template.subject,
    html: template.html,
    text: template.text
  })
}
