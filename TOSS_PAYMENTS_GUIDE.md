# 토스페이먼츠 연동 가이드

## 📋 개요

라이브 커머스 플랫폼에 토스페이먼츠 결제 시스템을 연동합니다.

---

## 🔑 토스페이먼츠 키 발급

### 1단계: 토스페이먼츠 가입
1. https://www.tosspayments.com 접속
2. **무료로 시작하기** 클릭
3. 회원가입 (사업자 정보 필요)

### 2단계: API 키 발급
1. 토스페이먼츠 대시보드 로그인
2. **개발자센터** → **API 키** 메뉴
3. **테스트 API 키** 복사:
   - 클라이언트 키 (Client Key)
   - 시크릿 키 (Secret Key)

---

## 🔧 환경 변수 설정

### `.env.local` 파일 생성/수정

```env
# 토스페이먼츠 테스트 키
NEXT_PUBLIC_TOSS_CLIENT_KEY=test_ck_xxxxxxxxxxxxxxxxxxxxxxxx
TOSS_SECRET_KEY=test_sk_xxxxxxxxxxxxxxxxxxxxxxxx

# 토스페이먼츠 프로덕션 키 (실서비스용)
# NEXT_PUBLIC_TOSS_CLIENT_KEY=live_ck_xxxxxxxxxxxxxxxxxxxxxxxx
# TOSS_SECRET_KEY=live_sk_xxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 💳 결제 플로우

### 1. 주문 생성
```
Customer → 제품 선택 → 주문서 작성 → 결제 요청
```

### 2. 결제 승인
```
토스페이먼츠 위젯 → 결제 정보 입력 → 서버 승인 요청 → 주문 완료
```

### 3. 결제 확인
```
Webhook → 결제 상태 업데이트 → 정산 처리
```

---

## 📊 결제 API 엔드포인트

### 1. 주문 생성
**POST** `/api/orders`

Request:
```json
{
  "partnerId": "partner-uuid",
  "items": [
    {
      "productId": "product-uuid",
      "quantity": 2
    }
  ],
  "shippingInfo": {
    "name": "홍길동",
    "phone": "010-1234-5678",
    "address": "서울시 강남구...",
    "zipCode": "12345"
  }
}
```

Response:
```json
{
  "orderId": "order-uuid",
  "orderNumber": "ORD-1234567890",
  "amount": 50000,
  "customerKey": "customer-uuid"
}
```

### 2. 결제 승인
**POST** `/api/payments/confirm`

Request:
```json
{
  "orderId": "order-uuid",
  "paymentKey": "payment-key-from-toss",
  "amount": 50000
}
```

Response:
```json
{
  "success": true,
  "order": {
    "id": "order-uuid",
    "status": "PAID",
    "paidAt": "2024-02-18T12:00:00Z"
  }
}
```

---

## 🎨 프론트엔드 통합

### 결제 위젯 사용 예시

```typescript
import { loadTossPayments } from '@tosspayments/payment-sdk'

const tossPayments = await loadTossPayments(clientKey)

const payment = tossPayments.payment({
  amount: 50000,
  orderId: 'order-uuid',
  orderName: '상품명',
  customerName: '고객명',
  successUrl: 'https://yourdomain.com/payments/success',
  failUrl: 'https://yourdomain.com/payments/fail',
})

await payment.requestPayment('카드')
```

---

## 🔒 보안 고려사항

1. **시크릿 키 보호**: `.env.local` 파일을 `.gitignore`에 추가
2. **금액 검증**: 서버에서 반드시 금액 재계산 및 검증
3. **HTTPS 필수**: 프로덕션 환경에서는 HTTPS 사용
4. **Webhook 서명 검증**: 토스페이먼츠 Webhook 서명 확인

---

## 💰 수수료 정책

### 토스페이먼츠 수수료
- 신용카드: 약 3.2% (업종별 상이)
- 계좌이체: 약 1.0%
- 가상계좌: 약 300원

### 플랫폼 수수료 구조
```
주문 금액: 100,000원
├─ 토스페이먼츠 수수료: 3,200원 (3.2%)
├─ 파트너 수익: 28,800원 (30%)
└─ 플랫폼 수익: 68,000원 (70%)
```

---

## 🧪 테스트 카드

### 토스페이먼츠 테스트용 카드 번호

| 카드사 | 번호 | 유효기간 | CVC |
|--------|------|----------|-----|
| 신한카드 | 5543-0000-0000-0001 | 12/28 | 123 |
| 국민카드 | 9430-0000-0000-0001 | 12/28 | 123 |
| 하나카드 | 4570-0000-0000-0001 | 12/28 | 123 |

**비밀번호**: 아무 숫자 2자리
**생년월일**: 아무 날짜 6자리

---

## 📝 결제 상태 관리

### 주문 상태 (Order Status)
- `PENDING`: 결제 대기
- `PAID`: 결제 완료
- `CONFIRMED`: 주문 확인
- `SHIPPING`: 배송중
- `DELIVERED`: 배송완료
- `CANCELLED`: 취소됨
- `REFUNDED`: 환불됨

### 결제 처리 플로우
```
1. PENDING → 주문 생성
2. PAID → 결제 승인 완료
3. CONFIRMED → 관리자/파트너 주문 확인
4. SHIPPING → 배송 시작
5. DELIVERED → 배송 완료 → 정산 가능
```

---

## 🚨 에러 핸들링

### 결제 실패 시
1. 고객에게 실패 사유 안내
2. 주문 상태를 `CANCELLED`로 변경
3. 재고 복구
4. 결제 재시도 옵션 제공

### 결제 취소/환불 시
1. 토스페이먼츠 취소 API 호출
2. 주문 상태를 `REFUNDED`로 변경
3. 재고 복구
4. 파트너 수익 차감 처리

---

## 📚 참고 문서

- [토스페이먼츠 개발자 문서](https://docs.tosspayments.com/)
- [결제 위젯 가이드](https://docs.tosspayments.com/guides/payment-widget/overview)
- [API 레퍼런스](https://docs.tosspayments.com/reference)
- [테스트 가이드](https://docs.tosspayments.com/guides/test)

---

## ✅ 구현 체크리스트

- [ ] 토스페이먼츠 계정 생성
- [ ] API 키 발급 및 환경 변수 설정
- [ ] 주문 생성 API 구현
- [ ] 결제 승인 API 구현
- [ ] 결제 위젯 통합
- [ ] 결제 성공/실패 페이지 구현
- [ ] Webhook 수신 엔드포인트 구현
- [ ] 테스트 결제 시나리오 검증
- [ ] 에러 핸들링 구현
- [ ] 프로덕션 키로 전환

---

**참고**: 현재는 기본 구조만 구현되어 있으며, 실제 토스페이먼츠 API 키를 발급받아 환경 변수를 설정하면 결제 기능이 활성화됩니다.

**개발 완료**: 2024-02-18
**개발자**: Stevewon
