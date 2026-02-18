// 찜하기 기능 유틸리티 함수

export interface WishlistItem {
  id: string;
  name: string;
  slug: string;
  price: number;
  comparePrice?: number;
  thumbnail: string;
  category: string;
  addedAt: string;
}

const WISHLIST_KEY = 'live-commerce-wishlist';

// 찜 목록 가져오기
export const getWishlist = (): WishlistItem[] => {
  if (typeof window === 'undefined') return [];
  
  try {
    const wishlist = localStorage.getItem(WISHLIST_KEY);
    return wishlist ? JSON.parse(wishlist) : [];
  } catch (error) {
    console.error('Failed to get wishlist:', error);
    return [];
  }
};

// 찜 목록에 추가
export const addToWishlist = (item: WishlistItem): boolean => {
  if (typeof window === 'undefined') return false;
  
  try {
    const wishlist = getWishlist();
    
    // 이미 찜한 상품인지 확인
    const exists = wishlist.some(w => w.id === item.id);
    if (exists) {
      return false;
    }
    
    const newWishlist = [...wishlist, { ...item, addedAt: new Date().toISOString() }];
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(newWishlist));
    
    // 커스텀 이벤트 발생 (다른 컴포넌트에서 감지)
    window.dispatchEvent(new Event('wishlistUpdated'));
    
    return true;
  } catch (error) {
    console.error('Failed to add to wishlist:', error);
    return false;
  }
};

// 찜 목록에서 제거
export const removeFromWishlist = (itemId: string): boolean => {
  if (typeof window === 'undefined') return false;
  
  try {
    const wishlist = getWishlist();
    const newWishlist = wishlist.filter(item => item.id !== itemId);
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(newWishlist));
    
    // 커스텀 이벤트 발생
    window.dispatchEvent(new Event('wishlistUpdated'));
    
    return true;
  } catch (error) {
    console.error('Failed to remove from wishlist:', error);
    return false;
  }
};

// 찜 목록 토글
export const toggleWishlist = (item: WishlistItem): boolean => {
  const wishlist = getWishlist();
  const exists = wishlist.some(w => w.id === item.id);
  
  if (exists) {
    return removeFromWishlist(item.id);
  } else {
    return addToWishlist(item);
  }
};

// 찜한 상품인지 확인
export const isInWishlist = (itemId: string): boolean => {
  const wishlist = getWishlist();
  return wishlist.some(item => item.id === itemId);
};

// 찜 목록 개수
export const getWishlistCount = (): number => {
  return getWishlist().length;
};

// 찜 목록 전체 삭제
export const clearWishlist = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  try {
    localStorage.removeItem(WISHLIST_KEY);
    window.dispatchEvent(new Event('wishlistUpdated'));
    return true;
  } catch (error) {
    console.error('Failed to clear wishlist:', error);
    return false;
  }
};
