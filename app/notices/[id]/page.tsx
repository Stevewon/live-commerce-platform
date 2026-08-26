'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import ShopNavigation from '@/components/ShopNavigation';

interface Notice {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
}

function formatDateTime(iso: string) {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}.${m}.${day} ${hh}:${mm}`;
  } catch {
    return '';
  }
}

export default function NoticeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`/api/notices/${id}`, { cache: 'no-store' });
        const json = await res.json();
        if (json?.success && json.data) {
          setNotice(json.data);
        } else {
          setNotFound(true);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  return (
    <div className="min-h-screen bg-gray-50">
      <ShopNavigation />

      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        {/* 브레드크럼 */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <Link href="/" className="hover:text-gray-700">홈</Link>
          <span>›</span>
          <Link href="/notices" className="hover:text-gray-700">공지사항</Link>
          <span>›</span>
          <span className="text-gray-700 truncate">상세</span>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 md:p-8">
            <div className="h-7 w-2/3 bg-gray-100 rounded animate-pulse mb-4" />
            <div className="h-4 w-32 bg-gray-100 rounded animate-pulse mb-8" />
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          </div>
        ) : notFound || !notice ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-gray-500 mb-6">공지사항을 찾을 수 없습니다.</p>
            <Link
              href="/notices"
              className="inline-block px-5 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800"
            >
              공지사항 목록으로
            </Link>
          </div>
        ) : (
          <>
            <article className="bg-white rounded-2xl border border-gray-100 p-6 md:p-8">
              <div className="border-b border-gray-100 pb-5 mb-6">
                <div className="flex items-start gap-2">
                  {notice.isPinned && (
                    <span className="shrink-0 mt-1 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                      📌 고정
                    </span>
                  )}
                  <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-snug">{notice.title}</h1>
                </div>
                <p className="text-sm text-gray-400 mt-2">{formatDateTime(notice.createdAt)}</p>
              </div>
              <div className="prose prose-sm md:prose max-w-none whitespace-pre-wrap break-words text-gray-800 leading-relaxed">
                {notice.content}
              </div>
            </article>

            <div className="mt-6 flex justify-center">
              <button
                onClick={() => router.push('/notices')}
                className="px-5 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50"
              >
                ← 목록으로
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
