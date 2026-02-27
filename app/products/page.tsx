'use client';
import { useAuth } from '@/lib/contexts/AuthContext'

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  comparePrice: number | null;
  stock: number;
  thumbnail: string;
  category: { name: string; slug: string };
  isFeatured: boolean;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    stock: number;
    thumbnail: string;
    category: { name: string; slug: string };
  };
}

interface Order {
  id: string;
  orderNumber: string;
  total: number;
  status: string;
  createdAt: string;
  items: Array<{
    product: { name: string; thumbnail: string };
    quantity: number;
    price: number;
  }>;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING: { label: '결제 대기', color: 'bg-yellow-100 text-yellow-800' },
  CONFIRMED: { label: '결제 완료', color: 'bg-blue-100 text-blue-800' },
  SHIPPING: { label: '배송 중', color: 'bg-purple-100 text-purple-800' },
  DELIVERED: { label: '배송 완료', color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: '취소됨', color: 'bg-red-100 text-red-800' },
};

// 카테고리 아이콘 매핑
const CATEGORY_ICONS: Record<string, string> = {
  'electronics': '📱',
  'beauty': '💄',
  'food': '🍯',
  'fashion': '👕',
  'all': '🏷️'
};

export default function ShopMainPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = null, loading = false // Temp;
  
  const view = searchParams?.get('view') || 'products';
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (view === 'products') {
      fetchProducts();
    } else if (view === 'cart' && user) {
      fetchCart();
    } else if (view === 'orders' && user) {
      fetchOrders();
    }
  }, [view, selectedCategory, searchTerm, user]);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.data || []);
      }
    } catch (err) {
      console.error('카테고리 조회 실패:', err);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      let url = '/api/products?';
      if (selectedCategory !== 'all') url += `category=${selectedCategory}&`;
      if (searchTerm) url += `search=${encodeURIComponent(searchTerm)}`;
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.data || []);
      }
    } catch (err) {
      console.error('상품 조회 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCart = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/cart', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCartItems(data.data || []);
      }
    } catch (err) {
      console.error('장바구니 조회 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/orders', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.data || []);
      }
    } catch (err) {
      console.error('주문 조회 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async (productId: string) => {
    if (!user) {
      alert('로그인이 필요합니다.');
      router.push('/login');
      return;
    }
    try {
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ productId, quantity: 1 }),
      });
      if (res.ok) {
        alert('장바구니에 추가되었습니다!');
      }
    } catch (err) {
      console.error('장바구니 추가 실패:', err);
    }
  };

  const updateQuantity = async (productId: string, newQuantity: number) => {
    try {
      setUpdating(productId);
      const res = await fetch('/api/cart', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ productId, quantity: newQuantity }),
      });
      if (res.ok) await fetchCart();
    } finally {
      setUpdating(null);
    }
  };

  const removeItem = async (productId: string) => {
    if (!confirm('이 상품을 삭제하시겠습니까?')) return;
    try {
      setUpdating(productId);
      const res = await fetch(`/api/cart?productId=${productId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) await fetchCart();
    } finally {
      setUpdating(null);
    }
  };

  const clearCart = async () => {
    if (!confirm('장바구니를 전체 비우시겠습니까?')) return;
    try {
      const res = await fetch('/api/cart', { method: 'DELETE', credentials: 'include' });
      if (res.ok) setCartItems([]);
    } catch (err) {
      console.error('장바구니 비우기 실패:', err);
    }
  };

  const cartTotal = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const shippingFee = cartTotal >= 50000 ? 0 : 3000;
  const finalAmount = cartTotal + shippingFee;

  return (
    <div className="min-h-screen bg-white">
      {/* 상단 헤더 */}
      <header className="bg-white border-b sticky top-0 z-50 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="h-16 flex items-center justify-between gap-2">
            <Link href="/" className="flex items-center gap-2 flex-shrink-0">
              <span className="text-2xl">🏪</span>
              <span className="font-bold text-lg lg:text-xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent hidden sm:inline">Live Commerce</span>
            </Link>
            
            {/* 검색바 - 데스크톱 */}
            <div className="hidden md:flex flex-1 max-w-2xl mx-4">
              <div className="relative w-full">
                <input
                  type="text"
                  placeholder="상품을 검색해보세요"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-11 pl-4 pr-12 border-2 border-blue-500 rounded-lg focus:outline-none focus:border-blue-600"
                />
                <button className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center hover:bg-blue-600 transition">
                  <span className="text-white text-lg">🔍</span>
                </button>
              </div>
            </div>

            {/* 사용자 메뉴 */}
            <div className="flex items-center gap-2 lg:gap-4">
              {user ? (
                <>
                  <span className="hidden lg:inline text-sm font-medium text-gray-700">{user.name}님</span>
                  <Link href="/" className="hidden sm:inline text-sm text-gray-600 hover:text-gray-900">홈</Link>
                </>
              ) : (
                <>
                  <Link href="/login" className="text-xs sm:text-sm font-medium text-gray-700 hover:text-blue-600">로그인</Link>
                  <Link href="/register" className="hidden sm:inline text-sm font-medium text-gray-700 hover:text-blue-600">회원가입</Link>
                </>
              )}
            </div>
          </div>
          
          {/* 모바일 검색바 */}
          <div className="md:hidden pb-3">
            <div className="relative">
              <input
                type="text"
                placeholder="상품 검색"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-10 pl-4 pr-12 border-2 border-blue-500 rounded-lg focus:outline-none focus:border-blue-600"
              />
              <button className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center hover:bg-blue-600 transition">
                <span className="text-white">🔍</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto px-4 py-6 flex gap-6">
        {/* 좌측 카테고리 네비게이션 - 데스크톱만 표시 */}
        <aside className="hidden lg:block w-60 flex-shrink-0">
          <nav className="bg-white rounded-lg border p-4 sticky top-24">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              <span>📂</span>
              <span>카테고리</span>
            </h2>
            <ul className="space-y-1">
              <li>
                <button
                  onClick={() => { router.push('/products?view=products'); setSelectedCategory('all'); }}
                  className={`w-full text-left px-4 py-2.5 rounded-lg transition font-medium ${
                    view === 'products' && selectedCategory === 'all'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="mr-2">🏷️</span>전체상품
                </button>
              </li>
              {categories.map((cat) => (
                <li key={cat.id}>
                  <button
                    onClick={() => { router.push('/products?view=products'); setSelectedCategory(cat.slug); }}
                    className={`w-full text-left px-4 py-2.5 rounded-lg transition font-medium ${
                      view === 'products' && selectedCategory === cat.slug
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="mr-2">{CATEGORY_ICONS[cat.slug] || '📦'}</span>{cat.name}
                  </button>
                </li>
              ))}
            </ul>

            {user && (
              <>
                <div className="border-t my-4"></div>
                <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <span>👤</span>
                  <span>마이쇼핑</span>
                </h2>
                <ul className="space-y-1">
                  <li>
                    <button
                      onClick={() => { router.push('/products?view=cart'); setMobileMenuOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 rounded-lg transition font-medium ${
                        view === 'cart' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      🛒 장바구니
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => { router.push('/products?view=orders'); setMobileMenuOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 rounded-lg transition font-medium ${
                        view === 'orders' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      📦 주문내역
                    </button>
                  </li>
                </ul>
              </>
            )}
          </nav>
        </aside>

        {/* 모바일 메뉴 오버레이 */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileMenuOpen(false)}>
            <aside 
              className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-bold text-xl">메뉴</h2>
                  <button 
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100"
                  >
                    ✕
                  </button>
                </div>
                
                <nav>
                  <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                    <span>📂</span>
                    <span>카테고리</span>
                  </h3>
                  <ul className="space-y-1 mb-6">
                    <li>
                      <button
                        onClick={() => { router.push('/products?view=products'); setSelectedCategory('all'); setMobileMenuOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 rounded-lg transition font-medium ${
                          view === 'products' && selectedCategory === 'all'
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span className="mr-2">🏷️</span>전체상품
                      </button>
                    </li>
                    {categories.map((cat) => (
                      <li key={cat.id}>
                        <button
                          onClick={() => { router.push('/products?view=products'); setSelectedCategory(cat.slug); setMobileMenuOpen(false); }}
                          className={`w-full text-left px-4 py-2.5 rounded-lg transition font-medium ${
                            view === 'products' && selectedCategory === cat.slug
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <span className="mr-2">{CATEGORY_ICONS[cat.slug] || '📦'}</span>{cat.name}
                        </button>
                      </li>
                    ))}
                  </ul>

                  {user && (
                    <>
                      <div className="border-t my-4"></div>
                      <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                        <span>👤</span>
                        <span>마이쇼핑</span>
                      </h3>
                      <ul className="space-y-1">
                        <li>
                          <button
                            onClick={() => { router.push('/products?view=cart'); setMobileMenuOpen(false); }}
                            className={`w-full text-left px-4 py-2.5 rounded-lg transition font-medium ${
                              view === 'cart' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            🛒 장바구니
                          </button>
                        </li>
                        <li>
                          <button
                            onClick={() => { router.push('/products?view=orders'); setMobileMenuOpen(false); }}
                            className={`w-full text-left px-4 py-2.5 rounded-lg transition font-medium ${
                              view === 'orders' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            📦 주문내역
                          </button>
                        </li>
                      </ul>
                    </>
                  )}
                </nav>
              </div>
            </aside>
          </div>
        )}

        {/* 메인 콘텐츠 */}
        <main className="flex-1 min-w-0">
          {/* 모바일 햄버거 메뉴 + 탭 네비게이션 */}
          <div className="lg:hidden mb-4">
            <div className="bg-white rounded-lg border p-3 flex items-center gap-3">
              <button 
                onClick={() => setMobileMenuOpen(true)}
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
              >
                <span className="text-xl">☰</span>
              </button>
              <div className="flex-1 flex gap-2 overflow-x-auto">
                <button
                  onClick={() => router.push('/products?view=products')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                    view === 'products' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  🛍️ 상품
                </button>
                {user && (
                  <>
                    <button
                      onClick={() => router.push('/products?view=cart')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                        view === 'cart' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      🛒 장바구니
                    </button>
                    <button
                      onClick={() => router.push('/products?view=orders')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                        view === 'orders' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      📦 주문
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
          {/* 상품 목록 뷰 */}
          {view === 'products' && (
            <div>
              {/* 배너 섹션 */}
              <div className="mb-6 rounded-2xl overflow-hidden shadow-lg">
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 md:p-12 text-white">
                  <h1 className="text-xl md:text-3xl font-bold mb-2">🎉 특가 세일 진행중!</h1>
                  <p className="text-sm md:text-lg opacity-90">최대 50% 할인 + 무료배송</p>
                  <div className="mt-3 md:mt-4 inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 md:px-4 py-1.5 md:py-2 rounded-full">
                    <span className="text-xs md:text-sm font-semibold">⚡ 로켓배송</span>
                    <span className="text-xs md:text-sm">|</span>
                    <span className="text-xs md:text-sm">오늘 주문 시 내일 도착</span>
                  </div>
                </div>
              </div>

              {/* 무료배송 안내 */}
              <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-3 md:p-4">
                <div className="flex items-center gap-3">
                  <span className="text-xl md:text-2xl">🚚</span>
                  <div>
                    <p className="font-bold text-blue-900 text-sm md:text-base">50,000원 이상 구매 시 무료배송</p>
                    <p className="text-xs md:text-sm text-blue-700">지금 바로 혜택을 받아보세요!</p>
                  </div>
                </div>
              </div>

              {/* 카테고리 타이틀 */}
              <div className="mb-6">
                <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                  {selectedCategory === 'all' ? '전체 상품' : categories.find(c => c.slug === selectedCategory)?.name || '상품'}
                </h2>
                <p className="text-xs md:text-sm text-gray-600 mt-1">총 {products.length}개의 상품</p>
              </div>
              
              {loading ? (
                <div className="flex items-center justify-center h-96">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                    <p className="text-gray-600">상품을 불러오는 중...</p>
                  </div>
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-20 bg-gradient-to-br from-gray-50 to-blue-50 rounded-2xl border-2 border-dashed border-gray-300">
                  <span className="text-8xl mb-4 block">🔍</span>
                  <p className="text-2xl font-bold text-gray-700 mb-2">상품이 없습니다</p>
                  <p className="text-gray-500">다른 카테고리를 확인해보세요</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {products.map((product) => (
                    <div key={product.id} className="group bg-white border rounded-lg overflow-hidden hover:shadow-2xl hover:border-blue-300 transition-all duration-300 flex flex-col">
                      <Link href={`/products/${product.slug}`} className="block">
                        <div className="relative aspect-square bg-gradient-to-br from-blue-50 to-purple-50 overflow-hidden cursor-pointer group-hover:scale-105 transition-transform duration-300">
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="text-center">
                              <span className="text-7xl mb-2 block opacity-30 group-hover:opacity-50 transition-opacity">
                                {CATEGORY_ICONS[product.category.slug] || '📦'}
                              </span>
                              <p className="text-xs text-gray-400 font-medium px-4">{product.name}</p>
                            </div>
                          </div>
                          {/* Hover 시 "상세보기" 오버레이 */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                            <div className="bg-white px-6 py-3 rounded-full shadow-lg transform scale-75 group-hover:scale-100 transition-transform">
                              <span className="text-sm font-bold text-gray-900">👁️ 상세보기</span>
                            </div>
                          </div>
                          {product.isFeatured && (
                            <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded-md text-xs font-bold shadow-lg">
                              🔥 인기
                            </div>
                          )}
                          {product.stock === 0 && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                              <span className="text-white font-bold text-lg bg-gray-900/80 px-4 py-2 rounded-lg">품절</span>
                            </div>
                          )}
                          {product.comparePrice && product.comparePrice > product.price && (
                            <div className="absolute top-2 right-2 bg-yellow-400 text-gray-900 px-2 py-1 rounded-md text-xs font-bold shadow-lg">
                              {Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)}% 할인
                            </div>
                          )}
                        </div>
                      </Link>
                      <div className="p-4 flex flex-col flex-1">
                        <div className="text-xs text-gray-500 mb-2">{product.category.name}</div>
                        <Link href={`/products/${product.slug}`} className="block mb-3">
                          <h3 className="font-medium text-gray-900 line-clamp-2 group-hover:text-blue-600 group-hover:underline transition h-10 cursor-pointer">
                            {product.name}
                          </h3>
                        </Link>
                        <div className="mb-3">
                          {product.comparePrice && product.comparePrice > product.price && (
                            <div className="text-sm text-gray-400 line-through mb-1">
                              ₩{product.comparePrice.toLocaleString()}
                            </div>
                          )}
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-gray-900">
                              ₩{product.price.toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="h-6 mb-2">
                          {product.price >= 50000 && (
                            <div className="text-xs text-blue-600 font-semibold flex items-center gap-1">
                              <span>🚚</span>
                              <span>무료배송</span>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 mt-auto">
                          <Link 
                            href={`/products/${product.slug}`}
                            className="flex-1 py-2.5 rounded-lg font-bold transition-all bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600 active:scale-95 text-center text-sm"
                          >
                            👁️ 상세보기
                          </Link>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              addToCart(product.id);
                            }}
                            disabled={product.stock === 0}
                            className={`flex-1 py-2.5 rounded-lg font-bold transition-all text-sm ${
                              product.stock === 0
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-blue-500 text-white hover:bg-blue-600 active:scale-95'
                            }`}
                          >
                            {product.stock === 0 ? '품절' : '🛒 담기'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 장바구니 뷰 */}
          {view === 'cart' && (
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-6">🛒 장바구니</h1>
              {!user ? (
                <div className="bg-gradient-to-br from-orange-50 to-red-50 border-2 border-dashed border-orange-300 rounded-2xl p-20 text-center">
                  <span className="text-8xl mb-6 block">🔐</span>
                  <h2 className="text-3xl font-bold text-gray-900 mb-3">로그인이 필요합니다</h2>
                  <p className="text-gray-600 mb-10 text-lg">장바구니 기능을 사용하려면 로그인해주세요</p>
                  <Link href="/login" className="inline-block px-10 py-4 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl hover:from-orange-600 hover:to-red-700 font-bold text-lg shadow-lg hover:shadow-xl transition-all">
                    🔓 로그인하기
                  </Link>
                </div>
              ) : loading ? (
                <div className="flex items-center justify-center h-96">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent"></div>
                </div>
              ) : cartItems.length === 0 ? (
                <div className="bg-white border rounded-lg p-16 text-center">
                  <span className="text-6xl mb-4 block">🛒</span>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">장바구니가 비어있습니다</h2>
                  <p className="text-gray-600 mb-8">마음에 드는 상품을 담아보세요!</p>
                  <button 
                    onClick={() => router.push('/products?view=products')} 
                    className="px-8 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-bold"
                  >
                    쇼핑 계속하기
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <div className="bg-white border rounded-lg overflow-hidden">
                      <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                        <div>
                          <h2 className="font-bold text-lg">전체 {cartItems.length}개</h2>
                          <p className="text-sm text-gray-600">일반배송 상품</p>
                        </div>
                        <button onClick={clearCart} className="text-sm text-red-600 hover:text-red-700 font-medium">전체삭제</button>
                      </div>
                      <div className="divide-y">
                        {cartItems.map((item) => (
                          <div key={item.id} className="p-4 hover:bg-gray-50 transition">
                            <div className="flex gap-4">
                              <img 
                                src={item.product.thumbnail} 
                                alt={item.product.name} 
                                className="w-28 h-28 object-cover rounded-lg border"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-gray-500 mb-1">{item.product.category.name}</p>
                                <h3 className="font-medium text-gray-900 mb-2 line-clamp-2">{item.product.name}</h3>
                                <p className="text-xl font-bold text-gray-900 mb-3">₩{item.product.price.toLocaleString()}</p>
                                <div className="flex items-center gap-2">
                                  <button 
                                    onClick={() => updateQuantity(item.productId, item.quantity - 1)} 
                                    disabled={updating === item.productId || item.quantity <= 1} 
                                    className="w-8 h-8 border rounded hover:bg-gray-100 disabled:opacity-50 flex items-center justify-center font-bold"
                                  >
                                    −
                                  </button>
                                  <span className="w-14 text-center font-bold text-lg">{item.quantity}</span>
                                  <button 
                                    onClick={() => updateQuantity(item.productId, item.quantity + 1)} 
                                    disabled={updating === item.productId || item.quantity >= item.product.stock} 
                                    className="w-8 h-8 border rounded hover:bg-gray-100 disabled:opacity-50 flex items-center justify-center font-bold"
                                  >
                                    +
                                  </button>
                                  <button 
                                    onClick={() => removeItem(item.productId)} 
                                    disabled={updating === item.productId} 
                                    className="ml-4 text-sm text-red-600 hover:text-red-700 font-medium"
                                  >
                                    삭제
                                  </button>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-xl font-bold text-blue-600">₩{(item.product.price * item.quantity).toLocaleString()}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="lg:col-span-1">
                    <div className="bg-white border rounded-lg p-6 sticky top-24">
                      <h2 className="text-xl font-bold text-gray-900 mb-6">결제 예상금액</h2>
                      <div className="space-y-3 mb-6 pb-6 border-b">
                        <div className="flex justify-between text-gray-700">
                          <span>주문금액</span>
                          <span className="font-bold">₩{cartTotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-gray-700">
                          <span>배송비</span>
                          <span className="font-bold">
                            {shippingFee === 0 ? (
                              <span className="text-blue-600">무료</span>
                            ) : (
                              `₩${shippingFee.toLocaleString()}`
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between text-xl font-bold text-gray-900 mb-6">
                        <span>총 결제금액</span>
                        <span className="text-blue-600">₩{finalAmount.toLocaleString()}</span>
                      </div>
                      <Link 
                        href="/checkout" 
                        className="block w-full py-4 bg-blue-500 text-white text-center rounded-lg font-bold text-lg hover:bg-blue-600 transition mb-3"
                      >
                        {cartItems.length}개 상품 주문하기
                      </Link>
                      <button 
                        onClick={() => router.push('/products?view=products')} 
                        className="block w-full py-3 bg-white border-2 border-gray-300 text-gray-700 text-center rounded-lg font-bold hover:bg-gray-50 transition"
                      >
                        쇼핑 계속하기
                      </button>
                      {cartTotal < 50000 && (
                        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                          <span className="font-bold">{(50000 - cartTotal).toLocaleString()}원</span> 더 담으면 <span className="font-bold">무료배송</span>!
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 주문내역 뷰 */}
          {view === 'orders' && (
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-6">📦 주문내역</h1>
              {!user ? (
                <div className="bg-gradient-to-br from-orange-50 to-red-50 border-2 border-dashed border-orange-300 rounded-2xl p-20 text-center">
                  <span className="text-8xl mb-6 block">🔐</span>
                  <h2 className="text-3xl font-bold text-gray-900 mb-3">로그인이 필요합니다</h2>
                  <p className="text-gray-600 mb-10 text-lg">장바구니 기능을 사용하려면 로그인해주세요</p>
                  <Link href="/login" className="inline-block px-10 py-4 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl hover:from-orange-600 hover:to-red-700 font-bold text-lg shadow-lg hover:shadow-xl transition-all">
                    🔓 로그인하기
                  </Link>
                </div>
              ) : loading ? (
                <div className="flex items-center justify-center h-96">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                    <p className="text-gray-600">주문 내역을 불러오는 중...</p>
                  </div>
                </div>
              ) : orders.length === 0 ? (
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-dashed border-blue-300 rounded-2xl p-20 text-center">
                  <span className="text-8xl mb-6 block">📦</span>
                  <h2 className="text-3xl font-bold text-gray-900 mb-3">주문 내역이 없습니다</h2>
                  <p className="text-gray-600 mb-10 text-lg">첫 주문을 시작해보세요!</p>
                  <button 
                    onClick={() => router.push('/products?view=products')} 
                    className="px-10 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 font-bold text-lg shadow-lg hover:shadow-xl transition-all"
                  >
                    🛍️ 쇼핑하러 가기
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => {
                    const status = STATUS_MAP[order.status] || { label: order.status, color: 'bg-gray-100 text-gray-800' };
                    return (
                      <div key={order.id} className="bg-white border rounded-lg overflow-hidden hover:shadow-lg transition">
                        <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <p className="font-bold text-gray-900">{order.orderNumber}</p>
                              <span className={`px-3 py-1 rounded-full text-sm font-bold ${status.color}`}>
                                {status.label}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">{new Date(order.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                          </div>
                          <Link 
                            href={`/orders/${order.id}`} 
                            className="px-5 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-bold text-sm transition"
                          >
                            상세보기
                          </Link>
                        </div>
                        <div className="p-4">
                          <div className="space-y-3">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="flex gap-4">
                                <img 
                                  src={item.product.thumbnail} 
                                  alt={item.product.name} 
                                  className="w-20 h-20 object-cover rounded-lg border" 
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-gray-900 mb-1 line-clamp-2">{item.product.name}</p>
                                  <p className="text-sm text-gray-600">₩{item.price.toLocaleString()} · {item.quantity}개</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-gray-900">₩{(item.price * item.quantity).toLocaleString()}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-4 pt-4 border-t flex justify-between items-center">
                            <p className="text-lg font-bold text-gray-900">총 결제금액</p>
                            <p className="text-2xl font-bold text-blue-600">₩{order.total.toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
