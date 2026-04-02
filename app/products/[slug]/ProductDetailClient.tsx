'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/contexts/AuthContext';
import { addToGuestCart } from '@/lib/utils/guestCart';
import ShopNavigation from '@/components/ShopNavigation';
import ProductReviews from '@/components/ProductReviews';

interface Partner {
  id: string;
  storeName: string;
  logo: string | null;
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
  createdAt: string;
  user: { name: string };
}

interface ProductVariant {
  id: string;
  optionValues: string;
  price: number | null;
  comparePrice: number | null;
  stock: number;
  sku: string | null;
  thumbnail: string | null;
  isActive: boolean;
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
  sku: string | null;
  images: string;
  detailImages: string | null;
  thumbnail: string;
  specifications: string | null;
  origin: string | null;
  manufacturer: string | null;
  brand: string | null;
  tags: string | null;
  hasOptions: boolean;
  optionNames: string | null;
  shippingInfo: string | null;
  returnInfo: string | null;
  isActive: boolean;
  isFeatured: boolean;
  category: { id: string; name: string; slug: string };
  partnerProducts: PartnerProduct[];
  reviews: Review[];
  variants: ProductVariant[];
}

const CATEGORY_ICONS: Record<string, string> = {
  electronics: '📱', beauty: '💄', food: '🍯', fashion: '👕',
  home: '🏠', sports: '⚽', kids: '👶', books: '📚',
};

