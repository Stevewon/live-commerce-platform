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

    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\s+/g, '_');
    const key = `products/${timestamp}_${safeName}`;

    // Cloudflare R2 업로드 시도
    let r2UploadError: string | null = null;
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare');
      const ctx = await getCloudflareContext();
      const r2 = (ctx.env as any).R2_BUCKET;

      if (r2) {
        const buffer = await file.arrayBuffer();
        await r2.put(key, buffer, {
          httpMetadata: {
            contentType: file.type,
          },
        });

        // R2 공개 URL
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
      } else {
        r2UploadError = 'R2_BUCKET binding not found';
      }
    } catch (e: any) {
      r2UploadError = e?.message || 'R2 context unavailable';
      console.log('R2 not available, using base64 fallback:', r2UploadError);
    }

    // Fallback: Base64 데이터 URL (R2 미설정 시, 로컬 개발 등)
    // chunk-safe base64 conversion (avoid spread operator call stack overflow)
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const end = Math.min(i + chunkSize, bytes.length);
      for (let j = i; j < end; j++) {
        binary += String.fromCharCode(bytes[j]);
      }
    }
    const base64 = btoa(binary);
    const dataUrl = `data:${file.type};base64,${base64}`;
    
    return NextResponse.json({
      success: true,
      data: {
        url: dataUrl,
        fileName: safeName,
        fileSize: file.size,
        fileType: file.type
      },
      message: r2UploadError 
        ? `이미지 업로드 완료 (base64 모드: ${r2UploadError})`
        : '이미지가 업로드되었습니다'
    });

  } catch (error: any) {
    console.error('이미지 업로드 실패:', error?.message || error);
    return NextResponse.json(
      { success: false, error: `이미지 업로드에 실패했습니다: ${error?.message || '알 수 없는 오류'}` },
      { status: 500 }
    );
  }
}
