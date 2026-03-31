'use client'

import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const RichEditor = lazy(() => import('@/components/admin/RichEditor'))

interface Category {
  id: string
  name: string
  slug: string
  parentId?: string | null
  children?: Category[]
}

interface VariantData {
  id?: string
  optionValues: Record<string, string>
  price: number | string
  comparePrice: number | string
  stock: number | string
  sku: string
  thumbnail: string
  isActive: boolean
}

interface ProductFormData {
  name: string
  slug: string
  description: string
  detailContent: string
  price: number | string
  comparePrice: number | string
  stock: number | string
  sku: string
  thumbnail: string
  images: string[]
  detailImages: string[]
  specifications: { key: string; value: string }[]
  shippingInfo: string
  returnInfo: string
  categoryId: string
  isActive: boolean
  isFeatured: boolean
  // 새 필드
  origin: string
  manufacturer: string
  brand: string
  tags: string
  // 옵션 시스템
  hasOptions: boolean
  optionNames: string[]
  variants: VariantData[]
}

interface Props {
  mode: 'create' | 'edit'
  initialData?: Partial<ProductFormData> & { id?: string }
}

const defaultShippingInfo = `• 배송방법: 택배배송
• 배송비: 3,000원 (50,000원 이상 구매 시 무료배송)
• 배송기간: 결제 확인 후 1~3일 이내 출고 (주말/공휴일 제외)
• 도서산간 지역: 추가 배송비 발생 가능`

const defaultReturnInfo = `• 교환/반품 기간: 상품 수령 후 7일 이내
• 교환/반품 배송비: 고객 변심 시 왕복 6,000원 / 상품 불량 시 무료
• 교환/반품 불가: 포장 훼손, 사용 흔적, 세탁한 경우
• 교환/반품 접수: 고객센터 또는 마이페이지에서 접수`

