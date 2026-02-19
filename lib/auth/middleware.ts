import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractToken } from './jwt';

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    userId: string;
    email: string;
    role: string;
    name: string;
  };
}

// 인증 필요한 API에 사용할 미들웨어
export async function requireAuth(
  request: NextRequest,
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    // Authorization 헤더에서 토큰 추출
    const authHeader = request.headers.get('authorization');
    const token = extractToken(authHeader);
    
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
    
    // request에 user 정보 추가
    const authenticatedRequest = request as AuthenticatedRequest;
    authenticatedRequest.user = payload;
    
    // 핸들러 실행
    return await handler(authenticatedRequest);
  } catch (error) {
    console.error('[AUTH_MIDDLEWARE_ERROR]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Authentication failed',
      },
      { status: 500 }
    );
  }
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
