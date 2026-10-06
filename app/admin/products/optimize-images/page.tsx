'use client'
import { useAdminAuth } from '@/lib/hooks/useAdminAuth'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { authFetch } from '@/lib/auth/clientFetch'
import { resizeImageToWebP, fetchUrlAsFile } from '@/lib/utils/imageResize'

interface ProductImages {
  id: string
  name: string
  thumbnail: string
  images: string[]
  detailImages: string[]
}

interface ProductStatus {
  id: string
  name: string
  total: number       // 최적화 대상 이미지 개수
  done: number        // 처리 완료 개수
  state: 'pending' | 'processing' | 'done' | 'skipped' | 'error'
  savedBytes: number  // 절감 용량 (근사)
  message?: string
}

// data URL(base64 저장분) 또는 .webp 가 아닌 http(s)/상대경로 이미지가 최적화 대상.
// 이미 .webp 인 URL 은 재변환하지 않는다.
function needsOptimize(url: string): boolean {
  if (!url) return false
  if (url.startsWith('data:image/')) return true // base64 저장분 → R2 로 옮기며 최적화
  const clean = url.split('?')[0].toLowerCase()
  if (clean.endsWith('.webp')) return false
  return url.startsWith('/api/images/') || url.startsWith('http') || url.startsWith('/')
}

