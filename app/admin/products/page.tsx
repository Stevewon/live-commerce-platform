'use client'
import { useAdminAuth } from '@/lib/hooks/useAdminAuth'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Product {
  id: string
  name: string
  slug: string
  description: string | null
  price: number
  comparePrice?: number | null
  stock: number
  thumbnail: string
  imageUrl: string | null
  isActive: boolean
  isFeatured: boolean
  createdAt: string
  category: {
    name: string
    slug: string
  }
}

interface Category {
  id: string
  name: string
  slug: string
}

export default function AdminProductsPage() {
  const router = useRouter()
  const { user, loading: authLoading, logout } = useAdminAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (user && user.role === 'ADMIN') {
      fetchProducts()
      fetchCategories()
    }
  }, [user, statusFilter, categoryFilter, currentPage])

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        status: statusFilter,
        category: categoryFilter,
        page: currentPage.toString(),
        limit: '20'
      })

      const res = await fetch(`/api/admin/products?${params}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await res.json()
      if (data.success) {
        setProducts(data.data.products)
        setTotalPages(data.data.pagination.totalPages)
        setTotalCount(data.data.pagination.totalCount)
      }
    } catch (error) {
      console.error('상품 조회 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories')
      const data = await res.json()
      if (data.success) {
        setCategories(data.data)
      }
    } catch (error) {
      console.error('카테고리 조회 실패:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('정말 이 상품을 삭제하시겠습니까?')) return
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      const data = await res.json()
      if (data.success) {
        alert(data.message)
        fetchProducts()
      } else {
        alert(data.error || '삭제 실패')
      }
    } catch (error) {
      alert('상품 삭제에 실패했습니다')
    }
  }

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus })
      })
      const data = await res.json()
      if (data.success) {
        fetchProducts()
      }
    } catch (error) {
      alert('상태 변경에 실패했습니다')
    }
  }

  const handleBulkAction = async (action: 'activate' | 'deactivate' | 'delete') => {
    if (selectedIds.size === 0) return
    const msg = action === 'delete' 
      ? `${selectedIds.size}개 상품을 삭제하시겠습니까?` 
      : `${selectedIds.size}개 상품을 ${action === 'activate' ? '활성화' : '비활성화'}하시겠습니까?`
    if (!confirm(msg)) return

    for (const id of selectedIds) {
      if (action === 'delete') {
        await fetch(`/api/admin/products/${id}`, { method: 'DELETE', credentials: 'include' })
      } else {
        await fetch(`/api/admin/products/${id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: action === 'activate' })
        })
      }
    }
    setSelectedIds(new Set())
    fetchProducts()
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredProducts.map(p => p.id)))
    }
  }

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.category?.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(amount)

  if (loading && products.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">상품 관리</h1>
              <p className="text-sm text-gray-500 mt-1">전체 {totalCount}개 상품</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => router.push('/admin/dashboard')} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition">
                대시보드
              </button>
              <Link
                href="/admin/products/new"
                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                상품 등록
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 필터 및 검색 */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">상태</label>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value as any); setCurrentPage(1) }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">전체</option>
                <option value="active">활성</option>
                <option value="inactive">비활성</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">카테고리</label>
              <select
                value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1) }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">전체</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">검색</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="상품명 또는 카테고리 검색..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <button onClick={() => setSearchQuery('')} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm">
                  초기화
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 일괄 작업 바 */}
        {selectedIds.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex items-center justify-between">
            <span className="text-sm text-blue-700 font-medium">{selectedIds.size}개 상품 선택됨</span>
            <div className="flex gap-2">
              <button onClick={() => handleBulkAction('activate')} className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700">
                일괄 활성화
              </button>
              <button onClick={() => handleBulkAction('deactivate')} className="px-3 py-1.5 text-xs font-medium bg-orange-600 text-white rounded hover:bg-orange-700">
                일괄 비활성화
              </button>
              <button onClick={() => handleBulkAction('delete')} className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700">
                일괄 삭제
              </button>
              <button onClick={() => setSelectedIds(new Set())} className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800">
                선택 해제
              </button>
            </div>
          </div>
        )}

        {/* 상품 목록 테이블 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={filteredProducts.length > 0 && selectedIds.size === filteredProducts.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">이미지</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상품정보</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">카테고리</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">가격</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">재고</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">관리</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center">
                      <div className="text-gray-400">
                        <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        <p className="text-lg font-medium">상품이 없습니다</p>
                        <p className="text-sm mt-1">새 상품을 등록해보세요</p>
                        <Link href="/admin/products/new" className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                          상품 등록하기
                        </Link>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(product.id)}
                          onChange={() => toggleSelect(product.id)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                      </td>
                      <td className="px-4 py-4">
                        {(product.thumbnail || product.imageUrl) ? (
                          <img
                            src={product.thumbnail || product.imageUrl || ''}
                            alt={product.name}
                            className="h-14 w-14 object-cover rounded-lg border"
                          />
                        ) : (
                          <div className="h-14 w-14 bg-gray-100 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <Link href={`/admin/products/${product.id}/edit`} className="text-sm font-medium text-gray-900 hover:text-blue-600 transition">
                          {product.name}
                        </Link>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{product.description}</p>
                        {product.isFeatured && (
                          <span className="mt-1 inline-block text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-medium">추천</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">{product.category?.name}</span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm font-semibold text-gray-900">{formatCurrency(product.price)}</div>
                        {product.comparePrice && (
                          <div className="text-xs text-gray-400 line-through">{formatCurrency(product.comparePrice)}</div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`text-sm font-medium ${
                          product.stock > 10 ? 'text-green-600' : product.stock > 0 ? 'text-orange-600' : 'text-red-600'
                        }`}>
                          {product.stock}개
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => handleToggleStatus(product.id, product.isActive)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                            product.isActive
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : 'bg-red-100 text-red-800 hover:bg-red-200'
                          }`}
                        >
                          {product.isActive ? '판매중' : '중지'}
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-1">
                          <Link
                            href={`/admin/products/${product.id}/edit`}
                            className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition"
                          >
                            수정
                          </Link>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="px-3 py-1.5 text-xs font-medium bg-red-50 text-red-600 rounded hover:bg-red-100 transition"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <p className="text-sm text-gray-700">
                <span className="font-medium">{currentPage}</span> / <span className="font-medium">{totalPages}</span> 페이지
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  이전
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  다음
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
