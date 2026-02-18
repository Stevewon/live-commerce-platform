'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

// 샘플 상품 데이터 (실제로는 API에서 가져옴)
const SAMPLE_PRODUCTS = [
  {
    id: '1',
    name: '프리미엄 무선 이어폰',
    slug: 'premium-wireless-earbuds',
    description: '최고의 음질과 편안한 착용감을 자랑하는 프리미엄 무선 이어폰입니다. ANC(액티브 노이즈 캔슬링) 기능으로 완벽한 몰입감을 제공합니다.',
    price: 129000,
    comparePrice: 179000,
    stock: 50,
    sku: 'EAR-001',
    images: [
      'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800',
      'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?w=800',
      'https://images.unsplash.com/photo-1613040809024-b4ef7ba99bc3?w=800',
      'https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b?w=800',
    ],
    thumbnail: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400',
    category: { name: '전자기기', slug: 'electronics' },
    features: [
      '액티브 노이즈 캔슬링(ANC)',
      '최대 30시간 재생',
      'IPX4 생활방수',
      '블루투스 5.3',
      '멀티포인트 연결',
    ],
    specs: [
      { label: '드라이버', value: '10mm 다이나믹 드라이버' },
      { label: '배터리', value: '이어폰 8시간 + 케이스 22시간' },
      { label: '충전', value: 'USB-C 고속충전 (5분 충전 1시간 사용)' },
      { label: '무게', value: '이어폰 4.5g, 케이스 45g' },
      { label: '코덱', value: 'AAC, SBC, aptX' },
    ],
    reviews: [
      {
        id: '1',
        userName: '김민준',
        rating: 5,
        comment: '음질이 정말 좋아요! 노이즈 캔슬링 기능도 훌륭합니다.',
        date: '2026-02-15',
        helpful: 24,
      },
      {
        id: '2',
        userName: '이서연',
        rating: 4,
        comment: '착용감이 편하고 배터리 지속시간도 만족스럽습니다.',
        date: '2026-02-14',
        helpful: 18,
      },
      {
        id: '3',
        userName: '박지훈',
        rating: 5,
        comment: '가격 대비 성능이 아주 좋습니다. 강력 추천!',
        date: '2026-02-12',
        helpful: 32,
      },
      {
        id: '4',
        userName: '최유진',
        rating: 4,
        comment: '디자인이 예쁘고 통화 품질도 괜찮아요.',
        date: '2026-02-10',
        helpful: 15,
      },
    ],
  },
  {
    id: '2',
    name: '스마트 워치 프로',
    slug: 'smart-watch-pro',
    description: '건강 관리부터 일상 생활까지, 모든 것을 한 손목에서. 최신 센서와 AI 기술로 당신의 건강을 지킵니다.',
    price: 289000,
    comparePrice: 349000,
    stock: 30,
    sku: 'WATCH-001',
    images: [
      'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=800',
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800',
      'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=800',
      'https://images.unsplash.com/photo-1617625802912-cad670fc709b?w=800',
    ],
    thumbnail: 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=400',
    category: { name: '웨어러블', slug: 'wearables' },
    features: [
      '심박수 24시간 모니터링',
      '혈중 산소포화도 측정',
      '수면 분석',
      '100가지 운동 모드',
      '5ATM 방수',
    ],
    specs: [
      { label: '디스플레이', value: '1.4인치 AMOLED (454x454)' },
      { label: '배터리', value: '최대 14일 사용' },
      { label: '센서', value: '심박, 혈중산소, 가속도, 자이로' },
      { label: '무게', value: '45g (스트랩 제외)' },
      { label: '호환', value: 'Android 6.0+, iOS 12.0+' },
    ],
    reviews: [
      {
        id: '5',
        userName: '정하윤',
        rating: 5,
        comment: '배터리가 오래가고 기능도 다양해서 만족합니다!',
        date: '2026-02-16',
        helpful: 28,
      },
      {
        id: '6',
        userName: '강민석',
        rating: 5,
        comment: '운동할 때 정말 유용해요. 추천합니다!',
        date: '2026-02-13',
        helpful: 21,
      },
    ],
  },
];

