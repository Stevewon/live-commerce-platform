'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/contexts/AuthContext';

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

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const slug = params.slug as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);

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
      setSelectedImage(productData.thumbnail);
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

  const images = product ? 
    (product.images ? JSON.parse(product.images) : [product.thumbnail]) : 
    [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">⚠️ {error || '상품을 찾을 수 없습니다'}</h1>
          <Link href="/products" className="text-blue-600 hover:text-blue-700">
            ← 상품 목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const discountPercent = product.comparePrice && product.comparePrice > product.price
    ? Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 뒤로 가기 */}
        <Link href="/products" className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-6">
          <span className="mr-2">←</span> 상품 목록으로
        </Link>

        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8">
            {/* 이미지 갤러리 */}
            <div>
              {/* 메인 이미지 */}
              <div className="relative aspect-square mb-4 bg-gray-100 rounded-lg overflow-hidden">
                <img
                  src={selectedImage}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
                {product.isFeatured && (
                  <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                    BEST
                  </div>
                )}
                {product.stock === 0 && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <span className="text-white font-bold text-2xl">품절</span>
                  </div>
                )}
              </div>

              {/* 썸네일 갤러리 */}
              {images.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {images.map((img: string, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImage(img)}
                      className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                        selectedImage === img
                          ? 'border-blue-600 ring-2 ring-blue-200'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <img
                        src={img}
                        alt={`${product.name} ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 상품 정보 */}
            <div>
              {/* 카테고리 */}
              <Link
                href={`/products?category=${product.category.slug}`}
                className="inline-block text-sm text-blue-600 hover:text-blue-700 mb-2"
              >
                {product.category.name}
              </Link>

              {/* 상품명 */}
              <h1 className="text-3xl font-bold text-gray-900 mb-4">{product.name}</h1>

              {/* 가격 */}
              <div className="mb-6">
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
                <div className="text-4xl font-bold text-gray-900">
                  ₩{product.price.toLocaleString()}
                </div>
              </div>

              {/* 설명 */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">상품 설명</h3>
                <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">
                  {product.description}
                </p>
              </div>

              {/* 재고 */}
              <div className="mb-6">
                <span className={`text-sm font-medium ${
                  product.stock > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {product.stock > 0 ? `재고: ${product.stock}개` : '품절'}
                </span>
              </div>

              {/* 수량 선택 */}
              {product.stock > 0 && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    수량
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                      className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={product.stock}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Math.min(product.stock, parseInt(e.target.value) || 1)))}
                      className="w-20 text-center border border-gray-300 rounded-lg px-3 py-2"
                    />
                    <button
                      onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                      disabled={quantity >= product.stock}
                      className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              {/* 구매 버튼 */}
              <div className="flex gap-3">
                <button
                  onClick={addToCart}
                  disabled={product.stock === 0 || adding}
                  className={`flex-1 py-4 px-6 rounded-lg font-semibold text-lg transition-colors ${
                    product.stock === 0
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {adding ? '추가 중...' : product.stock === 0 ? '품절' : '🛒 장바구니에 담기'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
