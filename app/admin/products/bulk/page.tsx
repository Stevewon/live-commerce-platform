'use client'

import { useAdminAuth } from '@/lib/hooks/useAdminAuth'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface UploadResult {
  row: number
  name: string
  status: 'success' | 'error' | 'skipped'
  message: string
  productId?: string
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

export default function BulkProductUploadPage() {
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
      const res = await fetch('/api/admin/products/bulk/template', {
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
      a.download = `QRLIVE_상품대량등록_템플릿_${new Date().toISOString().slice(0, 10)}.xlsx`
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
    if (!confirm(`"${selectedFile.name}" 파일의 상품을 대량 등록하시겠습니까?`)) return

    setUploading(true)
    setResponse(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const res = await fetch('/api/admin/products/bulk/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      const data: UploadResponse = await res.json()
      setResponse(data)

      if (data.success && data.data) {
        if (data.data.errorCount === 0 && data.data.skipCount === 0) {
          // 모두 성공
        }
      }
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
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">상품 대량등록</h1>
              <p className="text-sm text-gray-500 mt-1">엑셀 파일로 여러 상품을 한 번에 등록합니다</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/admin/products')}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition text-sm"
              >
                상품 목록
              </button>
              <button
                onClick={() => router.push('/admin/dashboard')}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition text-sm"
              >
                대시보드
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* STEP 1: 템플릿 다운로드 */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-lg">
              1
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">엑셀 템플릿 다운로드</h2>
              <p className="text-sm text-gray-600 mb-4">
                아래 버튼을 클릭하여 대량등록용 엑셀 템플릿을 다운로드하세요.<br />
                템플릿에는 <strong>상품입력 시트</strong>, <strong>카테고리 목록 시트</strong>, <strong>입력 가이드 시트</strong>가 포함되어 있습니다.
              </p>
              <button
                onClick={handleDownloadTemplate}
                disabled={downloadingTemplate}
                className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium text-sm flex items-center gap-2 disabled:opacity-50"
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
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    엑셀 템플릿 다운로드
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* STEP 2: 파일 업로드 */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-lg">
              2
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">엑셀 파일 업로드</h2>
              <p className="text-sm text-gray-600 mb-4">
                작성한 엑셀 파일(.xlsx)을 선택한 후 업로드 버튼을 클릭하세요.
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
                    className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        업로드 및 등록
                      </>
                    )}
                  </button>
                  {(selectedFile || response) && (
                    <button
                      onClick={handleReset}
                      className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm"
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
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-amber-800 mb-2">안내사항</h3>
            <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
              <li>엑셀 첫 번째 행(헤더)은 삭제하지 마세요.</li>
              <li>카테고리명은 "카테고리목록" 시트의 이름과 <strong>정확히</strong> 일치해야 합니다.</li>
              <li>판매가, 재고수량은 필수 입력입니다. 숫자만 입력하세요.</li>
              <li>이미지 URL은 사전에 업로드된 이미지의 URL을 입력하세요.</li>
              <li>SKU가 기존 상품과 중복되면 해당 행은 자동으로 건너뜁니다.</li>
              <li>한 번에 최대 500개 상품까지 등록 가능합니다.</li>
              <li>파일 크기는 10MB 이하여야 합니다.</li>
            </ul>
          </div>
        )}

        {/* STEP 3: 결과 */}
        {response && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-lg">
                3
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">등록 결과</h2>

                {/* 요약 */}
                {response.success && response.data ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">전체</p>
                      <p className="text-2xl font-bold text-gray-900">{response.data.totalRows}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-green-600">성공</p>
                      <p className="text-2xl font-bold text-green-700">{response.data.successCount}</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-red-600">실패</p>
                      <p className="text-2xl font-bold text-red-700">{response.data.errorCount}</p>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-yellow-600">건너뜀</p>
                      <p className="text-2xl font-bold text-yellow-700">{response.data.skipCount}</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-red-700 font-medium">{response.error || response.message}</p>
                  </div>
                )}

                {/* 상세 결과 테이블 */}
                {response.data && response.data.results.length > 0 && (
                  <>
                    {/* 필터 탭 */}
                    <div className="flex gap-1 mb-3 border-b">
                      {[
                        { key: 'all', label: '전체', count: response.data.results.length },
                        { key: 'success', label: '성공', count: response.data.successCount },
                        { key: 'error', label: '실패', count: response.data.errorCount },
                        { key: 'skipped', label: '건너뜀', count: response.data.skipCount },
                      ].map((tab) => (
                        <button
                          key={tab.key}
                          onClick={() => setFilterStatus(tab.key as any)}
                          className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition ${
                            filterStatus === tab.key
                              ? 'border-blue-600 text-blue-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          {tab.label} ({tab.count})
                        </button>
                      ))}
                    </div>

                    <div className="overflow-x-auto max-h-96 overflow-y-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">행</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">상품명</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">상태</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">메시지</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredResults.map((r, idx) => (
                            <tr key={idx} className={`${
                              r.status === 'error' ? 'bg-red-50' :
                              r.status === 'skipped' ? 'bg-yellow-50' : ''
                            }`}>
                              <td className="px-3 py-2 text-gray-600">{r.row}</td>
                              <td className="px-3 py-2 font-medium text-gray-900 max-w-[200px] truncate">{r.name}</td>
                              <td className="px-3 py-2">
                                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                                  r.status === 'success' ? 'bg-green-100 text-green-800' :
                                  r.status === 'error' ? 'bg-red-100 text-red-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {r.status === 'success' ? '성공' : r.status === 'error' ? '실패' : '건너뜀'}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-gray-600 text-xs">{r.message}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {/* 액션 버튼 */}
                <div className="flex gap-3 mt-5 pt-4 border-t">
                  <Link
                    href="/admin/products"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                  >
                    상품 목록 확인
                  </Link>
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm"
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
