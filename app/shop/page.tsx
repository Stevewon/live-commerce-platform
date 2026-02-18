'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { toggleWishlist, isInWishlist, getWishlistCount } from '@/lib/utils/wishlist';

const categories = [
  { id: 'all', name: '전체', icon: '🔥', color: 'from-yellow-500 to-orange-500' },
  { id: 'electronics', name: '전자기기', icon: '📱', color: 'from-blue-500 to-cyan-500' },
  { id: 'fashion', name: '패션의류', icon: '👕', color: 'from-pink-500 to-rose-500' },
  { id: 'beauty', name: '뷰티', icon: '💄', color: 'from-purple-500 to-pink-500' },
  { id: 'home', name: '홈인테리어', icon: '🏠', color: 'from-green-500 to-emerald-500' },
  { id: 'food', name: '식품', icon: '🍱', color: 'from-orange-500 to-amber-500' },
  { id: 'sports', name: '스포츠', icon: '⚽', color: 'from-red-500 to-orange-500' },
  { id: 'kids', name: '유아동', icon: '🧸', color: 'from-cyan-500 to-blue-500' },
  { id: 'books', name: '도서', icon: '📚', color: 'from-indigo-500 to-purple-500' },
];

const products = [
  {
    id: '1',
    name: '프리미엄 무선 이어폰',
    slug: 'premium-wireless-earbuds',
    category: 'electronics',
    price: 129000,
    comparePrice: 179000,
    rating: 4.8,
    reviews: 234,
    thumbnail: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500',
    badge: 'BEST',
    liveCount: 1234,
  },
  {
    id: '2',
    name: '스마트 워치 프로',
    slug: 'smart-watch-pro',
    category: 'electronics',
    price: 289000,
    comparePrice: 349000,
    rating: 5.0,
    reviews: 156,
    thumbnail: 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=500',
    badge: 'HOT',
    liveCount: 892,
  },
  {
    id: '3',
    name: '블루투스 스피커',
    slug: 'bluetooth-speaker',
    category: 'electronics',
    price: 89000,
    comparePrice: 119000,
    rating: 4.5,
    reviews: 89,
    thumbnail: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500',
    liveCount: 657,
  },
  {
    id: '4',
    name: '키보드 프로',
    slug: 'keyboard-pro',
    category: 'electronics',
    price: 159000,
    comparePrice: 199000,
    rating: 4.9,
    reviews: 178,
    thumbnail: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500',
    liveCount: 523,
  },
  {
    id: '5',
    name: '무선 마우스',
    slug: 'wireless-mouse',
    category: 'electronics',
    price: 39000,
    comparePrice: 49000,
    rating: 4.6,
    reviews: 145,
    thumbnail: 'https://images.unsplash.com/photo-1527814050087-3793815479db?w=500',
    liveCount: 412,
  },
  {
    id: '6',
    name: '노트북 스탠드',
    slug: 'laptop-stand',
    category: 'electronics',
    price: 45000,
    comparePrice: 59000,
    rating: 4.7,
    reviews: 98,
    thumbnail: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500',
    liveCount: 356,
  },
  {
    id: '7',
    name: '여성 원피스',
    slug: 'women-dress',
    category: 'fashion',
    price: 79000,
    comparePrice: 129000,
    rating: 4.8,
    reviews: 267,
    thumbnail: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=500',
    badge: 'NEW',
    liveCount: 789,
  },
  {
    id: '8',
    name: '남성 청바지',
    slug: 'men-jeans',
    category: 'fashion',
    price: 89000,
    comparePrice: 139000,
    rating: 4.6,
    reviews: 189,
    thumbnail: 'https://images.unsplash.com/photo-1542272454315-7dedaabf4d37?w=500',
    liveCount: 634,
  },
  {
    id: '9',
    name: '스킨케어 세트',
    slug: 'skincare-set',
    category: 'beauty',
    price: 159000,
    comparePrice: 219000,
    rating: 4.9,
    reviews: 412,
    thumbnail: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=500',
    badge: 'BEST',
    liveCount: 1023,
  },
  {
    id: '10',
    name: '립스틱 세트',
    slug: 'lipstick-set',
    category: 'beauty',
    price: 49000,
    comparePrice: 79000,
    rating: 4.7,
    reviews: 234,
    thumbnail: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=500',
    liveCount: 567,
  },
  {
    id: '11',
    name: '인테리어 조명',
    slug: 'interior-light',
    category: 'home',
    price: 129000,
    comparePrice: 189000,
    rating: 4.8,
    reviews: 156,
    thumbnail: 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=500',
    liveCount: 445,
  },
  {
    id: '12',
    name: '쿠션',
    slug: 'cushion',
    category: 'home',
    price: 29000,
    comparePrice: 45000,
    rating: 4.5,
    reviews: 89,
    thumbnail: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=500',
    liveCount: 312,
  },
];

