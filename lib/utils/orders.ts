// 주문 내역 관리 유틸리티

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  productImage: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  items: OrderItem[];
  totalAmount: number;
  shippingFee: number;
  status: 'pending' | 'confirmed' | 'shipping' | 'delivered' | 'cancelled';
  paymentMethod: string;
  shippingAddress: {
    name: string;
    phone: string;
    address: string;
    zipCode: string;
  };
  orderedAt: string;
  deliveredAt?: string;
}

const ORDERS_KEY = 'live-commerce-orders';

// 주문 목록 가져오기
export const getOrders = (): Order[] => {
  if (typeof window === 'undefined') return [];
  
  try {
    const orders = localStorage.getItem(ORDERS_KEY);
    return orders ? JSON.parse(orders) : [];
  } catch (error) {
    console.error('Failed to get orders:', error);
    return [];
  }
};

// 주문 추가
export const addOrder = (order: Order): boolean => {
  if (typeof window === 'undefined') return false;
  
  try {
    const orders = getOrders();
    const newOrders = [order, ...orders]; // 최신 순으로 정렬
    localStorage.setItem(ORDERS_KEY, JSON.stringify(newOrders));
    
    // 커스텀 이벤트 발생
    window.dispatchEvent(new Event('ordersUpdated'));
    
    return true;
  } catch (error) {
    console.error('Failed to add order:', error);
    return false;
  }
};

// 주문 상태 업데이트
export const updateOrderStatus = (orderId: string, status: Order['status']): boolean => {
  if (typeof window === 'undefined') return false;
  
  try {
    const orders = getOrders();
    const updatedOrders = orders.map(order => 
      order.id === orderId ? { ...order, status } : order
    );
    localStorage.setItem(ORDERS_KEY, JSON.stringify(updatedOrders));
    
    window.dispatchEvent(new Event('ordersUpdated'));
    
    return true;
  } catch (error) {
    console.error('Failed to update order status:', error);
    return false;
  }
};

// 특정 주문 가져오기
export const getOrder = (orderId: string): Order | null => {
  const orders = getOrders();
  return orders.find(order => order.id === orderId) || null;
};

// 주문 개수
export const getOrdersCount = (): number => {
  return getOrders().length;
};

// 주문 번호 생성
export const generateOrderNumber = (): string => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  
  return `ORD${year}${month}${day}${random}`;
};

// 샘플 주문 데이터 생성 (테스트용)
export const createSampleOrders = (): void => {
  const sampleOrders: Order[] = [
    {
      id: '1',
      orderNumber: 'ORD260218001',
      items: [
        {
          id: '1',
          productId: '1',
          productName: '프리미엄 무선 이어폰',
          productSlug: 'premium-wireless-earbuds',
          productImage: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400',
          quantity: 1,
          price: 129000,
        },
      ],
      totalAmount: 129000,
      shippingFee: 0,
      status: 'delivered',
      paymentMethod: '카드결제',
      shippingAddress: {
        name: '홍길동',
        phone: '010-1234-5678',
        address: '서울시 강남구 테헤란로 123',
        zipCode: '06234',
      },
      orderedAt: '2026-02-15T10:30:00.000Z',
      deliveredAt: '2026-02-17T14:20:00.000Z',
    },
    {
      id: '2',
      orderNumber: 'ORD260216002',
      items: [
        {
          id: '2',
          productId: '7',
          productName: '프리미엄 플라워 원피스',
          productSlug: 'women-dress',
          productImage: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400',
          quantity: 2,
          price: 79000,
        },
      ],
      totalAmount: 158000,
      shippingFee: 0,
      status: 'shipping',
      paymentMethod: '카카오페이',
      shippingAddress: {
        name: '김민지',
        phone: '010-9876-5432',
        address: '서울시 송파구 올림픽로 135',
        zipCode: '05510',
      },
      orderedAt: '2026-02-16T15:45:00.000Z',
    },
    {
      id: '3',
      orderNumber: 'ORD260214003',
      items: [
        {
          id: '3',
          productId: '2',
          productName: '스마트 워치 프로',
          productSlug: 'smart-watch-pro',
          productImage: 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=400',
          quantity: 1,
          price: 289000,
        },
        {
          id: '4',
          productId: '3',
          productName: '블루투스 스피커',
          productSlug: 'bluetooth-speaker',
          productImage: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400',
          quantity: 1,
          price: 89000,
        },
      ],
      totalAmount: 378000,
      shippingFee: 0,
      status: 'confirmed',
      paymentMethod: '토스페이',
      shippingAddress: {
        name: '이지은',
        phone: '010-5555-6666',
        address: '부산시 해운대구 해운대로 567',
        zipCode: '48099',
      },
      orderedAt: '2026-02-14T09:20:00.000Z',
    },
  ];
  
  localStorage.setItem(ORDERS_KEY, JSON.stringify(sampleOrders));
  window.dispatchEvent(new Event('ordersUpdated'));
};