export default function ProductDetailClient() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const slug = params.slug as string;

  // 파트너 스토어를 통한 접속인지 확인
  const storeSlug = searchParams.get('store');
  const partnerId = searchParams.get('partner');

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'detail' | 'specs' | 'sellers' | 'reviews' | 'qna'>('detail');
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartMessage, setCartMessage] = useState('');
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);

  useEffect(() => {
    if (slug) fetchProduct();
  }, [slug]);

  const fetchProduct = async () => {
    try {
      const res = await fetch(`/api/products?slug=${slug}`);
      const data = await res.json();
      if (data.success && data.data?.length > 0) {
        const p = data.data[0];
        // Ensure reviews and partnerProducts are always arrays
        if (!Array.isArray(p.reviews)) p.reviews = [];
        if (!Array.isArray(p.partnerProducts)) p.partnerProducts = [];
        if (!Array.isArray(p.variants)) p.variants = [];
        setProduct(p);
      } else {
        setError('상품을 찾을 수 없습니다.');
      }
    } catch {
      setError('상품 정보를 불러오는 데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ShopNavigation />
        <div className="max-w-6xl mx-auto px-4 py-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">상품 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ShopNavigation />
        <div className="max-w-6xl mx-auto px-4 py-12 text-center">
          <span className="text-6xl block mb-4">😢</span>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{error || '상품을 찾을 수 없습니다'}</h1>
          <Link href="/products" className="text-blue-600 hover:underline">상품 목록으로 돌아가기</Link>
        </div>
      </div>
    );
  }

  // Parse images
  let galleryImages: string[] = [];
  try {
    galleryImages = typeof product.images === 'string' ? JSON.parse(product.images) : product.images;
  } catch { galleryImages = []; }
  if (!galleryImages.length && product.thumbnail) galleryImages = [product.thumbnail];

  // Parse detail images
  let detailImages: string[] = [];
  try {
    if (product.detailImages) {
      detailImages = typeof product.detailImages === 'string' ? JSON.parse(product.detailImages) : product.detailImages;
    }
  } catch { detailImages = []; }

  // Parse specifications
  let specs: { key: string; value: string }[] = [];
  try {
    if (product.specifications) {
      specs = typeof product.specifications === 'string' ? JSON.parse(product.specifications) : product.specifications;
    }
  } catch { specs = []; }

  // Parse option names
  let optionNames: string[] = [];
  try {
    if (product.optionNames) {
      optionNames = typeof product.optionNames === 'string' ? JSON.parse(product.optionNames) : product.optionNames;
    }
  } catch { optionNames = []; }

  // Parse tags
  const tags = product.tags ? product.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

  // Price
  const currentPrice = selectedVariant?.price ?? product.price;
  const currentComparePrice = selectedVariant?.comparePrice ?? product.comparePrice;
  const currentStock = selectedVariant?.stock ?? product.stock;
  const discountPercent = currentComparePrice && currentComparePrice > currentPrice
    ? Math.round(((currentComparePrice - currentPrice) / currentComparePrice) * 100)
    : 0;
  const shippingFree = currentPrice * quantity >= 50000;

  // Average rating - safely handle reviews possibly being undefined or not an array
  const safeReviews = Array.isArray(product.reviews) ? product.reviews : [];
  const avgRating = safeReviews.length > 0
    ? (safeReviews.reduce((s, r) => s + (r.rating || 0), 0) / safeReviews.length).toFixed(1)
    : null;

  const handleAddToCart = async () => {
    if (currentStock <= 0) return;
    setAddingToCart(true);
    setCartMessage('');

    try {
      if (user) {
        const res = await fetch('/api/cart', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: product.id,
            variantId: selectedVariant?.id || null,
            quantity,
          }),
        });
        if (res.ok) {
          // 파트너 스토어 경유 시 partnerId를 sessionStorage에 저장
          if (partnerId) {
            sessionStorage.setItem('checkout_partnerId', partnerId);
            if (storeSlug) {
              sessionStorage.setItem('checkout_storeSlug', storeSlug);
            }
          }
          setCartMessage('장바구니에 추가되었습니다!');
        } else {
          setCartMessage('장바구니 추가에 실패했습니다.');
        }
      } else {
        addToGuestCart({
          productId: product.id,
          quantity,
          product: {
            id: product.id,
            name: product.name,
            slug: product.slug,
            price: currentPrice,
            comparePrice: currentComparePrice,
            stock: currentStock,
            thumbnail: product.thumbnail,
            category: product.category,
          },
          addedAt: new Date().toISOString(),
        });
        // 파트너 스토어 경유 시 partnerId를 sessionStorage에 저장
        if (partnerId) {
          sessionStorage.setItem('checkout_partnerId', partnerId);
          if (storeSlug) {
            sessionStorage.setItem('checkout_storeSlug', storeSlug);
          }
        }
        setCartMessage('장바구니에 추가되었습니다!');
      }
    } catch {
      setCartMessage('장바구니 추가에 실패했습니다.');
    } finally {
      setAddingToCart(false);
      setTimeout(() => setCartMessage(''), 3000);
    }
  };

  const handleBuyNow = async () => {
    // 바로구매: 장바구니에 넣지 않고 sessionStorage에 바로구매 상품만 저장 후 checkout으로 이동
    const buyNowItem = {
      productId: product.id,
      quantity,
      variantId: selectedVariant?.id || null,
      product: {
        id: product.id,
        name: product.name,
        price: currentPrice,
        thumbnail: product.thumbnail,
      },
    };
    try {
      sessionStorage.setItem('buyNowItem', JSON.stringify(buyNowItem));
      // 파트너 스토어 경유 시 partnerId를 sessionStorage에 저장
      if (partnerId) {
        sessionStorage.setItem('checkout_partnerId', partnerId);
        if (storeSlug) {
          sessionStorage.setItem('checkout_storeSlug', storeSlug);
        }
      }
    } catch {}
    router.push('/checkout?mode=buynow');
  };

  const tabs = [
    { id: 'detail' as const, label: '상세정보' },
    { id: 'specs' as const, label: '상품정보' },
    { id: 'sellers' as const, label: `판매자 (${(product.partnerProducts || []).length})` },
    { id: 'reviews' as const, label: `리뷰 (${safeReviews.length})` },
    { id: 'qna' as const, label: 'Q&A' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-0">
      <ShopNavigation />

      <div className="max-w-6xl mx-auto px-4 py-4 sm:py-8">
        {/* 파트너 스토어 경유 배너 */}
        {storeSlug && (
          <div className="mb-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-lg">🏪</span>
              <span className="text-blue-700 font-medium">파트너 스토어를 통해 접속하셨습니다</span>
            </div>
            <Link
              href={`/store/${storeSlug}`}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium hover:underline"
            >
              스토어로 돌아가기 &rarr;
            </Link>
          </div>
        )}

        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-4 flex items-center gap-2">
          <Link href="/" className="hover:text-gray-700">홈</Link>
          <span>/</span>
          <Link href="/products" className="hover:text-gray-700">전체상품</Link>
          <span>/</span>
          <Link href={`/products?category=${product.category.slug}`} className="hover:text-gray-700">{product.category.name}</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium truncate">{product.name}</span>
        </nav>

        {/* Product main section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10">
          {/* Image gallery */}
          <div>
            <div className="relative aspect-square bg-white rounded-xl overflow-hidden border">
              <img
                src={galleryImages[selectedImage] || product.thumbnail}
                alt={product.name}
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement!.innerHTML = `<div class="w-full h-full flex items-center justify-center text-8xl opacity-30">${CATEGORY_ICONS[product.category?.slug] || '📦'}</div>`;
                }}
              />
              {product.isFeatured && (
                <span className="absolute top-3 left-3 bg-red-500 text-white text-xs px-3 py-1 rounded-full font-bold">BEST</span>
              )}
              {discountPercent > 0 && (
                <span className="absolute top-3 right-3 bg-yellow-400 text-gray-900 text-xs px-3 py-1 rounded-full font-bold">{discountPercent}% OFF</span>
              )}
            </div>

            {/* Thumbnail strip */}
            {galleryImages.length > 1 && (
              <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                {galleryImages.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition ${
                      selectedImage === i ? 'border-blue-500' : 'border-transparent hover:border-gray-300'
                    }`}
                  >
                    <img src={url} alt={`${product.name} ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product info */}
          <div className="space-y-4">
            {/* Category & Brand */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-500">{product.category.name}</span>
              {product.brand && (
                <>
                  <span className="text-gray-300">|</span>
                  <span className="text-sm font-medium text-gray-700">{product.brand}</span>
                </>
              )}
            </div>

            {/* Name */}
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-snug">{product.name}</h1>

            {/* Rating */}
            {avgRating && (
              <div className="flex items-center gap-2">
                <div className="flex text-yellow-400 text-sm">
                  {'★'.repeat(Math.round(Number(avgRating)))}
                  {'☆'.repeat(5 - Math.round(Number(avgRating)))}
                </div>
                <span className="text-sm text-gray-600">{avgRating} ({safeReviews.length}개 리뷰)</span>
              </div>
            )}

            {/* Price */}
            <div className="bg-gray-50 rounded-lg p-4">
              {discountPercent > 0 && (
                <p className="text-sm text-gray-400 line-through mb-1">
                  ₩{currentComparePrice?.toLocaleString()}
                </p>
              )}
              <div className="flex items-baseline gap-3">
                {discountPercent > 0 && (
                  <span className="text-2xl font-bold text-red-500">{discountPercent}%</span>
                )}
                <span className="text-2xl sm:text-3xl font-bold text-gray-900">
                  ₩{currentPrice.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-2 text-sm">
                {shippingFree ? (
                  <span className="text-green-600 font-medium">무료배송</span>
                ) : (
                  <span className="text-gray-500">배송비 ₩3,000 (₩50,000 이상 무료)</span>
                )}
              </div>
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag, i) => (
                  <Link
                    key={i}
                    href={`/products?search=${encodeURIComponent(tag)}`}
                    className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full hover:bg-blue-100 transition"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            )}

            {/* Product Variants / Options */}
            {product.hasOptions && product.variants && product.variants.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">옵션 선택</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {product.variants.map((variant) => {
                    let optVals: Record<string, string> = {};
                    try { optVals = JSON.parse(variant.optionValues); } catch {}
                    const label = Object.values(optVals).join(' / ');
                    const isSelected = selectedVariant?.id === variant.id;
                    const isAvailable = variant.stock > 0;

                    return (
                      <button
                        key={variant.id}
                        onClick={() => setSelectedVariant(isSelected ? null : variant)}
                        disabled={!isAvailable}
                        className={`px-3 py-2 text-sm rounded-lg border text-left transition ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                            : isAvailable
                              ? 'border-gray-200 hover:border-gray-400 text-gray-700'
                              : 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                        }`}
                      >
                        <span>{label}</span>
                        {variant.price && variant.price !== product.price && (
                          <span className="block text-xs mt-0.5">₩{variant.price.toLocaleString()}</span>
                        )}
                        {!isAvailable && <span className="block text-xs">품절</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700">수량</span>
              <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="px-3 py-2 text-gray-500 hover:bg-gray-100 transition"
                >
                  -
                </button>
                <span className="w-12 text-center font-medium text-gray-900">{quantity}</span>
                <button
                  onClick={() => setQuantity(q => Math.min(currentStock, q + 1))}
                  className="px-3 py-2 text-gray-500 hover:bg-gray-100 transition"
                >
                  +
                </button>
              </div>
              <span className="text-sm text-gray-500">
                {currentStock > 0 ? `재고 ${currentStock}개` : ''}
              </span>
            </div>

            {/* Total */}
            <div className="flex justify-between items-center py-3 border-t border-b border-gray-200">
              <span className="text-sm font-medium text-gray-700">총 상품 금액</span>
              <span className="text-xl font-bold text-blue-600">₩{(currentPrice * quantity).toLocaleString()}</span>
            </div>

            {/* Cart notification */}
            {cartMessage && (
              <div className={`text-sm px-4 py-2 rounded-lg ${
                cartMessage.includes('실패') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
              }`}>
                {cartMessage}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              {currentStock > 0 ? (
                <>
                  <button
                    onClick={handleAddToCart}
                    disabled={addingToCart}
                    className="flex-1 py-3.5 border-2 border-blue-600 text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-50 transition disabled:opacity-50"
                  >
                    {addingToCart ? '추가 중...' : '장바구니'}
                  </button>
                  <button
                    onClick={handleBuyNow}
                    className="flex-1 py-3.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition"
                  >
                    바로 구매
                  </button>
                </>
              ) : (
                <button disabled className="flex-1 py-3.5 bg-gray-300 text-gray-500 rounded-xl font-bold text-sm cursor-not-allowed">
                  품절
                </button>
              )}
            </div>

            {/* Legal info: Origin / Manufacturer / Brand */}
            {(product.origin || product.manufacturer || product.brand) && (
              <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-4 text-sm">
                <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-1">
                  <span>⚖️</span> 상품 필수 정보
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-gray-600">
                  {product.origin && (
                    <div>
                      <span className="text-gray-400 text-xs">원산지</span>
                      <p className="font-medium">{product.origin}</p>
                    </div>
                  )}
                  {product.manufacturer && (
                    <div>
                      <span className="text-gray-400 text-xs">제조사</span>
                      <p className="font-medium">{product.manufacturer}</p>
                    </div>
                  )}
                  {product.brand && (
                    <div>
                      <span className="text-gray-400 text-xs">브랜드</span>
                      <p className="font-medium">{product.brand}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tabs section */}
        <div className="mt-10">
          <div className="bg-white border-b sticky top-0 z-20 rounded-t-xl">
            <div className="flex overflow-x-auto">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 min-w-fit px-6 py-4 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-b-xl p-4 sm:p-8 min-h-[400px]">
            {/* Detail tab */}
            {activeTab === 'detail' && (
              <div>
                {/* Detail content (WYSIWYG HTML) */}
                {product.detailContent && (
                  <div
                    className="prose max-w-none mb-8"
                    dangerouslySetInnerHTML={{ __html: product.detailContent }}
                  />
                )}

                {/* Detail images */}
                {detailImages.length > 0 && (
                  <div className="space-y-4">
                    {detailImages.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt={`${product.name} 상세 ${i + 1}`}
                        className="w-full rounded-lg"
                        loading="lazy"
                      />
                    ))}
                  </div>
                )}

                {/* Description */}
                {!product.detailContent && detailImages.length === 0 && (
                  <div className="text-gray-600 whitespace-pre-wrap leading-relaxed">
                    {product.description}
                  </div>
                )}
              </div>
            )}

            {/* Specs tab */}
            {activeTab === 'specs' && (
              <div className="space-y-6">
                {/* Specifications table */}
                {specs.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-4">상품 스펙</h3>
                    <table className="w-full border-collapse">
                      <tbody>
                        {specs.map((spec, i) => (
                          <tr key={i} className="border-b border-gray-100">
                            <td className="py-3 px-4 text-sm font-medium text-gray-500 bg-gray-50 w-1/3">{spec.key}</td>
                            <td className="py-3 px-4 text-sm text-gray-900">{spec.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Legal required info */}
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">필수 표시 정보</h3>
                  <table className="w-full border-collapse">
                    <tbody>
                      {product.origin && (
                        <tr className="border-b border-gray-100">
                          <td className="py-3 px-4 text-sm font-medium text-gray-500 bg-gray-50 w-1/3">원산지</td>
                          <td className="py-3 px-4 text-sm text-gray-900">{product.origin}</td>
                        </tr>
                      )}
                      {product.manufacturer && (
                        <tr className="border-b border-gray-100">
                          <td className="py-3 px-4 text-sm font-medium text-gray-500 bg-gray-50 w-1/3">제조사</td>
                          <td className="py-3 px-4 text-sm text-gray-900">{product.manufacturer}</td>
                        </tr>
                      )}
                      {product.brand && (
                        <tr className="border-b border-gray-100">
                          <td className="py-3 px-4 text-sm font-medium text-gray-500 bg-gray-50 w-1/3">브랜드</td>
                          <td className="py-3 px-4 text-sm text-gray-900">{product.brand}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Shipping info */}
                {product.shippingInfo && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-4">배송 안내</h3>
                    <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
                      {product.shippingInfo}
                    </div>
                  </div>
                )}

                {/* Return info */}
                {product.returnInfo && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-4">교환/반품 안내</h3>
                    <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
                      {product.returnInfo}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sellers tab */}
            {activeTab === 'sellers' && (
              <div>
                {(!product.partnerProducts || product.partnerProducts.length === 0) ? (
                  <p className="text-gray-500 text-center py-8">등록된 판매자가 없습니다.</p>
                ) : (
                  <div className="space-y-4">
                    {product.partnerProducts.map((pp) => (
                      <div key={pp.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                            {pp.partner.storeName.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{pp.partner.storeName}</p>
                            <p className="text-xs text-gray-500">{pp.partner.user.name}</p>
                          </div>
                        </div>
                        {pp.customPrice && (
                          <span className="font-bold text-gray-900">₩{pp.customPrice.toLocaleString()}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Reviews tab */}
            {activeTab === 'reviews' && (
              <ProductReviews productId={product.id} initialReviews={safeReviews} />
            )}

            {/* Q&A tab */}
            {activeTab === 'qna' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900">상품 Q&A</h2>
                </div>
                <div className="text-center py-12 text-gray-400">
                  <span className="text-5xl block mb-4">💬</span>
                  <p className="text-lg font-medium text-gray-500 mb-2">등록된 Q&A가 없습니다</p>
                  <p className="text-sm mb-6">상품에 대한 궁금한 점은 고객센터로 문의해주세요.</p>
                  <div className="bg-gray-50 rounded-lg p-4 max-w-sm mx-auto text-left">
                    <p className="text-sm font-medium text-gray-700 mb-2">📞 고객센터</p>
                    <p className="text-sm text-gray-600">전화: 02-1551-4220</p>
                    <p className="text-xs text-gray-400 mt-1">평일 10:00 ~ 18:00 (점심 12:00 ~ 13:00)</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-3 flex gap-3 md:hidden z-50">
        {currentStock > 0 ? (
          <>
            <button
              onClick={handleAddToCart}
              disabled={addingToCart}
              className="flex-1 py-3 border-2 border-blue-600 text-blue-600 rounded-xl font-bold text-sm"
            >
              장바구니
            </button>
            <button
              onClick={handleBuyNow}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm"
            >
              ₩{(currentPrice * quantity).toLocaleString()} 구매
            </button>
          </>
        ) : (
          <button disabled className="flex-1 py-3 bg-gray-300 text-gray-500 rounded-xl font-bold text-sm cursor-not-allowed">
            품절된 상품입니다
          </button>
        )}
      </div>
    </div>
  );
}
