'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CartRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/products?view=cart');
  }, [router]);
  
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );
}
