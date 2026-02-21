'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

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
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchCategories();
    fetchProducts();
  }, []);

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
      if (selectedCategory !== 'all') {
        url += `category=${selectedCategory}&`;
      }
      if (searchTerm) {
        url += `search=${encodeURIComponent(searchTerm)}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('상품 목록을 불러올 수 없습니다.');
      }

      const data = await res.json();
      setProducts(data.data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      console.error('상품 조회 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts();
    }, 300);
    return () => clearTimeout(timer);
  }, [selectedCategory, searchTerm]);

  const addToCart = async (productId: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('로그인이 필요합니다.');
        window.location.href = '/login';
        return;
      }

      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ productId, quantity: 1 }),
      });

      if (res.ok) {
        alert('장바구니에 추가되었습니다!');
      } else {
        const data = await res.json();
        alert(data.error || '장바구니 추가 실패');
      }
    } catch (err) {
      console.error('장바구니 추가 실패:', err);
      alert('장바구니 추가에 실패했습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">🛍️ 상품 목록</h1>
          <p className="mt-2 text-gray-600">다양한 상품을 둘러보고 쇼핑하세요</p>
        </div>

        {/* 필터 및 검색 */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 카테고리 필터 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">카테고리</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">전체</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.slug}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 검색 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">검색</label>
              <input
                type="text"
                placeholder="상품명으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* 로딩 */}
        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* 에러 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-600">⚠️ {error}</p>
            <button
              onClick={fetchProducts}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              다시 시도
            </button>
          </div>
        )}

        {/* 상품 그리드 */}
        {!loading && !error && (
          <>
            {products.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">상품이 없습니다.</p>
                <p className="text-gray-400 text-sm mt-2">다른 카테고리를 선택해보세요.</p>
              </div>
            ) : (
              <>
                <div className="mb-4 text-sm text-gray-600">
                  총 <span className="font-semibold text-gray-900">{products.length}</span>개의 상품
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300"
                    >
                      {/* 상품 이미지 */}
                      <Link href={`/products/${product.slug}`}>
                        <div className="relative h-64 bg-gray-200">
                          {product.thumbnail ? (
                            <img
                              src={product.thumbnail}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              이미지 없음
                            </div>
                          )}
                          {product.isFeatured && (
                            <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-bold">
                              BEST
                            </div>
                          )}
                          {product.stock === 0 && (
                            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                              <span className="text-white font-bold text-xl">품절</span>
                            </div>
                          )}
                        </div>
                      </Link>

                      {/* 상품 정보 */}
                      <div className="p-4">
                        <div className="text-xs text-gray-500 mb-1">{product.category.name}</div>
                        <Link href={`/products/${product.slug}`}>
                          <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 hover:text-blue-600">
                            {product.name}
                          </h3>
                        </Link>

                        {/* 가격 */}
                        <div className="mb-3">
                          {product.comparePrice && product.comparePrice > product.price && (
                            <div className="text-sm text-gray-400 line-through">
                              ₩{product.comparePrice.toLocaleString()}
                            </div>
                          )}
                          <div className="flex items-baseline gap-2">
                            <span className="text-xl font-bold text-gray-900">
                              ₩{product.price.toLocaleString()}
                            </span>
                            {product.comparePrice && product.comparePrice > product.price && (
                              <span className="text-sm font-semibold text-red-500">
                                {Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)}%
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 재고 정보 */}
                        <div className="text-xs text-gray-500 mb-3">
                          {product.stock > 0 ? `재고: ${product.stock}개` : '품절'}
                        </div>

                        {/* 장바구니 버튼 */}
                        <button
                          onClick={() => addToCart(product.id)}
                          disabled={product.stock === 0}
                          className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
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
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