export default function OptimizeImagesPage() {
  const { user, loading: authLoading } = useAdminAuth()
  const [products, setProducts] = useState<ProductImages[]>([])
  const [statuses, setStatuses] = useState<Record<string, ProductStatus>>({})
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const [runningId, setRunningId] = useState<string | null>(null) // 개별 최적화 중인 상품
  const stopRef = useRef(false)

  useEffect(() => {
    if (user && user.role === 'ADMIN') load()
  }, [user])

  const load = async () => {
    setLoading(true)
    try {
      const res = await authFetch('/api/admin/products/optimize-images')
      const data = await res.json()
      if (data.success) {
        setProducts(data.data)
        // 초기 상태 계산
        const init: Record<string, ProductStatus> = {}
        for (const p of data.data as ProductImages[]) {
          const all = [p.thumbnail, ...p.images, ...p.detailImages].filter(Boolean)
          const targets = all.filter(needsOptimize)
          init[p.id] = {
            id: p.id,
            name: p.name,
            total: targets.length,
            done: 0,
            state: targets.length === 0 ? 'skipped' : 'pending',
            savedBytes: 0,
          }
        }
        setStatuses(init)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // 단일 이미지 URL 최적화: fetch → resize+webp → upload → 새 URL 반환 (+절감 바이트)
  const optimizeOne = async (
    url: string,
    isThumb: boolean,
  ): Promise<{ url: string; saved: number } | null> => {
    const file = await fetchUrlAsFile(url, 'img')
    if (!file) return null
    const originalSize = file.size
    const resized = await resizeImageToWebP(file, { maxWidth: isThumb ? 400 : 800, quality: 0.8 })
    // 변환 후에도 크기가 거의 그대로면(이미 작음) 업로드 스킵하고 원본 유지
    if (resized === file || resized.size >= originalSize) {
      // 그래도 data:URL 이면 R2 로 옮겨야 하므로 업로드 진행
      if (!url.startsWith('data:')) return { url, saved: 0 }
    }
    const fd = new FormData()
    fd.append('file', resized)
    const res = await authFetch('/api/upload/image', { method: 'POST', body: fd })
    const data = await res.json()
    const newUrl = data?.data?.url || data?.url
    if (!data.success || !newUrl) return null
    return { url: newUrl, saved: Math.max(0, originalSize - resized.size) }
  }

  // 상품 1개 최적화 (썸네일 → 갤러리 → 상세 → PATCH 저장)
  // 중지 시에도 이미지 목록이 잘리지 않도록 남은 이미지는 원본 URL 그대로 유지
  const optimizeProduct = async (p: ProductImages) => {
    setStatuses(prev => ({ ...prev, [p.id]: { ...prev[p.id], state: 'processing', done: 0, message: undefined } }))

    try {
      let saved = 0
      let done = 0
      const bump = () => {
        done++
        setStatuses(prev => ({ ...prev, [p.id]: { ...prev[p.id], done, savedBytes: saved } }))
      }

      // 썸네일
      let newThumb = p.thumbnail
      if (needsOptimize(p.thumbnail)) {
        const r = await optimizeOne(p.thumbnail, true)
        if (r) { newThumb = r.url; saved += r.saved }
        bump()
      }

      // 갤러리 / 상세 이미지
      const optimizeList = async (list: string[]) => {
        const out: string[] = []
        for (const img of list) {
          if (!stopRef.current && needsOptimize(img)) {
            const r = await optimizeOne(img, false)
            out.push(r ? r.url : img)
            if (r) saved += r.saved
            bump()
          } else {
            out.push(img)
          }
        }
        return out
      }
      const newImages = await optimizeList(p.images)
      const newDetail = await optimizeList(p.detailImages)

      // 상품 저장 (PATCH)
      const patchBody: any = { thumbnail: newThumb, images: newImages }
      if (p.detailImages.length > 0) patchBody.detailImages = newDetail
      await authFetch(`/api/admin/products/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody),
      })

      // 같은 화면에서 다시 눌러도 바뀐 URL 기준으로 동작하도록 로컬 데이터 갱신
      setProducts(prev => prev.map(x => x.id === p.id ? { ...x, thumbnail: newThumb, images: newImages, detailImages: newDetail } : x))
      setStatuses(prev => ({ ...prev, [p.id]: { ...prev[p.id], state: 'done', done: prev[p.id].total, savedBytes: saved } }))
    } catch (e: any) {
      setStatuses(prev => ({ ...prev, [p.id]: { ...prev[p.id], state: 'error', message: e?.message || '실패' } }))
    }
  }

  const runAll = async () => {
    setRunning(true)
    setFinished(false)
    stopRef.current = false

    for (const p of products) {
      if (stopRef.current) break
      const st = statuses[p.id]
      if (!st || st.total === 0) continue
      await optimizeProduct(p)
    }

    setRunning(false)
    setFinished(true)
  }

  // 개별 상품만 최적화
  const runOne = async (id: string) => {
    const p = products.find(x => x.id === id)
    if (!p) return
    setRunning(true)
    setRunningId(id)
    stopRef.current = false
    await optimizeProduct(p)
    setRunningId(null)
    setRunning(false)
  }

  const stop = () => { stopRef.current = true }

  if (authLoading || (loading && !products.length)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
      </div>
    )
  }

  const list = Object.values(statuses)
  const totalTargets = list.reduce((s, x) => s + x.total, 0)
  const totalProductsToDo = list.filter(x => x.total > 0).length
  const doneProducts = list.filter(x => x.state === 'done').length
  const totalSaved = list.reduce((s, x) => s + x.savedBytes, 0)
  const fmtKB = (b: number) => `${(b / 1024).toFixed(0)}KB`

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/admin/products" className="text-sm text-gray-500 hover:text-gray-700">← 상품 목록</Link>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">기존 이미지 최적화</h1>
            <p className="text-sm text-gray-500 mt-1">
              이미 등록된 상품 이미지를 리사이즈 + WebP로 다시 저장합니다. (썸네일 400px / 갤러리·상세 800px)
            </p>
          </div>
        </div>

        {/* 요약 */}
        <div className="bg-white rounded-lg shadow p-5 mb-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-xs text-gray-500">최적화 대상 상품</p>
            <p className="text-xl font-bold text-gray-900">{totalProductsToDo}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">대상 이미지</p>
            <p className="text-xl font-bold text-gray-900">{totalTargets}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">완료 상품</p>
            <p className="text-xl font-bold text-purple-600">{doneProducts}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">절감 용량</p>
            <p className="text-xl font-bold text-green-600">{fmtKB(totalSaved)}</p>
          </div>
        </div>

        {/* 컨트롤 */}
        <div className="flex flex-wrap gap-3 mb-6">
          {!running ? (
            <button
              onClick={runAll}
              disabled={totalProductsToDo === 0}
              className="px-5 py-2.5 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {finished ? '전체 다시 실행' : '전체 최적화'}
            </button>
          ) : (
            <button onClick={stop} disabled={!!runningId} className="px-5 py-2.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700">
              중지
            </button>
          )}
          <button onClick={load} disabled={running} className="px-5 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            새로고침
          </button>
        </div>

        {totalProductsToDo === 0 && !running && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-4 text-sm">
            ✅ 최적화가 필요한 이미지가 없습니다. (모두 WebP이거나 이미지가 없습니다)
          </div>
        )}

        {/* 진행 목록 */}
        <div className="bg-white rounded-lg shadow divide-y">
          {list.filter(x => x.total > 0).map(st => (
            <div key={st.id} className="flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-2 p-4">
              <div className="flex-1 min-w-0 basis-full sm:basis-auto">
                <p className="text-sm font-medium text-gray-900 truncate">{st.name}</p>
                <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${st.state === 'error' ? 'bg-red-500' : st.state === 'done' ? 'bg-green-500' : 'bg-purple-500'}`}
                    style={{ width: `${st.total ? Math.round((st.done / st.total) * 100) : 0}%` }}
                  />
                </div>
              </div>
              <div className="flex-1 sm:flex-none text-left sm:text-right sm:w-28 min-w-0">
                <p className="text-xs text-gray-500">{st.done}/{st.total} 이미지</p>
                <p className={`text-xs font-semibold truncate ${
                  st.state === 'done' ? 'text-green-600'
                  : st.state === 'error' ? 'text-red-600'
                  : st.state === 'processing' ? 'text-purple-600'
                  : 'text-gray-400'
                }`}>
                  {st.state === 'done' ? `완료 (-${fmtKB(st.savedBytes)})`
                    : st.state === 'error' ? (st.message || '오류')
                    : st.state === 'processing' ? '처리중…'
                    : '대기'}
                </p>
              </div>
              <button
                onClick={() => runOne(st.id)}
                disabled={running}
                className="flex-shrink-0 min-h-[40px] px-4 py-2 text-sm font-semibold rounded-lg border border-purple-600 text-purple-600 hover:bg-purple-50 active:bg-purple-100 disabled:border-gray-300 disabled:text-gray-400 disabled:bg-transparent disabled:cursor-not-allowed"
              >
                {runningId === st.id ? '처리중…' : st.state === 'done' ? '다시' : '최적화'}
              </button>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400 mt-4">
          ※ 이 작업은 브라우저에서 이미지를 내려받아 변환 후 다시 업로드합니다. 창을 닫으면 중단되니 완료까지 열어두세요.
          이미 WebP인 이미지는 자동으로 건너뜁니다.
        </p>
      </div>
    </div>
  )
}
