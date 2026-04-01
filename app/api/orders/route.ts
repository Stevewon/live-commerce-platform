import { NextRequest, NextResponse } from 'next/server'
import { verifyAuthToken } from '@/lib/auth/middleware'
import { getPrisma } from '@/lib/prisma';
import { orderConfirmationEmail } from '@/lib/email'
import { orderConfirmationSMS } from '@/lib/sms'
import { sendEmailWithPreferences, sendSMSWithPreferences } from '@/lib/notification'
// Cloudflare Workers compatible crypto

// 주문 알림 전송 함수
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
      email = guestEmail || null;
      phone = guestPhone || null;
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

    // 이메일 전송
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

      if (userId) {
        await sendEmailWithPreferences({
          userId,
          to: email,
          subject: `[QRLIVE] 주문이 접수되었습니다 (${order.orderNumber})`,
          html: emailHtml,
          notificationType: 'order'
        });
      }
    }

    // SMS 전송
    if (phone && userId) {
      const smsMessage = orderConfirmationSMS({
        customerName: name,
        orderNumber: order.orderNumber,
        total: order.total
      });
      await sendSMSWithPreferences({
        userId,
        to: phone,
        message: smsMessage,
        notificationType: 'order'
      });
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

    // 쿠폰 처리
    let discount = 0;
    let appliedShippingFee = shippingFee;
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

      // 재고 차감
      for (const item of validatedItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity
            }
          }
        });
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
