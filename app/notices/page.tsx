'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ShopNavigation from '@/components/ShopNavigation';

interface Notice {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}.${m}.${day}`;
  } catch {
    return '';
  }
}

export default function NoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/notices', { cache: 'no-store' });
        const json = await res.json();
        if (json?.success && Array.isArray(json.data)) {
          setNotices(json.data);
        }
      } catch {
        // 실패해도 빈 목록으로 표시
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <ShopNavigation />

      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        {/* 헤더 */}
        <div className="mb-6 md:mb-8">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/" className="hover:text-gray-700">홈</Link>
            <span>›</span>
            <span className="text-gray-700">공지사항</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <span>📢</span> 공지사항
          </h1>
          <p className="text-gray-500 mt-1 text-sm md:text-base">큐알라이브의 새로운 소식과 안내를 확인하세요.</p>
        </div>

        {/* 목록 */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-white border border-gray-100 animate-pulse" />
            ))}
          </div>
        ) : notices.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
            <div className="text-4xl mb-3">🗒️</div>
            <p className="text-gray-500">등록된 공지사항이 없습니다.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
            {notices.map((n) => (
              <Link
                key={n.id}
                href={`/notices/${n.id}`}
                className="flex items-center gap-3 px-4 md:px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                {n.isPinned && (
                  <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                    📌 고정
                  </span>
                )}
                <span className="flex-1 min-w-0 truncate font-medium text-gray-900">{n.title}</span>
                <span className="shrink-0 text-xs md:text-sm text-gray-400">{formatDate(n.createdAt)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
