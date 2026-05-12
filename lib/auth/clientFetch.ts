/**
 * [2026-05-12 v1.0.16] 클라이언트 인증 fetch 헬퍼
 *
 * 배경 (사고 #4 모바일 회원 결제 차단):
 *   - 모바일 회원이 결제 클릭 시 "비회원 주문 시 이메일 또는 전화번호가 필요합니다" 경고
 *   - 원인: 클라이언트가 `credentials: 'include'` 만 사용 → 모바일 브라우저(특히 iOS Safari)
 *     에서 sameSite='lax' POST 쿠키 누락 사례 → 서버에서 userId=null → 비회원 분기 진입
 *   - 해결: localStorage.auth-token 을 읽어 Authorization 헤더로도 동시 전송 (양면 방어)
 *
 * 사용법:
 *   import { authFetch } from '@/lib/auth/clientFetch';
 *   const res = await authFetch('/api/orders', { method: 'POST', body: JSON.stringify(data) });
 *
 * 자동 동작:
 *   - Content-Type: application/json 기본 첨부 (body 있을 때, 명시 헤더 없을 때만)
 *   - localStorage 의 auth-token 존재 시 Authorization: Bearer <token> 자동 추가
 *   - credentials: 'include' 자동 첨부 (쿠키 폴백 유지)
 *
 * SSR 안전:
 *   - typeof window === 'undefined' 일 때 localStorage 접근 안 함
 */
export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers || {});

  // Authorization 헤더 자동 첨부 (이미 명시되지 않은 경우만)
  if (!headers.has('Authorization') && typeof window !== 'undefined') {
    try {
      const token = window.localStorage.getItem('auth-token');
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    } catch {
      // localStorage 접근 실패 (Safari private mode 등) — 쿠키 폴백에 의존
    }
  }

  // Content-Type 기본값 (body 있고 명시 안 된 경우)
  if (init?.body && !headers.has('Content-Type')) {
    // FormData / Blob 등은 브라우저가 자동 설정하도록 두기
    const body = init.body;
    const isFormDataLike =
      (typeof FormData !== 'undefined' && body instanceof FormData) ||
      (typeof Blob !== 'undefined' && body instanceof Blob);
    if (!isFormDataLike) {
      headers.set('Content-Type', 'application/json');
    }
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: init?.credentials || 'include',
  });
}

/**
 * 인증 fetch 의 JSON 응답을 한 번에 받기 (간편 헬퍼)
 */
export async function authFetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  try {
    const res = await authFetch(input, init);
    let data: T | null = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { ok: res.ok, status: res.status, data };
  } catch (err: any) {
    return { ok: false, status: 0, data: null, error: err?.message || String(err) };
  }
}
