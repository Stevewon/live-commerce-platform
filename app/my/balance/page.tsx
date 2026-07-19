'use client';

/**
 * [v1.0.22] 내 잔액 페이지
 * - KRW / QKEY 잔액 조회
 * - 충전 신청 (KRW 무통장입금 / QKEY 송금)
 * - 잔액 증감 이력 + 충전 신청 이력
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import ShopNavigation from '@/components/ShopNavigation';
import { authFetch } from '@/lib/auth/clientFetch';
import { useLanguage } from '@/lib/i18n/LanguageContext';

// 회사 입금/수령 정보 (lib/balance.ts 와 동일)
const BANK_INFO = {
  bankName: 'IBK기업은행',
  accountNumber: '992-026554-01-015',
  accountHolder: '주식회사 퀀타리움',
};
const QKEY_WALLET = {
  address: '0xE0c166B147a742E4FbCf5e5BCf73aCA631f14f0e',
  network: '퀀타리움 자체 블록체인 (Quantarium Chain)',
};

interface Balance {
  krwBalance: number;
  qkeyBalance: number;
  qkeyBalanceInKrw: number;
}

interface LedgerRow {
  id: string;
  currency: 'KRW' | 'QKEY';
  amount: number;
  balanceAfter: number;
  reason: string;
  createdAt: string;
}

interface RequestRow {
  id: string;
  type: 'KRW_DEPOSIT' | 'QKEY_DEPOSIT';
  amount: number;
  depositorName: string | null;
  txHash: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  adminNote: string | null;
  createdAt: string;
}

export default function BalancePage() {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const dateLocaleMap: Record<string, string> = { ko: 'ko-KR', en: 'en-US', vi: 'vi-VN', th: 'th-TH', ja: 'ja-JP', zh: 'zh-CN' };
  const { user, loading: authLoading } = useAuth();

  const [balance, setBalance] = useState<Balance | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'ledger' | 'requests'>('ledger');

  // 충전 신청 폼
  const [depositType, setDepositType] = useState<'KRW_DEPOSIT' | 'QKEY_DEPOSIT'>('KRW_DEPOSIT');
  const [amount, setAmount] = useState('');
  const [depositorName, setDepositorName] = useState('');
  const [txHash, setTxHash] = useState('');
  const [senderAddress, setSenderAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login?redirect=/my/balance');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (authLoading || !user) return;
    loadAll();
  }, [user, authLoading]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [bRes, lRes, rRes] = await Promise.all([
        authFetch('/api/my/balance'),
        authFetch('/api/my/balance/ledger?limit=50'),
        authFetch('/api/balance/deposit-request?limit=30'),
      ]);
      if (bRes.ok) {
        const d = await bRes.json();
        if (d.success) setBalance(d.data);
      }
      if (lRes.ok) {
        const d = await lRes.json();
        if (d.success) setLedger(d.data || []);
      }
      if (rRes.ok) {
        const d = await rRes.json();
        if (d.success) setRequests(d.data || []);
      }
    } catch (e) {
      console.error('잔액 데이터 로드 실패:', e);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert(`${label}${t.balance.copied}`);
    } catch {
      alert(t.balance.copyFail);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseInt(amount.replace(/[^0-9]/g, ''), 10);
    if (!Number.isFinite(amt) || amt <= 0) {
      alert(t.balance.amountInvalid);
      return;
    }
    if (depositType === 'KRW_DEPOSIT') {
      if (amt < 1000) return alert(t.balance.krwMin);
      if (!depositorName.trim()) return alert(t.balance.depositorRequired);
    } else {
      if (!txHash.trim()) return alert(t.balance.txHashRequired);
    }

    const body: any = { type: depositType, amount: amt };
    if (depositType === 'KRW_DEPOSIT') {
      body.depositorName = depositorName.trim();
    } else {
      body.txHash = txHash.trim();
      if (senderAddress.trim()) body.senderAddress = senderAddress.trim();
    }

    try {
      setSubmitting(true);
      const res = await authFetch('/api/balance/deposit-request', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || t.balance.chargeFail);
      }
      alert(data.message || t.balance.chargeSuccess);
      setAmount('');
      setDepositorName('');
      setTxHash('');
      setSenderAddress('');
      setTab('requests');
      loadAll();
    } catch (err: any) {
      alert(err.message || t.balance.chargeError);
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      PENDING: 'text-yellow-700 bg-yellow-100',
      APPROVED: 'text-green-700 bg-green-100',
      REJECTED: 'text-red-700 bg-red-100',
    };
    const label: Record<string, string> = {
      PENDING: t.balance.statusPending,
      APPROVED: t.balance.statusApproved,
      REJECTED: t.balance.statusRejected,
    };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${map[status] || 'text-gray-700 bg-gray-100'}`}>
        {label[status] || status}
      </span>
    );
  };

  const fmtDate = (s: string) => {
    try {
      return new Date(s).toLocaleString(dateLocaleMap[locale] || 'ko-KR', { dateStyle: 'medium', timeStyle: 'short' } as any);
    } catch {
      return s;
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16 md:pb-0">
      <ShopNavigation />

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-4xl">
        <div className="mb-6 flex items-center gap-2">
          <Link href="/my" className="text-gray-400 hover:text-gray-600 text-sm">← {t.balance.myPage}</Link>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">💰 {t.balance.title}</h1>

        {/* 잔액 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
            <div className="text-sm text-gray-500 mb-1">{t.balance.krwBalance}</div>
            <div className="text-3xl font-bold text-blue-600">
              {loading ? '...' : `₩${(balance?.krwBalance ?? 0).toLocaleString()}`}
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
            <div className="text-sm text-gray-500 mb-1">{t.balance.qkeyBalance}</div>
            <div className="text-3xl font-bold text-indigo-600">
              {loading ? '...' : `${(balance?.qkeyBalance ?? 0).toLocaleString()} QKEY`}
            </div>
            {!loading && (
              <div className="text-xs text-gray-400 mt-1">≈ ₩{(balance?.qkeyBalanceInKrw ?? 0).toLocaleString()} ({t.checkout.qkeyRate})</div>
            )}
          </div>
        </div>

        {/* 충전 신청 폼 */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">{t.balance.chargeRequest}</h2>

          {/* 타입 선택 */}
          <div className="flex gap-2 mb-5">
            <button
              type="button"
              onClick={() => setDepositType('KRW_DEPOSIT')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition ${depositType === 'KRW_DEPOSIT' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}
            >
              {t.balance.krwDeposit}
            </button>
            <button
              type="button"
              onClick={() => setDepositType('QKEY_DEPOSIT')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition ${depositType === 'QKEY_DEPOSIT' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600'}`}
            >
              {t.balance.qkeyTransfer}
            </button>
          </div>

          {/* 입금/송금 안내 */}
          {depositType === 'KRW_DEPOSIT' ? (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4 text-sm space-y-1.5">
              <p className="font-semibold text-blue-800">{t.balance.depositGuideKrw}</p>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">{BANK_INFO.bankName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono font-semibold text-gray-900">{BANK_INFO.accountNumber}</span>
                <button type="button" onClick={() => copyToClipboard(BANK_INFO.accountNumber, t.balance.accountNumberLabel)} className="text-xs text-blue-600 underline">{t.balance.copy}</button>
              </div>
              <div className="text-gray-600">{t.balance.accountHolder}: {BANK_INFO.accountHolder}</div>
            </div>
          ) : (
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 mb-4 text-sm space-y-1.5">
              <p className="font-semibold text-indigo-800">{t.balance.depositGuideQkey}</p>
              <div className="text-gray-600">{QKEY_WALLET.network}</div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-gray-900 break-all">{QKEY_WALLET.address}</span>
                <button type="button" onClick={() => copyToClipboard(QKEY_WALLET.address, t.balance.walletAddressLabel)} className="text-xs text-indigo-600 underline flex-shrink-0">{t.balance.copy}</button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {depositType === 'KRW_DEPOSIT' ? t.balance.chargeAmountKrw : t.balance.chargeAmountQkey}
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder={depositType === 'KRW_DEPOSIT' ? '예: 50000' : '예: 5000'}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {amount && depositType === 'QKEY_DEPOSIT' && (
                <p className="text-xs text-gray-400 mt-1">≈ ₩{(parseInt(amount, 10) * 10).toLocaleString()}</p>
              )}
            </div>

            {depositType === 'KRW_DEPOSIT' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.balance.depositorName}</label>
                <input
                  type="text"
                  value={depositorName}
                  onChange={(e) => setDepositorName(e.target.value)}
                  placeholder={t.balance.depositorPlaceholder}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.balance.txHash}</label>
                  <input
                    type="text"
                    value={txHash}
                    onChange={(e) => setTxHash(e.target.value)}
                    placeholder={t.balance.txHashPlaceholder}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.balance.senderAddress}</label>
                  <input
                    type="text"
                    value={senderAddress}
                    onChange={(e) => setSenderAddress(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm"
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 transition"
            >
              {submitting ? t.balance.requesting : t.balance.submitCharge}
            </button>
            <p className="text-xs text-gray-400 text-center">{t.balance.adminApproveNote}</p>
          </form>
        </div>

        {/* 탭: 이력 / 신청내역 */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setTab('ledger')}
              className={`flex-1 py-3 text-sm font-semibold transition ${tab === 'ledger' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
            >
              {t.balance.ledgerTab}
            </button>
            <button
              onClick={() => setTab('requests')}
              className={`flex-1 py-3 text-sm font-semibold transition ${tab === 'requests' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
            >
              {t.balance.requestsTab}
            </button>
          </div>

          <div className="p-4 sm:p-6">
            {loading ? (
              <div className="text-center py-8 text-gray-400">{t.balance.loading}</div>
            ) : tab === 'ledger' ? (
              ledger.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">{t.balance.noLedger}</div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {ledger.map((row) => (
                    <li key={row.id} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{row.reason}</div>
                        <div className="text-xs text-gray-400">{fmtDate(row.createdAt)}</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-bold ${row.amount >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {row.amount >= 0 ? '+' : ''}
                          {row.amount.toLocaleString()} {row.currency}
                        </div>
                        <div className="text-xs text-gray-400">{t.balance.balanceLabel} {row.balanceAfter.toLocaleString()}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )
            ) : requests.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">{t.balance.noRequests}</div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {requests.map((r) => (
                  <li key={r.id} className="py-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm font-medium text-gray-900">
                        {r.type === 'KRW_DEPOSIT' ? `${t.balance.krwBalance} +₩${r.amount.toLocaleString()}` : `${t.balance.qkeyBalance} +${r.amount.toLocaleString()} QKEY`}
                      </div>
                      {statusBadge(r.status)}
                    </div>
                    <div className="text-xs text-gray-400">
                      {r.type === 'KRW_DEPOSIT' && r.depositorName ? `${t.balance.depositor}: ${r.depositorName} · ` : ''}
                      {r.type === 'QKEY_DEPOSIT' && r.txHash ? `TX: ${r.txHash.slice(0, 12)}… · ` : ''}
                      {fmtDate(r.createdAt)}
                    </div>
                    {r.status === 'REJECTED' && r.adminNote && (
                      <div className="text-xs text-red-500 mt-1">{t.balance.reason}: {r.adminNote}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
