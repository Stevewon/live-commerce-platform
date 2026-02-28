'use client';
import { useAuth } from '@/lib/contexts/AuthContext'

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Partner {
  id: string;
  storeName: string;
  storeSlug: string;
  description: string | null;
  youtubeUrl: string | null;
  africaTvUrl: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  naverShoppingUrl: string | null;
  coupangUrl: string | null;
  user: { name: string; email: string };
}

interface PartnerProduct {
  id: string;
  customPrice: number | null;
  partner: Partner;
}

interface Review {
  id: string;
  rating: number;
  content: string;
  images: string | null;
  likes: number;
  reply: string | null;
  createdAt: string;
  user: { name: string };
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  detailContent: string | null;
  price: number;
  comparePrice: number | null;
  stock: number;
  thumbnail: string;
  images: string;
  detailImages: string | null;
  specifications: string | null;
  shippingInfo: string | null;
  returnInfo: string | null;
  category: { id: string; name: string; slug: string };
  isActive: boolean;
  isFeatured: boolean;
  partnerProducts: PartnerProduct[];
  reviews: Review[];
}

const CATEGORY_ICONS: Record<string, string> = {
  electronics: '📱',
  beauty: '💄',
  food: '🍯',
  fashion: '👕',
  all: '🏷️',
};

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const user = null, authLoading = false // Temp;
  const slug = params.slug as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<PartnerProduct | null>(null);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'detail' | 'specs' | 'sellers' | 'review' | 'qna'>('detail');

  useEffect(() => {
    if (slug) fetchProduct();
  }, [slug]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/products?slug=${slug}`);
      if (!res.ok) throw new Error('상품을 찾을 수 없습니다.');
      const data = await res.json();
      if (!data.data || data.data.length === 0) throw new Error('상품을 찾을 수 없습니다.');
      const productData = data.data[0];
      setProduct(productData);
      setSelectedImage(productData.thumbnail);
      if (productData.partnerProducts && productData.partnerProducts.length > 0) {
        setSelectedPartner(productData.partnerProducts[0]);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message);
      console.error('상품 조회 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async () => {
    if (!user) {
      alert('로그인이 필요합니다.');
      router.push('/login');
      return;
    }
    if (!product) return;
    try {
      setAdding(true);
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ productId: product.id, quantity }),
      });
      if (res.ok) {
        alert('장바구니에 추가되었습니다!');
        router.push('/products?view=cart');
      } else {
        const data = await res.json();
        alert(data.error || '장바구니 추가 실패');
      }
    } catch (err) {
      console.error('장바구니 추가 실패:', err);
      alert('장바구니 추가에 실패했습니다.');
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">상품을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <span className="text-8xl mb-6 block">😢</span>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">{error || '상품을 찾을 수 없습니다'}</h1>
          <Link href="/products" className="inline-block px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium transition">
            ← 쇼핑 계속하기
          </Link>
        </div>
      </div>
    );
  }

  const discountPercent = product.comparePrice && product.comparePrice > product.price
    ? Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)
    : 0;
  const currentPrice = selectedPartner?.customPrice || product.price;
  const lowestPrice = product.partnerProducts.length > 0
    ? Math.min(...product.partnerProducts.map((pp) => pp.customPrice || product.price))
    : product.price;
  const images = product.images ? JSON.parse(product.images) : [product.thumbnail];
  const detailImages = product.detailImages ? JSON.parse(product.detailImages) : [];
  const specs = product.specifications ? JSON.parse(product.specifications) : {};
  const avgRating = product.reviews && product.reviews.length > 0
    ? (product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length).toFixed(1)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/products" className="inline-flex items-center text-gray-600 hover:text-gray-900 font-medium">
              <span className="mr-2">←</span> 뒤로가기
            </Link>
            
            {/* 사용자 정보 */}
            <div className="flex items-center gap-4">
              {user ? (
                <>
                  <span className="text-sm text-gray-600">
                    안녕하세요, <span className="font-bold text-gray-900">{user.name}</span>님
                  </span>
                  <Link
                    href="/products?view=cart"
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium transition text-sm"
                  >
                    🛒 장바구니
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="text-sm text-gray-600 hover:text-gray-900 font-medium"
                  >
                    로그인
                  </Link>
                  <Link
                    href="/register"
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium transition text-sm"
                  >
                    회원가입
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* 상품 메인 정보 */}
        <div className="bg-white rounded-lg shadow-sm mb-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-6 lg:p-8">
            {/* 이미지 갤러리 */}
            <div>
              <div className="relative aspect-square mb-4 bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
                <img
                  src={selectedImage}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement!.innerHTML = `
                      <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
                        <div class="text-center">
                          <span class="text-9xl block opacity-30">${CATEGORY_ICONS[product.category.slug] || '📦'}</span>
                          <p class="text-sm text-gray-400 font-medium mt-4">${product.name}</p>
                        </div>
                      </div>
                    `;
                  }}
                />
                {product.isFeatured && (
                  <div className="absolute top-4 left-4 bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg">
                    🔥 BEST
                  </div>
                )}
                {discountPercent > 0 && (
                  <div className="absolute top-4 right-4 bg-yellow-400 text-gray-900 px-4 py-2 rounded-lg text-sm font-bold shadow-lg">
                    {discountPercent}% 할인
                  </div>
                )}
                {product.stock === 0 && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-white font-bold text-3xl bg-gray-900/80 px-8 py-4 rounded-lg">품절</span>
                  </div>
                )}
              </div>
              {images.length > 1 && (
                <div className="grid grid-cols-5 gap-2">
                  {images.map((img: string, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImage(img)}
                      className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                        selectedImage === img ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <img src={img} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 구매 정보 */}
            <div className="flex flex-col">
              <Link href="/products" className="inline-block text-sm text-blue-600 hover:text-blue-700 mb-2 font-medium">
                {product.category.name}
              </Link>
              <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4 leading-tight">{product.name}</h1>
              
              {/* 평점 */}
              {product.reviews.length > 0 && (
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex items-center">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span key={star} className={`text-xl ${star <= Number(avgRating) ? 'text-yellow-400' : 'text-gray-300'}`}>
                        ⭐
                      </span>
                    ))}
                  </div>
                  <span className="text-lg font-semibold text-gray-900">{avgRating}</span>
                  <span className="text-sm text-gray-500">({product.reviews.length}개 리뷰)</span>
                </div>
              )}

              {/* 가격 */}
              <div className="mb-6 pb-6 border-b">
                {product.comparePrice && product.comparePrice > product.price && (
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-lg text-gray-400 line-through">₩{product.comparePrice.toLocaleString()}</span>
                    <span className="text-xl font-bold text-red-500 bg-red-50 px-3 py-1 rounded-full">{discountPercent}% 할인</span>
                  </div>
                )}
                <div className="flex items-baseline gap-3 mb-3">
                  <span className="text-5xl font-bold text-gray-900">₩{currentPrice.toLocaleString()}</span>
                </div>
                {product.partnerProducts.length > 0 && currentPrice > lowestPrice && (
                  <div className="text-sm text-orange-600 font-semibold bg-orange-50 inline-block px-3 py-1 rounded-full">
                    💰 최저가 ₩{lowestPrice.toLocaleString()}
                  </div>
                )}
              </div>

              {/* 배송/재고 정보 */}
              <div className="mb-6 space-y-3">
                <div className="flex items-center justify-between py-3 border-b">
                  <span className="text-gray-600">배송비</span>
                  <span className="font-semibold text-gray-900">
                    {currentPrice >= 50000 ? <span className="text-blue-600">무료배송 🚚</span> : <span>₩3,000 <span className="text-xs text-gray-500">(50,000원 이상 무료)</span></span>}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3 border-b">
                  <span className="text-gray-600">재고</span>
                  <span className={`font-semibold ${product.stock > 10 ? 'text-green-600' : product.stock > 0 ? 'text-orange-600' : 'text-red-600'}`}>
                    {product.stock > 0 ? `${product.stock}개 남음` : '품절'}
                  </span>
                </div>
                {selectedPartner && (
                  <div className="flex items-center justify-between py-3 border-b">
                    <span className="text-gray-600">판매자</span>
                    <span className="font-semibold text-blue-600">{selectedPartner.partner.storeName}</span>
                  </div>
                )}
              </div>

              {/* 수량 선택 */}
              {product.stock > 0 && (
                <div className="mb-6">
                  <label className="block text-sm font-bold text-gray-700 mb-3">수량 선택</label>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                      className="w-12 h-12 flex items-center justify-center border-2 border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition text-xl font-bold"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={product.stock}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Math.min(product.stock, parseInt(e.target.value) || 1)))}
                      className="w-24 text-center border-2 border-gray-300 rounded-lg px-4 py-3 text-lg font-bold focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                      disabled={quantity >= product.stock}
                      className="w-12 h-12 flex items-center justify-center border-2 border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition text-xl font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              {/* 구매 버튼 */}
              <div className="mt-auto space-y-3">
                <button
                  onClick={addToCart}
                  disabled={product.stock === 0 || adding}
                  className={`w-full py-4 px-6 rounded-lg font-bold text-lg transition-all ${
                    product.stock === 0 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : adding ? 'bg-blue-400 text-white cursor-wait' : 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 active:scale-95 shadow-lg'
                  }`}
                >
                  {adding ? '⏳ 추가 중...' : product.stock === 0 ? '❌ 품절' : '🛒 장바구니에 담기'}
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <button className="py-3 px-4 border-2 border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition">❤️ 찜하기</button>
                  <button className="py-3 px-4 border-2 border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition">🔔 알림받기</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 탭 네비게이션 */}
        <div className="bg-white rounded-t-lg shadow-sm border-b sticky top-[57px] z-40">
          <div className="max-w-4xl mx-auto">
            <div className="flex overflow-x-auto">
              <button onClick={() => setActiveTab('detail')} className={`flex-shrink-0 px-6 py-4 font-bold text-base transition-all ${activeTab === 'detail' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-600 hover:text-gray-900'}`}>
                📝 상세정보
              </button>
              <button onClick={() => setActiveTab('specs')} className={`flex-shrink-0 px-6 py-4 font-bold text-base transition-all ${activeTab === 'specs' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-600 hover:text-gray-900'}`}>
                📊 상품스펙
              </button>
              {product.partnerProducts.length > 0 && (
                <button onClick={() => setActiveTab('sellers')} className={`flex-shrink-0 px-6 py-4 font-bold text-base transition-all ${activeTab === 'sellers' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-600 hover:text-gray-900'}`}>
                  🏪 판매업체 ({product.partnerProducts.length})
                </button>
              )}
              <button onClick={() => setActiveTab('review')} className={`flex-shrink-0 px-6 py-4 font-bold text-base transition-all ${activeTab === 'review' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-600 hover:text-gray-900'}`}>
                ⭐ 리뷰 ({product.reviews && product.reviews.length})
              </button>
              <button onClick={() => setActiveTab('qna')} className={`flex-shrink-0 px-6 py-4 font-bold text-base transition-all ${activeTab === 'qna' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-600 hover:text-gray-900'}`}>
                ❓ Q&A
              </button>
            </div>
          </div>
        </div>

        {/* 탭 컨텐츠 */}
        <div className="bg-white rounded-b-lg shadow-sm p-6 lg:p-8 min-h-[600px]">
          {/* 상세정보 */}
          {activeTab === 'detail' && (
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 pb-4 border-b">📋 상품 상세 정보</h2>
              {product.detailContent ? (
                <div className="prose max-w-none mb-8" dangerouslySetInnerHTML={{ __html: product.detailContent }} />
              ) : (
                <div className="bg-gray-50 rounded-lg p-6 mb-8">
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-base">{product.description}</p>
                </div>
              )}
              {detailImages.length > 0 && (
                <div className="space-y-4 mb-8">
                  <h3 className="text-lg font-bold text-gray-900">상품 상세 이미지</h3>
                  {detailImages.map((img: string, idx: number) => (
                    <img key={idx} src={img} alt={`상세 ${idx + 1}`} className="w-full rounded-lg" />
                  ))}
                </div>
              )}
              {product.shippingInfo && (
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">🚚 배송 안내</h3>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{product.shippingInfo}</p>
                  </div>
                </div>
              )}
              {product.returnInfo && (
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">🔄 교환/반품 안내</h3>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{product.returnInfo}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 상품스펙 */}
          {activeTab === 'specs' && (
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 pb-4 border-b">📊 제품 사양</h2>
              {Object.keys(specs).length > 0 ? (
                <div className="border rounded-lg divide-y">
                  {Object.entries(specs).map(([key, value], idx) => (
                    <div key={key} className={`flex py-4 px-6 ${idx % 2 === 0 ? '' : 'bg-gray-50'}`}>
                      <span className="w-40 text-gray-600 font-medium">{key}</span>
                      <span className="flex-1 text-gray-900">{String(value)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <span className="text-8xl mb-6 block">📋</span>
                  <p className="text-gray-600">등록된 제품 사양이 없습니다.</p>
                </div>
              )}
            </div>
          )}

          {/* 판매업체 */}
          {activeTab === 'sellers' && (
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 pb-4 border-b">🏪 판매업체 ({product.partnerProducts.length}개)</h2>
              <div className="space-y-4">
                {product.partnerProducts.map((pp) => (
                  <div
                    key={pp.id}
                    onClick={() => setSelectedPartner(pp)}
                    className={`border-2 rounded-xl p-6 cursor-pointer transition-all hover:shadow-lg ${selectedPartner?.id === pp.id ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-gray-200 hover:border-blue-300'}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-xl font-bold text-gray-900">{pp.partner.storeName}</h3>
                          {selectedPartner?.id === pp.id && <span className="text-xs bg-blue-500 text-white px-3 py-1 rounded-full font-bold">선택됨 ✓</span>}
                          {pp.customPrice === lowestPrice && product.partnerProducts.length > 1 && <span className="text-xs bg-orange-500 text-white px-3 py-1 rounded-full font-bold">최저가!</span>}
                        </div>
                        {pp.partner.description && <p className="text-gray-600 mb-3">{pp.partner.description}</p>}
                        <div className="flex flex-wrap gap-2 mb-3">
                          {pp.partner.youtubeUrl && (
                            <a href={pp.partner.youtubeUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-full hover:bg-red-200 font-medium">
                              📺 YouTube
                            </a>
                          )}
                          {pp.partner.instagramUrl && (
                            <a href={pp.partner.instagramUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-xs bg-pink-100 text-pink-700 px-3 py-1.5 rounded-full hover:bg-pink-200 font-medium">
                              📷 Instagram
                            </a>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          판매자: <span className="font-medium text-gray-700">{pp.partner.user.name}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-blue-600 mb-2">₩{(pp.customPrice || product.price).toLocaleString()}</div>
                        {pp.customPrice && pp.customPrice < product.price && (
                          <div className="text-sm text-green-600 font-semibold bg-green-50 px-3 py-1 rounded-full inline-block">₩{(product.price - pp.customPrice).toLocaleString()} 할인</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 리뷰 */}
          {activeTab === 'review' && (
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 pb-4 border-b">⭐ 고객 리뷰 ({product.reviews.length})</h2>
              {product.reviews.length > 0 ? (
                <div className="space-y-6">
                  {product.reviews.map((review) => (
                    <div key={review.id} className="border rounded-lg p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-gray-900">{review.user.name}</span>
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span key={star} className={`text-lg ${star <= review.rating ? 'text-yellow-400' : 'text-gray-300'}`}>⭐</span>
                            ))}
                          </div>
                        </div>
                        <span className="text-sm text-gray-500">{new Date(review.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-gray-700 leading-relaxed mb-4">{review.content}</p>
                      {review.images && JSON.parse(review.images).length > 0 && (
                        <div className="grid grid-cols-4 gap-2 mb-4">
                          {JSON.parse(review.images).map((img: string, idx: number) => (
                            <img key={idx} src={img} alt={`리뷰 ${idx + 1}`} className="w-full aspect-square object-cover rounded-lg" />
                          ))}
                        </div>
                      )}
                      {review.reply && (
                        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mt-4">
                          <p className="text-sm font-semibold text-blue-900 mb-1">판매자 답변</p>
                          <p className="text-sm text-gray-700">{review.reply}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-4 mt-4 pt-4 border-t">
                        <button className="text-sm text-gray-600 hover:text-blue-600 flex items-center gap-1">
                          👍 도움이 돼요 ({review.likes})
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <span className="text-8xl mb-6 block">💬</span>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">첫 리뷰를 작성해주세요!</h3>
                  <p className="text-gray-600 mb-8">상품을 구매하신 후 리뷰를 남겨주세요.</p>
                  <button className="px-8 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition">리뷰 작성하기</button>
                </div>
              )}
            </div>
          )}

          {/* Q&A */}
          {activeTab === 'qna' && (
            <div className="max-w-4xl mx-auto text-center py-20">
              <span className="text-8xl mb-6 block">❓</span>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">궁금한 점이 있으신가요?</h3>
              <p className="text-gray-600 mb-8">상품에 대해 질문해주세요. 판매자가 답변해드립니다.</p>
              <button className="px-8 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition">질문하기</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