// 관련 상품 샘플
const RELATED_PRODUCTS = [
  {
    id: '3',
    name: '블루투스 스피커',
    slug: 'bluetooth-speaker',
    price: 89000,
    comparePrice: 119000,
    thumbnail: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400',
  },
  {
    id: '4',
    name: '노트북 스탠드',
    slug: 'laptop-stand',
    price: 45000,
    comparePrice: 59000,
    thumbnail: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400',
  },
  {
    id: '5',
    name: '무선 마우스',
    slug: 'wireless-mouse',
    price: 39000,
    comparePrice: 49000,
    thumbnail: 'https://images.unsplash.com/photo-1527814050087-3793815479db?w=400',
  },
  {
    id: '6',
    name: '키보드 프로',
    slug: 'keyboard-pro',
    price: 159000,
    comparePrice: 199000,
    thumbnail: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400',
  },
];

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [product, setProduct] = useState<any>(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedTab, setSelectedTab] = useState<'description' | 'specs' | 'reviews'>('description');
  const [reviewFilter, setReviewFilter] = useState<'all' | '5' | '4' | '3' | '2' | '1'>('all');
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    // 실제로는 API 호출
    const foundProduct = SAMPLE_PRODUCTS.find((p) => p.slug === slug);
    if (foundProduct) {
      setProduct(foundProduct);
    }

    // 장바구니 개수 로드
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    setCartCount(cart.length);
  }, [slug]);

  const addToCart = () => {
    if (!product) return;

    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const existingItemIndex = cart.findIndex((item: any) => item.id === product.id);

    if (existingItemIndex >= 0) {
      cart[existingItemIndex].quantity += quantity;
    } else {
      cart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        thumbnail: product.thumbnail,
        quantity: quantity,
      });
    }

    localStorage.setItem('cart', JSON.stringify(cart));
    setCartCount(cart.length);
    alert('장바구니에 추가되었습니다!');
  };

  const buyNow = () => {
    addToCart();
    router.push('/cart');
  };

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">상품을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  const discount = product.comparePrice
    ? Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)
    : 0;

  const averageRating =
    product.reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / product.reviews.length;

  const filteredReviews =
    reviewFilter === 'all'
      ? product.reviews
      : product.reviews.filter((r: any) => r.rating === parseInt(reviewFilter));

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* 헤더 */}
      <header className="bg-gray-800/50 backdrop-blur-md border-b border-gray-700 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
              Live Commerce
            </Link>
            <div className="flex items-center gap-6">
              <Link href="/cart" className="relative">
                <span className="text-2xl">🛒</span>
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* 상품 상세 메인 */}
      <div className="container mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* 왼쪽: 이미지 갤러리 */}
          <div>
            {/* 메인 이미지 */}
            <div className="relative aspect-square bg-gray-800 rounded-2xl overflow-hidden mb-4 group">
              <img
                src={product.images[selectedImage]}
                alt={product.name}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
              />
              {discount > 0 && (
                <div className="absolute top-4 left-4 bg-red-500 text-white px-4 py-2 rounded-full font-bold text-lg">
                  {discount}% OFF
                </div>
              )}
            </div>

            {/* 썸네일 이미지 */}
            <div className="grid grid-cols-4 gap-4">
              {product.images.map((img: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(idx)}
                  className={`relative aspect-square bg-gray-800 rounded-lg overflow-hidden border-2 transition-all ${
                    selectedImage === idx
                      ? 'border-blue-500 ring-2 ring-blue-500/50'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <img src={img} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* 오른쪽: 상품 정보 */}
          <div>
            {/* 카테고리 */}
            <p className="text-blue-400 text-sm font-medium mb-2">{product.category.name}</p>

            {/* 상품명 */}
            <h1 className="text-4xl font-bold mb-4">{product.name}</h1>

            {/* 평점 */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className={`text-xl ${i < Math.round(averageRating) ? 'text-yellow-400' : 'text-gray-600'}`}>
                    ★
                  </span>
                ))}
              </div>
              <span className="text-gray-400">
                {averageRating.toFixed(1)} ({product.reviews.length}개 리뷰)
              </span>
            </div>

            {/* 가격 */}
            <div className="mb-8">
              {product.comparePrice && (
                <p className="text-gray-500 line-through text-lg mb-1">
                  ₩{product.comparePrice.toLocaleString()}
                </p>
              )}
              <div className="flex items-baseline gap-3">
                <p className="text-4xl font-bold text-blue-400">₩{product.price.toLocaleString()}</p>
                {discount > 0 && <span className="text-red-400 text-xl font-bold">{discount}% 할인</span>}
              </div>
            </div>

            {/* 주요 특징 */}
            <div className="bg-gray-800/50 rounded-xl p-6 mb-8">
              <h3 className="text-lg font-bold mb-4">주요 특징</h3>
              <ul className="space-y-2">
                {product.features.map((feature: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-green-400 mt-1">✓</span>
                    <span className="text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 재고 */}
            <div className="mb-6">
              <p className="text-sm text-gray-400 mb-2">재고</p>
              <p className={`font-bold ${product.stock > 10 ? 'text-green-400' : 'text-orange-400'}`}>
                {product.stock > 10 ? `재고 충분 (${product.stock}개)` : `재고 얼마 남지 않음 (${product.stock}개)`}
              </p>
            </div>

            {/* 수량 선택 */}
            <div className="mb-8">
              <p className="text-sm text-gray-400 mb-2">수량</p>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-12 h-12 bg-gray-800 hover:bg-gray-700 rounded-lg font-bold text-xl transition-colors"
                >
                  -
                </button>
                <span className="text-2xl font-bold w-12 text-center">{quantity}</span>
                <button
                  onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                  className="w-12 h-12 bg-gray-800 hover:bg-gray-700 rounded-lg font-bold text-xl transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            {/* 구매 버튼 */}
            <div className="flex gap-4 mb-8">
              <button
                onClick={addToCart}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-4 rounded-xl font-bold text-lg transition-all hover:scale-105"
              >
                장바구니 담기
              </button>
              <button
                onClick={buyNow}
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white py-4 rounded-xl font-bold text-lg transition-all hover:scale-105"
              >
                바로 구매
              </button>
            </div>

            {/* 배송 정보 */}
            <div className="bg-gray-800/30 rounded-xl p-6 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🚚</span>
                <div>
                  <p className="font-bold">무료 배송</p>
                  <p className="text-sm text-gray-400">평균 2-3일 소요</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl">↩️</span>
                <div>
                  <p className="font-bold">무료 반품</p>
                  <p className="text-sm text-gray-400">30일 이내 무료 반품</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl">🛡️</span>
                <div>
                  <p className="font-bold">품질 보증</p>
                  <p className="text-sm text-gray-400">1년 제조사 보증</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 탭 섹션 */}
        <div className="mt-16">
          {/* 탭 버튼 */}
          <div className="flex gap-4 border-b border-gray-700 mb-8">
            <button
              onClick={() => setSelectedTab('description')}
              className={`px-6 py-3 font-bold transition-colors relative ${
                selectedTab === 'description' ? 'text-blue-400' : 'text-gray-400 hover:text-white'
              }`}
            >
              상품 설명
              {selectedTab === 'description' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400"></div>
              )}
            </button>
            <button
              onClick={() => setSelectedTab('specs')}
              className={`px-6 py-3 font-bold transition-colors relative ${
                selectedTab === 'specs' ? 'text-blue-400' : 'text-gray-400 hover:text-white'
              }`}
            >
              제품 사양
              {selectedTab === 'specs' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400"></div>}
            </button>
            <button
              onClick={() => setSelectedTab('reviews')}
              className={`px-6 py-3 font-bold transition-colors relative ${
                selectedTab === 'reviews' ? 'text-blue-400' : 'text-gray-400 hover:text-white'
              }`}
            >
              리뷰 ({product.reviews.length})
              {selectedTab === 'reviews' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400"></div>}
            </button>
          </div>

          {/* 탭 컨텐츠 */}
          <div>
            {selectedTab === 'description' && (
              <div className="prose prose-invert max-w-none">
                <p className="text-lg text-gray-300 leading-relaxed">{product.description}</p>
              </div>
            )}

            {selectedTab === 'specs' && (
              <div className="bg-gray-800/30 rounded-xl p-8">
                <table className="w-full">
                  <tbody>
                    {product.specs.map((spec: any, idx: number) => (
                      <tr key={idx} className="border-b border-gray-700 last:border-0">
                        <td className="py-4 pr-8 font-bold text-gray-400 w-1/3">{spec.label}</td>
                        <td className="py-4 text-gray-200">{spec.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {selectedTab === 'reviews' && (
              <div>
                {/* 리뷰 통계 */}
                <div className="bg-gray-800/30 rounded-xl p-8 mb-8">
                  <div className="flex items-center gap-8">
                    <div className="text-center">
                      <p className="text-5xl font-bold text-blue-400 mb-2">{averageRating.toFixed(1)}</p>
                      <div className="flex items-center gap-1 mb-2">
                        {[...Array(5)].map((_, i) => (
                          <span key={i} className={`text-2xl ${i < Math.round(averageRating) ? 'text-yellow-400' : 'text-gray-600'}`}>
                            ★
                          </span>
                        ))}
                      </div>
                      <p className="text-sm text-gray-400">{product.reviews.length}개 리뷰</p>
                    </div>

                    <div className="flex-1">
                      {[5, 4, 3, 2, 1].map((rating) => {
                        const count = product.reviews.filter((r: any) => r.rating === rating).length;
                        const percentage = (count / product.reviews.length) * 100;
                        return (
                          <div key={rating} className="flex items-center gap-3 mb-2">
                            <span className="text-sm text-gray-400 w-12">{rating}점</span>
                            <div className="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-yellow-400 h-full transition-all"
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                            <span className="text-sm text-gray-400 w-12">{count}개</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 리뷰 필터 */}
                <div className="flex gap-2 mb-6">
                  <button
                    onClick={() => setReviewFilter('all')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      reviewFilter === 'all'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    전체
                  </button>
                  {[5, 4, 3, 2, 1].map((rating) => (
                    <button
                      key={rating}
                      onClick={() => setReviewFilter(rating.toString() as any)}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        reviewFilter === rating.toString()
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {rating}점
                    </button>
                  ))}
                </div>

                {/* 리뷰 목록 */}
                <div className="space-y-6">
                  {filteredReviews.map((review: any) => (
                    <div key={review.id} className="bg-gray-800/30 rounded-xl p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-bold mb-1">{review.userName}</p>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center">
                              {[...Array(5)].map((_, i) => (
                                <span key={i} className={`text-sm ${i < review.rating ? 'text-yellow-400' : 'text-gray-600'}`}>
                                  ★
                                </span>
                              ))}
                            </div>
                            <span className="text-sm text-gray-400">{review.date}</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-gray-300 mb-4">{review.comment}</p>
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <button className="hover:text-white transition-colors">👍 도움됨 ({review.helpful})</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 관련 상품 */}
        <div className="mt-16">
          <h2 className="text-3xl font-bold mb-8">관련 상품</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {RELATED_PRODUCTS.map((relatedProduct) => {
              const relatedDiscount = relatedProduct.comparePrice
                ? Math.round(
                    ((relatedProduct.comparePrice - relatedProduct.price) / relatedProduct.comparePrice) * 100
                  )
                : 0;
              return (
                <Link
                  key={relatedProduct.id}
                  href={`/products/${relatedProduct.slug}`}
                  className="group bg-gray-800/30 rounded-xl overflow-hidden hover:bg-gray-800/50 transition-all hover:scale-105"
                >
                  <div className="relative aspect-square">
                    <img
                      src={relatedProduct.thumbnail}
                      alt={relatedProduct.name}
                      className="w-full h-full object-cover"
                    />
                    {relatedDiscount > 0 && (
                      <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded-full text-sm font-bold">
                        {relatedDiscount}%
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold mb-2 group-hover:text-blue-400 transition-colors">
                      {relatedProduct.name}
                    </h3>
                    <div className="flex items-baseline gap-2">
                      <p className="text-lg font-bold text-blue-400">₩{relatedProduct.price.toLocaleString()}</p>
                      {relatedProduct.comparePrice && (
                        <p className="text-sm text-gray-500 line-through">
                          ₩{relatedProduct.comparePrice.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* 푸터 */}
      <footer className="bg-gray-800/50 border-t border-gray-700 py-8 mt-16">
        <div className="container mx-auto px-6 text-center text-gray-400">
          <p>© 2026 Live Commerce Platform. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
