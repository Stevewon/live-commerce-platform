'use client'

import { useAdminAuth } from '@/lib/hooks/useAdminAuth'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface UploadResult {
  row: number
  orderNumber: string
  status: 'success' | 'error' | 'skipped'
  message: string
}

interface UploadResponse {
  success: boolean
  message: string
  error?: string
  data?: {
    totalRows: number
    successCount: number
    errorCount: number
    skipCount: number
    results: UploadResult[]
  }
}

export default function BulkInvoiceUploadPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAdminAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)
  const [response, setResponse] = useState<UploadResponse | null>(null)
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'error' | 'skipped'>('all')

  // 템플릿 다운로드
  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true)
    try {
      const res = await fetch('/api/admin/orders/bulk/template', {
        credentials: 'include',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        alert(err?.error || '템플릿 다운로드에 실패했습니다')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `QRLIVE_송장대량등록_템플릿_${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('템플릿 다운로드 실패:', error)
      alert('템플릿 다운로드에 실패했습니다')
    } finally {
      setDownloadingTemplate(false)
    }
  }

  // 파일 선택
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    if (file) {
      const name = file.name.toLowerCase()
      if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
        alert('.xlsx 또는 .xls 파일만 업로드 가능합니다')
        e.target.value = ''
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        alert('파일 크기는 10MB 이하여야 합니다')
        e.target.value = ''
        return
      }
    }
    setSelectedFile(file)
    setResponse(null)
  }

  // 업로드
  const handleUpload = async () => {
    if (!selectedFile) {
      alert('파일을 선택해주세요')
      return
    }
    if (!confirm(`"${selectedFile.name}" 파일의 송장을 대량 등록하시겠습니까?\n\n등록된 주문은 자동으로 "배송중" 상태로 변경됩니다.`)) return

    setUploading(true)
    setResponse(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const res = await fetch('/api/admin/orders/bulk/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      const data: UploadResponse = await res.json()
      setResponse(data)
    } catch (error) {
      console.error('업로드 실패:', error)
      setResponse({
        success: false,
        message: '업로드 처리 중 오류가 발생했습니다',
        error: String(error),
      })
    } finally {
      setUploading(false)
    }
  }

  // 초기화
  const handleReset = () => {
    setSelectedFile(null)
    setResponse(null)
    setFilterStatus('all')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // 결과 필터링
  const filteredResults = response?.data?.results?.filter((r) => {
    if (filterStatus === 'all') return true
    return r.status === filterStatus
  }) || []

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-200 border-t-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-bold text-lg">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 shadow-2xl border-b-4 border-blue-500">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 flex items-center justify-center shadow-2xl">
                <span className="text-2xl">🚚</span>
              </div>
              <div>
                <h1 className="text-3xl font-black text-white">송장 대량등록</h1>
                <p className="text-blue-200 text-sm font-medium mt-1">엑셀 파일로 운송장을 한 번에 등록합니다</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/admin/orders')}
                className="px-5 py-2.5 bg-white/10 backdrop-blur text-white border border-white/20 rounded-xl hover:bg-white/20 transition font-bold text-sm"
              >
                주문 관리
              </button>
              <button
                onClick={() => router.push('/admin/dashboard')}
                className="px-5 py-2.5 bg-white/10 backdrop-blur text-white border border-white/20 rounded-xl hover:bg-white/20 transition font-bold text-sm"
              >
                대시보드
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* STEP 1: 템플릿 다운로드 */}
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-200">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl flex items-center justify-center font-black text-xl shadow-lg">
              1
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-black text-gray-900 mb-2">송장 등록 템플릿 다운로드</h2>
              <p className="text-sm text-gray-600 mb-1">
                아래 버튼을 클릭하면 <strong>송장 미등록 주문 목록</strong>이 미리 채워진 엑셀 템플릿이 다운로드됩니다.
              </p>
              <p className="text-sm text-gray-500 mb-4">
                주문번호, 수령인, 배송지 등이 자동으로 입력되어 있으며, <strong>택배사</strong>와 <strong>운송장번호</strong>만 입력하시면 됩니다.
              </p>
              <button
                onClick={handleDownloadTemplate}
                disabled={downloadingTemplate}
                className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition font-bold text-sm flex items-center gap-2 disabled:opacity-50 shadow-lg hover:scale-105"
              >
                {downloadingTemplate ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    다운로드 중...
                  </>
                ) : (
                  <>
                    <span className="text-lg">📥</span>
                    송장 템플릿 다운로드
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* STEP 2: 파일 업로드 */}
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-200">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl flex items-center justify-center font-black text-xl shadow-lg">
              2
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-black text-gray-900 mb-2">엑셀 파일 업로드</h2>
              <p className="text-sm text-gray-600 mb-4">
                택배사와 운송장번호를 입력한 엑셀 파일(.xlsx)을 선택한 후 업로드 버튼을 클릭하세요.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                <div className="flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2.5 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-semibold
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100
                      cursor-pointer"
                  />
                  {selectedFile && (
                    <p className="mt-2 text-xs text-gray-500">
                      선택된 파일: <span className="font-medium text-gray-700">{selectedFile.name}</span>{' '}
                      ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleUpload}
                    disabled={!selectedFile || uploading}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition font-bold text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:scale-105"
                  >
                    {uploading ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                        </svg>
                        업로드 처리 중...
                      </>
                    ) : (
                      <>
                        <span className="text-lg">🚚</span>
                        송장 일괄 등록
                      </>
                    )}
                  </button>
                  {(selectedFile || response) && (
                    <button
                      onClick={handleReset}
                      className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition text-sm font-bold"
                    >
                      초기화
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 안내사항 */}
        {!response && (
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-5">
            <h3 className="text-sm font-black text-amber-800 mb-3 flex items-center gap-2">
              <span className="text-lg">&#9888;&#65039;</span> 안내사항
            </h3>
            <ul className="text-sm text-amber-700 space-y-1.5 list-disc list-inside">
              <li>엑셀 첫 번째 행(헤더)은 삭제하지 마세요.</li>
              <li><strong>주문번호</strong>, <strong>택배사</strong>, <strong>운송장번호</strong> 3개 필드만 필수입니다.</li>
              <li>&quot;(참고)&quot; 컬럼(수령인, 배송지 등)은 확인용이며, 업로드 시 무시됩니다.</li>
              <li>송장 등록 시 주문 상태가 자동으로 <strong>&quot;배송중&quot;</strong>으로 변경됩니다.</li>
              <li>취소/환불된 주문이나 배송완료 주문은 자동으로 건너뜁니다.</li>
              <li>이미 송장이 등록된 주문은 새 송장 정보로 덮어쓰기됩니다.</li>
              <li>한 번에 최대 <strong>1,000건</strong>까지 처리 가능합니다.</li>
            </ul>
          </div>
        )}

        {/* STEP 3: 결과 */}
        {response && (
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-200">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl flex items-center justify-center font-black text-xl shadow-lg">
                3
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-black text-gray-900 mb-3">등록 결과</h2>

                {/* 요약 */}
                {response.success && response.data ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                    <div className="bg-gradient-to-br from-gray-50 to-slate-100 rounded-xl p-4 text-center border border-gray-200">
                      <p className="text-xs text-gray-500 font-bold">전체</p>
                      <p className="text-3xl font-black text-gray-900">{response.data.totalRows}</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl p-4 text-center border border-green-200">
                      <p className="text-xs text-green-600 font-bold">성공</p>
                      <p className="text-3xl font-black text-green-700">{response.data.successCount}</p>
                    </div>
                    <div className="bg-gradient-to-br from-red-50 to-rose-100 rounded-xl p-4 text-center border border-red-200">
                      <p className="text-xs text-red-600 font-bold">실패</p>
                      <p className="text-3xl font-black text-red-700">{response.data.errorCount}</p>
                    </div>
                    <div className="bg-gradient-to-br from-yellow-50 to-amber-100 rounded-xl p-4 text-center border border-yellow-200">
                      <p className="text-xs text-yellow-600 font-bold">건너뜀</p>
                      <p className="text-3xl font-black text-yellow-700">{response.data.skipCount}</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-4">
                    <p className="text-sm text-red-700 font-bold">{response.error || response.message}</p>
                  </div>
                )}

                {/* 상세 결과 테이블 */}
                {response.data && response.data.results.length > 0 && (
                  <>
                    {/* 필터 탭 */}
                    <div className="flex gap-1 mb-3 border-b border-gray-200">
                      {[
                        { key: 'all', label: '전체', count: response.data.results.length },
                        { key: 'success', label: '성공', count: response.data.successCount },
                        { key: 'error', label: '실패', count: response.data.errorCount },
                        { key: 'skipped', label: '건너뜀', count: response.data.skipCount },
                      ].map((tab) => (
                        <button
                          key={tab.key}
                          onClick={() => setFilterStatus(tab.key as any)}
                          className={`px-4 py-2.5 text-xs font-black border-b-3 -mb-px transition ${
                            filterStatus === tab.key
                              ? 'border-blue-600 text-blue-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          {tab.label} ({tab.count})
                        </button>
                      ))}
                    </div>

                    <div className="overflow-x-auto max-h-96 overflow-y-auto rounded-xl border border-gray-200">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gradient-to-r from-gray-50 to-blue-50 sticky top-0">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-black text-gray-500">행</th>
                            <th className="px-4 py-3 text-left text-xs font-black text-gray-500">주문번호</th>
                            <th className="px-4 py-3 text-left text-xs font-black text-gray-500">상태</th>
                            <th className="px-4 py-3 text-left text-xs font-black text-gray-500">메시지</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredResults.map((r, idx) => (
                            <tr key={idx} className={`${
                              r.status === 'error' ? 'bg-red-50' :
                              r.status === 'skipped' ? 'bg-yellow-50' :
                              'hover:bg-gray-50'
                            }`}>
                              <td className="px-4 py-2.5 text-gray-600 font-medium">{r.row}</td>
                              <td className="px-4 py-2.5 font-mono font-bold text-gray-900">{r.orderNumber}</td>
                              <td className="px-4 py-2.5">
                                <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-black ${
                                  r.status === 'success' ? 'bg-green-100 text-green-800' :
                                  r.status === 'error' ? 'bg-red-100 text-red-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {r.status === 'success' ? '성공' : r.status === 'error' ? '실패' : '건너뜀'}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-gray-600 text-xs">{r.message}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {/* 액션 버튼 */}
                <div className="flex gap-3 mt-5 pt-4 border-t border-gray-200">
                  <Link
                    href="/admin/orders"
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition text-sm font-bold shadow-lg"
                  >
                    주문 목록 확인
                  </Link>
                  <button
                    onClick={handleReset}
                    className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition text-sm font-bold"
                  >
                    추가 업로드
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
