'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Product {
  id: string
  name: string
  slug: string
  description: string
  price: number
  comparePrice?: number
  stock: number
  thumbnail: string
  isActive: boolean
  category: {
    name: string
  }
}

interface PartnerProduct {
  id: string
  productId: string
  isActive: boolean
  product: Product
}

export default function PartnerProducts() {
  const router = useRouter()
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [myProducts, setMyProducts] = useState<PartnerProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/partner/login')
        return
      }

      // 모든 제품 조회
      const allResponse = await fetch('/api/admin/products', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      // 내가 선택한 제품 조회
      const myResponse = await fetch('/api/partner/products', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (allResponse.ok && myResponse.ok) {
        const allData = await allResponse.json()
        const myData = await myResponse.json()
        setAllProducts(allData.products)
        setMyProducts(myData.products)
      } else if (allResponse.status === 401 || myResponse.status === 401) {
        router.push('/partner/login')
      }
    } catch (error) {
      console.error('Products fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  const isProductSelected = (productId: string) => {
    return myProducts.some(pp => pp.productId === productId)
  }

  const handleToggleProduct = async (productId: string) => {
    try {
      const token = localStorage.getItem('token')
      const isSelected = isProductSelected(productId)
      const action = isSelected ? 'remove' : 'add'

      const response = await fetch('/api/partner/products', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ productId, action })
      })

      if (response.ok) {
        fetchData() // 목록 새로고침
      } else {
        const data = await response.json()
        alert(data.error || '제품 처리 중 오류가 발생했습니다')
      }
    } catch (error) {
      console.error('Toggle product error:', error)
      alert('제품 처리 중 오류가 발생했습니다')
    }
  }

  const filteredProducts = allProducts.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = categoryFilter === 'ALL' || product.category.name === categoryFilter
    return matchesSearch && matchesCategory && product.isActive
  })

  const categories = Array.from(new Set(allProducts.map(p => p.category.name)))
  const selectedCount = myProducts.length
  const activeCount = myProducts.filter(pp => pp.isActive).length

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">제품 선택</h1>
          <p className="mt-2 text-gray-600">내 쇼핑몰에서 판매할 제품을 선택하세요</p>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-2">선택한 제품</p>
            <p className="text-3xl font-bold text-blue-600">{selectedCount}개</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-2">판매 중인 제품</p>
            <p className="text-3xl font-bold text-green-600">{activeCount}개</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-2">전체 제품</p>
            <p className="text-3xl font-bold text-gray-900">{allProducts.length}개</p>
          </div>
        </div>

        {/* 검색 및 필터 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="제품 검색..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full md:w-48 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="ALL">전체 카테고리</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 제품 그리드 */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500">제품이 없습니다</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => {
              const isSelected = isProductSelected(product.id)
              return (
                <div
                  key={product.id}
                  className={`bg-white rounded-lg shadow overflow-hidden hover:shadow-lg transition-shadow ${
                    isSelected ? 'ring-2 ring-blue-600' : ''
                  }`}
                >
                  {/* 제품 이미지 */}
                  <div className="relative h-48 bg-gray-200">
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                      제품 이미지
                    </div>
                    {isSelected && (
                      <div className="absolute top-2 right-2 bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
                        선택됨
                      </div>
                    )}
                  </div>

                  {/* 제품 정보 */}
                  <div className="p-4">
                    <div className="mb-2">
                      <span className="inline-block px-2 py-1 text-xs font-semibold text-blue-600 bg-blue-100 rounded">
                        {product.category.name}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                      {product.name}
                    </h3>
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {product.description}
                    </p>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <span className="text-xl font-bold text-gray-900">
                          ₩{product.price.toLocaleString()}
                        </span>
                        {product.comparePrice && (
                          <span className="ml-2 text-sm text-gray-500 line-through">
                            ₩{product.comparePrice.toLocaleString()}
                          </span>
                        )}
                      </div>
                      <span className={`text-sm ${
                        product.stock > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        재고: {product.stock}
                      </span>
                    </div>
                    <button
                      onClick={() => handleToggleProduct(product.id)}
                      className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors ${
                        isSelected
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {isSelected ? '제거하기' : '추가하기'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
