'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/contexts/AuthContext';

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  comparePrice: number | null;
  stock: number;
  thumbnail: string;
  brand: string | null;
  tags: string | null;
  isFeatured: boolean;
  category: { name: string; slug: string };
}

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

const CATEGORY_ICONS: Record<string, string> = {
  electronics: '📱', beauty: '💄', food: '🍯', fashion: '👕',
  home: '🏠', sports: '⚽', kids: '👶', books: '📚', all: '🏷️',
};

const SORT_OPTIONS = [
  { value: 'newest', label: '최신순' },
  { value: 'popular', label: '인기순' },
  { value: 'price-low', label: '낮은가격순' },
  { value: 'price-high', label: '높은가격순' },
  { value: 'discount', label: '할인율순' },
  { value: 'name', label: '이름순' },
];

export default function ProductsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <ProductsContent />
    </Suspense>
  );
}

function ProductsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, totalCount: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);

  // Filters from URL
  const currentCategory = searchParams.get('category') || 'all';
  const currentSort = searchParams.get('sort') || 'newest';
  const currentSearch = searchParams.get('search') || '';
  const currentPage = parseInt(searchParams.get('page') || '1');
  const currentBrand = searchParams.get('brand') || '';
  const currentMinPrice = searchParams.get('minPrice') || '';
  const currentMaxPrice = searchParams.get('maxPrice') || '';
  const currentInStock = searchParams.get('inStock') || '';

  // Local filter state
  const [searchInput, setSearchInput] = useState(currentSearch);
  const [priceMin, setPriceMin] = useState(currentMinPrice);
  const [priceMax, setPriceMax] = useState(currentMaxPrice);

  const buildUrl = useCallback((overrides: Record<string, string>) => {
    const params = new URLSearchParams();
    const values: Record<string, string> = {
      category: currentCategory,
      sort: currentSort,
      search: currentSearch,
      page: String(currentPage),
      brand: currentBrand,
      minPrice: currentMinPrice,
      maxPrice: currentMaxPrice,
      inStock: currentInStock,
      ...overrides,
    };
    Object.entries(values).forEach(([k, v]) => {
      if (v && v !== 'all' && v !== '1' || (k === 'page' && v !== '1')) {
        if (v && v !== 'all' && !(k === 'page' && v === '1')) params.set(k, v);
      }
    });
    return `/products?${params.toString()}`;
  }, [currentCategory, currentSort, currentSearch, currentPage, currentBrand, currentMinPrice, currentMaxPrice, currentInStock]);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [currentCategory, currentSort, currentSearch, currentPage, currentBrand, currentMinPrice, currentMaxPrice, currentInStock]);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      if (data.success) setCategories(data.data || []);
    } catch (e) { /* ignore */ }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (currentCategory !== 'all') params.set('category', currentCategory);
      if (currentSearch) params.set('search', currentSearch);
      if (currentSort) params.set('sort', currentSort);
      params.set('page', String(currentPage));
      params.set('limit', '20');
      if (currentBrand) params.set('brand', currentBrand);
      if (currentMinPrice) params.set('minPrice', currentMinPrice);
      if (currentMaxPrice) params.set('maxPrice', currentMaxPrice);
      if (currentInStock) params.set('inStock', currentInStock);

      const res = await fetch(`/api/products?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setProducts(data.data || []);
        if (data.pagination) setPagination(data.pagination);
        if (data.filters?.brands) setBrands(data.filters.brands);
      }
    } catch (e) {
      console.error('상품 로드 실패:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(buildUrl({ search: searchInput, page: '1' }));
  };

  const handlePriceFilter = () => {
    router.push(buildUrl({ minPrice: priceMin, maxPrice: priceMax, page: '1' }));
  };

  const clearFilters = () => {
    setSearchInput('');
    setPriceMin('');
    setPriceMax('');
    router.push('/products');
  };

  const hasActiveFilters = currentSearch || currentBrand || currentMinPrice || currentMaxPrice || currentInStock;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/products" className="text-xl font-bold text-gray-900">QRLIVE Shop</Link>
            <div className="flex items-center gap-3">
              <form onSubmit={handleSearch} className="relative hidden sm:block">
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="상품 검색..."
                  className="w-64 lg:w-80 px-4 py-2 pr-10 border border-gray-300 rounded-full text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  🔍
                </button>
              </form>
              <Link href="/cart" className="px-3 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium">🛒 장바구니</Link>
              {user ? (
                <span className="hidden sm:inline text-sm text-gray-700 font-medium">{user.name}님</span>
              ) : (
                <>
                  <Link href="/login" className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 font-medium">로그인</Link>
                  <Link href="/register" className="px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium">회원가입</Link>
                </>
              )}
            </div>
          </div>
          {/* 모바일 검색 */}
          <form onSubmit={handleSearch} className="mt-2 sm:hidden">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="상품 검색..."
              className="w-full px-4 py-2 border border-gray-300 rounded-full text-sm focus:ring-2 focus:ring-blue-500"
            />
          </form>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* 사이드바 필터 (데스크톱) */}
          <div className="hidden lg:block w-64 flex-shrink-0">
            <div className="bg-white rounded-lg shadow-sm p-5 sticky top-20 space-y-6">
              {/* 카테고리 필터 */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3">카테고리</h3>
                <div className="space-y-1.5">
                  <button
                    onClick={() => router.push(buildUrl({ category: 'all', page: '1' }))}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${currentCategory === 'all' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    🏷️ 전체
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => router.push(buildUrl({ category: cat.slug, page: '1' }))}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${currentCategory === cat.slug ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                      {CATEGORY_ICONS[cat.slug] || '📦'} {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* 가격 필터 */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3">가격 범위</h3>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    value={priceMin}
                    onChange={e => setPriceMin(e.target.value)}
                    placeholder="최소"
                    className="w-full px-2 py-1.5 border rounded text-sm text-gray-900"
                  />
                  <span className="text-gray-400">~</span>
                  <input
                    type="number"
                    value={priceMax}
                    onChange={e => setPriceMax(e.target.value)}
                    placeholder="최대"
                    className="w-full px-2 py-1.5 border rounded text-sm text-gray-900"
                  />
                </div>
                <button onClick={handlePriceFilter} className="mt-2 w-full py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded font-medium text-gray-700 transition">적용</button>
              </div>

              {/* 브랜드 필터 */}
              {brands.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-3">브랜드</h3>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {brands.map(b => (
                      <button
                        key={b}
                        onClick={() => router.push(buildUrl({ brand: currentBrand === b ? '' : b, page: '1' }))}
                        className={`w-full text-left px-3 py-1.5 rounded text-sm transition ${currentBrand === b ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 재고 필터 */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentInStock === 'true'}
                  onChange={e => router.push(buildUrl({ inStock: e.target.checked ? 'true' : '', page: '1' }))}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600"
                />
                <span className="text-sm text-gray-700">재고 있는 상품만</span>
              </label>

              {/* 필터 초기화 */}
              {hasActiveFilters && (
                <button onClick={clearFilters} className="w-full py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg font-medium transition">
                  필터 초기화
                </button>
              )}
            </div>
          </div>

          {/* 메인 콘텐츠 */}
          <div className="flex-1 min-w-0">
            {/* 모바일 카테고리 스크롤 */}
            <div className="lg:hidden mb-4 -mx-4 px-4 overflow-x-auto">
              <div className="flex gap-2 pb-2">
                <button
                  onClick={() => router.push(buildUrl({ category: 'all', page: '1' }))}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition ${currentCategory === 'all' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
                >
                  전체
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => router.push(buildUrl({ category: cat.slug, page: '1' }))}
                    className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition ${currentCategory === cat.slug ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
                  >
                    {CATEGORY_ICONS[cat.slug] || '📦'} {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 정렬 + 결과 수 */}
            <div className="flex items-center justify-between mb-4 bg-white rounded-lg shadow-sm px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  총 <strong className="text-gray-900">{pagination.totalCount}</strong>개
                </span>
                {currentSearch && (
                  <span className="text-sm text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                    &quot;{currentSearch}&quot; 검색결과
                  </span>
                )}
                {hasActiveFilters && (
                  <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700 lg:hidden">초기화</button>
                )}
              </div>
              <select
                value={currentSort}
                onChange={e => router.push(buildUrl({ sort: e.target.value, page: '1' }))}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 text-gray-700"
              >
                {SORT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* 상품 그리드 */}
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-lg shadow-sm overflow-hidden animate-pulse">
                    <div className="aspect-square bg-gray-200" />
                    <div className="p-3 space-y-2">
                      <div className="h-3 bg-gray-200 rounded w-1/3" />
                      <div className="h-4 bg-gray-200 rounded w-2/3" />
                      <div className="h-5 bg-gray-200 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-lg shadow-sm">
                <span className="text-6xl block mb-4">🔍</span>
                <h2 className="text-xl font-bold text-gray-900 mb-2">검색 결과가 없습니다</h2>
                <p className="text-gray-500 mb-6">다른 키워드나 필터를 사용해보세요.</p>
                <button onClick={clearFilters} className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium transition">
                  필터 초기화
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {products.map(product => {
                  const discountPercent = product.comparePrice && product.comparePrice > product.price
                    ? Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)
                    : 0;
                  return (
                    <Link
                      key={product.id}
                      href={`/products/${product.slug}`}
                      className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-all group"
                    >
                      <div className="relative aspect-square bg-gray-100 overflow-hidden">
                        <img
                          src={product.thumbnail}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={e => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement!.innerHTML = `<div class="w-full h-full flex items-center justify-center text-5xl bg-gradient-to-br from-blue-50 to-purple-50 opacity-50">${CATEGORY_ICONS[product.category?.slug] || '📦'}</div>`;
                          }}
                        />
                        {product.isFeatured && (
                          <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded font-bold">BEST</span>
                        )}
                        {discountPercent > 0 && (
                          <span className="absolute top-2 right-2 bg-yellow-400 text-gray-900 text-[10px] px-2 py-0.5 rounded font-bold">{discountPercent}%</span>
                        )}
                        {product.stock === 0 && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <span className="text-white font-bold text-sm bg-gray-900/70 px-3 py-1 rounded">품절</span>
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-[10px] text-gray-400 mb-1">{product.category?.name}{product.brand ? ` / ${product.brand}` : ''}</p>
                        <h3 className="text-sm font-medium text-gray-900 line-clamp-2 mb-2 leading-snug">{product.name}</h3>
                        <div className="flex items-baseline gap-2">
                          {discountPercent > 0 && (
                            <span className="text-red-500 font-bold text-sm">{discountPercent}%</span>
                          )}
                          <span className="font-bold text-gray-900">₩{product.price.toLocaleString()}</span>
                        </div>
                        {product.comparePrice && product.comparePrice > product.price && (
                          <p className="text-xs text-gray-400 line-through">₩{product.comparePrice.toLocaleString()}</p>
                        )}
                        <div className="flex gap-1 mt-2">
                          {product.stock > 0 && product.price >= 50000 && (
                            <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">무료배송</span>
                          )}
                          {product.stock > 0 && product.stock <= 5 && (
                            <span className="text-[10px] text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">{product.stock}개 남음</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* 페이지네이션 */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => router.push(buildUrl({ page: String(Math.max(1, currentPage - 1)) }))}
                  disabled={currentPage <= 1}
                  className="px-3 py-2 border rounded-lg text-sm disabled:opacity-30 hover:bg-gray-50 transition"
                >
                  ← 이전
                </button>
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (pagination.totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= pagination.totalPages - 2) {
                    pageNum = pagination.totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => router.push(buildUrl({ page: String(pageNum) }))}
                      className={`w-10 h-10 rounded-lg text-sm font-medium transition ${
                        currentPage === pageNum
                          ? 'bg-blue-500 text-white'
                          : 'border text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => router.push(buildUrl({ page: String(Math.min(pagination.totalPages, currentPage + 1)) }))}
                  disabled={currentPage >= pagination.totalPages}
                  className="px-3 py-2 border rounded-lg text-sm disabled:opacity-30 hover:bg-gray-50 transition"
                >
                  다음 →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
