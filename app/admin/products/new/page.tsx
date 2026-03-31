'use client'

import { useAdminAuth } from '@/lib/hooks/useAdminAuth'
import ProductForm from '@/components/admin/ProductForm'

export default function NewProductPage() {
  const { user, loading } = useAdminAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  return <ProductForm mode="create" />
}