export default function ProductForm({ mode, initialData }: Props) {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [activeTab, setActiveTab] = useState<'basic' | 'detail' | 'images' | 'shipping' | 'seo' | 'options'>('basic')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadingDetail, setUploadingDetail] = useState(false)
  const thumbnailRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const detailImgRef = useRef<HTMLInputElement>(null)

  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [dragType, setDragType] = useState<'images' | 'detailImages' | null>(null)
  const dragStartIndex = useRef<number | null>(null)

  const [form, setForm] = useState<ProductFormData>({
    name: '',
    slug: '',
    description: '',
    detailContent: '',
    price: '',
    comparePrice: '',
    stock: '',
    sku: '',
    thumbnail: '',
    images: [],
    detailImages: [],
    specifications: [{ key: '', value: '' }],
    shippingInfo: defaultShippingInfo,
    returnInfo: defaultReturnInfo,
    categoryId: '',
    isActive: true,
    isFeatured: false,
    origin: '',
    manufacturer: '',
    brand: '',
    tags: '',
    hasOptions: false,
    optionNames: [],
    variants: [],
  })

  // Load categories
  useEffect(() => {
    fetchCategories()
  }, [])

  // Fill form with initial data (edit mode)
  useEffect(() => {
    if (initialData && mode === 'edit') {
      const specs = initialData.specifications
        ? (typeof initialData.specifications === 'string'
            ? JSON.parse(initialData.specifications as string)
            : initialData.specifications)
        : [{ key: '', value: '' }]
      
      const parsedImages = initialData.images
        ? (typeof initialData.images === 'string' ? JSON.parse(initialData.images as string) : initialData.images)
        : []
      
      const parsedDetailImages = initialData.detailImages
        ? (typeof initialData.detailImages === 'string' ? JSON.parse(initialData.detailImages as string) : initialData.detailImages)
        : []

      setForm({
        name: initialData.name || '',
        slug: initialData.slug || '',
        description: initialData.description || '',
        detailContent: initialData.detailContent || '',
        price: initialData.price || '',
        comparePrice: initialData.comparePrice || '',
        stock: initialData.stock ?? '',
        sku: initialData.sku || '',
        thumbnail: initialData.thumbnail || '',
        images: parsedImages.filter(Boolean),
        detailImages: parsedDetailImages.filter(Boolean),
        specifications: Array.isArray(specs) && specs.length > 0 ? specs : [{ key: '', value: '' }],
        shippingInfo: initialData.shippingInfo || defaultShippingInfo,
        returnInfo: initialData.returnInfo || defaultReturnInfo,
        categoryId: initialData.categoryId || '',
        isActive: initialData.isActive ?? true,
        isFeatured: initialData.isFeatured ?? false,
        origin: (initialData as any).origin || '',
        manufacturer: (initialData as any).manufacturer || '',
        brand: (initialData as any).brand || '',
        tags: (initialData as any).tags || '',
        hasOptions: (initialData as any).hasOptions ?? false,
        optionNames: (() => {
          try {
            const names = (initialData as any).optionNames
            if (!names) return []
            return typeof names === 'string' ? JSON.parse(names) : names
          } catch { return [] }
        })(),
        variants: (() => {
          try {
            const v = (initialData as any).variants
            if (!v || !Array.isArray(v)) return []
            return v.map((vr: any) => ({
              id: vr.id,
              optionValues: typeof vr.optionValues === 'string' ? JSON.parse(vr.optionValues) : vr.optionValues,
              price: vr.price ?? '',
              comparePrice: vr.comparePrice ?? '',
              stock: vr.stock ?? 0,
              sku: vr.sku || '',
              thumbnail: vr.thumbnail || '',
              isActive: vr.isActive ?? true,
            }))
          } catch { return [] }
        })(),
      })
    }
  }, [initialData, mode])

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories')
      const data = await res.json()
      if (data.success) {
        setCategories(data.data || [])
      }
    } catch (err) {
      console.error('카테고리 로드 실패:', err)
    }
  }

  // Auto-generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9가-힣\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  const handleNameChange = (name: string) => {
    setForm(prev => ({
      ...prev,
      name,
      slug: mode === 'create' ? generateSlug(name) + '-' + Date.now().toString(36) : prev.slug
    }))
  }

  // Image upload helper
  const uploadImage = async (file: File): Promise<string | null> => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setError('지원하지 않는 파일 형식입니다. (JPG, PNG, GIF, WEBP만 가능)')
      return null
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('파일 크기는 5MB 이하여야 합니다.')
      return null
    }

    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('/api/upload/image', {
      method: 'POST',
      credentials: 'include',
      body: formData
    })
    const data = await res.json()
    if (data.success) {
      return data.data?.url || data.url
    }
    setError(data.error || '이미지 업로드 실패')
    return null
  }

  // Thumbnail upload
  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImage(true)
    setError('')
    const url = await uploadImage(file)
    if (url) {
      setForm(prev => ({ ...prev, thumbnail: url }))
    }
    setUploadingImage(false)
  }

  // Gallery images upload (multiple)
  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    setUploadingImage(true)
    setError('')
    const urls: string[] = []
    for (const file of Array.from(files)) {
      const url = await uploadImage(file)
      if (url) urls.push(url)
    }
    setForm(prev => ({ ...prev, images: [...prev.images, ...urls] }))
    setUploadingImage(false)
    if (galleryRef.current) galleryRef.current.value = ''
  }

  // Detail images upload
  const handleDetailImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    setUploadingDetail(true)
    setError('')
    const urls: string[] = []
    for (const file of Array.from(files)) {
      const url = await uploadImage(file)
      if (url) urls.push(url)
    }
    setForm(prev => ({ ...prev, detailImages: [...prev.detailImages, ...urls] }))
    setUploadingDetail(false)
    if (detailImgRef.current) detailImgRef.current.value = ''
  }

  const removeImage = (index: number, type: 'images' | 'detailImages') => {
    setForm(prev => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index)
    }))
  }

  // Drag and drop for image reordering
  const handleDragStart = (index: number, type: 'images' | 'detailImages') => {
    dragStartIndex.current = index
    setDragType(type)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDragOverIndex(index)
  }

  const handleDragEnd = () => {
    if (dragStartIndex.current === null || dragOverIndex === null || !dragType) {
      setDragOverIndex(null)
      setDragType(null)
      dragStartIndex.current = null
      return
    }
    const startIdx = dragStartIndex.current
    const endIdx = dragOverIndex
    if (startIdx !== endIdx) {
      setForm(prev => {
        const items = [...prev[dragType]]
        const [moved] = items.splice(startIdx, 1)
        items.splice(endIdx, 0, moved)
        return { ...prev, [dragType]: items }
      })
    }
    setDragOverIndex(null)
    setDragType(null)
    dragStartIndex.current = null
  }

  // Specifications
  const addSpec = () => {
    setForm(prev => ({
      ...prev,
      specifications: [...prev.specifications, { key: '', value: '' }]
    }))
  }

  const removeSpec = (index: number) => {
    setForm(prev => ({
      ...prev,
      specifications: prev.specifications.filter((_, i) => i !== index)
    }))
  }

  const updateSpec = (index: number, field: 'key' | 'value', value: string) => {
    setForm(prev => ({
      ...prev,
      specifications: prev.specifications.map((s, i) =>
        i === index ? { ...s, [field]: value } : s
      )
    }))
  }

  // Form validation
  const validateForm = (): string | null => {
    if (!form.name.trim()) return '상품명을 입력해주세요.'
    if (!form.categoryId) return '카테고리를 선택해주세요.'
    if (!form.price || Number(form.price) <= 0) return '판매가를 입력해주세요.'
    if (form.comparePrice && Number(form.comparePrice) <= Number(form.price)) {
      return '정가는 판매가보다 높아야 합니다.'
    }
    if (!form.description.trim()) return '상품 간단 설명을 입력해주세요.'
    if (form.stock === '' || Number(form.stock) < 0) return '재고 수량을 입력해주세요.'
    return null
  }

  // Submit
  const handleSubmit = async () => {
    setError('')
    setSuccess('')

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)

    try {
      const specs = form.specifications.filter(s => s.key.trim() && s.value.trim())

      const payload: any = {
        name: form.name.trim(),
        slug: form.slug || generateSlug(form.name) + '-' + Date.now().toString(36),
        description: form.description.trim(),
        detailContent: form.detailContent || null,
        price: Number(form.price),
        comparePrice: form.comparePrice ? Number(form.comparePrice) : null,
        stock: Number(form.stock),
        sku: form.sku.trim() || null,
        thumbnail: form.thumbnail || form.images[0] || '',
        images: JSON.stringify(form.images.length > 0 ? form.images : [form.thumbnail].filter(Boolean)),
        detailImages: form.detailImages.length > 0 ? JSON.stringify(form.detailImages) : null,
        specifications: specs.length > 0 ? JSON.stringify(specs) : null,
        shippingInfo: form.shippingInfo.trim() || null,
        returnInfo: form.returnInfo.trim() || null,
        categoryId: form.categoryId,
        isActive: form.isActive,
        isFeatured: form.isFeatured,
        origin: form.origin.trim() || null,
        manufacturer: form.manufacturer.trim() || null,
        brand: form.brand.trim() || null,
        tags: form.tags.trim() || null,
        hasOptions: form.hasOptions,
        optionNames: form.hasOptions && form.optionNames.length > 0 ? JSON.stringify(form.optionNames.filter(n => n.trim())) : null,
        variants: form.hasOptions ? form.variants.map(v => ({
          id: v.id || undefined,
          optionValues: JSON.stringify(v.optionValues),
          price: v.price ? Number(v.price) : null,
          comparePrice: v.comparePrice ? Number(v.comparePrice) : null,
          stock: Number(v.stock) || 0,
          sku: v.sku.trim() || null,
          thumbnail: v.thumbnail || null,
          isActive: v.isActive,
        })) : [],
      }

      const url = mode === 'edit' && initialData?.id
        ? `/api/admin/products/${initialData.id}`
        : '/api/admin/products'

      const res = await fetch(url, {
        method: mode === 'edit' ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (data.success) {
        setSuccess(mode === 'create' ? '상품이 등록되었습니다!' : '상품이 수정되었습니다!')
        if (mode === 'create') {
          setTimeout(() => router.push('/admin/products'), 1500)
        }
      } else {
        setError(data.error || '저장에 실패했습니다.')
      }
    } catch (err: any) {
      setError(err.message || '저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // Price formatting
  const formatPrice = (val: number | string) => {
    const num = Number(val)
    if (!num) return ''
    return num.toLocaleString('ko-KR')
  }

  const discountRate = form.comparePrice && form.price
    ? Math.round((1 - Number(form.price) / Number(form.comparePrice)) * 100)
    : 0

  // === 옵션 관리 함수들 ===
  const addOptionName = () => {
    setForm(prev => ({
      ...prev,
      optionNames: [...prev.optionNames, ''],
    }))
  }

  const removeOptionName = (index: number) => {
    setForm(prev => {
      const newNames = prev.optionNames.filter((_, i) => i !== index)
      // 변형의 해당 옵션 키도 제거
      const oldName = prev.optionNames[index]
      const newVariants = prev.variants.map(v => {
        const newValues = { ...v.optionValues }
        delete newValues[oldName]
        return { ...v, optionValues: newValues }
      })
      return { ...prev, optionNames: newNames, variants: newVariants }
    })
  }

  const updateOptionName = (index: number, value: string) => {
    setForm(prev => {
      const oldName = prev.optionNames[index]
      const newNames = [...prev.optionNames]
      newNames[index] = value
      // 변형의 키도 업데이트
      const newVariants = prev.variants.map(v => {
        const newValues: Record<string, string> = {}
        for (const [k, val] of Object.entries(v.optionValues)) {
          newValues[k === oldName ? value : k] = val
        }
        return { ...v, optionValues: newValues }
      })
      return { ...prev, optionNames: newNames, variants: newVariants }
    })
  }

  const addVariant = () => {
    const emptyValues: Record<string, string> = {}
    form.optionNames.forEach(name => {
      if (name.trim()) emptyValues[name] = ''
    })
    setForm(prev => ({
      ...prev,
      variants: [...prev.variants, {
        optionValues: emptyValues,
        price: '',
        comparePrice: '',
        stock: 0,
        sku: '',
        thumbnail: '',
        isActive: true,
      }],
    }))
  }

  const removeVariant = (index: number) => {
    setForm(prev => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index),
    }))
  }

  const updateVariant = (index: number, field: string, value: any) => {
    setForm(prev => ({
      ...prev,
      variants: prev.variants.map((v, i) =>
        i === index ? { ...v, [field]: value } : v
      ),
    }))
  }

  const updateVariantOptionValue = (variantIndex: number, optionName: string, value: string) => {
    setForm(prev => ({
      ...prev,
      variants: prev.variants.map((v, i) =>
        i === variantIndex
          ? { ...v, optionValues: { ...v.optionValues, [optionName]: value } }
          : v
      ),
    }))
  }

  // 자동 조합 생성
  const generateVariantCombinations = () => {
    // 사용자에게 각 옵션의 값을 입력받아 조합
    const optionValuesInput: Record<string, string[]> = {}
    const validNames = form.optionNames.filter(n => n.trim())
    
    for (const name of validNames) {
      const input = prompt(`"${name}" 옵션의 값들을 쉼표로 입력하세요.\n예: 빨강,파랑,검정`)
      if (!input) return
      optionValuesInput[name] = input.split(',').map(s => s.trim()).filter(Boolean)
    }

    // 조합 생성
    const keys = Object.keys(optionValuesInput)
    if (keys.length === 0) return

    const combinations: Record<string, string>[] = []
    const generate = (index: number, current: Record<string, string>) => {
      if (index === keys.length) {
        combinations.push({ ...current })
        return
      }
      const key = keys[index]
      for (const val of optionValuesInput[key]) {
        current[key] = val
        generate(index + 1, current)
      }
    }
    generate(0, {})

    const newVariants: VariantData[] = combinations.map(combo => ({
      optionValues: combo,
      price: form.price,
      comparePrice: form.comparePrice,
      stock: 0,
      sku: '',
      thumbnail: '',
      isActive: true,
    }))

    setForm(prev => ({ ...prev, variants: newVariants }))
  }

  const tabs = [
    { id: 'basic' as const, label: '기본정보', icon: '📋' },
    { id: 'detail' as const, label: '상세설명', icon: '📝' },
    { id: 'images' as const, label: '이미지', icon: '🖼️' },
    { id: 'options' as const, label: '옵션/변형', icon: '🎨' },
    { id: 'shipping' as const, label: '배송/교환', icon: '🚛' },
    { id: 'seo' as const, label: 'SEO/노출', icon: '🔍' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 헤더 */}
      <div className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin/products" className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {mode === 'create' ? '상품 등록' : '상품 수정'}
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  {mode === 'create' ? '새 상품을 등록합니다' : `${form.name || '상품'} 정보를 수정합니다`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/admin/products"
                className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                취소
              </Link>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
              >
                {saving && (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {saving ? '저장 중...' : mode === 'create' ? '상품 등록' : '변경사항 저장'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* 알림 */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <span>⚠️</span> {error}
            <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">&times;</button>
          </div>
        )}
        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <span>✅</span> {success}
          </div>
        )}

        {/* 탭 네비게이션 */}
        <div className="bg-white rounded-t-xl border border-b-0 border-gray-200">
          <div className="flex overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 컨텐츠 영역 */}
        <div className="bg-white rounded-b-xl border border-t-0 border-gray-200 p-6 sm:p-8">

          {/* ===== 기본정보 탭 ===== */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              {/* 상품명 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  상품명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  placeholder="상품명을 입력하세요 (예: 프리미엄 블루투스 이어폰)"
                  maxLength={100}
                />
                <p className="mt-1 text-xs text-gray-500 text-right">{form.name.length}/100</p>
              </div>

              {/* 카테고리 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  카테고리 <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm(prev => ({ ...prev, categoryId: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                >
                  <option value="">카테고리를 선택하세요</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {/* 가격 영역 */}
              <div className="bg-gray-50 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">💰 가격 설정</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      판매가 (원) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={form.price}
                      onChange={(e) => setForm(prev => ({ ...prev, price: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="0"
                      min="0"
                    />
                    {form.price && <p className="mt-1 text-xs text-blue-600 font-medium">₩{formatPrice(form.price)}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      정가 (원) <span className="text-gray-400">(선택)</span>
                    </label>
                    <input
                      type="number"
                      value={form.comparePrice}
                      onChange={(e) => setForm(prev => ({ ...prev, comparePrice: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="할인 전 원래 가격"
                      min="0"
                    />
                    {form.comparePrice && <p className="mt-1 text-xs text-gray-500 line-through">₩{formatPrice(form.comparePrice)}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">할인율</label>
                    <div className={`px-4 py-2.5 rounded-lg border text-center font-bold text-lg ${
                      discountRate > 0 ? 'bg-red-50 border-red-200 text-red-600' : 'bg-gray-100 border-gray-200 text-gray-400'
                    }`}>
                      {discountRate > 0 ? `${discountRate}% OFF` : '-'}
                    </div>
                  </div>
                </div>
              </div>

              {/* 재고/SKU */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    재고 수량 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={form.stock}
                    onChange={(e) => setForm(prev => ({ ...prev, stock: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    SKU (상품코드) <span className="text-gray-400 font-normal text-xs">(선택)</span>
                  </label>
                  <input
                    type="text"
                    value={form.sku}
                    onChange={(e) => setForm(prev => ({ ...prev, sku: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder="예: PROD-001"
                  />
                </div>
              </div>

              {/* 간단 설명 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  상품 간단 설명 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                  placeholder="상품 목록에 표시될 간단한 설명 (1~2줄)"
                  maxLength={200}
                />
                <p className="mt-1 text-xs text-gray-500 text-right">{form.description.length}/200</p>
              </div>

              {/* 전자상거래법 필수 표시 정보 */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                  ⚖️ 전자상거래법 필수 표시
                  <span className="text-xs text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded">법적 필수</span>
                </h3>
                <p className="text-xs text-yellow-700 mb-4">전자상거래법에 따라 아래 정보는 반드시 입력해야 합니다.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      원산지 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.origin}
                      onChange={(e) => setForm(prev => ({ ...prev, origin: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="예: 대한민국"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      제조사 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.manufacturer}
                      onChange={(e) => setForm(prev => ({ ...prev, manufacturer: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="예: (주)큐라이브"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      브랜드
                    </label>
                    <input
                      type="text"
                      value={form.brand}
                      onChange={(e) => setForm(prev => ({ ...prev, brand: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="예: QRLIVE"
                    />
                  </div>
                </div>
              </div>

              {/* 검색 태그 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  검색 태그 <span className="text-gray-400 font-normal text-xs">(쉼표로 구분)</span>
                </label>
                <input
                  type="text"
                  value={form.tags}
                  onChange={(e) => setForm(prev => ({ ...prev, tags: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                  placeholder="예: 여름, 면티, 데일리, 캐주얼"
                />
                <p className="mt-1 text-xs text-gray-500">검색 시 노출되는 키워드입니다. 쉼표(,)로 구분하세요.</p>
                {form.tags && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.tags.split(',').map((t, i) => t.trim() && (
                      <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">#{t.trim()}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* 상품 스펙 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-gray-700">
                    상품 스펙 <span className="text-gray-400 font-normal text-xs">(선택)</span>
                  </label>
                  <button
                    type="button"
                    onClick={addSpec}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    + 항목 추가
                  </button>
                </div>
                <div className="space-y-2">
                  {form.specifications.map((spec, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={spec.key}
                        onChange={(e) => updateSpec(i, 'key', e.target.value)}
                        className="w-1/3 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                        placeholder="항목명 (예: 소재)"
                      />
                      <input
                        type="text"
                        value={spec.value}
                        onChange={(e) => updateSpec(i, 'value', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                        placeholder="내용 (예: 100% 면)"
                      />
                      {form.specifications.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSpec(i)}
                          className="px-2 text-red-400 hover:text-red-600"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 상태 토글 */}
              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">판매 활성화</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isFeatured}
                    onChange={(e) => setForm(prev => ({ ...prev, isFeatured: e.target.checked }))}
                    className="w-4 h-4 text-yellow-500 rounded focus:ring-yellow-500"
                  />
                  <span className="text-sm text-gray-700">추천 상품 (메인 노출)</span>
                </label>
              </div>
            </div>
          )}

          {/* ===== 상세설명 탭 ===== */}
          {activeTab === 'detail' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  상품 상세 설명 (WYSIWYG 에디터)
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  상세페이지에 표시될 내용입니다. 에디터를 사용하여 서식, 이미지, 링크 등을 자유롭게 편집하세요.
                </p>
                <Suspense fallback={
                  <div className="border border-gray-300 rounded-lg p-8 text-center text-gray-400">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    에디터 로딩 중...
                  </div>
                }>
                  <RichEditor
                    content={form.detailContent}
                    onChange={(html) => setForm(prev => ({ ...prev, detailContent: html }))}
                    placeholder="상품 상세 설명을 작성하세요..."
                  />
                </Suspense>
              </div>

              {/* 상세 이미지 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  상세페이지 이미지
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  상세 설명 이미지를 순서대로 업로드하세요. 상세페이지에서 위에서 아래로 표시됩니다.
                </p>

                {/* 업로드 된 이미지 목록 */}
                {form.detailImages.length > 0 && (
                  <div className="space-y-3 mb-4">
                    {form.detailImages.map((url, i) => (
                      <div
                        key={i}
                        className={`relative flex items-start gap-3 bg-gray-50 rounded-lg p-3 cursor-grab active:cursor-grabbing ${dragOverIndex === i && dragType === 'detailImages' ? 'ring-2 ring-blue-500' : ''}`}
                        draggable
                        onDragStart={() => handleDragStart(i, 'detailImages')}
                        onDragOver={(e) => handleDragOver(e, i)}
                        onDragEnd={handleDragEnd}
                      >
                        <span className="text-xs text-gray-400 font-mono mt-1">⠿ {i + 1}</span>
                        <img src={url} alt={`상세 ${i + 1}`} className="w-20 h-20 object-cover rounded border" />
                        <p className="flex-1 text-xs text-gray-500 break-all mt-1">{url}</p>
                        <button
                          type="button"
                          onClick={() => removeImage(i, 'detailImages')}
                          className="text-red-400 hover:text-red-600 shrink-0"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <input
                  ref={detailImgRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleDetailImageUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => detailImgRef.current?.click()}
                  disabled={uploadingDetail}
                  className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500 transition disabled:opacity-50"
                >
                  {uploadingDetail ? '업로드 중...' : '+ 상세 이미지 추가'}
                </button>
              </div>
            </div>
          )}

          {/* ===== 이미지 탭 ===== */}
          {activeTab === 'images' && (
            <div className="space-y-6">
              {/* 대표 이미지 (썸네일) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  대표 이미지 (썸네일) <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500 mb-3">상품 목록과 검색 결과에 표시됩니다. 권장: 800x800px, 정사각형</p>

                {form.thumbnail ? (
                  <div className="relative inline-block">
                    <img src={form.thumbnail} alt="썸네일" className="w-48 h-48 object-cover rounded-lg border-2 border-blue-300" />
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, thumbnail: '' }))}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                    >
                      ✕
                    </button>
                    <div className="absolute bottom-2 left-2 bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded">
                      대표
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => thumbnailRef.current?.click()}
                    className="w-48 h-48 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 transition"
                  >
                    <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="mt-2 text-xs text-gray-400">클릭하여 업로드</span>
                  </div>
                )}
                <input ref={thumbnailRef} type="file" accept="image/*" onChange={handleThumbnailUpload} className="hidden" />
                {uploadingImage && <p className="mt-2 text-xs text-blue-500">업로드 중...</p>}
              </div>

              {/* 갤러리 이미지 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  갤러리 이미지 <span className="text-gray-400 font-normal text-xs">(최대 10장, 드래그로 순서 변경)</span>
                </label>
                <p className="text-xs text-gray-500 mb-3">상품 상세페이지 상단 슬라이더에 표시됩니다. 드래그하여 순서를 변경할 수 있습니다.</p>

                <div className="flex flex-wrap gap-3">
                  {form.images.map((url, i) => (
                    <div
                      key={i}
                      className={`relative cursor-grab active:cursor-grabbing ${dragOverIndex === i && dragType === 'images' ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
                      draggable
                      onDragStart={() => handleDragStart(i, 'images')}
                      onDragOver={(e) => handleDragOver(e, i)}
                      onDragEnd={handleDragEnd}
                    >
                      <img src={url} alt={`갤러리 ${i + 1}`} className="w-28 h-28 object-cover rounded-lg border" />
                      <button
                        type="button"
                        onClick={() => removeImage(i, 'images')}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] hover:bg-red-600"
                      >
                        ✕
                      </button>
                      <span className="absolute bottom-1 left-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded">
                        {i + 1}
                      </span>
                      <span className="absolute top-1 left-1 text-[10px] opacity-50">⠿</span>
                    </div>
                  ))}

                  {form.images.length < 10 && (
                    <div
                      onClick={() => galleryRef.current?.click()}
                      className="w-28 h-28 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 transition"
                    >
                      <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span className="mt-1 text-[10px] text-gray-400">추가</span>
                    </div>
                  )}
                </div>
                <input ref={galleryRef} type="file" accept="image/*" multiple onChange={handleGalleryUpload} className="hidden" />
              </div>
            </div>
          )}

          {/* ===== 배송/교환 탭 ===== */}
          {activeTab === 'shipping' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">배송 안내</label>
                <textarea
                  value={form.shippingInfo}
                  onChange={(e) => setForm(prev => ({ ...prev, shippingInfo: e.target.value }))}
                  rows={8}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">교환/반품 안내</label>
                <textarea
                  value={form.returnInfo}
                  onChange={(e) => setForm(prev => ({ ...prev, returnInfo: e.target.value }))}
                  rows={8}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 text-sm"
                />
              </div>
            </div>
          )}

          {/* ===== 옵션/변형 탭 ===== */}
          {activeTab === 'options' && (
            <div className="space-y-6">
              {/* 옵션 사용 토글 */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.hasOptions}
                    onChange={(e) => setForm(prev => ({ ...prev, hasOptions: e.target.checked }))}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-semibold text-gray-700">상품 옵션 사용</span>
                </label>
                <p className="text-xs text-gray-500">색상, 사이즈 등 옵션별로 재고와 가격을 관리합니다</p>
              </div>

              {form.hasOptions && (
                <>
                  {/* 옵션명 관리 */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-700">🏷️ 옵션명 설정</h3>
                      <button
                        type="button"
                        onClick={addOptionName}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium px-3 py-1 bg-blue-100 rounded-lg"
                      >
                        + 옵션 추가
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">예: 색상, 사이즈, 소재 등</p>
                    <div className="space-y-2">
                      {form.optionNames.map((name, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <span className="text-xs text-gray-400 w-6">{i + 1}</span>
                          <input
                            type="text"
                            value={name}
                            onChange={(e) => updateOptionName(i, e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                            placeholder={`옵션명 (예: ${i === 0 ? '색상' : i === 1 ? '사이즈' : '소재'})`}
                          />
                          <button
                            type="button"
                            onClick={() => removeOptionName(i)}
                            className="px-2 py-2 text-red-400 hover:text-red-600 transition"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))}
                      {form.optionNames.length === 0 && (
                        <p className="text-xs text-gray-400 text-center py-3">옵션명을 추가해주세요 (예: 색상, 사이즈)</p>
                      )}
                    </div>
                  </div>

                  {/* 변형(조합) 관리 */}
                  {form.optionNames.filter(n => n.trim()).length > 0 && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-gray-700">📦 옵션 조합 (변형)</h3>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={generateVariantCombinations}
                            className="text-xs text-green-600 hover:text-green-700 font-medium px-3 py-1 bg-green-100 rounded-lg"
                          >
                            ✨ 자동 조합 생성
                          </button>
                          <button
                            type="button"
                            onClick={addVariant}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium px-3 py-1 bg-blue-100 rounded-lg"
                          >
                            + 수동 추가
                          </button>
                        </div>
                      </div>

                      {form.variants.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                          <span className="text-4xl block mb-2">🎨</span>
                          <p className="text-sm">옵션 조합을 추가해주세요</p>
                          <p className="text-xs mt-1">"자동 조합 생성"을 클릭하면 모든 조합이 자동으로 생성됩니다</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {form.variants.map((variant, vi) => (
                            <div key={vi} className={`bg-white rounded-lg border p-4 ${!variant.isActive ? 'opacity-60' : ''}`}>
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono text-gray-400">#{vi + 1}</span>
                                  {variant.id && <span className="text-[10px] text-gray-300">ID: {variant.id.slice(0, 8)}</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                  <label className="flex items-center gap-1 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={variant.isActive}
                                      onChange={(e) => updateVariant(vi, 'isActive', e.target.checked)}
                                      className="w-3.5 h-3.5 text-blue-600 rounded"
                                    />
                                    <span className="text-[10px] text-gray-500">활성</span>
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => removeVariant(vi)}
                                    className="text-red-400 hover:text-red-600 text-xs"
                                  >
                                    삭제
                                  </button>
                                </div>
                              </div>

                              {/* 옵션 값 */}
                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-3">
                                {form.optionNames.filter(n => n.trim()).map((optName, oi) => (
                                  <div key={oi}>
                                    <label className="block text-[10px] font-medium text-gray-500 mb-1">{optName}</label>
                                    <input
                                      type="text"
                                      value={variant.optionValues[optName] || ''}
                                      onChange={(e) => updateVariantOptionValue(vi, optName, e.target.value)}
                                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 focus:ring-1 focus:ring-blue-500"
                                      placeholder={`${optName} 값`}
                                    />
                                  </div>
                                ))}
                              </div>

                              {/* 가격/재고/SKU */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <div>
                                  <label className="block text-[10px] font-medium text-gray-500 mb-1">판매가 (원)</label>
                                  <input
                                    type="number"
                                    value={variant.price}
                                    onChange={(e) => updateVariant(vi, 'price', e.target.value)}
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900"
                                    placeholder="기본가 사용"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-medium text-gray-500 mb-1">재고</label>
                                  <input
                                    type="number"
                                    value={variant.stock}
                                    onChange={(e) => updateVariant(vi, 'stock', e.target.value)}
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900"
                                    placeholder="0"
                                    min="0"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-medium text-gray-500 mb-1">SKU</label>
                                  <input
                                    type="text"
                                    value={variant.sku}
                                    onChange={(e) => updateVariant(vi, 'sku', e.target.value)}
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900"
                                    placeholder="선택"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-medium text-gray-500 mb-1">정가 (원)</label>
                                  <input
                                    type="number"
                                    value={variant.comparePrice}
                                    onChange={(e) => updateVariant(vi, 'comparePrice', e.target.value)}
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900"
                                    placeholder="선택"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {form.variants.length > 0 && (
                        <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                          <span>총 {form.variants.length}개 변형 | 전체 재고: {form.variants.reduce((s, v) => s + (Number(v.stock) || 0), 0)}개</span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {!form.hasOptions && (
                <div className="text-center py-12 text-gray-400">
                  <span className="text-5xl block mb-3">🎨</span>
                  <p className="text-sm font-medium text-gray-500">옵션을 사용하지 않습니다</p>
                  <p className="text-xs mt-1">위 체크박스를 선택하면 색상/사이즈 등의 옵션을 설정할 수 있습니다</p>
                </div>
              )}
            </div>
          )}

          {/* ===== SEO/노출 탭 ===== */}
          {activeTab === 'seo' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  URL 슬러그
                </label>
                <div className="flex items-center">
                  <span className="px-3 py-3 bg-gray-100 border border-r-0 border-gray-300 rounded-l-lg text-sm text-gray-500">
                    /products/
                  </span>
                  <input
                    type="text"
                    value={form.slug}
                    onChange={(e) => setForm(prev => ({ ...prev, slug: e.target.value }))}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-r-lg focus:ring-2 focus:ring-blue-500 text-gray-900 text-sm"
                    placeholder="product-url-slug"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  상품 URL에 사용됩니다. 영문 소문자, 숫자, 하이픈만 사용하세요.
                </p>
              </div>

              {/* 미리보기 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">검색 결과 미리보기</label>
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <p className="text-blue-700 text-lg hover:underline cursor-pointer">
                    {form.name || '상품명이 여기에 표시됩니다'}
                  </p>
                  <p className="text-green-700 text-sm">
                    qrlive.io/products/{form.slug || 'product-slug'}
                  </p>
                  <p className="text-gray-600 text-sm mt-1 line-clamp-2">
                    {form.description || '상품 설명이 여기에 표시됩니다...'}
                  </p>
                </div>
              </div>

              {/* 상태 요약 */}
              <div className="bg-gray-50 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">노출 상태</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">판매 상태</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      form.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {form.isActive ? '판매중' : '판매중지'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">추천 상품</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      form.isFeatured ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {form.isFeatured ? '추천' : '일반'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">재고</span>
                    <span className={`text-sm font-semibold ${
                      Number(form.stock) > 10 ? 'text-green-600' : Number(form.stock) > 0 ? 'text-orange-600' : 'text-red-600'
                    }`}>
                      {form.stock || 0}개
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 하단 저장 버튼 (모바일 대응) */}
        <div className="mt-6 flex justify-end gap-3">
          <Link
            href="/admin/products"
            className="px-6 py-3 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            취소
          </Link>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-8 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {saving ? '저장 중...' : mode === 'create' ? '상품 등록' : '변경사항 저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
