import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// 플레이스홀더 이미지 URL - 다양한 카테고리별
const imageUrls: Record<string, string[]> = {
  fashion: [
    'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800&h=800&fit=crop',
    'https://images.unsplash.com/photo-1529374255404-311a2a4f1fd9?w=800&h=800&fit=crop',
    'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&h=800&fit=crop',
  ],
  electronics: [
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&h=800&fit=crop',
    'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800&h=800&fit=crop',
    'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800&h=800&fit=crop',
  ],
  beauty: [
    'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&h=800&fit=crop',
    'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&h=800&fit=crop',
    'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&h=800&fit=crop',
  ],
  home: [
    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&h=800&fit=crop',
    'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=800&h=800&fit=crop',
    'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800&h=800&fit=crop',
  ],
  kitchen: [
    'https://images.unsplash.com/photo-1556911220-bff31c812dba?w=800&h=800&fit=crop',
    'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=800&h=800&fit=crop',
    'https://images.unsplash.com/photo-1620799140188-3b2a02fd9a77?w=800&h=800&fit=crop',
  ],
  sports: [
    'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&h=800&fit=crop',
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&h=800&fit=crop',
    'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=800&h=800&fit=crop',
  ],
  accessories: [
    'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=800&h=800&fit=crop',
    'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&h=800&fit=crop',
    'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800&h=800&fit=crop',
  ],
  default: [
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&h=800&fit=crop',
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&h=800&fit=crop',
    'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800&h=800&fit=crop',
  ]
};

// POST /api/products/update-images - 모든 상품의 이미지 업데이트
export async function POST(request: NextRequest) {
  try {
    console.log('📸 상품 이미지 업데이트 시작...');

    // 모든 상품 가져오기
    const products = await prisma.product.findMany({
      include: {
        category: true,
      },
    });

    console.log(`총 ${products.length}개의 상품을 업데이트합니다.`);

    const results = [];

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const categorySlug = product.category.slug;
      
      // 카테고리에 맞는 이미지 선택
      let images: string[];
      if (categorySlug in imageUrls) {
        images = imageUrls[categorySlug];
      } else {
        images = imageUrls.default;
      }

      // 랜덤 이미지 선택
      const randomIndex = i % images.length;
      const thumbnail = images[randomIndex];
      const imageArray = [thumbnail, ...images.filter(img => img !== thumbnail)];

      await prisma.product.update({
        where: { id: product.id },
        data: {
          thumbnail: thumbnail,
          images: JSON.stringify(imageArray),
        },
      });

      results.push({
        id: product.id,
        name: product.name,
        thumbnail: thumbnail,
      });

      console.log(`✅ ${i + 1}. ${product.name} - 이미지 업데이트 완료`);
    }

    console.log('🎉 모든 상품 이미지 업데이트 완료!');

    return NextResponse.json({
      success: true,
      message: `${products.length}개의 상품 이미지가 업데이트되었습니다.`,
      data: results,
    });
  } catch (error) {
    console.error('[UPDATE_IMAGES_ERROR]', error);
    return NextResponse.json(
      {
        success: false,
        error: '이미지 업데이트에 실패했습니다.',
      },
      { status: 500 }
    );
  }
}
