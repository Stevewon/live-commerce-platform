import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth/middleware';

export async function POST(req: NextRequest) {
  try {
    // 인증 확인 (파트너 또는 관리자만 이미지 업로드 가능)
    const authResult = await verifyAuthToken(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    
    if (!['ADMIN', 'PARTNER'].includes(authResult.role)) {
      return NextResponse.json(
        { success: false, error: '권한이 필요합니다' },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: '파일이 제공되지 않았습니다' },
        { status: 400 }
      );
    }

    // 파일 타입 검증
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: '지원하지 않는 파일 형식입니다. (JPG, PNG, GIF, WEBP만 가능)' },
        { status: 400 }
      );
    }

    // 파일 크기 검증 (최대 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: '파일 크기는 10MB 이하여야 합니다' },
        { status: 400 }
      );
    }

    // Cloudflare R2 업로드
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare');
      const ctx = await getCloudflareContext();
      const r2 = (ctx.env as any).R2_BUCKET;

      if (r2) {
        // R2 사용 가능 - 클라우드 스토리지에 업로드
        const timestamp = Date.now();
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\s+/g, '_');
        const key = `products/${timestamp}_${safeName}`;

        const buffer = await file.arrayBuffer();
        await r2.put(key, buffer, {
          httpMetadata: {
            contentType: file.type,
          },
        });

        // R2 공개 URL (커스텀 도메인 또는 R2 퍼블릭 URL)
        const r2PublicUrl = (ctx.env as any).R2_PUBLIC_URL;
        const publicUrl = r2PublicUrl 
          ? `${r2PublicUrl}/${key}`
          : `/api/images/${key}`;

        return NextResponse.json({
          success: true,
          data: {
            url: publicUrl,
            key: key,
            fileName: safeName,
            fileSize: file.size,
            fileType: file.type
          },
          message: '이미지가 성공적으로 업로드되었습니다'
        });
      }
    } catch (e) {
      // R2 not available, fallback below
      console.log('R2 not available, using base64 fallback');
    }

    // Fallback: Base64 데이터 URL (R2 미설정 시)
    const buffer = await file.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    const dataUrl = `data:${file.type};base64,${base64}`;
    
    // For large files, store as base64 is not ideal but works as fallback
    // In production, R2 should be configured
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    
    return NextResponse.json({
      success: true,
      data: {
        url: dataUrl,
        fileName: safeName,
        fileSize: file.size,
        fileType: file.type
      },
      message: '이미지가 업로드되었습니다 (R2 미설정 - base64 모드)'
    });

  } catch (error) {
    console.error('이미지 업로드 실패:', error);
    return NextResponse.json(
      { success: false, error: '이미지 업로드에 실패했습니다' },
      { status: 500 }
    );
  }
}
