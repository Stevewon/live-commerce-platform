import { NextRequest, NextResponse } from 'next/server'
import { verifyAuthToken } from '@/lib/auth/middleware'
import { getPrisma } from '@/lib/prisma';
import { orderConfirmationEmail, sendEmail } from '@/lib/email'
import { orderConfirmationSMS, sendSMS } from '@/lib/sms'
import { sendEmailWithPreferences, sendSMSWithPreferences } from '@/lib/notification'
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
      paymentMethod = 'CARD',
      shippingFee = 3000,
      couponCode,
      // 비회원 전용 필드
      guestEmail,
      guestPhone,
    } = body;

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

    // 비회원 주문인 경우 이메일 또는 전화번호 필수
    if (!userId && !guestEmail && !guestPhone) {
      return NextResponse.json(
        { success: false, error: '비회원 주문 시 이메일 또는 전화번호가 필요합니다' },
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
        price: product.price
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

    // 서버사이드 배송비 계산 (클라이언트 값 대신 DB 설정 사용)
    const serverShippingFee = configFreeThreshold > 0 && subtotal >= configFreeThreshold ? 0 : configShippingFee;

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
        paymentMethod,
        status: 'PENDING',
        items: {
          create: validatedItems
        }
      };
      // Only add optional fields if they have actual values
      if (userId) orderData.userId = userId;
      if (guestEmail) orderData.guestEmail = guestEmail;
      if (guestPhone || shippingPhone) orderData.guestPhone = guestPhone || shippingPhone;
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
    return NextResponse.json(
      { success: false, error: error.message || '주문 처리 중 오류가 발생했습니다' },
      { status: 500 }
    );
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

    return NextResponse.json({
      success: true,
      data: orders,
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
