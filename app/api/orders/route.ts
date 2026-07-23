import { NextRequest, NextResponse } from 'next/server'
import { verifyAuthToken } from '@/lib/auth/middleware'
import { getPrisma } from '@/lib/prisma';
import { orderConfirmationEmail, sendEmail } from '@/lib/email'
import { orderConfirmationSMS, sendSMS } from '@/lib/sms'
import { sendEmailWithPreferences, sendSMSWithPreferences } from '@/lib/notification'
// [v1.0.22] 잔액 결제 시스템 통합
import { getD1, krwToQkey, QKEY_TO_KRW, newId, qtaFromKrw, ensureQtaColumn } from '@/lib/balance';
// [병행결제] Order 테이블 결제 분할 기록 컬럼 자동 보정
import { ensureOrderPaymentColumns, ensureUserQrchatColumns } from '@/lib/ensureProductColumns';
// [상품 스냅샷] OrderItem 에 주문 시점 상품명/썸네일 저장 (상품 삭제/변경돼도 주문내역 유지)
import { ensureOrderItemSnapshotColumns, backfillOrderItemSnapshots } from '@/lib/orderItemSnapshot';
// [QRChat 연동] B 회원(origin=QRCHAT) QKEY 를 Firebase 에서 직접 차감
import { spendQkeyForQrlive, getQrchatQkeyBalance } from '@/lib/qrchat-bridge';
// Cloudflare Workers compatible crypto

// ─── 휴대전화번호 정규화 (KR) ───
// 입력 예: '010-1234-5678', '01012345678', '+82 10 1234 5678', '+821012345678'
// 출력 예: '01012345678' (숫자만, 11자리). 유효성 미달 시 null.
function normalizeKrPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/[^0-9]/g, '');
  // +82 / 82 로 시작하는 국제표기 -> 국내 0 prefix 로 변환
  if (digits.startsWith('82')) {
    digits = '0' + digits.slice(2);
  }
  // 010/011/016/017/018/019 계열 휴대전화 11자리 (또는 일부 10자리 011~) 만 통과
  if (!/^01[016789][0-9]{7,8}$/.test(digits)) return null;
  return digits;
}

// 주문 알림 전송 함수 (회원 + 비회원 모두 지원)
// [2026-05-11 v3] 비회원 SMS/이메일 알림 누락 패치 - 사장님 HIGH 1 지시
// - 회원: sendEmailWithPreferences / sendSMSWithPreferences (사용자 알림설정 존중)
// - 비회원: sendEmail / sendSMS 직접 호출 (체크아웃에서 받은 guestEmail/guestPhone 사용)
async function sendOrderNotifications(order: any, userId?: string, guestEmail?: string, guestPhone?: string) {
  const prisma = await getPrisma();
  try {
    let email: string | null = null;
    let phone: string | null = null;
    let name: string = order.shippingName;

    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, phone: true, name: true }
      });
      if (user) {
        email = user.email;
        phone = user.phone;
        name = user.name;
      }
    } else {
      // 비회원: 체크아웃에서 받은 guestEmail/guestPhone 우선,
      // 누락 시 shippingPhone(필수) 사용
      email = guestEmail || null;
      phone = guestPhone || order.shippingPhone || null;
      name = order.shippingName || '고객';
    }

    const orderWithItems = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        items: {
          include: {
            product: {
              select: { name: true }
            }
          }
        }
      }
    });

    if (!orderWithItems) return;

    // ─── 이메일 전송 ───
    if (email) {
      const emailHtml = orderConfirmationEmail({
        customerName: name,
        orderNumber: order.orderNumber,
        orderDate: new Date(order.createdAt).toLocaleString('ko-KR'),
        items: orderWithItems.items.map(item => ({
          name: item.product.name,
          quantity: item.quantity,
          price: item.price
        })),
        subtotal: order.subtotal,
        shippingFee: order.shippingFee,
        total: order.total,
        shippingAddress: `${order.shippingName} / ${order.shippingPhone}\n${order.shippingAddress} ${order.shippingZipCode || ''}`
      });

      const subject = `[QRLIVE] 주문이 접수되었습니다 (${order.orderNumber})`;

      if (userId) {
        // 회원: 사용자 알림 설정 존중
        await sendEmailWithPreferences({
          userId,
          to: email,
          subject,
          html: emailHtml,
          notificationType: 'order'
        });
      } else {
        // 비회원: 알림 설정 없음 -> 체크아웃에서 약관 동의했으므로 직접 발송
        try {
          await sendEmail({
            to: email,
            subject,
            html: emailHtml,
          });
          console.log('[GuestOrder] 이메일 발송 완료:', email, 'orderNumber:', order.orderNumber);
        } catch (e: any) {
          console.error('[GuestOrder] 이메일 발송 실패:', e?.message || e);
        }
      }
    }

    // ─── SMS 전송 ───
    const normalizedPhone = normalizeKrPhone(phone);
    if (normalizedPhone) {
      const smsMessage = orderConfirmationSMS({
        customerName: name,
        orderNumber: order.orderNumber,
        total: order.total
      });

      if (userId) {
        // 회원: 사용자 알림 설정 존중
        await sendSMSWithPreferences({
          userId,
          to: normalizedPhone,
          message: smsMessage,
          notificationType: 'order'
        });
      } else {
        // 비회원: 알림 설정 없음 -> 체크아웃에서 입력한 연락처로 직접 발송
        try {
          await sendSMS({
            to: normalizedPhone,
            message: smsMessage,
          });
          console.log('[GuestOrder] SMS 발송 완료:', normalizedPhone, 'orderNumber:', order.orderNumber);
        } catch (e: any) {
          console.error('[GuestOrder] SMS 발송 실패:', e?.message || e);
        }
      }
    } else if (phone) {
      console.warn('[OrderNotification] 휴대전화 번호 정규화 실패, SMS 미발송:', phone);
    }
  } catch (error) {
    console.error('Order notification error:', error);
  }
}

