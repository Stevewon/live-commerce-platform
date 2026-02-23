'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/contexts/AuthContext';

interface Partner {
  id: string;
  userId: string;
  storeName: string;
  storeSlug: string;
  description: string | null;
  logo: string | null;
  banner: string | null;
  commissionRate: number;
  youtubeUrl: string | null;
  africaTvUrl: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  naverShoppingUrl: string | null;
  coupangUrl: string | null;
  isActive: boolean;
  user: {
    name: string;
    email: string;
  };
}

interface PartnerProduct {
  id: string;
  partnerId: string;
  productId: string;
  customPrice: number | null;
  isActive: boolean;
  partner: Partner;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  comparePrice: number | null;
  stock: number;
  thumbnail: string;
  images: string;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  isActive: boolean;
  isFeatured: boolean;
  partnerProducts: PartnerProduct[];
}

// 카테고리 아이콘
const CATEGORY_ICONS: Record<string, string> = {
  'electronics': '📱',
  'beauty': '💄',
  'food': '🍯',
  'fashion': '👕',
  'all': '🏷️'
};

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const slug = params.slug as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<PartnerProduct | null>(null);

  useEffect(() => {
    if (slug) {
      fetchProduct();
    }
  }, [slug]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/products?slug=${slug}`);
      
      if (!res.ok) {
        throw new Error('상품을 찾을 수 없습니다.');
      }

      const data = await res.json();
      
      if (!data.data || data.data.length === 0) {
        throw new Error('상품을 찾을 수 없습니다.');
      }

      const productData = data.data[0];
      setProduct(productData);
      
      // 기본 선택: 가장 저렴한 파트너
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
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ 
          productId: product.id, 
          quantity 
        }),
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
          <p className="text-gray-600">상품을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <span className="text-8xl mb-6 block">😢</span>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
            {error || '상품을 찾을 수 없습니다'}
          </h1>
          <Link 
            href="/products" 
            className="inline-block px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium transition"
          >
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
    ? Math.min(...product.partnerProducts.map(pp => pp.customPrice || product.price))
    : product.price;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
        {/* 뒤로 가기 */}
        <Link 
          href="/products" 
          className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4 md:mb-6 text-sm md:text-base font-medium"
        >
          <span className="mr-2">←</span> 상품 목록으로
        </Link>

        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 p-4 md:p-8">
            {/* 이미지 영역 */}
            <div>
              {/* 메인 이미지 */}
              <div className="relative aspect-square mb-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl overflow-hidden shadow-md">
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <span className="text-9xl block opacity-30 mb-4">
                      {CATEGORY_ICONS[product.category.slug] || '📦'}
                    </span>
                    <p className="text-sm text-gray-400 font-medium px-4">{product.name}</p>
                  </div>
                </div>
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
            </div>

            {/* 상품 정보 */}
            <div className="flex flex-col">
              {/* 카테고리 */}
              <Link
                href={`/products`}
                className="inline-block text-sm text-blue-600 hover:text-blue-700 mb-2 font-medium"
              >
                {product.category.name}
              </Link>

              {/* 상품명 */}
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{product.name}</h1>

              {/* 가격 */}
              <div className="mb-6 pb-6 border-b">
                {product.comparePrice && product.comparePrice > product.price && (
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-lg text-gray-400 line-through">
                      ₩{product.comparePrice.toLocaleString()}
                    </span>
                    <span className="text-xl font-bold text-red-500">
                      {discountPercent}% OFF
                    </span>
                  </div>
                )}
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl md:text-5xl font-bold text-gray-900">
                    ₩{currentPrice.toLocaleString()}
                  </span>
                  {product.partnerProducts.length > 0 && currentPrice > lowestPrice && (
                    <span className="text-sm text-orange-500 font-semibold">
                      최저가 ₩{lowestPrice.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              {/* 설명 */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">📝 상품 설명</h3>
                <p className="text-base text-gray-600 leading-relaxed whitespace-pre-wrap bg-gray-50 p-4 rounded-lg">
                  {product.description}
                </p>
              </div>

              {/* 재고 */}
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold bg-green-50 border-2 border-green-200 text-green-700">
                  <span>
                    {product.stock > 0 ? `✅ 재고: ${product.stock}개` : '❌ 품절'}
                  </span>
                </div>
              </div>

              {/* 파트너 판매자 목록 */}
              {product.partnerProducts.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">🏪 판매 업체 ({product.partnerProducts.length})</h3>
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {product.partnerProducts.map((pp) => (
                      <div
                        key={pp.id}
                        onClick={() => setSelectedPartner(pp)}
                        className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                          selectedPartner?.id === pp.id
                            ? 'border-blue-500 bg-blue-50 shadow-md'
                            : 'border-gray-200 hover:border-blue-300 hover:shadow'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-bold text-gray-900">{pp.partner.storeName}</h4>
                              {selectedPartner?.id === pp.id && (
                                <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full font-bold">
                                  선택됨
                                </span>
                              )}
                            </div>
                            {pp.partner.description && (
                              <p className="text-sm text-gray-600 mb-2">{pp.partner.description}</p>
                            )}
                            <div className="flex flex-wrap gap-2 mb-2">
                              {pp.partner.youtubeUrl && (
                                <a
                                  href={pp.partner.youtubeUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200"
                                >
                                  YouTube
                                </a>
                              )}
                              {pp.partner.instagramUrl && (
                                <a
                                  href={pp.partner.instagramUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs bg-pink-100 text-pink-700 px-2 py-1 rounded hover:bg-pink-200"
                                >
                                  Instagram
                                </a>
                              )}
                              {pp.partner.africaTvUrl && (
                                <a
                                  href={pp.partner.africaTvUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200"
                                >
                                  AfreecaTV
                                </a>
                              )}
                              {pp.partner.tiktokUrl && (
                                <a
                                  href={pp.partner.tiktokUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs bg-gray-800 text-white px-2 py-1 rounded hover:bg-gray-700"
                                >
                                  TikTok
                                </a>
                              )}
                              {pp.partner.naverShoppingUrl && (
                                <a
                                  href={pp.partner.naverShoppingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded hover:bg-green-200"
                                >
                                  네이버 쇼핑
                                </a>
                              )}
                              {pp.partner.coupangUrl && (
                                <a
                                  href={pp.partner.coupangUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded hover:bg-orange-200"
                                >
                                  쿠팡
                                </a>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">
                              판매자: {pp.partner.user.name}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-blue-600">
                              ₩{(pp.customPrice || product.price).toLocaleString()}
                            </div>
                            {pp.customPrice && pp.customPrice < product.price && (
                              <div className="text-xs text-green-600 font-semibold mt-1">
                                ₩{(product.price - pp.customPrice).toLocaleString()} 할인
                              </div>
                            )}
                            {pp.customPrice === lowestPrice && product.partnerProducts.length > 1 && (
                              <div className="text-xs bg-orange-500 text-white px-2 py-1 rounded mt-1 font-bold">
                                최저가!
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 수량 선택 */}
              {product.stock > 0 && (
                <div className="mb-6">
                  <label className="block text-sm font-bold text-gray-700 mb-3">
                    수량
                  </label>
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

              {/* 무료배송 안내 */}
              {currentPrice >= 50000 && (
                <div className="mb-6 bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-3 text-blue-700 font-bold">
                    <span className="text-2xl">🚚</span>
                    <span>무료배송</span>
                  </div>
                </div>
              )}

              {/* 구매 버튼 */}
              <div className="mt-auto space-y-3">
                {selectedPartner && (
                  <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                    <span className="font-semibold">선택한 판매자:</span> {selectedPartner.partner.storeName}
                  </div>
                )}
                <button
                  onClick={addToCart}
                  disabled={product.stock === 0 || adding}
                  className={`w-full py-4 px-6 rounded-lg font-bold text-lg transition-all ${
                    product.stock === 0
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : adding
                      ? 'bg-blue-400 text-white cursor-wait'
                      : 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 active:scale-95 shadow-lg'
                  }`}
                >
                  {adding ? '⏳ 추가 중...' : product.stock === 0 ? '품절' : '🛒 장바구니에 담기'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
