'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Partner {
  id: string
  storeName: string
  slug: string
  businessNumber: string | null
  bankAccount: string | null
  commissionRate: number
  isActive: boolean
  createdAt: string
  user: {
    name: string
    email: string
    phone: string | null
  }
  _count: {
    products: number
    orders: number
  }
  totalRevenue: number
}

export default function AdminPartnersPage() {
  const router = useRouter()
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // 상세 모달
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null)

  // 수정 모달
  const [showEditModal, setShowEditModal] = useState(false)
  const [editData, setEditData] = useState({
    commissionRate: 0,
    storeName: '',
    businessNumber: '',
    bankAccount: ''
  })

  useEffect(() => {
    // 인증 확인
    const token = localStorage.getItem('token')
    const role = localStorage.getItem('role')
    if (!token || role !== 'ADMIN') {
      router.push('/admin/login')
      return
    }

    fetchPartners()
  }, [statusFilter, currentPage])

  const fetchPartners = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const params = new URLSearchParams({
        status: statusFilter,
        page: currentPage.toString(),
        limit: '20'
      })

      const res = await fetch(`/api/admin/partners?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await res.json()
      if (data.success) {
        setPartners(data.data.partners)
        setTotalPages(data.data.pagination.totalPages)
        setTotalCount(data.data.pagination.totalCount)
      }
    } catch (error) {
      console.error('파트너 조회 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    if (!confirm(`파트너를 ${currentStatus ? '비활성화' : '활성화'}하시겠습니까?`)) return

    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/admin/partners/${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isActive: !currentStatus })
      })

      const data = await res.json()
      if (data.success) {
        fetchPartners()
      } else {
        alert(data.error || '상태 변경 실패')
      }
    } catch (error) {
      console.error('상태 변경 실패:', error)
      alert('상태 변경에 실패했습니다')
    }
  }

  const handleViewDetail = async (partner: Partner) => {
    setSelectedPartner(partner)
    setShowDetailModal(true)
  }

  const handleEdit = (partner: Partner) => {
    setSelectedPartner(partner)
    setEditData({
      commissionRate: partner.commissionRate,
      storeName: partner.storeName,
      businessNumber: partner.businessNumber || '',
      bankAccount: partner.bankAccount || ''
    })
    setShowEditModal(true)
  }

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPartner) return

    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/admin/partners/${selectedPartner.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editData)
      })

      const data = await res.json()
      if (data.success) {
        alert('파트너 정보가 수정되었습니다')
        setShowEditModal(false)
        fetchPartners()
      } else {
        alert(data.error || '수정 실패')
      }
    } catch (error) {
      console.error('수정 실패:', error)
      alert('수정에 실패했습니다')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('정말 이 파트너를 삭제하시겠습니까?\n(상품/주문이 있으면 비활성화만 됩니다)')) return

    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/admin/partners/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await res.json()
      if (data.success) {
        alert(data.message)
        fetchPartners()
      } else {
        alert(data.error || '삭제 실패')
      }
    } catch (error) {
      console.error('삭제 실패:', error)
      alert('삭제에 실패했습니다')
    }
  }

  const filteredPartners = partners.filter(partner =>
    partner.storeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    partner.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    partner.user.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR')
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('role')
    router.push('/admin/login')
  }

  if (loading && partners.length === 0) {
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
              <h1 className="text-2xl font-bold text-gray-900">파트너 관리</h1>
              <p className="text-sm text-gray-500 mt-1">전체 {totalCount}개 파트너</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/admin/dashboard')}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                대시보드
              </button>
              <button
                onClick={() => router.push('/admin/orders')}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                주문관리
              </button>
              <button
                onClick={() => router.push('/admin/products')}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                상품관리
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 필터 및 검색 */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 상태 필터 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                상태
              </label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')
                  setCurrentPage(1)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">전체</option>
                <option value="active">활성</option>
                <option value="inactive">비활성</option>
              </select>
            </div>

            {/* 검색 */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                검색
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="스토어명, 담당자명, 이메일 검색..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
                >
                  초기화
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">총 파트너</h3>
            <p className="text-3xl font-bold text-blue-600 mt-2">{totalCount}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">활성 파트너</h3>
            <p className="text-3xl font-bold text-green-600 mt-2">
              {partners.filter(p => p.isActive).length}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">총 상품 수</h3>
            <p className="text-3xl font-bold text-purple-600 mt-2">
              {partners.reduce((sum, p) => sum + p._count.products, 0)}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">총 주문 수</h3>
            <p className="text-3xl font-bold text-orange-600 mt-2">
              {partners.reduce((sum, p) => sum + p._count.orders, 0)}
            </p>
          </div>
        </div>

        {/* 파트너 목록 테이블 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    스토어명
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    담당자
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상품/주문
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    총 매출
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    수수료율
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPartners.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      파트너가 없습니다
                    </td>
                  </tr>
                ) : (
                  filteredPartners.map((partner) => (
                    <tr key={partner.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{partner.storeName}</div>
                        <div className="text-sm text-gray-500">@{partner.slug}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{partner.user.name}</div>
                        <div className="text-sm text-gray-500">{partner.user.email}</div>
                        {partner.user.phone && (
                          <div className="text-sm text-gray-400">{partner.user.phone}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          상품: <span className="font-semibold">{partner._count.products}</span>
                        </div>
                        <div className="text-sm text-gray-500">
                          주문: <span className="font-semibold">{partner._count.orders}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-semibold text-gray-900">
                          {formatCurrency(partner.totalRevenue)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-semibold text-blue-600">
                          {partner.commissionRate}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleStatus(partner.id, partner.isActive)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            partner.isActive
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : 'bg-red-100 text-red-800 hover:bg-red-200'
                          } transition`}
                        >
                          {partner.isActive ? '활성' : '비활성'}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleViewDetail(partner)}
                            className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
                          >
                            상세
                          </button>
                          <button
                            onClick={() => handleEdit(partner)}
                            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                          >
                            수정
                          </button>
                          <button
                            onClick={() => handleDelete(partner.id)}
                            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition"
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
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  이전
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  다음
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">{currentPage}</span> / <span className="font-medium">{totalPages}</span> 페이지
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      이전
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      다음
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 상세 모달 */}
      {showDetailModal && selectedPartner && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-6">파트너 상세 정보</h2>
              
              <div className="space-y-4">
                {/* 기본 정보 */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-lg mb-3">기본 정보</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">스토어명:</span>
                      <span className="ml-2 font-medium">{selectedPartner.storeName}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">슬러그:</span>
                      <span className="ml-2 font-medium">@{selectedPartner.slug}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">사업자번호:</span>
                      <span className="ml-2 font-medium">{selectedPartner.businessNumber || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">계좌정보:</span>
                      <span className="ml-2 font-medium">{selectedPartner.bankAccount || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">수수료율:</span>
                      <span className="ml-2 font-semibold text-blue-600">{selectedPartner.commissionRate}%</span>
                    </div>
                    <div>
                      <span className="text-gray-500">가입일:</span>
                      <span className="ml-2 font-medium">{formatDate(selectedPartner.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* 담당자 정보 */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-lg mb-3">담당자 정보</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">이름:</span>
                      <span className="ml-2 font-medium">{selectedPartner.user.name}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">이메일:</span>
                      <span className="ml-2 font-medium">{selectedPartner.user.email}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">연락처:</span>
                      <span className="ml-2 font-medium">{selectedPartner.user.phone || '-'}</span>
                    </div>
                  </div>
                </div>

                {/* 통계 */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-lg mb-3">통계</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">등록 상품:</span>
                      <span className="ml-2 font-semibold text-purple-600">{selectedPartner._count.products}개</span>
                    </div>
                    <div>
                      <span className="text-gray-500">총 주문:</span>
                      <span className="ml-2 font-semibold text-orange-600">{selectedPartner._count.orders}건</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500">총 매출:</span>
                      <span className="ml-2 font-bold text-green-600 text-lg">
                        {formatCurrency(selectedPartner.totalRevenue)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 수정 모달 */}
      {showEditModal && selectedPartner && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-6">파트너 정보 수정</h2>
              <form onSubmit={handleSubmitEdit} className="space-y-4">
                {/* 스토어명 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    스토어명
                  </label>
                  <input
                    type="text"
                    value={editData.storeName}
                    onChange={(e) => setEditData({ ...editData, storeName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 수수료율 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    수수료율 (%)
                  </label>
                  <input
                    type="number"
                    value={editData.commissionRate}
                    onChange={(e) => setEditData({ ...editData, commissionRate: parseFloat(e.target.value) || 0 })}
                    step="0.1"
                    min="0"
                    max="100"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 사업자번호 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    사업자번호
                  </label>
                  <input
                    type="text"
                    value={editData.businessNumber}
                    onChange={(e) => setEditData({ ...editData, businessNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 계좌정보 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    계좌정보
                  </label>
                  <input
                    type="text"
                    value={editData.bankAccount}
                    onChange={(e) => setEditData({ ...editData, bankAccount: e.target.value })}
                    placeholder="은행명 계좌번호 예금주"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 버튼 */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
                  >
                    취소
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