// 주문 생성 (POST) - 회원 + 비회원 모두 지원
export async function POST(req: NextRequest) {
  const prisma = await getPrisma();
  try {
    // 인증 시도 (비회원이면 null)
    let userId: string | null = null;
    const authResult = await verifyAuthToken(req);
    if (!(authResult instanceof NextResponse)) {
      userId = authResult.userId;
    }

    const body = await req.json();
    const {
      items,
      shippingName,
      shippingPhone,
      shippingAddress,
      shippingZipCode,
      shippingMemo,
      paymentMethod: rawPaymentMethod = 'KRW_BALANCE',
      shippingFee = 3000,
      couponCode,
      // [병행결제] SPLIT_BALANCE 시 사용할 쿠키(QKEY) 개수 (나머지는 현금으로 자동 차감)
      splitQkey: rawSplitQkey,
      // 비회원 전용 필드
      guestEmail,
      guestPhone,
    } = body;

    // [v1.0.22] 결제수단 검증 — KRW 잔액 / QKEY 잔액 / SPLIT(쿠키+현금 병행) 만 허용, PG 계열 완전 차단
    const ALLOWED_METHODS = ['KRW_BALANCE', 'QKEY_BALANCE', 'SPLIT_BALANCE'] as const;
    type PaymentMethod = typeof ALLOWED_METHODS[number];

    const paymentMethod: PaymentMethod = ALLOWED_METHODS.includes(rawPaymentMethod as any)
      ? (rawPaymentMethod as PaymentMethod)
      : 'KRW_BALANCE';

    // 잔액 결제는 회원만 사용 가능 (비회원 지원 안 함)
    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: '잔액 결제는 로그인 후 이용 가능합니다. 로그인 후 잔액을 충전해주세요.',
          code: 'AUTH_REQUIRED',
        },
        { status: 401 }
      );
    }

    // 유효성 검사
    if (!items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: '주문할 상품이 없습니다' },
        { status: 400 }
      );
    }

    if (!shippingName || !shippingPhone || !shippingAddress) {
      return NextResponse.json(
        { success: false, error: '배송 정보를 입력해주세요' },
        { status: 400 }
      );
    }

    // 배송비 설정 조회 (DB에서 동적 배송비 가져오기)
    // SiteSetting 테이블은 prisma/schema.prisma 에 정의되어 있고 D1 마이그레이션으로 생성됨
    // (inline CREATE TABLE 제거 - 주문 1건당 불필요한 DDL 2회 실행 비용 절감)
    let configShippingFee = 3000;
    let configFreeThreshold = 50000;
    try {
      const shippingSettings = await prisma.siteSetting.findMany({
        where: { key: { in: ['SHIPPING_FEE', 'FREE_SHIPPING_THRESHOLD'] } },
      });
      for (const s of shippingSettings) {
        if (s.key === 'SHIPPING_FEE') configShippingFee = parseInt(s.value) || 3000;
        if (s.key === 'FREE_SHIPPING_THRESHOLD') configFreeThreshold = parseInt(s.value) || 50000;
      }
    } catch (e) {
      // DB 오류 시 기본값 사용
      console.error('Failed to load shipping settings:', e);
    }

    // 상품 가격 검증
    const productIds = items.map((item: any) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } }
    });

    let subtotal = 0;
    const validatedItems: Array<{
      productId: string;
      quantity: number;
      price: number;
      productName: string;
      productThumbnail: string | null;
    }> = [];

    // 파트너 스토어를 통한 주문인 경우 partnerId 확인
    const { partnerId: requestPartnerId } = body;

    for (const item of items) {
      const product = products.find(p => p.id === item.productId);
      if (!product) {
        return NextResponse.json(
          { success: false, error: `상품을 찾을 수 없습니다: ${item.productId}` },
          { status: 404 }
        );
      }

      if (product.stock < item.quantity) {
        return NextResponse.json(
          { success: false, error: `${product.name}의 재고가 부족합니다` },
          { status: 400 }
        );
      }

      const itemTotal = product.price * item.quantity;
      subtotal += itemTotal;

      validatedItems.push({
        productId: product.id,
        quantity: item.quantity,
        price: product.price,
        // ★ 주문 시점 상품 스냅샷 (상품 삭제/변경돼도 주문내역/배송 유지)
        productName: product.name,
        productThumbnail: (product as any).thumbnail || null,
      });
    }

    // partnerId 결정: 요청에서 전달 or 상품의 파트너 제품에서 자동 매칭
    let partnerId: string | null = requestPartnerId || null;
    if (!partnerId && productIds.length > 0) {
      // 상품이 파트너 제품에 등록되어 있으면 해당 파트너를 자동 매칭
      const partnerProduct = await prisma.partnerProduct.findFirst({
        where: { 
          productId: { in: productIds },
          isActive: true
        }
      });
      if (partnerProduct) {
        partnerId = partnerProduct.partnerId;
      }
    }

    // 서버사이드 배송비 계산
    // [정책] 가격을 떠나 전 상품 무조건 무료배송 — 배송비는 항상 0원.
    //  (기존 임계금액/기본배송비 설정은 무시하고 강제로 무료 처리)
    const serverShippingFee = 0;
    // (참고용으로 남겨둔 설정값 — 계산에는 사용하지 않음)
    void configShippingFee; void configFreeThreshold;

    // 쿠폰 처리
    let discount = 0;
    let appliedShippingFee = serverShippingFee;
    let couponId: string | null = null;

    if (couponCode) {
      const coupon = await prisma.coupon.findUnique({
        where: { code: couponCode.toUpperCase() }
      });

      if (coupon && coupon.isActive) {
        const now = new Date();
        if (now >= coupon.validFrom && now <= coupon.validUntil) {
          if (coupon.usageLimit === null || coupon.usedCount < coupon.usageLimit) {
            if (!coupon.minAmount || subtotal >= coupon.minAmount) {
              couponId = coupon.id;
              switch (coupon.type) {
                case 'FIXED':
                  discount = coupon.value;
                  break;
                case 'PERCENT':
                  discount = subtotal * (coupon.value / 100);
                  if (coupon.maxDiscount && discount > coupon.maxDiscount) {
                    discount = coupon.maxDiscount;
                  }
                  break;
                case 'FREE_SHIPPING':
                  appliedShippingFee = 0;
                  break;
              }
            }
          }
        }
      }
    }

    const total = subtotal - discount + appliedShippingFee;

    // 주문 번호 생성
    const orderNumber = `ORD-${Date.now()}`;
    
    // 비회원 주문조회 토큰 생성 (Cloudflare Workers 호환)
    let guestOrderToken: string | null = null;
    if (!userId) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      guestOrderToken = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // [v1.0.22] 잔액 사전 확인 (트랜잭션 진입 전 빠른 실패)
    // 실제 차감은 트랜잭션 안에서 다시 원자적으로 수행
    const d1 = await getD1();
    // [QRChat 연동] origin/qrchatUid 컬럼 보장 후, 출처 판별에 필요한 필드까지 조회
    try { await ensureUserQrchatColumns(d1); } catch { /* 보정 실패해도 진행 */ }
    // [상품 스냅샷] OrderItem 에 productName/productThumbnail 컬럼 보장 (주문 생성 전 필수)
    try { await ensureOrderItemSnapshotColumns(d1); } catch { /* 보정 실패해도 진행 */ }
    const userRow: any = await d1
      .prepare(
        `SELECT "krwBalance","qkeyBalance","origin","qrchatUid","nickname","name","securetQrUrl"
         FROM "User" WHERE "id" = ? LIMIT 1`
      )
      .bind(userId)
      .first();
    if (!userRow) {
      return NextResponse.json(
        { success: false, error: '사용자 정보를 찾을 수 없습니다' },
        { status: 404 }
      );
    }
    const currentKrw = Number(userRow.krwBalance) || 0;
    const currentQkey = Number(userRow.qkeyBalance) || 0;

    // ── [QRChat 연동] B 회원 판별 ──────────────────────────────────────────
    // 사장님 확정: origin="QRCHAT" 이고 qrchatUid+지갑(securetQrUrl)이 있으면
    //   QKEY 는 쇼핑몰 자체 잔액이 아니라 QRChat(Firebase) 에서 "직접 차감((가))".
    //   → 이 경우 로컬 qkeyBalance 대신 spendQkeyForQrlive 로 결제.
    //   ⚠️ A 회원(origin=QRLIVE)은 지갑연결(qrchatUid 있음)이라도 origin 으로 구분되어
    //      절대 다른 사람 QKEY 를 차감하지 않음. 단, A 회원이 명시적으로 지갑연결한
    //      경우도 qrchatUid 로 본인 QRChat 잔액을 차감할 수 있음(사장님 답변 (2)).
    const qrchatUid: string | null = userRow.qrchatUid || null;
    const qrchatWallet: string = String(userRow.securetQrUrl || '').trim().toLowerCase();
    const qrchatNick: string = String(userRow.nickname || userRow.name || '').trim();
    // QKEY 를 Firebase 에서 차감해야 하는 회원인지: qrchatUid + 지갑 존재 (B 회원 또는 지갑연결 A 회원)
    const usesFirebaseQkey: boolean = !!(qrchatUid && qrchatWallet && qrchatNick);

    // ── [병행결제] 서버측 분할 금액 산정 (신뢰: 클라이언트 splitQkey 는 참고값, 서버에서 재검증) ──
    // splitUsedQkey: 실제 사용할 쿠키 개수. 다음 세 값 중 최솟값으로 clamp.
    //   (1) 클라이언트 요청 개수, (2) 보유 쿠키 잔액, (3) 결제금액을 쿠키로 환산(내림)
    //
    // ⚠️ [핵심 버그 수정 2026-07-23]
    //   B 회원(QRChat 연동)은 쿠키(QKEY) 잔액이 로컬 D1 에는 항상 0 이고 실제 잔액은
    //   Firebase(QRChat) 에 있다. 기존 SPLIT 경로는 로컬 currentQkey(=0) 만 보고
    //   쿠키를 한 개도 못 써서 "현금 전액 필요 → 현금 부족" 402 로 튕겼다.
    //   → SPLIT 이고 usesFirebaseQkey 면 Firebase 실시간 쿠키 잔액을 상한으로 사용한다.
    let splitUsedQkey = 0;
    let splitKrwRemainder = 0;
    // 병행결제 시 쿠키를 Firebase 에서 차감해야 하는지 (커밋 후 spendQkeyForQrlive 사용)
    let splitUsesFirebaseQkey = false;
    if (paymentMethod === 'SPLIT_BALANCE') {
      // 쿠키 사용 가능 상한(개수). 기본은 로컬 잔액.
      let availableQkey = currentQkey;
      if (usesFirebaseQkey) {
        // B 회원(또는 지갑연결 A 회원): Firebase 실시간 잔액을 상한으로 사용
        try {
          const live = await getQrchatQkeyBalance(qrchatUid as string);
          if (live.ok && typeof live.qkeyBalance === 'number') {
            availableQkey = Math.max(0, Math.floor(live.qkeyBalance));
            splitUsesFirebaseQkey = true;
          }
        } catch (e) {
          console.error('[orders POST] split firebase qkey balance fetch failed:', e);
        }
      }
      const requested = Math.max(0, Math.floor(Number(rawSplitQkey) || 0));
      const maxByBalance = availableQkey;
      const maxByTotal = Math.floor(total / QKEY_TO_KRW); // 결제금액 초과 사용 방지
      splitUsedQkey = Math.min(requested, maxByBalance, maxByTotal);
      if (splitUsedQkey < 0) splitUsedQkey = 0;
      splitKrwRemainder = Math.max(0, total - splitUsedQkey * QKEY_TO_KRW);

      // [병행결제 자동 보정] 남은 현금이 현금 잔액보다 많아 결제가 불가능하지만,
      //   쿠키(QKEY)를 더 써서 부족한 현금분을 메울 수 있다면 자동으로 쿠키 사용량을 늘린다.
      //   → 사용자가 쿠키를 적게(또는 0으로) 요청해서 "현금 부족" 으로 튕기던 문제 방지.
      if (splitKrwRemainder > currentKrw) {
        const cashShortfall = splitKrwRemainder - currentKrw;           // 더 메워야 하는 현금
        const extraQkeyNeeded = Math.ceil(cashShortfall / QKEY_TO_KRW); // 그만큼 필요한 추가 쿠키(올림)
        const bumpedQkey = Math.min(splitUsedQkey + extraQkeyNeeded, maxByBalance, maxByTotal);
        if (bumpedQkey > splitUsedQkey) {
          splitUsedQkey = bumpedQkey;
          splitKrwRemainder = Math.max(0, total - splitUsedQkey * QKEY_TO_KRW);
        }
      }
    }

    // 필요 금액 검증
    if (paymentMethod === 'KRW_BALANCE') {
      if (currentKrw < total) {
        return NextResponse.json(
          {
            success: false,
            error: `KRW 잔액이 부족합니다 (현재: ${currentKrw.toLocaleString()}원, 필요: ${total.toLocaleString()}원)`,
            code: 'INSUFFICIENT_BALANCE',
            balance: { krw: currentKrw, qkey: currentQkey },
            required: { krw: total, qkey: krwToQkey(total) },
          },
          { status: 402 } // Payment Required
        );
      }
    } else if (paymentMethod === 'QKEY_BALANCE' && usesFirebaseQkey) {
      // [QRChat 연동] B 회원(또는 지갑연결 A 회원) → 로컬 잔액 대신 Firebase 잔액 사전 확인.
      //   실제 차감은 주문 생성 후 spendQkeyForQrlive 트랜잭션에서 원자적으로 수행.
      //   여기서는 사전 실패를 위해 link/verify 없이 스킵하고, 차감 단계에서 402 처리.
      //   (Firebase 는 spend 시 잔액 부족을 insufficient_balance 로 반환)
    } else if (paymentMethod === 'QKEY_BALANCE') {
      // QKEY_BALANCE: total(KRW) 을 QKEY 로 환산 (올림하여 사용자 손해 방지)
      const requiredQkey = Math.ceil(total / QKEY_TO_KRW);
      if (currentQkey < requiredQkey) {
        return NextResponse.json(
          {
            success: false,
            error: `QKEY 잔액이 부족합니다 (현재: ${currentQkey.toLocaleString()} QKEY, 필요: ${requiredQkey.toLocaleString()} QKEY)`,
            code: 'INSUFFICIENT_BALANCE',
            balance: { krw: currentKrw, qkey: currentQkey },
            required: { krw: total, qkey: requiredQkey },
          },
          { status: 402 }
        );
      }
    } else {
      // SPLIT_BALANCE: 쿠키 usedQkey 개 + 나머지 현금 splitKrwRemainder 원
      // 쿠키 보유 확인 (splitUsedQkey 는 이미 잔액 이하로 clamp 되었지만 방어)
      //   ⚠️ B 회원(splitUsesFirebaseQkey)은 로컬 currentQkey 가 항상 0 이므로 로컬 잔액으로
      //      검증하면 안 된다. 실제 쿠키 차감은 커밋 후 spendQkeyForQrlive(Firebase)에서
      //      원자적으로 이뤄지고, 잔액 부족은 그 단계에서 402 로 처리한다.
      if (!splitUsesFirebaseQkey && currentQkey < splitUsedQkey) {
        return NextResponse.json(
          {
            success: false,
            error: `쿠키 잔액이 부족합니다 (현재: ${currentQkey.toLocaleString()} 쿠키)`,
            code: 'INSUFFICIENT_BALANCE',
            balance: { krw: currentKrw, qkey: currentQkey },
          },
          { status: 402 }
        );
      }
      // 나머지 현금 잔액 확인
      if (currentKrw < splitKrwRemainder) {
        return NextResponse.json(
          {
            success: false,
            error: `현금 잔액이 부족합니다 (현재: ${currentKrw.toLocaleString()}원, 필요: ${splitKrwRemainder.toLocaleString()}원). 쿠키 사용량을 늘리거나 잔액을 충전해주세요.`,
            code: 'INSUFFICIENT_BALANCE',
            balance: { krw: currentKrw, qkey: currentQkey },
            required: { krw: splitKrwRemainder, qkey: splitUsedQkey },
          },
          { status: 402 }
        );
      }
    }

    // QTA 적립 컬럼 자동 보정 (멱등, 회원 주문 시에만 의미)
    if (userId) {
      try {
        await ensureQtaColumn(await getD1());
      } catch { /* 보정 실패해도 주문은 진행 */ }
    }

    // [병행결제] Order.paidQkey / paidKrw 컬럼 자동 보정 (멱등)
    try {
      await ensureOrderPaymentColumns(d1);
    } catch { /* 보정 실패해도 주문은 진행 (컬럼 없으면 아래 set 시 무시됨) */ }

    // 결제 분할 금액 산정 (모든 결제수단 공통 — 주문 기록용)
    const paidQkey =
      paymentMethod === 'QKEY_BALANCE' ? Math.ceil(total / QKEY_TO_KRW)
      : paymentMethod === 'SPLIT_BALANCE' ? splitUsedQkey
      : 0;
    const paidKrw =
      paymentMethod === 'KRW_BALANCE' ? total
      : paymentMethod === 'SPLIT_BALANCE' ? splitKrwRemainder
      : 0;

    // 주문 생성 (트랜잭션)
    const order = await prisma.$transaction(async (tx) => {
      // Build order data - only include non-null/undefined fields for D1 compatibility
      const orderData: any = {
        orderNumber,
        subtotal,
        discount,
        shippingFee: appliedShippingFee,
        total,
        shippingName,
        shippingPhone,
        shippingAddress,
        paymentMethod, // 'KRW_BALANCE' | 'QKEY_BALANCE' | 'SPLIT_BALANCE'
        // [병행결제] 이 주문에서 쿠키/현금으로 각각 결제한 양 (자동 보정된 컬럼)
        paidQkey,
        paidKrw,
        // [v1.0.22] 잔액 결제는 즉시 확정 (PG 없음, 승인 대기 없음)
        status: 'CONFIRMED',
        paidAt: new Date().toISOString(),
        items: {
          create: validatedItems
        }
      };
      // Only add optional fields if they have actual values
      if (userId) orderData.userId = userId;
      if (guestOrderToken) orderData.guestOrderToken = guestOrderToken;
      if (shippingZipCode) orderData.shippingZipCode = shippingZipCode;
      if (shippingMemo) orderData.shippingMemo = shippingMemo;
      if (couponId) orderData.couponId = couponId;
      
      // 파트너 연결 및 수익 계산
      if (partnerId) {
        const partner = await tx.partner.findUnique({
          where: { id: partnerId }
        });
        if (partner && partner.isActive) {
          orderData.partnerId = partnerId;
          const commissionRate = partner.commissionRate || 30;
          orderData.partnerRevenue = Math.round(total * (commissionRate / 100));
          orderData.platformRevenue = total - orderData.partnerRevenue;
        }
      }

      const newOrder = await tx.order.create({
        data: orderData,
        include: {
          items: {
            include: {
              product: true
            }
          }
        }
      });

      // [v1.0.22] 잔액 원자 차감 + BalanceLedger 기록 (트랜잭션 내부 raw)
      // ── Prisma $transaction(tx) 컨텍스트 안에서 직접 raw 실행하여 원자성 보장.
      //    (lib/balance.adjustBalance 는 별도 D1 바인딩이라 이 트랜잭션과 무관 → 여기서는 tx 사용)
      //
      // 통화별 차감을 공통 헬퍼로 처리 (KRW / QKEY 각각 원자적 재확인 후 차감 + 원장 기록).
      const debitOneCurrency = async (
        column: 'krwBalance' | 'qkeyBalance',
        currency: 'KRW' | 'QKEY',
        debitAmount: number,
      ) => {
        if (debitAmount <= 0) return; // 0 이하면 차감/기록 생략 (병행결제에서 한쪽이 0인 경우)
        // 1) 현재 잔액 재조회 (트랜잭션 내부 최신값) — 동시성 대비 재확인
        const balRows: any = await tx.$queryRawUnsafe(
          `SELECT "${column}" AS bal FROM "User" WHERE "id" = ? LIMIT 1`,
          userId
        );
        const balRow = Array.isArray(balRows) ? balRows[0] : balRows;
        const curBal = Number(balRow?.bal) || 0;
        const afterBal = curBal - debitAmount;
        if (afterBal < 0) {
          // 트랜잭션 롤백 유도 (동시 주문으로 잔액이 그 사이 소진된 경우)
          throw new Error('INSUFFICIENT_BALANCE_TX');
        }
        // 2) User 잔액 차감
        await tx.$executeRawUnsafe(
          `UPDATE "User" SET "${column}" = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ?`,
          afterBal,
          userId
        );
        // 3) BalanceLedger 기록 (사용자 노출 안전 문구만)
        await tx.$executeRawUnsafe(
          `INSERT INTO "BalanceLedger"
             ("id","userId","currency","amount","balanceAfter","reason","relatedOrderId","relatedRequestId","createdAt")
           VALUES (?, ?, ?, ?, ?, ?, ?, NULL, CURRENT_TIMESTAMP)`,
          newId(),
          userId,
          currency,
          -debitAmount,
          afterBal,
          '주문 결제',
          newOrder.id
        );
      };

      if (paymentMethod === 'KRW_BALANCE') {
        await debitOneCurrency('krwBalance', 'KRW', total);
      } else if (paymentMethod === 'QKEY_BALANCE' && usesFirebaseQkey) {
        // [QRChat 연동] 로컬 QKEY 차감을 하지 않는다.
        //   → 트랜잭션 커밋 후 spendQkeyForQrlive 로 Firebase 잔액에서 직접 차감.
        //   (외부 HTTP 는 D1 트랜잭션 내부에서 부를 수 없으므로 커밋 후 보상방식 처리)
      } else if (paymentMethod === 'QKEY_BALANCE') {
        // QKEY 는 올림 환산 (사전 확인과 동일 규칙)
        await debitOneCurrency('qkeyBalance', 'QKEY', Math.ceil(total / QKEY_TO_KRW));
      } else {
        // [병행결제] SPLIT_BALANCE: 쿠키(splitUsedQkey개) + 나머지 현금(splitKrwRemainder원)
        //   현금(KRW)은 항상 로컬 D1 에서 차감한다.
        //   쿠키(QKEY)는:
        //     · 일반 회원        → 로컬 D1 qkeyBalance 에서 차감
        //     · B 회원(Firebase) → 로컬 차감 생략, 커밋 후 spendQkeyForQrlive 로 Firebase 차감
        //   → 트랜잭션 안에서는 로컬 차감만, 외부 HTTP(Firebase)는 커밋 후 보상방식.
        if (!splitUsesFirebaseQkey && splitUsedQkey > 0) {
          await debitOneCurrency('qkeyBalance', 'QKEY', splitUsedQkey);
        }
        if (splitKrwRemainder > 0) {
          await debitOneCurrency('krwBalance', 'KRW', splitKrwRemainder);
        }
      }

      // [QTA 적립] 현금(KRW) 100% 결제 시에만 구매 금액의 5% 를 QTA 로 적립 (100원 = 1 QTA)
      // ── 사장님 확정 룰(2026-07-23): 현금으로 100% 상품 구매한 경우에만 적립.
      //    · KRW_BALANCE  = 현금(원화) 100% 결제 → 적립 O
      //    · QKEY_BALANCE = 쿠키(QKEY) 결제      → 적립 X
      //    · SPLIT_BALANCE= 쿠키+현금 병행 결제   → 적립 X (현금 100% 가 아님)
      // ── 회원(userId 존재)만 적립. 예: 20,000원 → 5% = 1,000원 → ÷100 = 10 QTA
      //    같은 트랜잭션 내부 raw 실행으로 원자성 보장.
      //    적립 실패가 주문 자체를 막지 않도록 방어적으로 처리.
      //    취소/환불 시에는 BalanceLedger 의 이 주문 적립분을 그대로 회수(차감)한다.
      const isCashOnlyPayment = paymentMethod === 'KRW_BALANCE';
      if (userId && isCashOnlyPayment) {
        try {
          const qtaEarned = qtaFromKrw(total);
          if (qtaEarned > 0) {
            // 1) 현재 QTA 적립 잔액 재조회
            const qtaRows: any = await tx.$queryRawUnsafe(
              `SELECT "qtaBalance" AS bal FROM "User" WHERE "id" = ? LIMIT 1`,
              userId
            );
            const qtaRow = Array.isArray(qtaRows) ? qtaRows[0] : qtaRows;
            const curQta = Number(qtaRow?.bal) || 0;
            const afterQta = curQta + qtaEarned;

            // 2) User QTA 적립 잔액 증가
            await tx.$executeRawUnsafe(
              `UPDATE "User" SET "qtaBalance" = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ?`,
              afterQta,
              userId
            );

            // 3) BalanceLedger 기록 (사용자 노출 안전 문구만)
            const qtaLedgerId = newId();
            await tx.$executeRawUnsafe(
              `INSERT INTO "BalanceLedger"
                 ("id","userId","currency","amount","balanceAfter","reason","relatedOrderId","relatedRequestId","createdAt")
               VALUES (?, ?, ?, ?, ?, ?, ?, NULL, CURRENT_TIMESTAMP)`,
              qtaLedgerId,
              userId,
              'QTA',
              qtaEarned,
              afterQta,
              '구매 적립',
              newOrder.id
            );
          }
        } catch (qtaErr: any) {
          // QTA 적립 실패는 주문 결제/생성을 막지 않는다 (로그만 남김)
          console.warn('[QTA 적립 실패(무시)]', String(qtaErr?.message || qtaErr || ''));
        }
      }

      // 재고 차감 (batch update - N+1 쿼리 제거)
      // 같은 productId가 items에 여러 번 나올 수 있으므로 productId별로 합산
      const stockDecrementMap = new Map<string, number>();
      for (const item of validatedItems) {
        const qty = Number(item.quantity);
        if (!item.productId || !Number.isFinite(qty) || qty <= 0) continue;
        stockDecrementMap.set(
          item.productId,
          (stockDecrementMap.get(item.productId) || 0) + qty
        );
      }
      if (stockDecrementMap.size > 0) {
        const productIds = Array.from(stockDecrementMap.keys());
        // CASE WHEN 절 구성: 각 productId 별 다른 quantity 차감
        const caseParts: string[] = [];
        const params: any[] = [];
        for (const [pid, qty] of stockDecrementMap.entries()) {
          caseParts.push(`WHEN ? THEN stock - ?`);
          params.push(pid, qty);
        }
        const placeholders = productIds.map(() => '?').join(',');
        // WHERE 절에 동일 productIds 바인딩
        const sql = `UPDATE "Product" SET stock = CASE id ${caseParts.join(' ')} ELSE stock END, "updatedAt" = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`;
        await tx.$executeRawUnsafe(sql, ...params, ...productIds);
      }

      // 쿠폰 사용 횟수 증가
      if (couponId) {
        await tx.coupon.update({
          where: { id: couponId },
          data: {
            usedCount: { increment: 1 }
          }
        });
      }

      return newOrder;
    });

    // ── [QRChat 연동] B 회원 QKEY 결제: Firebase 잔액에서 직접 차감 ((가) 방식) ──
    //   D1 트랜잭션 커밋 후 외부 HTTP 로 spendQkeyForQrlive 호출.
    //   idemKey = order.id (주문당 1회) → 재시도/중복요청 안전.
    //   실패 시 방금 생성한 주문을 삭제(보상)하고 402/409 로 반환.
    //   ⚠️ 사장님 확정: uid+지갑+닉네임 3중 검증 후에만 차감 (다른 사람 QKEY 차감 방지).
    if (paymentMethod === 'QKEY_BALANCE' && usesFirebaseQkey) {
      const requiredQkey = Math.ceil(total / QKEY_TO_KRW);
      let spend;
      try {
        spend = await spendQkeyForQrlive({
          uid: qrchatUid as string,
          wallet: qrchatWallet,
          nick: qrchatNick,
          amountQkey: requiredQkey,
          orderId: order.id,
          idemKey: order.id, // 주문당 멱등 키
        });
      } catch (e: any) {
        spend = { ok: false, error: 'bridge_error' } as any;
      }

      if (!spend || !spend.ok) {
        // 보상: 방금 만든 주문 롤백 (재고/쿠폰은 실패 확률 낮으나 주문 삭제로 표시)
        try {
          await d1.prepare(`DELETE FROM "Order" WHERE "id" = ?`).bind(order.id).run();
          await d1.prepare(`DELETE FROM "OrderItem" WHERE "orderId" = ?`).bind(order.id).run();
        } catch (delErr) {
          console.error('[QRChat QKEY spend 실패 후 주문 롤백 실패]', delErr);
        }
        const err = String((spend as any)?.error || 'spend_failed');
        const status =
          err === 'insufficient_balance' ? 402
          : err === 'wallet_mismatch' || err === 'nickname_mismatch' ? 409
          : err === 'user_not_found' ? 404
          : err === 'banned' ? 403
          : 502;
        const msg =
          err === 'insufficient_balance' ? 'QKEY 잔액이 부족합니다. QRChat 앱에서 잔액을 확인해주세요.'
          : err === 'wallet_mismatch' || err === 'nickname_mismatch' ? '본인확인 정보가 일치하지 않아 결제할 수 없습니다.'
          : err === 'banned' ? '이용이 제한된 계정입니다.'
          : err === 'user_not_found' ? 'QRChat 사용자 정보를 찾을 수 없습니다.'
          : 'QKEY 결제 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
        return NextResponse.json(
          { success: false, error: msg, code: 'QRCHAT_QKEY_SPEND_FAILED', detail: err },
          { status }
        );
      }

      // 성공: 로컬 BalanceLedger 에 결제 기록 (표시용, 로컬 잔액은 건드리지 않음)
      try {
        await d1
          .prepare(
            `INSERT INTO "BalanceLedger"
               ("id","userId","currency","amount","balanceAfter","reason","relatedOrderId","relatedRequestId","createdAt")
             VALUES (?, ?, 'QKEY', ?, ?, '주문 결제(QRChat QKEY)', ?, NULL, CURRENT_TIMESTAMP)`
          )
          .bind(
            newId(),
            userId,
            -requiredQkey,
            Number((spend as any).newBalance) || 0,
            order.id
          )
          .run();
      } catch (ledgerErr) {
        console.warn('[QRChat QKEY 원장 기록 실패(무시)]', ledgerErr);
      }
    }

    // ── [병행결제 × QRChat] B 회원 SPLIT 결제: 쿠키(splitUsedQkey개)를 Firebase 에서 차감 ──
    //   현금(splitKrwRemainder원)은 이미 위 D1 트랜잭션에서 로컬 차감 완료.
    //   여기서 Firebase 쿠키 차감이 실패하면 → 주문 삭제 + 방금 차감한 현금까지 환원(보상).
    //   idemKey = order.id (주문당 멱등).
    if (paymentMethod === 'SPLIT_BALANCE' && splitUsesFirebaseQkey && splitUsedQkey > 0) {
      let spend;
      try {
        spend = await spendQkeyForQrlive({
          uid: qrchatUid as string,
          wallet: qrchatWallet,
          nick: qrchatNick,
          amountQkey: splitUsedQkey,
          orderId: order.id,
          idemKey: order.id,
        });
      } catch (e: any) {
        spend = { ok: false, error: 'bridge_error' } as any;
      }

      if (!spend || !spend.ok) {
        // 보상 1) 이미 로컬에서 차감한 현금(splitKrwRemainder) 을 되돌린다.
        if (splitKrwRemainder > 0) {
          try {
            const balRow: any = await d1
              .prepare(`SELECT "krwBalance" AS bal FROM "User" WHERE "id" = ? LIMIT 1`)
              .bind(userId)
              .first();
            const curKrw = Number(balRow?.bal) || 0;
            const restored = curKrw + splitKrwRemainder;
            await d1
              .prepare(`UPDATE "User" SET "krwBalance" = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ?`)
              .bind(restored, userId)
              .run();
            // 원장에 환원 기록 (사용자 노출 안전 문구)
            await d1
              .prepare(
                `INSERT INTO "BalanceLedger"
                   ("id","userId","currency","amount","balanceAfter","reason","relatedOrderId","relatedRequestId","createdAt")
                 VALUES (?, ?, 'KRW', ?, ?, '주문 결제 취소', ?, NULL, CURRENT_TIMESTAMP)`
              )
              .bind(newId(), userId, splitKrwRemainder, restored, order.id)
              .run();
          } catch (refundErr) {
            console.error('[SPLIT QRChat spend 실패 후 현금 환원 실패]', refundErr);
          }
        }
        // 보상 2) 방금 만든 주문 삭제
        try {
          await d1.prepare(`DELETE FROM "Order" WHERE "id" = ?`).bind(order.id).run();
          await d1.prepare(`DELETE FROM "OrderItem" WHERE "orderId" = ?`).bind(order.id).run();
        } catch (delErr) {
          console.error('[SPLIT QRChat spend 실패 후 주문 롤백 실패]', delErr);
        }
        const err = String((spend as any)?.error || 'spend_failed');
        const status =
          err === 'insufficient_balance' ? 402
          : err === 'wallet_mismatch' || err === 'nickname_mismatch' ? 409
          : err === 'user_not_found' ? 404
          : err === 'banned' ? 403
          : 502;
        const msg =
          err === 'insufficient_balance' ? '쿠키 잔액이 부족합니다. QRChat 앱에서 잔액을 확인해주세요.'
          : err === 'wallet_mismatch' || err === 'nickname_mismatch' ? '본인확인 정보가 일치하지 않아 결제할 수 없습니다.'
          : err === 'banned' ? '이용이 제한된 계정입니다.'
          : err === 'user_not_found' ? 'QRChat 사용자 정보를 찾을 수 없습니다.'
          : '병행결제 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
        return NextResponse.json(
          { success: false, error: msg, code: 'QRCHAT_QKEY_SPEND_FAILED', detail: err },
          { status }
        );
      }

      // 성공: 로컬 BalanceLedger 에 쿠키 결제 기록 (표시용, 로컬 잔액은 건드리지 않음)
      try {
        await d1
          .prepare(
            `INSERT INTO "BalanceLedger"
               ("id","userId","currency","amount","balanceAfter","reason","relatedOrderId","relatedRequestId","createdAt")
             VALUES (?, ?, 'QKEY', ?, ?, '주문 결제(QRChat QKEY)', ?, NULL, CURRENT_TIMESTAMP)`
          )
          .bind(
            newId(),
            userId,
            -splitUsedQkey,
            Number((spend as any).newBalance) || 0,
            order.id
          )
          .run();
      } catch (ledgerErr) {
        console.warn('[SPLIT QRChat QKEY 원장 기록 실패(무시)]', ledgerErr);
      }
    }

    // 주문 확인 알림 전송
    sendOrderNotifications(order, userId || undefined, guestEmail || '', guestPhone || shippingPhone || '').catch(err => {
      console.error('Notification send error:', err);
    });

    return NextResponse.json({
      success: true,
      data: order,
      guestOrderToken,
      message: '주문이 완료되었습니다'
    });
  } catch (error: any) {
    console.error('Create order error:', error);
    // [v1.0.22] 동시 주문으로 트랜잭션 내부 잔액 부족 → 402 로 변환
    if (error?.message === 'INSUFFICIENT_BALANCE_TX') {
      return NextResponse.json(
        {
          success: false,
          error: '잔액이 부족합니다. 잔액을 다시 확인해주세요.',
          code: 'INSUFFICIENT_BALANCE',
        },
        { status: 402 }
      );
    }
    return NextResponse.json(
      { success: false, error: error.message || '주문 처리 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// 주문 아이템의 상품 정보를 스냅샷 우선으로 정규화 (상품 삭제/변경돼도 상품명 유지)
function normalizeOrderItems(order: any): void {
  if (!order) return;
  if (!Array.isArray(order.items)) order.items = [];
  for (const item of order.items) {
    const snapName = item.productName || '';
    const snapThumb = item.productThumbnail || '';
    if (!item.product) {
      item.product = {
        id: item.productId || '',
        name: snapName || '주문 상품',
        slug: '',
        thumbnail: snapThumb || '',
        category: { name: '' },
      };
    } else {
      item.product.name = item.product.name || snapName || '주문 상품';
      item.product.slug = item.product.slug || '';
      item.product.thumbnail = item.product.thumbnail || snapThumb || '';
      if (!item.product.category) item.product.category = { name: '' };
    }
  }
}

// 주문 내역 조회 (GET) - 회원용 + 비회원 토큰 조회
export async function GET(req: NextRequest) {
  const prisma = await getPrisma();
  try {
    const { searchParams } = new URL(req.url);
    
    // 비회원 주문 조회 (토큰 + 주문번호)
    const guestToken = searchParams.get('guestToken');
    const orderNumber = searchParams.get('orderNumber');
    
    if (guestToken && orderNumber) {
      const order = await prisma.order.findFirst({
        where: {
          orderNumber,
          guestOrderToken: guestToken,
        },
        include: {
          items: {
            include: {
              product: {
                include: { category: true }
              }
            }
          }
        }
      });

      if (!order) {
        return NextResponse.json(
          { success: false, error: '주문을 찾을 수 없습니다' },
          { status: 404 }
        );
      }

      normalizeOrderItems(order);
      return NextResponse.json({
        success: true,
        data: [order]
      });
    }

    // 비회원 주문 조회 (이메일/전화번호 + 주문번호)
    const guestEmail = searchParams.get('guestEmail');
    const guestPhone = searchParams.get('guestPhone');
    
    if ((guestEmail || guestPhone) && orderNumber) {
      const where: any = { orderNumber };
      if (guestEmail) where.guestEmail = guestEmail;
      if (guestPhone) where.guestPhone = guestPhone;

      const order = await prisma.order.findFirst({
        where,
        include: {
          items: {
            include: {
              product: {
                include: { category: true }
              }
            }
          }
        }
      });

      if (!order) {
        return NextResponse.json(
          { success: false, error: '주문을 찾을 수 없습니다. 주문번호와 연락처를 확인해주세요.' },
          { status: 404 }
        );
      }

      normalizeOrderItems(order);
      return NextResponse.json({
        success: true,
        data: [order]
      });
    }

    // 회원 주문 조회
    const authResult = await verifyAuthToken(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { userId } = authResult;

    // [상품 스냅샷] 컬럼 보장 + 기존 주문 백필 (멱등, 프로세스당 1회)
    try { await backfillOrderItemSnapshots(await getD1()); } catch { /* 실패해도 조회는 진행 */ }

    // 페이지네이션 파라미터
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { userId },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          subtotal: true,
          shippingFee: true,
          discount: true,
          shippingName: true,
          shippingPhone: true,
          shippingAddress: true,
          shippingZipCode: true,
          shippingMemo: true,
          paymentMethod: true,
          paidAt: true,
          createdAt: true,
          updatedAt: true,
          partner: {
            select: {
              id: true,
              storeName: true,
              storeSlug: true,
            }
          },
          coupon: {
            select: {
              id: true,
              code: true,
              name: true,
              type: true,
              value: true,
            }
          },
          items: {
            select: {
              id: true,
              productId: true,
              quantity: true,
              price: true,
              productName: true,
              productThumbnail: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  thumbnail: true,
                  category: {
                    select: { name: true }
                  }
                }
              }
            }
          },
          review: {
            select: {
              id: true,
              rating: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip: offset,
        take: limit
      }),
      prisma.order.count({ where: { userId } })
    ]);

    // ★ [v1.0.21 HOTFIX] D1 select 모드 nested relation null-safety 정규화
    // /my-orders 페이지 진입 시 item.product null → TypeError → 전역 error boundary 발동 방지
    for (const order of orders as any[]) {
      if (!Array.isArray(order.items)) {
        order.items = [];
      }
      for (const item of order.items) {
        // ★ 주문 시점 스냅샷 우선 사용 (상품 삭제/변경돼도 실제 상품명 표시)
        const snapName = item.productName || '';
        const snapThumb = item.productThumbnail || '';
        if (!item.product) {
          item.product = {
            id: item.productId || '',
            name: snapName || '주문 상품',
            slug: '',
            thumbnail: snapThumb || '',
            category: { name: '' }
          };
        } else {
          // 현재 상품이 존재해도, 이름이 비면 스냅샷으로 보강
          item.product.name = item.product.name || snapName || '주문 상품';
          item.product.slug = item.product.slug || '';
          item.product.thumbnail = item.product.thumbnail || snapThumb || '';
          if (!item.product.category) {
            item.product.category = { name: '' };
          }
        }
      }
      // 숫자 필드 null 방어
      order.total = order.total ?? 0;
      order.subtotal = order.subtotal ?? 0;
      order.shippingFee = order.shippingFee ?? 0;
      order.discount = order.discount ?? 0;
      // 문자열 필드 null 방어 (frontend가 .toLocaleString / .toUpperCase 등 호출)
      order.status = order.status || 'PENDING';
      order.orderNumber = order.orderNumber || '';
      order.createdAt = order.createdAt || new Date().toISOString();
    }

    // [주문목록 최신순 보장] DB orderBy 가 wrapper/타임스탬프 이슈로 흔들려도
    //   항상 createdAt 내림차순(최신 먼저)으로 재정렬한다.
    (orders as any[]).sort(
      (a, b) =>
        new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime()
    );

    return NextResponse.json({
      success: true,
      data: orders,
      orders, // 일부 클라이언트 코드가 data.orders 로 접근 — 호환 키 추가
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('Get orders error:', error);
    return NextResponse.json(
      { success: false, error: error.message || '주문 내역 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
