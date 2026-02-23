'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/contexts/AuthContext';

// 상품 인터페이스
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

export default function ShopMainPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  
  const view = searchParams?.get('view') || 'products';
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

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
  const shippingFee = cartTotal > 0 ? 3000 : 0;
  const finalAmount = cartTotal + shippingFee;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 헤더 */}
      <div className="bg-white border-b sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl text-gray-900 hover:text-blue-600">
            <span className="text-2xl">🏪</span>
            <span>Live Commerce</span>
          </Link>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <span className="text-sm text-gray-700"><span className="font-semibold">{user.name}</span>님</span>
                <Link href="/" className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">홈으로</Link>
              </>
            ) : (
              <Link href="/login" className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">로그인</Link>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 flex gap-6">
        {/* 좌측 사이드바 */}
        <aside className="w-64 flex-shrink-0">
          <div className="bg-white rounded-lg shadow-sm p-4 sticky top-24">
            <h2 className="font-bold text-lg mb-4 text-gray-900">🛍️ 쇼핑몰</h2>
            
            {/* 카테고리 */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-500 mb-2">카테고리</h3>
              <nav className="space-y-1">
                <button
                  onClick={() => { router.push('/products?view=products'); setSelectedCategory('all'); }}
                  className={`w-full text-left px-3 py-2 rounded-lg transition ${
                    view === 'products' && selectedCategory === 'all'
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  🏷️ 전체상품
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => { router.push('/products?view=products'); setSelectedCategory(cat.slug); }}
                    className={`w-full text-left px-3 py-2 rounded-lg transition ${
                      view === 'products' && selectedCategory === cat.slug
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </nav>
            </div>

            {/* 마이쇼핑 */}
            {user && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-2">마이쇼핑</h3>
                <nav className="space-y-1">
                  <button
                    onClick={() => router.push('/products?view=cart')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition ${
                      view === 'cart' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    🛒 장바구니
                  </button>
                  <button
                    onClick={() => router.push('/products?view=orders')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition ${
                      view === 'orders' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    📦 주문내역
                  </button>
                </nav>
              </div>
            )}
          </div>
        </aside>

        {/* 메인 콘텐츠 */}
        <main className="flex-1">
          {/* 상품 목록 뷰 */}
          {view === 'products' && (
            <div>
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  {selectedCategory === 'all' ? '전체 상품' : categories.find(c => c.slug === selectedCategory)?.name || '상품'}
                </h1>
                <input
                  type="text"
                  placeholder="상품 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg">
                  <p className="text-gray-500">상품이 없습니다</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {products.map((product) => (
                    <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition">
                      <Link href={`/products/${product.slug}`}>
                        <div className="relative h-48 bg-gray-200">
                          {product.thumbnail ? (
                            <img src={product.thumbnail} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">이미지 없음</div>
                          )}
                          {product.isFeatured && (
                            <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-bold">BEST</div>
                          )}
                          {product.stock === 0 && (
                            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                              <span className="text-white font-bold">품절</span>
                            </div>
                          )}
                        </div>
                      </Link>
                      <div className="p-4">
                        <div className="text-xs text-gray-500 mb-1">{product.category.name}</div>
                        <Link href={`/products/${product.slug}`}>
                          <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 hover:text-blue-600">{product.name}</h3>
                        </Link>
                        <div className="mb-3">
                          {product.comparePrice && product.comparePrice > product.price && (
                            <div className="text-sm text-gray-400 line-through">₩{product.comparePrice.toLocaleString()}</div>
                          )}
                          <div className="flex items-baseline gap-2">
                            <span className="text-xl font-bold text-gray-900">₩{product.price.toLocaleString()}</span>
                            {product.comparePrice && product.comparePrice > product.price && (
                              <span className="text-sm font-semibold text-red-500">
                                {Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)}%
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 mb-3">
                          {product.stock > 0 ? `재고: ${product.stock}개` : '품절'}
                        </div>
                        <button
                          onClick={() => addToCart(product.id)}
                          disabled={product.stock === 0}
                          className={`w-full py-2 px-4 rounded-lg font-medium transition ${
                            product.stock === 0
                              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          {product.stock === 0 ? '품절' : '🛒 장바구니'}
                        </button>
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
              <h1 className="text-2xl font-bold text-gray-900 mb-6">🛒 장바구니</h1>
              {!user ? (
                <div className="bg-white rounded-lg p-12 text-center">
                  <p className="text-gray-600 mb-4">로그인이 필요합니다</p>
                  <Link href="/login" className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">로그인</Link>
                </div>
              ) : loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              ) : cartItems.length === 0 ? (
                <div className="bg-white rounded-lg p-12 text-center">
                  <div className="text-6xl mb-4">🛒</div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">장바구니가 비어있습니다</h2>
                  <p className="text-gray-600 mb-6">상품을 담아보세요!</p>
                  <button onClick={() => router.push('/products?view=products')} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">쇼핑 계속하기</button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <div className="bg-white rounded-lg shadow">
                      <div className="p-4 border-b flex justify-between items-center">
                        <h2 className="font-semibold">상품 목록 ({cartItems.length}개)</h2>
                        <button onClick={clearCart} className="text-sm text-red-600 hover:text-red-700">전체 삭제</button>
                      </div>
                      <div className="divide-y">
                        {cartItems.map((item) => (
                          <div key={item.id} className="p-4 hover:bg-gray-50">
                            <div className="flex gap-4">
                              <img src={item.product.thumbnail} alt={item.product.name} className="w-24 h-24 object-cover rounded-lg" />
                              <div className="flex-1">
                                <p className="text-xs text-gray-500 mb-1">{item.product.category.name}</p>
                                <h3 className="font-semibold text-gray-900 mb-2">{item.product.name}</h3>
                                <p className="text-lg font-bold text-gray-900 mb-3">₩{item.product.price.toLocaleString()}</p>
                                <div className="flex items-center gap-2">
                                  <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} disabled={updating === item.productId || item.quantity <= 1} className="w-8 h-8 border rounded hover:bg-gray-100 disabled:opacity-50">−</button>
                                  <span className="w-12 text-center font-medium">{item.quantity}</span>
                                  <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} disabled={updating === item.productId || item.quantity >= item.product.stock} className="w-8 h-8 border rounded hover:bg-gray-100 disabled:opacity-50">+</button>
                                  <button onClick={() => removeItem(item.productId)} disabled={updating === item.productId} className="ml-4 text-sm text-red-600 hover:text-red-700">삭제</button>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold text-gray-900">₩{(item.product.price * item.quantity).toLocaleString()}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="lg:col-span-1">
                    <div className="bg-white rounded-lg shadow p-6 sticky top-24">
                      <h2 className="text-lg font-bold text-gray-900 mb-4">주문 요약</h2>
                      <div className="space-y-3 mb-4">
                        <div className="flex justify-between text-gray-600">
                          <span>상품 금액</span>
                          <span>₩{cartTotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                          <span>배송비</span>
                          <span>₩{shippingFee.toLocaleString()}</span>
                        </div>
                        <div className="border-t pt-3 flex justify-between text-lg font-bold text-gray-900">
                          <span>총 결제 금액</span>
                          <span className="text-blue-600">₩{finalAmount.toLocaleString()}</span>
                        </div>
                      </div>
                      <Link href="/checkout" className="block w-full py-3 bg-blue-600 text-white text-center rounded-lg font-semibold hover:bg-blue-700 mb-2">주문하기</Link>
                      <button onClick={() => router.push('/products?view=products')} className="block w-full py-3 bg-gray-100 text-gray-700 text-center rounded-lg font-medium hover:bg-gray-200">쇼핑 계속하기</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 주문내역 뷰 */}
          {view === 'orders' && (
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-6">📦 주문내역</h1>
              {!user ? (
                <div className="bg-white rounded-lg p-12 text-center">
                  <p className="text-gray-600 mb-4">로그인이 필요합니다</p>
                  <Link href="/login" className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">로그인</Link>
                </div>
              ) : loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              ) : orders.length === 0 ? (
                <div className="bg-white rounded-lg p-12 text-center">
                  <div className="text-6xl mb-4">📦</div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">주문 내역이 없습니다</h2>
                  <p className="text-gray-600 mb-6">첫 주문을 시작해보세요!</p>
                  <button onClick={() => router.push('/products?view=products')} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">쇼핑하러 가기</button>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => {
                    const status = STATUS_MAP[order.status] || { label: order.status, color: 'bg-gray-100 text-gray-800' };
                    return (
                      <div key={order.id} className="bg-white rounded-lg shadow overflow-hidden">
                        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                          <div>
                            <p className="text-sm text-gray-500">주문번호: {order.orderNumber}</p>
                            <p className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleDateString('ko-KR')}</p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${status.color}`}>{status.label}</span>
                        </div>
                        <div className="p-4">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex gap-4 mb-3">
                              <img src={item.product.thumbnail} alt={item.product.name} className="w-20 h-20 object-cover rounded" />
                              <div className="flex-1">
                                <p className="font-semibold text-gray-900">{item.product.name}</p>
                                <p className="text-sm text-gray-600">₩{item.price.toLocaleString()} × {item.quantity}개</p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-gray-900">₩{(item.price * item.quantity).toLocaleString()}</p>
                              </div>
                            </div>
                          ))}
                          <div className="border-t pt-3 flex justify-between items-center">
                            <p className="text-lg font-bold text-gray-900">총 결제금액: ₩{order.total.toLocaleString()}</p>
                            <Link href={`/orders/${order.id}`} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">상세보기</Link>
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
