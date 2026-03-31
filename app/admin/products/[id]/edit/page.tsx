'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useAdminAuth } from '@/lib/hooks/useAdminAuth'
import ProductForm from '@/components/admin/ProductForm'

export default function EditProductPage() {
  const { user, loading: authLoading } = useAdminAuth()
  const params = useParams()
  const productId = params?.id as string

  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (productId && user) {
      fetchProduct()
    }
  }, [productId, user])

  const fetchProduct = async () => {
    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        credentials: 'include'
      })
      const data = await res.json()
      if (data.success) {
        setProduct(data.data)
      } else {
        setError(data.error || '상품을 찾을 수 없습니다.')
      }
    } catch (err) {
      setError('상품 정보를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">상품 정보 로딩 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 text-lg">{error}</p>
          <a href="/admin/products" className="mt-4 inline-block text-blue-600 hover:underline">
            상품 목록으로 돌아가기
          </a>
        </div>
      </div>
    )
  }

  if (!product) return null

  return (
    <ProductForm
      mode="edit"
      initialData={{
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        detailContent: product.detailContent,
        price: product.price,
        comparePrice: product.comparePrice,
        stock: product.stock,
        sku: product.sku,
        thumbnail: product.thumbnail,
        images: product.images,
        detailImages: product.detailImages,
        specifications: product.specifications,
        shippingInfo: product.shippingInfo,
        returnInfo: product.returnInfo,
        categoryId: product.categoryId || product.category?.id,
        isActive: product.isActive,
        isFeatured: product.isFeatured,
        origin: product.origin,
        manufacturer: product.manufacturer,
        brand: product.brand,
        tags: product.tags,
        hasOptions: product.hasOptions,
        optionNames: product.optionNames,
        variants: product.variants || [],
      }}
    />
  )
}
