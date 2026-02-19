import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d'; // 7일

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  name: string;
}

// JWT 토큰 생성
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

// JWT 토큰 검증
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    console.error('[JWT_VERIFY_ERROR]', error);
    return null;
  }
}

// 요청에서 토큰 추출
export function extractToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  
  // Bearer 토큰 형식: "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') {
    return parts[1];
  }
  
  return null;
}
