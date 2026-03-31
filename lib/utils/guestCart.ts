// 비회원 장바구니 유틸리티 (localStorage 기반)
'use client';

export interface GuestCartItem {
  productId: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    comparePrice?: number | null;
    stock: number;
    thumbnail: string;
    category?: { name: string; slug: string };
  };
  addedAt: string;
}

const GUEST_CART_KEY = 'qrlive_guest_cart';

// 비회원 장바구니 가져오기
export function getGuestCart(): GuestCartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const cart = localStorage.getItem(GUEST_CART_KEY);
    return cart ? JSON.parse(cart) : [];
  } catch {
    return [];
  }
}

// 비회원 장바구니에 상품 추가
export function addToGuestCart(item: GuestCartItem): GuestCartItem[] {
  const cart = getGuestCart();
  const existingIdx = cart.findIndex(c => c.productId === item.productId);
  
  if (existingIdx >= 0) {
    cart[existingIdx].quantity += item.quantity;
  } else {
    cart.push({ ...item, addedAt: new Date().toISOString() });
  }
  
  localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event('guestCartUpdated'));
  return cart;
}

// 비회원 장바구니 수량 업데이트
export function updateGuestCartQuantity(productId: string, quantity: number): GuestCartItem[] {
  let cart = getGuestCart();
  
  if (quantity <= 0) {
    cart = cart.filter(c => c.productId !== productId);
  } else {
    const idx = cart.findIndex(c => c.productId === productId);
    if (idx >= 0) {
      cart[idx].quantity = quantity;
    }
  }
  
  localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event('guestCartUpdated'));
  return cart;
}

// 비회원 장바구니에서 삭제
export function removeFromGuestCart(productId: string): GuestCartItem[] {
  let cart = getGuestCart();
  cart = cart.filter(c => c.productId !== productId);
  localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event('guestCartUpdated'));
  return cart;
}

// 비회원 장바구니 비우기
export function clearGuestCart(): void {
  localStorage.removeItem(GUEST_CART_KEY);
  window.dispatchEvent(new Event('guestCartUpdated'));
}

// 비회원 장바구니 개수
export function getGuestCartCount(): number {
  return getGuestCart().reduce((sum, item) => sum + item.quantity, 0);
}

// 비회원 장바구니 합계
export function getGuestCartTotal(): number {
  return getGuestCart().reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
}
