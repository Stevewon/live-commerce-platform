'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import ShopNavigation from '@/components/ShopNavigation'

interface StoreInfo {
  id: string
  storeName: string
  storeSlug: string
  description: string | null
  logo: string | null
  banner: string | null
  ownerName: string | null
}

interface Product {
  id: string
  name: string
  slug: string
  price: number
  comparePrice: number | null
  thumbnail: string
  description: string
  stock: number
  isActive: boolean
  isFeatured: boolean
  category: {
    id: string
    name: string
    slug: string
  } | null
  customPrice: number | null
}

export default function StorePage() {
  const params = useParams()
  const slug = params?.slug as string

  const [store, setStore] = useState<StoreInfo | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  useEffect(() => {
    if (slug) fetchStoreData()
  }, [slug])

  const fetchStoreData = async () => {
    try {
      const res = await fetch(`/api/store/${slug}`)
      const data = await res.json()
      if (data.success) {
        setStore(data.data.store)
        setProducts(data.data.products)
      } else {
        setError(data.error || '스토어를 찾을 수 없습니다')
      }
    } catch (err) {
      setError('스토어 정보를 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount)
  }

  // 카테고리 목록 추출
  const categories = Array.from(
    new Map(
      products
        .filter(p => p.category)
        .map(p => [p.category!.id, p.category!])
    ).values()
  )

  const filteredProducts = selectedCategory === 'all'
    ? products
    : products.filter(p => p.category?.id === selectedCategory)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ShopNavigation />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">스토어 로딩 중...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !store) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ShopNavigation />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="text-6xl mb-4">🏪</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">스토어를 찾을 수 없습니다</h1>
            <p className="text-gray-500 mb-6">{error || '존재하지 않는 스토어입니다'}</p>
            <Link href="/shop" className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              쇼핑몰로 이동
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ShopNavigation />

      {/* 스토어 배너 */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center gap-6">
            {store.logo ? (
              <img src={store.logo} alt={store.storeName} className="w-24 h-24 rounded-2xl object-cover border-4 border-white/30 shadow-xl" />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-white/20 flex items-center justify-center text-4xl border-4 border-white/30 shadow-xl">
                🏪
              </div>
            )}
            <div>
              <h1 className="text-3xl sm:text-4xl font-black">{store.storeName}</h1>
              {store.description && (
                <p className="mt-2 text-blue-100 text-lg max-w-2xl">{store.description}</p>
              )}
              <div className="mt-3 flex items-center gap-4 text-sm text-blue-200">
                <span>상품 {products.length}개</span>
                {store.ownerName && <span>운영자: {store.ownerName}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 카테고리 필터 */}
        {categories.length > 1 && (
          <div className="mb-8 flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                selectedCategory === 'all'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border'
              }`}
            >
              전체 ({products.length})
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                  selectedCategory === cat.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border'
                }`}
              >
                {cat.name} ({products.filter(p => p.category?.id === cat.id).length})
              </button>
            ))}
          </div>
        )}

        {/* 상품 그리드 */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📦</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">등록된 상품이 없습니다</h2>
            <p className="text-gray-500">곧 새로운 상품이 업데이트됩니다</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
            {filteredProducts.map(product => {
              const displayPrice = product.customPrice || product.price
              const discountRate = product.comparePrice
                ? Math.round((1 - displayPrice / product.comparePrice) * 100)
                : 0

              return (
                <Link
                  key={product.id}
                  href={`/products/${product.slug}?store=${store.storeSlug}&partner=${store.id}`}
                  className="group bg-white rounded-xl overflow-hidden border border-gray-200 hover:shadow-lg hover:border-blue-300 transition-all duration-200"
                >
                  {/* 이미지 */}
                  <div className="aspect-square relative overflow-hidden bg-gray-100">
                    {product.thumbnail ? (
                      <img
                        src={product.thumbnail}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl text-gray-300">
                        📷
                      </div>
                    )}
                    {discountRate > 0 && (
                      <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-lg">
                        {discountRate}%
                      </div>
                    )}
                    {product.stock <= 0 && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white font-bold text-lg">품절</span>
                      </div>
                    )}
                  </div>

                  {/* 상품 정보 */}
                  <div className="p-3 sm:p-4">
                    {product.category && (
                      <span className="text-[10px] text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full">
                        {product.category.name}
                      </span>
                    )}
                    <h3 className="mt-1.5 text-sm font-medium text-gray-900 line-clamp-2 leading-snug group-hover:text-blue-600 transition">
                      {product.name}
                    </h3>
                    <div className="mt-2">
                      {product.comparePrice && product.comparePrice > displayPrice && (
                        <p className="text-xs text-gray-400 line-through">
                          {formatPrice(product.comparePrice)}원
                        </p>
                      )}
                      <p className="text-base font-bold text-gray-900">
                        {formatPrice(displayPrice)}
                        <span className="text-sm font-normal text-gray-600">원</span>
                      </p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* 하단 스토어 정보 */}
      <div className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-sm text-gray-500">
            <p className="font-medium text-gray-700">{store.storeName}</p>
            <p className="mt-1">QRLIVE 플랫폼에서 운영되는 파트너 스토어입니다</p>
            <Link href="/shop" className="mt-3 inline-block text-blue-600 hover:underline">
              QRLIVE 메인 쇼핑몰 보기 &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
