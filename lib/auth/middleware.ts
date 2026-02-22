import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/jwt';

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    userId: string;
    email: string;
    role: string;
    name: string;
  };
}

// 인증 헬퍼 함수 - userId 반환 또는 에러 응답 반환
export async function verifyAuthToken(
  request: NextRequest
): Promise<{ userId: string; email: string; role: string; name: string } | NextResponse> {
  try {
    // 쿠키에서 토큰 추출
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    
    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
        },
        { status: 401 }
      );
    }
    
    // 토큰 검증
    const payload = verifyToken(token);
    
    if (!payload) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or expired token',
        },
        { status: 401 }
      );
    }
    
    return payload;
  } catch (error) {
    console.error('[AUTH_VERIFY_ERROR]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Authentication failed',
      },
      { status: 500 }
    );
  }
}

// 인증 필요한 API에 사용할 미들웨어
export async function requireAuth(
  request: NextRequest,
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  const authResult = await verifyAuthToken(request);
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  
  // request에 user 정보 추가
  const authenticatedRequest = request as AuthenticatedRequest;
  authenticatedRequest.user = authResult;
  
  // 핸들러 실행
  return await handler(authenticatedRequest);
}

// 특정 역할만 허용하는 미들웨어
export async function requireRole(
  request: NextRequest,
  allowedRoles: string[],
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  return requireAuth(request, async (req) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient permissions',
        },
        { status: 403 }
      );
    }
    
    return await handler(req);
  });
}

