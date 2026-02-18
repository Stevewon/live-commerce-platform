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
              <Link href="/" className="text-gray-300 hover:text-white transition text-sm">
                홈
              </Link>
              <Link href="/shop" className="text-gray-300 hover:text-white transition text-sm font-semibold">
                🛍️ 쇼핑몰
              </Link>
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
              <div className="space-y-12">
                {/* 상품 소개 */}
                <div className="bg-gray-800/30 rounded-2xl p-8">
                  <h3 className="text-3xl font-bold mb-6">상품 소개</h3>
                  <p className="text-lg text-gray-300 leading-relaxed mb-8">{product.description}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {product.features.map((feature: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-3 bg-gray-700/30 p-4 rounded-xl">
                        <span className="text-2xl">✓</span>
                        <div>
                          <p className="font-bold text-white mb-1">{feature}</p>
                          <p className="text-sm text-gray-400">최고 수준의 성능을 제공합니다</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 상세 이미지 1 - 제품 전체 샷 */}
                <div className="relative aspect-[16/9] rounded-2xl overflow-hidden">
                  <img 
                    src="https://images.unsplash.com/photo-1484704849700-f032a568e944?w=1200" 
                    alt="상품 상세 이미지 1"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent flex items-end">
                    <div className="p-8">
                      <h4 className="text-3xl font-bold text-white mb-2">프리미엄 디자인</h4>
                      <p className="text-lg text-gray-300">세련된 디자인과 편안한 착용감</p>
                    </div>
                  </div>
                </div>

                {/* 기능 설명 섹션 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-2xl p-8 border border-blue-500/30">
                    <div className="text-5xl mb-4">🎧</div>
                    <h4 className="text-2xl font-bold mb-3">탁월한 음질</h4>
                    <p className="text-gray-300 leading-relaxed">
                      10mm 다이나믹 드라이버가 제공하는 깊고 풍부한 베이스와 
                      선명한 고음역대를 경험하세요. AAC, aptX 코덱 지원으로 
                      무손실에 가까운 고품질 오디오를 즐길 수 있습니다.
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-2xl p-8 border border-purple-500/30">
                    <div className="text-5xl mb-4">🔇</div>
                    <h4 className="text-2xl font-bold mb-3">액티브 노이즈 캔슬링</h4>
                    <p className="text-gray-300 leading-relaxed">
                      최신 ANC 기술로 주변 소음을 최대 95%까지 차단합니다. 
                      지하철, 카페, 사무실 등 어디서나 완벽한 몰입감을 제공하며, 
                      투명 모드로 주변 소리를 들을 수도 있습니다.
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-green-600/20 to-teal-600/20 rounded-2xl p-8 border border-green-500/30">
                    <div className="text-5xl mb-4">🔋</div>
                    <h4 className="text-2xl font-bold mb-3">장시간 배터리</h4>
                    <p className="text-gray-300 leading-relaxed">
                      이어폰 단독 8시간, 충전 케이스 포함 최대 30시간 재생이 가능합니다. 
                      급속 충전 기능으로 5분 충전만으로도 1시간 사용할 수 있어 
                      바쁜 일상에서도 걱정 없습니다.
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-orange-600/20 to-red-600/20 rounded-2xl p-8 border border-orange-500/30">
                    <div className="text-5xl mb-4">💧</div>
                    <h4 className="text-2xl font-bold mb-3">생활방수 IPX4</h4>
                    <p className="text-gray-300 leading-relaxed">
                      IPX4 등급 방수로 땀과 물방울로부터 안전합니다. 
                      운동 중이나 갑작스러운 비에도 걱정 없이 사용할 수 있으며, 
                      내구성 있는 설계로 오래도록 사용할 수 있습니다.
                    </p>
                  </div>
                </div>

                {/* 상세 이미지 2 - 기능 설명 */}
                <div className="relative aspect-[16/9] rounded-2xl overflow-hidden">
                  <img 
                    src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1200" 
                    alt="상품 상세 이미지 2"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent flex items-end">
                    <div className="p-8">
                      <h4 className="text-3xl font-bold text-white mb-2">최고의 편안함</h4>
                      <p className="text-lg text-gray-300">장시간 착용해도 편안한 인체공학적 디자인</p>
                    </div>
                  </div>
                </div>

                {/* 사용 시나리오 */}
                <div className="bg-gray-800/30 rounded-2xl p-8">
                  <h3 className="text-3xl font-bold mb-8 text-center">이런 분들께 추천합니다</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center">
                      <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-4xl">🎵</span>
                      </div>
                      <h4 className="font-bold text-lg mb-2">음악 애호가</h4>
                      <p className="text-sm text-gray-400">고음질 음악을 즐기고 싶은 분</p>
                    </div>
                    <div className="text-center">
                      <div className="w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-4xl">💼</span>
                      </div>
                      <h4 className="font-bold text-lg mb-2">직장인</h4>
                      <p className="text-sm text-gray-400">출퇴근 시간을 알차게 보내고 싶은 분</p>
                    </div>
                    <div className="text-center">
                      <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-4xl">🏃</span>
                      </div>
                      <h4 className="font-bold text-lg mb-2">운동 마니아</h4>
                      <p className="text-sm text-gray-400">운동 중에도 음악을 즐기고 싶은 분</p>
                    </div>
                  </div>
                </div>

                {/* 패키지 구성품 */}
                <div className="bg-gray-800/30 rounded-2xl p-8">
                  <h3 className="text-3xl font-bold mb-6">패키지 구성</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="text-center">
                      <div className="bg-gray-700/30 rounded-xl p-6 mb-3">
                        <span className="text-4xl">🎧</span>
                      </div>
                      <p className="font-bold">이어폰 본체</p>
                      <p className="text-sm text-gray-400">좌/우 1쌍</p>
                    </div>
                    <div className="text-center">
                      <div className="bg-gray-700/30 rounded-xl p-6 mb-3">
                        <span className="text-4xl">📦</span>
                      </div>
                      <p className="font-bold">충전 케이스</p>
                      <p className="text-sm text-gray-400">USB-C 포트</p>
                    </div>
                    <div className="text-center">
                      <div className="bg-gray-700/30 rounded-xl p-6 mb-3">
                        <span className="text-4xl">🔌</span>
                      </div>
                      <p className="font-bold">USB-C 케이블</p>
                      <p className="text-sm text-gray-400">고속 충전</p>
                    </div>
                    <div className="text-center">
                      <div className="bg-gray-700/30 rounded-xl p-6 mb-3">
                        <span className="text-4xl">📄</span>
                      </div>
                      <p className="font-bold">사용 설명서</p>
                      <p className="text-sm text-gray-400">한글 포함</p>
                    </div>
                  </div>
                </div>

                {/* 상세 이미지 3 - 마지막 */}
                <div className="relative aspect-[16/9] rounded-2xl overflow-hidden">
                  <img 
                    src="https://images.unsplash.com/photo-1545127398-14699f92334b?w=1200" 
                    alt="상품 상세 이미지 3"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent flex items-end">
                    <div className="p-8">
                      <h4 className="text-3xl font-bold text-white mb-2">지금 바로 경험하세요</h4>
                      <p className="text-lg text-gray-300">최고의 오디오 경험이 시작됩니다</p>
                    </div>
                  </div>
                </div>

                {/* 주의사항 */}
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-6">
                  <h4 className="font-bold text-orange-400 mb-3 flex items-center gap-2">
                    <span>⚠️</span> 사용 시 주의사항
                  </h4>
                  <ul className="space-y-2 text-sm text-gray-300">
                    <li>• 과도한 음량으로 장시간 사용 시 청력에 손상을 줄 수 있습니다.</li>
                    <li>• 운전 중이나 위험한 작업 시에는 사용을 자제해 주세요.</li>
                    <li>• 고온 다습한 환경에서는 제품이 손상될 수 있습니다.</li>
                    <li>• 어린이의 손이 닿지 않는 곳에 보관해 주세요.</li>
                  </ul>
                </div>
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

        {/* 상품 정보 고시 */}
        <div className="mt-16 bg-gray-800/30 rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            📋 상품정보제공고시
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex border-b border-gray-700 pb-3">
              <span className="text-gray-400 w-40 flex-shrink-0">제품명</span>
              <span className="text-white">{product.name}</span>
            </div>
            <div className="flex border-b border-gray-700 pb-3">
              <span className="text-gray-400 w-40 flex-shrink-0">모델명</span>
              <span className="text-white">{product.sku || 'EAR-PRO-2024'}</span>
            </div>
            <div className="flex border-b border-gray-700 pb-3">
              <span className="text-gray-400 w-40 flex-shrink-0">제조국</span>
              <span className="text-white">중국</span>
            </div>
            <div className="flex border-b border-gray-700 pb-3">
              <span className="text-gray-400 w-40 flex-shrink-0">제조연월</span>
              <span className="text-white">2024년 1월</span>
            </div>
            <div className="flex border-b border-gray-700 pb-3">
              <span className="text-gray-400 w-40 flex-shrink-0">A/S 책임자와 전화번호</span>
              <span className="text-white">고객센터 1588-0000</span>
            </div>
            <div className="flex border-b border-gray-700 pb-3">
              <span className="text-gray-400 w-40 flex-shrink-0">품질보증기준</span>
              <span className="text-white">구매일로부터 1년 무상 A/S</span>
            </div>
          </div>
        </div>

        {/* 배송/교환/반품 안내 */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 배송 안내 */}
          <div className="bg-gray-800/30 rounded-2xl p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              🚚 배송 안내
            </h3>
            <ul className="space-y-3 text-sm text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <div>
                  <p className="font-semibold text-white">배송비</p>
                  <p>전 지역 무료배송</p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <div>
                  <p className="font-semibold text-white">배송 기간</p>
                  <p>평균 2-3일 소요 (주말/공휴일 제외)</p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <div>
                  <p className="font-semibold text-white">배송 방법</p>
                  <p>CJ대한통운, 로젠택배</p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <div>
                  <p className="font-semibold text-white">도서산간 지역</p>
                  <p>추가 배송비 없음</p>
                </div>
              </li>
            </ul>
          </div>

          {/* 교환 안내 */}
          <div className="bg-gray-800/30 rounded-2xl p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              🔄 교환 안내
            </h3>
            <ul className="space-y-3 text-sm text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">•</span>
                <div>
                  <p className="font-semibold text-white">교환 기간</p>
                  <p>상품 수령 후 7일 이내</p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">•</span>
                <div>
                  <p className="font-semibold text-white">교환 비용</p>
                  <p>무료 (단순 변심 시 왕복 배송비 6,000원)</p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">•</span>
                <div>
                  <p className="font-semibold text-white">교환 방법</p>
                  <p>고객센터 또는 마이페이지에서 신청</p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">•</span>
                <div>
                  <p className="font-semibold text-white">교환 불가</p>
                  <p>제품 훼손, 사용 흔적, 7일 경과 시</p>
                </div>
              </li>
            </ul>
          </div>

          {/* 반품 안내 */}
          <div className="bg-gray-800/30 rounded-2xl p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              ↩️ 반품 안내
            </h3>
            <ul className="space-y-3 text-sm text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-orange-400 mt-1">•</span>
                <div>
                  <p className="font-semibold text-white">반품 기간</p>
                  <p>상품 수령 후 7일 이내</p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-400 mt-1">•</span>
                <div>
                  <p className="font-semibold text-white">반품 비용</p>
                  <p>무료 (단순 변심 시 왕복 배송비 6,000원)</p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-400 mt-1">•</span>
                <div>
                  <p className="font-semibold text-white">환불 처리</p>
                  <p>상품 회수 후 3-5 영업일 이내</p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-400 mt-1">•</span>
                <div>
                  <p className="font-semibold text-white">반품 불가</p>
                  <p>제품 훼손, 포장 훼손, 사용 흔적</p>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* 판매자/공급자 정보 */}
        <div className="mt-8 bg-gray-800/30 rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            🏢 판매자 정보
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-bold text-lg mb-4 text-blue-400">판매자</h3>
              <div className="space-y-3 text-sm">
                <div className="flex">
                  <span className="text-gray-400 w-32">상호명</span>
                  <span className="text-white">Live Commerce</span>
                </div>
                <div className="flex">
                  <span className="text-gray-400 w-32">대표자</span>
                  <span className="text-white">김라이브</span>
                </div>
                <div className="flex">
                  <span className="text-gray-400 w-32">사업자등록번호</span>
                  <span className="text-white">123-45-67890</span>
                </div>
                <div className="flex">
                  <span className="text-gray-400 w-32">통신판매업</span>
                  <span className="text-white">제2024-서울강남-0000호</span>
                </div>
                <div className="flex">
                  <span className="text-gray-400 w-32">주소</span>
                  <span className="text-white">서울시 강남구 테헤란로 123</span>
                </div>
                <div className="flex">
                  <span className="text-gray-400 w-32">이메일</span>
                  <span className="text-white">support@livecommerce.com</span>
                </div>
                <div className="flex">
                  <span className="text-gray-400 w-32">전화번호</span>
                  <span className="text-white">1588-0000</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-4 text-purple-400">제조/공급자</h3>
              <div className="space-y-3 text-sm">
                <div className="flex">
                  <span className="text-gray-400 w-32">제조사</span>
                  <span className="text-white">Audio Tech Co., Ltd.</span>
                </div>
                <div className="flex">
                  <span className="text-gray-400 w-32">제조국</span>
                  <span className="text-white">중국</span>
                </div>
                <div className="flex">
                  <span className="text-gray-400 w-32">공급자</span>
                  <span className="text-white">글로벌테크 유한회사</span>
                </div>
                <div className="flex">
                  <span className="text-gray-400 w-32">A/S 센터</span>
                  <span className="text-white">서울시 마포구 상암동 456</span>
                </div>
                <div className="flex">
                  <span className="text-gray-400 w-32">A/S 전화</span>
                  <span className="text-white">1588-1234</span>
                </div>
                <div className="flex">
                  <span className="text-gray-400 w-32">수입자</span>
                  <span className="text-white">Live Commerce</span>
                </div>
                <div className="flex">
                  <span className="text-gray-400 w-32">KC 인증번호</span>
                  <span className="text-white">R-R-AAA-2024-0000</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 고객센터 안내 */}
        <div className="mt-8 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-2xl p-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl font-bold mb-3 flex items-center gap-2">
                📞 고객센터
              </h2>
              <p className="text-gray-300 mb-2">상품 문의, 주문/배송 문의, 교환/반품 문의</p>
              <p className="text-sm text-gray-400">평일 09:00 - 18:00 (점심시간 12:00 - 13:00)</p>
              <p className="text-sm text-gray-400">주말 및 공휴일 휴무</p>
            </div>
            <div className="flex flex-col gap-3">
              <a 
                href="tel:1588-0000" 
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-center transition-colors"
              >
                📞 1588-0000
              </a>
              <a 
                href="mailto:support@livecommerce.com"
                className="px-8 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-bold text-center transition-colors"
              >
                📧 이메일 문의
              </a>
            </div>
          </div>
        </div>

        {/* 소비자 보호 안내 */}
        <div className="mt-8 bg-gray-800/30 rounded-2xl p-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            🛡️ 소비자 보호 및 법적 고지
          </h3>
          <div className="space-y-3 text-sm text-gray-400">
            <p>
              • 전자상거래 등에서의 소비자보호에 관한 법률에 의거하여 소비자의 청약철회 가능 기간은 상품 수령 후 7일 이내입니다.
            </p>
            <p>
              • 디지털 콘텐츠 또는 용역의 경우 소비자의 요청에 의하여 개별적으로 생산되는 재화로서 「청약철회등의 제한」 사유에 해당됩니다.
            </p>
            <p>
              • 소비자피해보상보험 가입: 고객님의 안전거래를 위해 소비자피해보상보험에 가입되어 있습니다.
            </p>
            <p>
              • 구매안전서비스 가입: 고객님의 안전한 구매를 위해 구매안전서비스에 가입되어 있습니다.
            </p>
            <p>
              • 개인정보보호: 고객님의 개인정보는 개인정보처리방침에 따라 안전하게 관리됩니다.
            </p>
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