export default function ShopPage() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'popular' | 'low-price' | 'high-price' | 'rating'>('popular');
  const [searchQuery, setSearchQuery] = useState('');
  const [wishlistItems, setWishlistItems] = useState<Set<string>>(new Set());
  const [wishlistCount, setWishlistCount] = useState(0);

  // 찜 목록 초기화 및 업데이트 감지
  useEffect(() => {
    const updateWishlist = () => {
      const items = new Set<string>();
      products.forEach(p => {
        if (isInWishlist(p.id)) {
          items.add(p.id);
        }
      });
      setWishlistItems(items);
      setWishlistCount(getWishlistCount());
    };

    updateWishlist();
    window.addEventListener('wishlistUpdated', updateWishlist);
    
    return () => {
      window.removeEventListener('wishlistUpdated', updateWishlist);
    };
  }, []);

  // 검색 및 카테고리 필터링
  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesSearch = searchQuery === '' || 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case 'low-price':
        return a.price - b.price;
      case 'high-price':
        return b.price - a.price;
      case 'rating':
        return b.rating - a.rating;
      case 'popular':
      default:
        return b.liveCount - a.liveCount;
    }
  });

  const discount = (product: any) =>
    product.comparePrice
      ? Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)
      : 0;

  // 찜하기 토글 핸들러
  const handleWishlistToggle = (e: React.MouseEvent, product: any) => {
    e.preventDefault();
    e.stopPropagation();
    
    const wishlistItem = {
      id: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      comparePrice: product.comparePrice,
      thumbnail: product.thumbnail,
      category: product.category,
      addedAt: new Date().toISOString(),
    };
    
    toggleWishlist(wishlistItem);
  };

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
              <Link href="/shop" className="text-blue-400 font-semibold text-sm">
                🛍️ 쇼핑몰
              </Link>
              <Link href="/wishlist" className="relative text-gray-300 hover:text-white transition">
                <span className="text-2xl">💖</span>
                {wishlistCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {wishlistCount}
                  </span>
                )}
              </Link>
              <Link href="/cart" className="relative text-gray-300 hover:text-white transition">
                <span className="text-2xl">🛒</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* 페이지 제목 */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">🛍️ 쇼핑몰</h1>
          <p className="text-gray-400 text-lg">라이브 방송에서 판매하는 모든 상품</p>
        </div>

        {/* 검색바 */}
        <div className="mb-8">
          <div className="relative max-w-2xl">
            <input
              type="text"
              placeholder="상품명 또는 카테고리를 검색하세요..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-800/50 border-2 border-gray-700 rounded-xl px-6 py-4 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition text-lg"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
              🔍
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-12 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition"
              >
                ✕
              </button>
            )}
          </div>
          {searchQuery && (
            <div className="mt-3 text-sm text-gray-400">
              <span className="text-blue-400 font-semibold">{filteredProducts.length}개</span>의 검색 결과
            </div>
          )}
        </div>

        {/* 카테고리 필터 */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">카테고리</h2>
          <div className="flex flex-wrap gap-3">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-6 py-3 rounded-xl font-semibold transition-all transform hover:scale-105 ${
                  selectedCategory === cat.id
                    ? `bg-gradient-to-r ${cat.color} text-white shadow-lg`
                    : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
                }`}
              >
                <span className="mr-2">{cat.icon}</span>
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* 정렬 옵션 */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-gray-400">
            총 <span className="text-white font-bold">{sortedProducts.length}</span>개 상품
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">정렬:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="popular">인기순</option>
              <option value="low-price">낮은 가격순</option>
              <option value="high-price">높은 가격순</option>
              <option value="rating">평점순</option>
            </select>
          </div>
        </div>

        {/* 상품 그리드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {sortedProducts.map((product) => (
            <Link
              key={product.id}
              href={`/products/${product.slug}`}
              className="group bg-gray-800/50 rounded-2xl overflow-hidden border border-gray-700 hover:border-blue-500 transition-all duration-300 transform hover:-translate-y-2 hover:shadow-2xl"
            >
              <div className="relative aspect-square overflow-hidden bg-gray-700">
                <img
                  src={product.thumbnail}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
                {/* 찜하기 버튼 */}
                <button
                  onClick={(e) => handleWishlistToggle(e, product)}
                  className="absolute top-3 left-3 z-10 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-black/70 transition-all transform hover:scale-110"
                >
                  <span className={`text-2xl transition-all ${
                    wishlistItems.has(product.id) 
                      ? 'animate-pulse' 
                      : ''
                  }`}>
                    {wishlistItems.has(product.id) ? '💖' : '🤍'}
                  </span>
                </button>
                {discount(product) > 0 && (
                  <div className="absolute top-3 right-3 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                    {discount(product)}% OFF
                  </div>
                )}
                {product.badge && (
                  <div className="absolute top-14 left-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                    {product.badge}
                  </div>
                )}
                <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm px-3 py-1 rounded-full text-white text-sm">
                  ⚡ {product.liveCount.toLocaleString()}명 구매중
                </div>
              </div>

              <div className="p-5">
                <h3 className="text-white font-bold text-lg mb-2 group-hover:text-blue-400 transition-colors line-clamp-2">
                  {product.name}
                </h3>

                <div className="flex items-center gap-1 text-yellow-400 text-sm mb-3">
                  {'★'.repeat(Math.floor(product.rating))}
                  {'☆'.repeat(5 - Math.floor(product.rating))}
                  <span className="text-gray-400 ml-1">({product.reviews})</span>
                </div>

                <div className="flex items-baseline gap-2 mb-3">
                  <p className="text-2xl font-bold text-blue-400">₩{product.price.toLocaleString()}</p>
                  {product.comparePrice && (
                    <p className="text-sm text-gray-500 line-through">₩{product.comparePrice.toLocaleString()}</p>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm text-gray-400">
                  <span>🚚 무료배송</span>
                  <span>⏰ 오늘출발</span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* 상품이 없을 때 */}
        {sortedProducts.length === 0 && (
          <div className="text-center py-24">
            <div className="text-6xl mb-4">📦</div>
            <p className="text-2xl text-gray-400 mb-4">해당 카테고리에 상품이 없습니다</p>
            <button
              onClick={() => setSelectedCategory('all')}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition"
            >
              전체 상품 보기
            </button>
          </div>
        )}
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
