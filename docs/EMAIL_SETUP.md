# 이메일 알림 설정 가이드

## Gmail SMTP 설정 방법

### 1. Google 계정 2단계 인증 활성화

1. [Google 계정 보안 페이지](https://myaccount.google.com/security) 접속
2. "2단계 인증" 클릭
3. 안내에 따라 2단계 인증 활성화

### 2. 앱 비밀번호 생성

1. [앱 비밀번호 페이지](https://myaccount.google.com/apppasswords) 접속
2. "앱 선택" → "메일" 선택
3. "기기 선택" → "기타" 선택 후 "Live Commerce" 입력
4. "생성" 클릭
5. 16자리 앱 비밀번호 복사 (공백 제거)

### 3. 환경 변수 설정

`.env.local` 파일에 다음 정보 입력:

```env
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-16-digit-app-password"
NEXT_PUBLIC_APP_URL="https://your-domain.com"
```

### 4. 이메일 테스트

관리자 계정으로 로그인 후:

```bash
curl -X GET https://your-domain.com/api/email/send \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 이메일 타입별 전송 방법

### 1. 주문 완료 이메일

```typescript
await fetch('/api/email/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    type: 'order_confirmation',
    data: {
      email: 'customer@example.com',
      name: '홍길동',
      orderNumber: 'ORD-20240101-001',
      items: [
        { name: '상품명', quantity: 2, price: 10000 }
      ],
      subtotal: 20000,
      shippingFee: 3000,
      discount: 0,
      total: 23000,
      shippingAddress: '서울시 강남구...',
    },
  }),
});
```

### 2. 배송 시작 이메일

```typescript
await fetch('/api/email/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    type: 'shipping_start',
    data: {
      email: 'customer@example.com',
      name: '홍길동',
      orderNumber: 'ORD-20240101-001',
      trackingNumber: '1234567890',
      shippingCompany: 'CJ대한통운',
    },
  }),
});
```

### 3. 배송 완료 이메일

```typescript
await fetch('/api/email/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    type: 'delivery_complete',
    data: {
      email: 'customer@example.com',
      name: '홍길동',
      orderNumber: 'ORD-20240101-001',
    },
  }),
});
```

### 4. 파트너 승인 이메일 (관리자만)

```typescript
await fetch('/api/email/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`,
  },
  body: JSON.stringify({
    type: 'partner_approval',
    data: {
      email: 'partner@example.com',
      name: '김스트리머',
      storeName: '김스트리머 샵',
    },
  }),
});
```

### 5. 정산 완료 이메일 (관리자만)

```typescript
await fetch('/api/email/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`,
  },
  body: JSON.stringify({
    type: 'settlement_complete',
    data: {
      email: 'partner@example.com',
      name: '김스트리머',
      amount: 500000,
      settlementId: 'SETTLE-001',
      bankAccount: '국민은행 123-456-789012',
    },
  }),
});
```

---

## 자동 이메일 전송 설정

### 주문 상태 변경 시 자동 전송

주문 API에서 상태 변경 시 자동으로 이메일 전송:

```typescript
// app/api/admin/orders/[id]/route.ts
if (newStatus === 'SHIPPING') {
  await fetch('/api/email/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': request.headers.get('Authorization')!,
    },
    body: JSON.stringify({
      type: 'shipping_start',
      data: {
        email: order.user.email,
        name: order.user.name,
        orderNumber: order.orderNumber,
      },
    }),
  });
}
```

---

## 프로덕션 환경 설정

Railway 배포 시 환경 변수:

```env
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
NEXT_PUBLIC_APP_URL=https://your-railway-domain.railway.app
```

---

## 이메일 디자인 커스터마이징

`lib/email/email-service.ts` 파일에서 HTML 템플릿 수정 가능:

- `emailStyles`: 전체 스타일 설정
- 각 이메일 함수의 `html` 변수: 이메일 내용 수정

---

## 문제 해결

### SMTP 연결 실패

- Gmail 앱 비밀번호 확인
- 2단계 인증 활성화 확인
- 방화벽 설정 확인

### 이메일 미전송

- 환경 변수 확인 (`.env.local`)
- 서버 재시작
- 이메일 주소 유효성 확인

---

## 테스트 이메일 전송

```bash
# 개발 환경
curl -X GET http://localhost:3015/api/email/send \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# 프로덕션 환경
curl -X GET https://your-domain.com/api/email/send \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

성공 응답:
```json
{
  "success": true,
  "message": "SMTP 연결 성공"
}
```
