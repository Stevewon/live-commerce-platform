// Toss Payments SDK 설정
export const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || 'test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq';
export const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY || 'test_sk_zXLkKEypNArWmo50nX3lmeaxYG5R';

// Toss Payments API Base URL
export const TOSS_API_BASE_URL = 'https://api.tosspayments.com/v1';

// Base64 인코딩 (Cloudflare Workers 호환)
function toBase64(str: string): string {
  if (typeof btoa === 'function') {
    return btoa(str);
  }
  // Node.js fallback
  return Buffer.from(str).toString('base64');
}

// Authorization 헤더 생성
function getAuthHeader(): string {
  return `Basic ${toBase64(`${TOSS_SECRET_KEY}:`)}`;
}

/**
 * Toss Payments 결제 승인 API
 */
export async function confirmTossPayment(params: {
  paymentKey: string;
  orderId: string;
  amount: number;
}) {
  const { paymentKey, orderId, amount } = params;
  
  const response = await fetch(`${TOSS_API_BASE_URL}/payments/confirm`, {
    method: 'POST',
    headers: {
      'Authorization': getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      paymentKey,
      orderId,
      amount,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || '결제 승인에 실패했습니다.');
  }

  return response.json();
}

/**
 * Toss Payments 결제 취소 API
 */
export async function cancelTossPayment(paymentKey: string, cancelReason: string) {
  const response = await fetch(`${TOSS_API_BASE_URL}/payments/${paymentKey}/cancel`, {
    method: 'POST',
    headers: {
      'Authorization': getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      cancelReason,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || '결제 취소에 실패했습니다.');
  }

  return response.json();
}
