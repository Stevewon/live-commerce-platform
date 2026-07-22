'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';

/**
 * /my/link-qrchat — A 회원(QRLIVE) 이 QRChat 지갑을 연결하는 화면.
 * 사장님 답변 (2): A 회원도 지갑을 등록하면 QKEY 로 결제 가능.
 */
export default function LinkQrchatPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [wallet, setWallet] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<null | { nickname?: string; qkeyBalance?: number }>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!wallet || !nickname) {
      setError('지갑주소와 QRChat 닉네임을 모두 입력해주세요.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/user/link-qrchat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ wallet: wallet.trim(), nickname: nickname.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        setError(json?.error || '연결에 실패했습니다.');
        return;
      }
      setDone({ nickname: json?.data?.nickname, qkeyBalance: json?.data?.qkeyBalance });
    } catch {
      setError('처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-5 py-8">
      <h1 className="text-xl font-bold mb-2">QRChat 지갑 연결</h1>
      <p className="text-sm text-gray-500 mb-6">
        QRChat 지갑을 연결하면 채굴한 QKEY(쿠키)로 상품을 결제할 수 있습니다.
      </p>

      {done ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center">
          <p className="text-green-700 font-semibold">연결 완료!</p>
          <p className="mt-2 text-sm text-gray-700">
            {done.nickname ? `${done.nickname} 님, ` : ''}이제 QKEY 로 결제할 수 있습니다.
          </p>
          {typeof done.qkeyBalance === 'number' && (
            <p className="mt-1 text-sm text-gray-500">
              현재 QKEY: {done.qkeyBalance.toLocaleString()}
            </p>
          )}
          <button
            onClick={() => router.push('/products')}
            className="mt-4 w-full py-3 bg-black text-white rounded-lg text-sm font-medium"
          >
            쇼핑하러 가기
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">QRChat 지갑주소</label>
            <input
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              placeholder="0x..."
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">QRChat 닉네임</label>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="QRChat 에서 사용하는 닉네임"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <p className="text-xs text-gray-400">
            지갑주소와 닉네임이 <b>동시에</b> 일치해야 연결됩니다. (본인확인)
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-black text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {loading ? '연결 중…' : '지갑 연결하기'}
          </button>
        </form>
      )}
    </div>
  );
}
