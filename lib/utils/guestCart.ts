// 비회원 장바구니 유틸리티 (localStorage 기반)
'use client';

export interface GuestCartItem {
  productId: string;
  variantId?: string | null;    // [옵션] 선택한 변형 ID — 같은 상품이라도 옵션이 다르면 별도 행
  optionLabel?: string | null;  // [옵션] 표시용 라벨 (예: "색상: 핑크 / 사이즈: M")
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

// 같은 행 판정: productId + variantId. variantId 를 생략(undefined)하면 해당 상품 전체에 적용(구버전 호환)
function sameRow(c: GuestCartItem, productId: string, variantId?: string | null): boolean {
  if (c.productId !== productId) return false;
  if (variantId === undefined) return true;
  return (c.variantId || null) === (variantId || null);
}

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
  const existingIdx = cart.findIndex(c => sameRow(c, item.productId, item.variantId || null));
  
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
export function updateGuestCartQuantity(productId: string, quantity: number, variantId?: string | null): GuestCartItem[] {
  let cart = getGuestCart();

  if (quantity <= 0) {
    cart = cart.filter(c => !sameRow(c, productId, variantId));
  } else {
    const idx = cart.findIndex(c => sameRow(c, productId, variantId));
    if (idx >= 0) {
      cart[idx].quantity = quantity;
    }
  }
  
  localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event('guestCartUpdated'));
  return cart;
}

// 비회원 장바구니에서 삭제
export function removeFromGuestCart(productId: string, variantId?: string | null): GuestCartItem[] {
  let cart = getGuestCart();
  cart = cart.filter(c => !sameRow(c, productId, variantId));
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
