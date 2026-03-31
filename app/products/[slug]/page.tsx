import type { Metadata } from 'next';

interface Props {
  params: Promise<{ slug: string }>;
}

// SSR metadata for SEO (OG + Twitter Cards)
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://qrlive.io';

  try {
    const res = await fetch(`${baseUrl}/api/products?slug=${slug}`, {
      next: { revalidate: 300 }, // 5분 캐시
    });

    if (!res.ok) {
      return {
        title: '상품을 찾을 수 없습니다',
        description: 'QRLIVE 쇼핑몰에서 다양한 상품을 만나보세요.',
      };
    }

    const data = await res.json();
    const product = data.data?.[0];

    if (!product) {
      return {
        title: '상품을 찾을 수 없습니다',
        description: 'QRLIVE 쇼핑몰에서 다양한 상품을 만나보세요.',
      };
    }

    const price = product.price?.toLocaleString('ko-KR');
    const description = product.description?.slice(0, 160) || `${product.name} - QRLIVE 쇼핑몰`;
    const title = `${product.name} | QRLIVE`;

    const images = [];
    if (product.thumbnail) {
      images.push({
        url: product.thumbnail.startsWith('http') ? product.thumbnail : `${baseUrl}${product.thumbnail}`,
        width: 800,
        height: 800,
        alt: product.name,
      });
    }

    return {
      title,
      description: `${description} | ₩${price}`,
      keywords: [
        product.name,
        product.brand,
        product.category?.name,
        ...(product.tags ? product.tags.split(',').map((t: string) => t.trim()) : []),
        'QRLIVE', '큐라이브', '쇼핑몰',
      ].filter(Boolean),
      openGraph: {
        title,
        description: `${description} | ₩${price}`,
        url: `${baseUrl}/products/${slug}`,
        siteName: 'QRLIVE',
        locale: 'ko_KR',
        type: 'website',
        images,
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description: `${description} | ₩${price}`,
        images: images.map(img => img.url),
      },
      alternates: {
        canonical: `${baseUrl}/products/${slug}`,
      },
      other: {
        'product:price:amount': String(product.price || ''),
        'product:price:currency': 'KRW',
        'product:availability': product.stock > 0 ? 'in stock' : 'out of stock',
        'product:brand': product.brand || '',
        'product:category': product.category?.name || '',
      },
    };
  } catch (error) {
    return {
      title: 'QRLIVE Shop',
      description: 'QRLIVE 쇼핑몰에서 다양한 상품을 만나보세요.',
    };
  }
}

// Re-export the client component
export { default } from './ProductDetailClient';
