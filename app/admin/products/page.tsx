'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Product {
  id: string
  name: string
  slug: string
  price: number
  comparePrice: number | null
  stock: number
  sku: string | null
  thumbnail: string
  isActive: boolean
  isFeatured: boolean
  category: {
    name: string
  }
  _count: {
    partnerProducts: number
    orderItems: number
  }
  createdAt: string
}

export default function AdminProductsPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  useEffect(() => {
    // 인증 확인
    const token = localStorage.getItem('token')
    const userStr = localStorage.getItem('user')
    
    if (!token || !userStr) {
      router.push('/admin/login')
      return
    }

    const userData = JSON.parse(userStr)
    if (userData.role !== 'ADMIN') {
      router.push('/admin/login')
      return
    }

    loadProducts(token)
  }, [router])

  const loadProducts = async (token: string) => {
    try {
      const res = await fetch('/api/admin/products', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!res.ok) throw new Error('제품 로드 실패')

      const data = await res.json()
      setProducts(data.products)
    } catch (err) {
      console.error('Products load error:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleProductStatus = async (productId: string, currentStatus: boolean) => {
    const token = localStorage.getItem('token')
    if (!token) return

    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isActive: !currentStatus })
      })

      if (res.ok) {
        loadProducts(token)
      }
    } catch (err) {
      console.error('Status toggle error:', err)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(amount)
  }

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' && product.isActive) ||
                         (filterStatus === 'inactive' && !product.isActive)
    
    return matchesSearch && matchesStatus
  })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <Link href="/admin/dashboard" className="text-sm text-blue-600 hover:underline mb-2 inline-block">
                ← 대시보드로 돌아가기
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">제품 관리</h1>
              <p className="text-sm text-gray-600">플랫폼 제품을 관리하고 파트너에게 공급하세요</p>
            </div>
            <Link href="/admin/products/new" className="btn btn-primary">
              + 새 제품 추가
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Filters */}
        <div className="card mb-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="label">검색</label>
              <input
                type="text"
                className="input"
                placeholder="제품명 또는 SKU 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div>
              <label className="label">상태</label>
              <select
                className="input"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">전체</option>
                <option value="active">판매중</option>
                <option value="inactive">판매중지</option>
              </select>
            </div>

            <div className="flex items-end">
              <div className="text-sm text-gray-600">
                총 <span className="font-bold text-gray-900">{filteredProducts.length}</span>개 제품
              </div>
            </div>
          </div>
        </div>

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <div className="card text-center py-12">
            <div className="text-5xl mb-4">📦</div>
            <p className="text-gray-600 mb-4">제품이 없습니다</p>
            <Link href="/admin/products/new" className="btn btn-primary inline-block">
              첫 제품 추가하기
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <div key={product.id} className="card hover:shadow-lg transition-shadow">
                {/* Product Image */}
                <div className="relative mb-4">
                  <div className="aspect-square bg-gray-200 rounded-lg flex items-center justify-center overflow-hidden">
                    {product.thumbnail ? (
                      <img src={product.thumbnail} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-6xl">📦</span>
                    )}
                  </div>
                  {product.isFeatured && (
                    <span className="absolute top-2 right-2 bg-yellow-500 text-white px-2 py-1 rounded text-xs font-bold">
                      추천
                    </span>
                  )}
                  <button
                    onClick={() => toggleProductStatus(product.id, product.isActive)}
                    className={`absolute top-2 left-2 px-2 py-1 rounded text-xs font-bold ${
                      product.isActive
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-500 text-white'
                    }`}
                  >
                    {product.isActive ? '판매중' : '중지'}
                  </button>
                </div>

                {/* Product Info */}
                <div className="space-y-2">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900 line-clamp-2">
                      {product.name}
                    </h3>
                    <p className="text-xs text-gray-500">{product.category.name}</p>
                  </div>

                  {product.sku && (
                    <p className="text-xs font-mono text-gray-600">SKU: {product.sku}</p>
                  )}

                  <div className="flex items-center gap-2">
                    {product.comparePrice && (
                      <span className="text-sm text-gray-400 line-through">
                        {formatCurrency(product.comparePrice)}
                      </span>
                    )}
                    <span className="text-xl font-bold text-blue-600">
                      {formatCurrency(product.price)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className={`${product.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      재고: {product.stock}개
                    </span>
                    <span className="text-gray-600">
                      판매: {product._count.orderItems}건
                    </span>
                  </div>

                  <div className="pt-2 border-t">
                    <p className="text-xs text-gray-600">
                      {product._count.partnerProducts}명의 파트너가 판매 중
                    </p>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Link
                      href={`/admin/products/${product.id}`}
                      className="btn btn-secondary flex-1 text-sm"
                    >
                      수정
                    </Link>
                    <button className="btn btn-secondary text-sm">
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
