'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';

/**
 * /sso?token=... — QRChat 앱 WebView 에서 진입하는 자동로그인 랜딩.
 * ---------------------------------------------------------------------------
 * QRChat 앱이 createQrliveSsoTicket 으로 발급받은 ssoToken 을 쿼리로 전달하면,
 * /api/auth/sso 로 POST → 검증/자동가입/JWT 쿠키 세팅 후 쇼핑몰로 진입.
 */
function SsoInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { refreshUser } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    const token = params.get('token') || params.get('ssoToken') || '';
    const redirect = params.get('redirect') || '/products';

    if (!token) {
      setError('SSO 토큰이 없습니다.');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/sso', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !json?.success) {
          setError(json?.error || '자동로그인에 실패했습니다.');
          return;
        }

        // ★★★ 2026-08-15 수정 (WebView 자동로그인 세션 유실 사건):
        //   ─ 증상: 큐알쳇 앱 WebView 에서 SSO 로 자동로그인 "화면상 성공" 했는데도
        //           바로구매/리뷰작성 등 API 호출이 전부 "로그인 요구" 로 튕김.
        //   ─ 원인: 서버는 auth-token 을 쿠키(SameSite=Lax)로만 세팅했다.
        //           앱 WebView 는 큐알쳇 도메인 ↔ qrlive.io 크로스사이트라
        //           SameSite=Lax 쿠키가 이후 fetch 요청에 실리지 않는다.
        //           일반 로그인(AuthContext)은 localStorage 에 토큰을 저장해
        //           authFetch 가 Authorization 헤더로 보내는데, SSO 경로만
        //           이 저장을 안 해서 헤더 폴백조차 없었다.
        //   ─ 수정: 일반 로그인과 동일하게 응답의 token/user 를 localStorage 에 저장
        //           → 이후 authFetch 가 Authorization: Bearer 헤더로 전송(크로스사이트 안전).
        //           (쿠키는 서버에서 SameSite=None; Secure 로 별도 보강)
        try {
          const tokenData = json?.data?.token || json?.token;
          const userData = json?.data?.user || json?.user;
          if (tokenData) localStorage.setItem('auth-token', tokenData);
          if (userData) localStorage.setItem('user', JSON.stringify(userData));
        } catch {
          /* localStorage 접근 실패(Safari private 등) — 쿠키 폴백에 의존 */
        }

        // 쿠키 세팅 완료 → 컨텍스트 갱신 후 이동
        await refreshUser().catch(() => {});
        router.replace(redirect.startsWith('/') ? redirect : '/products');
      } catch (e) {
        if (!cancelled) setError('자동로그인 처리 중 오류가 발생했습니다.');
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6">
      {!error ? (
        <>
          <div className="w-10 h-10 border-4 border-gray-200 border-t-black rounded-full animate-spin" />
          <p className="mt-4 text-gray-600 text-sm">QRChat 계정으로 로그인 중…</p>
        </>
      ) : (
        <>
          <p className="text-red-600 text-sm text-center">{error}</p>
          <button
            onClick={() => router.replace('/login')}
            className="mt-4 px-4 py-2 bg-black text-white rounded-lg text-sm"
          >
            로그인 화면으로
          </button>
        </>
      )}
    </div>
  );
}

export default function SsoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="w-10 h-10 border-4 border-gray-200 border-t-black rounded-full animate-spin" />
        </div>
      }
    >
      <SsoInner />
    </Suspense>
  );
}
