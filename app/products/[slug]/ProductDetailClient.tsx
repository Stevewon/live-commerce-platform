'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/contexts/AuthContext';
import { authFetch } from '@/lib/auth/clientFetch';
import { addToGuestCart } from '@/lib/utils/guestCart';
import { buildOptionLabel } from '@/lib/utils/optionLabel';
import ShopNavigation from '@/components/ShopNavigation';
import ProductReviews from '@/components/ProductReviews';
import ProductQnA from '@/components/ProductQnA';
import { krwToQkeyDisplay, krwToQtaDisplay } from '@/lib/utils/qkey';
import { proxyImg, thumbUrl } from '@/lib/utils/imgProxy';
import { useAutoTranslate } from '@/lib/i18n/useAutoTranslate';

interface Partner {
  id: string;
  storeName: string;
  logo: string | null;
  user: { name: string; email: string };
}

interface PartnerProduct {
  id: string;
  customPrice: number | null;
  partner: Partner;
}

interface Review {
  id: string;
  rating: number;
  content: string;
  images: string | null;
  createdAt: string;
  user: { name: string };
}

interface ProductVariant {
  id: string;
  optionValues: string;
  price: number | null;
  comparePrice: number | null;
  stock: number;
  sku: string | null;
  thumbnail: string | null;
  isActive: boolean;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  detailContent: string | null;
  price: number;
  comparePrice: number | null;
  stock: number;
  sku: string | null;
  images: string;
  detailImages: string | null;
  thumbnail: string;
  specifications: string | null;
  origin: string | null;
  manufacturer: string | null;
  brand: string | null;
  tags: string | null;
  hasOptions: boolean;
  optionNames: string | null;
  shippingInfo: string | null;
  returnInfo: string | null;
  bottomBannerImage: string | null;
  bottomBannerLink: string | null;
  bottomBannerPosition: string | null;
  isActive: boolean;
  isFeatured: boolean;
  category: { id: string; name: string; slug: string };
  partnerProducts: PartnerProduct[];
  reviews: Review[];
  variants: ProductVariant[];
}

const CATEGORY_ICONS: Record<string, string> = {
  electronics: '📱', beauty: '💄', food: '🍯', fashion: '👕',
  home: '🏠', sports: '⚽', kids: '👶', books: '📚',
};

export default function ProductDetailClient({ initialProduct = null }: { initialProduct?: Product | null }) {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const slug = params.slug as string;

  // 파트너 스토어를 통한 접속인지 확인
  const storeSlug = searchParams.get('store');
  const partnerId = searchParams.get('partner');

  // 서버에서 미리 조회한 상품이 있으면 그것으로 시작 → 스피너 없이 즉시 표시(쿠팡식)
  const [product, setProduct] = useState<Product | null>(initialProduct);
  const [loading, setLoading] = useState(!initialProduct);
  const [error, setError] = useState('');
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'detail' | 'specs' | 'sellers' | 'reviews' | 'qna'>('detail');
  const tabsSectionRef = useRef<HTMLDivElement>(null);

  // 리뷰 탭으로 전환 + 해당 섹션으로 스크롤
  const goToReviews = () => {
    setActiveTab('reviews');
    setTimeout(() => {
      tabsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartMessage, setCartMessage] = useState('');
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null); // 마지막으로 고른 옵션(가격 표시용)
  // [옵션 여러 개 담기] 쿠팡식: 옵션을 고를 때마다 행이 추가되고 행마다 수량 조절
  //   예) 핑크/M 1개 + 블루/L 1개를 한 번에 장바구니·바로구매·선물
  const [optionRows, setOptionRows] = useState<Array<{ variant: ProductVariant; quantity: number }>>([]);

  // ===== 공유하기 / 선물하기 =====
  const [shareMessage, setShareMessage] = useState('');      // 공유 완료 토스트
  const [showGiftModal, setShowGiftModal] = useState(false); // 선물 모달 표시
  const [giftMessage, setGiftMessage] = useState('');        // 선물 메시지(카드)
  // 받는 분: 큐라이브/큐알쳇 회원 닉네임 검색 후 선택
  const [giftQuery, setGiftQuery] = useState('');            // 닉네임 검색어
  const [giftSearching, setGiftSearching] = useState(false); // 검색 중
  const [giftResults, setGiftResults] = useState<Array<{ userId: string; nickname: string; maskedName: string; maskedPhone: string; origin: string }>>([]);
  const [giftRecipient, setGiftRecipient] = useState<{ userId: string; nickname: string; maskedName: string; origin: string } | null>(null); // 선택된 받는 분

  // 동적 배송비 설정
  const [shippingConfig, setShippingConfig] = useState({ shippingFee: 3000, freeShippingThreshold: 50000 });

  // 동적 텍스트(상품명/카테고리/브랜드/설명) 자동 번역
  const { tr } = useAutoTranslate([
    product?.name,
    product?.category?.name,
    product?.brand,
    product?.description,
  ].filter(Boolean) as string[]);

  useEffect(() => {
    fetch('/api/settings/shipping')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setShippingConfig(data.data);
        }
      })
      .catch(() => {});
  }, []);

  // 선물하기: 닉네임 검색어 디바운스(300ms) 후 회원 검색
  useEffect(() => {
    if (!showGiftModal) return;
    const q = giftQuery.trim();
    if (q.length < 1) {
      setGiftResults([]);
      return;
    }
    const timer = setTimeout(() => {
      searchRecipients(q);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [giftQuery, showGiftModal]);

  useEffect(() => {
    // 서버에서 이미 완전한 상품 데이터를 받았으면 재조회하지 않는다(즉시 표시).
    // initialProduct 가 없을 때(직접 API 라우팅 등)만 클라이언트에서 조회.
    if (initialProduct) return;
    if (slug) fetchProduct();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // 뒤로가기(브라우저/앱 WebView 네이티브 뒤로가기 포함) 처리
  //
  // ★ 사장님 지시 (2026-08-05 최신):
  //   상세페이지에서 뒤로가기 1번 → "상품을 누르기 바로 직전 단계"로 가야 한다.
  //     (그 상품이 있던 목록의 스크롤/필터/페이지 상태 그대로 = 브라우저 히스토리상 직전 페이지)
  //   거기서 뒤로가기 또 1번 → 그 다음 자연스러운 이전 단계(예: 카테고리)로.
  //   → 즉, 특정 URL 로 강제 점프(shopGuard + location.assign)를 하면 안 되고,
  //     "브라우저 기본 뒤로가기 히스토리"를 그대로 살려야 한다.
  //
  //   단, 예외: 앱 WebView 등에서 상세로 '직접 진입'(딥링크/새 탭)한 경우엔
  //   뒤 히스토리에 쇼핑몰이 없어 뒤로가기 한 번에 WebView 가 닫히며 앱 메인으로 나가버린다.
  //   이 "직접 진입" 케이스에서만 뒤로가기 1회를 목록으로 보정한다.
  const categorySlug = product?.category?.slug || null;

  // "직접 진입" fallback 목적지 (사이트 내부에서 클릭해 들어온 게 아닐 때만 사용).
  //   ① from 쿼리(목록에서 심어준 왔던 URL) → ② 카테고리 목록 → ③ 쇼핑 메인
  const resolveFallbackTarget = (): string => {
    const PRODUCTS_HOME = '/products';
    if (typeof window === 'undefined') {
      return categorySlug ? `${PRODUCTS_HOME}?category=${encodeURIComponent(categorySlug)}` : PRODUCTS_HOME;
    }
    try {
      const from = new URLSearchParams(window.location.search).get('from');
      if (from) {
        const dec = decodeURIComponent(from);
        const isInternal = dec.startsWith('/') && !dec.startsWith('//');
        const isAllowed = /^\/(products|store|shop|cart|wishlist|lives|live|my|my-orders|orders|search)(\/|\?|$)/.test(dec);
        if (isInternal && isAllowed) return dec;
      }
    } catch { /* noop */ }
    if (categorySlug) return `${PRODUCTS_HOME}?category=${encodeURIComponent(categorySlug)}`;
    return PRODUCTS_HOME;
  };

  // 화면 뒤로가기 버튼 클릭 핸들러.
  //   - 사이트 내부에서 클릭해 들어왔으면 → 브라우저 기본 뒤로가기(직전 페이지)로.
  //   - 직접 진입(딥링크 등, 뒤 히스토리 없음)이면 → 목록 fallback 으로 이동.
  const handleBackButton = () => {
    if (typeof window === 'undefined') return;
    let cameFromInsideSite = false;
    try {
      if (document.referrer) {
        const ref = new URL(document.referrer);
        cameFromInsideSite = ref.origin === window.location.origin;
      }
    } catch { /* noop */ }
    if (cameFromInsideSite && window.history.length > 1) {
      window.history.back();
    } else {
      window.location.assign(resolveFallbackTarget());
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // "사이트 내부에서 클릭해 들어왔는가?" 판별.
    //   - 같은 오리진 referrer 가 있으면 = 사이트 안에서 링크를 눌러 들어온 것 → 뒤 히스토리 존재.
    //   - referrer 가 없거나 외부면 = 딥링크/직접 진입/새 탭 → 뒤 히스토리에 쇼핑몰 없음.
    let cameFromInsideSite = false;
    try {
      if (document.referrer) {
        const ref = new URL(document.referrer);
        cameFromInsideSite = ref.origin === window.location.origin;
      }
    } catch { /* noop */ }

    // (A) 사이트 내부 유입 → 아무것도 하지 않는다.
    //     방어 엔트리도 안 쌓고 popstate 도 가로채지 않는다.
    //     그래야 뒤로가기가 "직전 페이지(상품 클릭 직전)"로 정상 동작하고,
    //     한 번 더 누르면 그 이전 단계로 자연스럽게 이어진다.
    if (cameFromInsideSite) {
      return;
    }

    // (B) 직접 진입(딥링크 등) → 뒤로가기 시 앱/브라우저가 쇼핑몰 밖으로 나가버리므로,
    //     방어 엔트리 1개만 쌓아 두고, 그게 소비되는 첫 뒤로가기 때 목록으로 1회 보정한다.
    let guarded = false;
    try {
      window.history.pushState({ shopGuard: true }, '', window.location.href);
      guarded = true;
    } catch { /* noop */ }

    const handlePopState = () => {
      if (!guarded) return;
      guarded = false; // 1회성 — 이후엔 브라우저 기본 동작에 맡긴다.
      const target = resolveFallbackTarget();
      // SPA 라우팅은 WebView 가 '뒤로가기 완료'로 인식 못 하는 경우가 있어 하드 이동.
      window.location.assign(target);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [router, categorySlug]);

  const fetchProduct = async () => {
    try {
      const res = await fetch(`/api/products?slug=${slug}`);
      const data = await res.json();
      if (data.success && data.data?.length > 0) {
        const p = data.data[0];
        // Ensure reviews and partnerProducts are always arrays
        if (!Array.isArray(p.reviews)) p.reviews = [];
        if (!Array.isArray(p.partnerProducts)) p.partnerProducts = [];
        if (!Array.isArray(p.variants)) p.variants = [];
        setProduct(p);
      } else {
        setError('상품을 찾을 수 없습니다.');
      }
    } catch {
      setError('상품 정보를 불러오는 데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ShopNavigation />
        <div className="max-w-6xl mx-auto px-4 py-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">상품 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ShopNavigation />
        <div className="max-w-6xl mx-auto px-4 py-12 text-center">
          <span className="text-6xl block mb-4">😢</span>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{error || '상품을 찾을 수 없습니다'}</h1>
          <Link href="/products" className="text-blue-600 hover:underline">상품 목록으로 돌아가기</Link>
        </div>
      </div>
    );
  }

  // Parse images
  let galleryImages: string[] = [];
  try {
    galleryImages = typeof product.images === 'string' ? JSON.parse(product.images) : product.images;
  } catch { galleryImages = []; }
  if (!galleryImages.length && product.thumbnail) galleryImages = [product.thumbnail];

  // Parse detail images
  let detailImages: string[] = [];
  try {
    if (product.detailImages) {
      detailImages = typeof product.detailImages === 'string' ? JSON.parse(product.detailImages) : product.detailImages;
    }
  } catch { detailImages = []; }

  // Parse specifications
  let specs: { key: string; value: string }[] = [];
  try {
    if (product.specifications) {
      specs = typeof product.specifications === 'string' ? JSON.parse(product.specifications) : product.specifications;
    }
  } catch { specs = []; }

  // Parse option names
  let optionNames: string[] = [];
  try {
    if (product.optionNames) {
      optionNames = typeof product.optionNames === 'string' ? JSON.parse(product.optionNames) : product.optionNames;
    }
  } catch { optionNames = []; }

  // Parse tags
  const tags = product.tags ? product.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

  // Price
  const currentPrice = selectedVariant?.price ?? product.price;
  const currentComparePrice = selectedVariant?.comparePrice ?? product.comparePrice;
  const currentStock = selectedVariant?.stock ?? product.stock;
  const discountPercent = currentComparePrice && currentComparePrice > currentPrice
    ? Math.round(((currentComparePrice - currentPrice) / currentComparePrice) * 100)
    : 0;
  // [정책] 전 상품 무조건 무료배송 — 가격과 무관하게 항상 무료배송 표시
  const shippingFree = true;

  // Average rating - safely handle reviews possibly being undefined or not an array
  const safeReviews = Array.isArray(product.reviews) ? product.reviews : [];
  const avgRating = safeReviews.length > 0
    ? (safeReviews.reduce((s, r) => s + (r.rating || 0), 0) / safeReviews.length).toFixed(1)
    : null;

  // 옵션이 있는 상품인지 (옵션 선택 필수 판정)
  const optionRequired = !!(product.hasOptions && Array.isArray(product.variants) && product.variants.length > 0);

  // ★★★ 2026-08-15 수정 (사장님 요구): 옵션이 있는 상품인데 옵션을 안 고르고
  //   담기/구매를 누르면 반드시 "경고창(alert)"을 띄워 옵션 선택을 요구한다.
  //   (기존엔 작은 인라인 메시지라 모바일/앱에서 눈에 안 띄어 '반응 없음'처럼 느껴졌음)
  //   alert 은 앱 WebView에서도 화면 중앙에 확실히 뜨는 네이티브 다이얼로그다.
  //   반환값 true = 옵션 미선택으로 진행을 막아야 함.
  // 구매할 행 목록: 옵션 상품은 고른 옵션 행들, 일반 상품은 단일 행
  const lineItems = optionRequired
    ? optionRows.map(r => ({
        variant: r.variant as ProductVariant | null,
        quantity: r.quantity,
        price: r.variant.price ?? product.price,
      }))
    : [{ variant: null as ProductVariant | null, quantity, price: product.price }];
  const totalQuantity = lineItems.reduce((s, li) => s + li.quantity, 0);
  const totalPrice = lineItems.reduce((s, li) => s + li.price * li.quantity, 0);

  // 옵션 선택 → 행 추가 (이미 있으면 수량 +1, 재고 한도 내)
  const addOptionRow = (variant: ProductVariant) => {
    setSelectedVariant(variant);
    setOptionRows(prev => {
      const idx = prev.findIndex(r => r.variant.id === variant.id);
      if (idx < 0) return [...prev, { variant, quantity: 1 }];
      const next = [...prev];
      next[idx] = { ...next[idx], quantity: Math.min(variant.stock, next[idx].quantity + 1) };
      return next;
    });
  };
  const changeOptionRowQty = (variantId: string, delta: number) => {
    setOptionRows(prev => prev.map(r =>
      r.variant.id === variantId
        ? { ...r, quantity: Math.max(1, Math.min(r.variant.stock, r.quantity + delta)) }
        : r
    ));
  };
  const removeOptionRow = (variantId: string) => {
    setOptionRows(prev => prev.filter(r => r.variant.id !== variantId));
  };

  // 바로구매/선물하기로 checkout 에 넘길 행들
  const buildBuyNowItems = () =>
    lineItems.map(li => ({
      productId: product.id,
      quantity: li.quantity,
      variantId: li.variant?.id || null,
      optionLabel: li.variant ? buildOptionLabel(li.variant.optionValues) : null,
      product: {
        id: product.id,
        name: product.name,
        price: li.price,
        thumbnail: product.thumbnail,
      },
    }));

  const warnIfOptionNotSelected = (): boolean => {
    if (optionRequired && optionRows.length === 0) {
      if (typeof window !== 'undefined') {
        window.alert('옵션을 선택해주세요.');
        document.getElementById('product-options')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return true;
    }
    return false;
  };

  const handleAddToCart = async () => {
    if (currentStock <= 0) return;
    // [옵션 필수] 옵션이 있는 상품은 반드시 옵션을 선택해야 담기/구매 가능 → 경고창
    if (warnIfOptionNotSelected()) return;
    setAddingToCart(true);
    setCartMessage('');

    try {
      if (user) {
        // 옵션 행마다 담기 — 서버는 productId+variantId 별로 별도 행으로 저장
        let allOk = true;
        for (const li of lineItems) {
          const res = await authFetch('/api/cart', {
            method: 'POST',
            body: JSON.stringify({
              productId: product.id,
              variantId: li.variant?.id || null,
              quantity: li.quantity,
            }),
          });
          if (!res.ok) allOk = false;
        }
        if (allOk) {
          // 파트너 스토어 경유 시 partnerId를 sessionStorage에 저장
          if (partnerId) {
            sessionStorage.setItem('checkout_partnerId', partnerId);
            if (storeSlug) {
              sessionStorage.setItem('checkout_storeSlug', storeSlug);
            }
          }
          setCartMessage('장바구니에 추가되었습니다!');
        } else {
          setCartMessage('장바구니 추가에 실패했습니다.');
        }
      } else {
        for (const li of lineItems) {
          addToGuestCart({
            productId: product.id,
            variantId: li.variant?.id || null,
            optionLabel: li.variant ? buildOptionLabel(li.variant.optionValues) : null,
            quantity: li.quantity,
            product: {
              id: product.id,
              name: product.name,
              slug: product.slug,
              price: li.price,
              comparePrice: li.variant ? null : product.comparePrice,
              stock: li.variant ? li.variant.stock : product.stock,
              thumbnail: product.thumbnail,
              category: product.category,
            },
            addedAt: new Date().toISOString(),
          });
        }
        // 파트너 스토어 경유 시 partnerId를 sessionStorage에 저장
        if (partnerId) {
          sessionStorage.setItem('checkout_partnerId', partnerId);
          if (storeSlug) {
            sessionStorage.setItem('checkout_storeSlug', storeSlug);
          }
        }
        setCartMessage('장바구니에 추가되었습니다!');
      }
    } catch {
      setCartMessage('장바구니 추가에 실패했습니다.');
    } finally {
      setAddingToCart(false);
      setTimeout(() => setCartMessage(''), 3000);
    }
  };

  const handleBuyNow = async () => {
    // [옵션 필수] 옵션이 있는 상품은 반드시 옵션을 선택해야 구매 가능 → 경고창
    if (warnIfOptionNotSelected()) return;
    // 바로구매: 장바구니에 넣지 않고 sessionStorage에 바로구매 행들(옵션별)만 저장 후 checkout으로 이동
    try {
      sessionStorage.setItem('buyNowItems', JSON.stringify(buildBuyNowItems()));
      sessionStorage.removeItem('buyNowItem');
      // 파트너 스토어 경유 시 partnerId를 sessionStorage에 저장
      if (partnerId) {
        sessionStorage.setItem('checkout_partnerId', partnerId);
        if (storeSlug) {
          sessionStorage.setItem('checkout_storeSlug', storeSlug);
        }
      }
    } catch {}
    router.push('/checkout?mode=buynow');
  };

  // ===== 공유하기 =====
  //  1) navigator.share 지원(모바일 대부분) → 네이티브 공유 시트
  //  2) 미지원(데스크톱 등) → URL 클립보드 복사 후 토스트
  const handleShare = async () => {
    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
    const shareData = {
      title: product.name,
      text: `${product.name} - 큐라이브`,
      url: shareUrl,
    };
    try {
      if (typeof navigator !== 'undefined' && (navigator as any).share) {
        await (navigator as any).share(shareData);
        return;
      }
    } catch {
      // 사용자가 공유 시트를 취소한 경우 등 → 조용히 무시
      return;
    }
    // 폴백: 클립보드 복사
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const ta = document.createElement('textarea');
        ta.value = shareUrl;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setShareMessage('상품 링크가 복사되었습니다!');
      setTimeout(() => setShareMessage(''), 2500);
    } catch {
      setShareMessage('링크 복사에 실패했습니다. 주소창의 URL을 복사해주세요.');
      setTimeout(() => setShareMessage(''), 3000);
    }
  };

  // ===== 선물하기 =====
  //  받는 분을 "큐라이브/큐알쳇 회원 닉네임 검색" 으로 선택한 뒤 결제로 이동.
  //  선물 정보(받는 분 userId/닉네임 + 메시지)를 sessionStorage 로 checkout 에 전달.
  const openGiftModal = () => {
    if (currentStock <= 0) return;
    if (warnIfOptionNotSelected()) return;
    // 로그인해야 회원 검색이 가능
    if (!user) {
      alert('선물하기는 로그인 후 이용하실 수 있습니다.');
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    // 상태 초기화 후 열기
    setGiftQuery('');
    setGiftResults([]);
    setGiftRecipient(null);
    setGiftMessage('');
    setShowGiftModal(true);
  };

  // 닉네임 검색 (디바운스는 아래 useEffect 에서 처리)
  const searchRecipients = async (q: string) => {
    const query = q.trim();
    if (query.length < 1) {
      setGiftResults([]);
      return;
    }
    setGiftSearching(true);
    try {
      const res = await authFetch(`/api/users/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setGiftResults(data.data);
      } else {
        setGiftResults([]);
      }
    } catch {
      setGiftResults([]);
    } finally {
      setGiftSearching(false);
    }
  };

  const submitGift = () => {
    if (!giftRecipient) {
      alert('선물 받으실 회원(닉네임)을 검색해서 선택해주세요.');
      return;
    }

    const giftInfo = {
      isGift: true,
      recipientUserId: giftRecipient.userId,
      recipientNickname: giftRecipient.nickname,
      recipientName: giftRecipient.maskedName,
      recipientOrigin: giftRecipient.origin,
      message: giftMessage.trim(),
    };

    try {
      sessionStorage.setItem('buyNowItems', JSON.stringify(buildBuyNowItems()));
      sessionStorage.removeItem('buyNowItem');
      sessionStorage.setItem('checkout_gift', JSON.stringify(giftInfo));
      if (partnerId) {
        sessionStorage.setItem('checkout_partnerId', partnerId);
        if (storeSlug) sessionStorage.setItem('checkout_storeSlug', storeSlug);
      }
    } catch {}
    setShowGiftModal(false);
    router.push('/checkout?mode=buynow&gift=1');
  };

  const tabs = [
    { id: 'detail' as const, label: '상세정보' },
    { id: 'specs' as const, label: '상품정보' },
    { id: 'reviews' as const, label: `⭐ 리뷰 (${safeReviews.length})` },
    { id: 'sellers' as const, label: `판매자 (${(product.partnerProducts || []).length})` },
    { id: 'qna' as const, label: 'Q&A' },
  ];

  // ===== 상세페이지 배너 (상품별 개별 프로모션 배너) =====
  //   위치(bottomBannerPosition): 'top' | 'bottom' | 'both' (기본 'bottom')
  //   클릭 시 반드시 새 창(target=_blank)으로 링크 이동. 링크 없으면 이미지로만 노출.
  const bannerPosition = product.bottomBannerPosition || 'bottom';
  const showTopBanner = !!product.bottomBannerImage && (bannerPosition === 'top' || bannerPosition === 'both');
  const showBottomBanner = !!product.bottomBannerImage && (bannerPosition === 'bottom' || bannerPosition === 'both');
  const renderBanner = (extraClass = '') => {
    if (!product.bottomBannerImage) return null;
    const img = (
      <img
        src={product.bottomBannerImage}
        alt={`${product.name} 배너`}
        className="w-full h-auto object-cover block"
        loading="lazy"
      />
    );
    return (
      <div className={`max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 ${extraClass}`}>
        {product.bottomBannerLink ? (
          <a
            href={product.bottomBannerLink}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
          >
            {img}
          </a>
        ) : (
          <div className="block rounded-xl overflow-hidden shadow-sm">{img}</div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-0">
      <ShopNavigation />

      {/* 상단 배너 (position: top | both) */}
      {showTopBanner && renderBanner('mt-4 mb-2')}

      <div className="max-w-6xl mx-auto px-4 py-4 sm:py-8">
        {/* 파트너 스토어 경유 배너 */}
        {storeSlug && (
          <div className="mb-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-lg">🏪</span>
              <span className="text-blue-700 font-medium">파트너 스토어를 통해 접속하셨습니다</span>
            </div>
            <Link
              href={`/store/${storeSlug}`}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium hover:underline"
            >
              스토어로 돌아가기 &rarr;
            </Link>
          </div>
        )}

        {/* Breadcrumb — 모바일: 컴팩트(뒤로+카테고리만), 데스크톱: 전체 경로 */}
        {/* 모바일 전용: 상품명까지 넣으면 좁은 화면에서 줄이 밀려 상단이 지저분해짐 → 뒤로가기 + 카테고리만 */}
        <nav className="sm:hidden mb-3 flex items-center gap-1.5 text-sm text-gray-600">
          <button
            type="button"
            onClick={handleBackButton}
            className="inline-flex items-center gap-1 px-2 py-1 -ml-2 rounded-md hover:bg-gray-100 active:bg-gray-200 shrink-0"
            aria-label="뒤로"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <Link
            href={`/products?category=${product.category.slug}`}
            className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 font-medium truncate max-w-[60%]"
          >
            {tr(product.category.name)}
          </Link>
        </nav>

        {/* 데스크톱 전용: 전체 경로 */}
        <nav className="hidden sm:flex text-sm text-gray-500 mb-4 items-center gap-2">
          <Link href="/products" className="hover:text-gray-700">홈</Link>
          <span>/</span>
          <Link href="/products" className="hover:text-gray-700">전체상품</Link>
          <span>/</span>
          <Link href={`/products?category=${product.category.slug}`} className="hover:text-gray-700">{tr(product.category.name)}</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium truncate">{tr(product.name)}</span>
        </nav>

        {/* Product main section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10">
          {/* Image gallery */}
          <div>
            <div className="relative aspect-square bg-white rounded-xl overflow-hidden border">
              <img
                src={thumbUrl(galleryImages[selectedImage] || product.thumbnail, 600)}
                alt={product.name}
                width={600}
                height={600}
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement!.innerHTML = `<div class="w-full h-full flex items-center justify-center text-8xl opacity-30">${CATEGORY_ICONS[product.category?.slug] || '📦'}</div>`;
                }}
              />
              {product.isFeatured && (
                <span className="absolute top-3 left-3 bg-red-500 text-white text-xs px-3 py-1 rounded-full font-bold">BEST</span>
              )}
              {discountPercent > 0 && (
                <span className="absolute top-3 right-3 bg-yellow-400 text-gray-900 text-xs px-3 py-1 rounded-full font-bold">{discountPercent}% OFF</span>
              )}
            </div>

            {/* Thumbnail strip */}
            {galleryImages.length > 1 && (
              <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                {galleryImages.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition ${
                      selectedImage === i ? 'border-blue-500' : 'border-transparent hover:border-gray-300'
                    }`}
                  >
                    <img src={thumbUrl(url, 200)} alt={`${product.name} ${i + 1}`} loading="lazy" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product info */}
          <div className="space-y-4">
            {/* Category & Brand */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-500">{tr(product.category.name)}</span>
              {product.brand && (
                <>
                  <span className="text-gray-300">|</span>
                  <span className="text-sm font-medium text-gray-700">{tr(product.brand)}</span>
                </>
              )}
            </div>

            {/* Name */}
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-snug">{tr(product.name)}</h1>

            {/* Rating — 클릭하면 리뷰 탭으로 이동 */}
            <button
              type="button"
              onClick={goToReviews}
              className="flex items-center gap-2 group"
            >
              {avgRating ? (
                <>
                  <div className="flex text-yellow-400 text-sm">
                    {'★'.repeat(Math.round(Number(avgRating)))}
                    {'☆'.repeat(5 - Math.round(Number(avgRating)))}
                  </div>
                  <span className="text-sm text-gray-600 group-hover:text-blue-600 underline-offset-2 group-hover:underline">
                    {avgRating} ({safeReviews.length}개 리뷰) 보기 ›
                  </span>
                </>
              ) : (
                <span className="text-sm text-purple-600 font-medium group-hover:underline underline-offset-2">
                  ⭐ 리뷰 {safeReviews.length}개 · 리뷰 보기/작성 ›
                </span>
              )}
            </button>

            {/* Price */}
            <div className="bg-gray-50 rounded-lg p-4">
              {discountPercent > 0 && (
                <p className="text-sm text-gray-400 line-through mb-1">
                  ₩{currentComparePrice?.toLocaleString()}
                </p>
              )}
              <div className="flex items-baseline gap-3">
                {discountPercent > 0 && (
                  <span className="text-2xl font-bold text-red-500">{discountPercent}%</span>
                )}
                <span className="text-2xl sm:text-3xl font-bold text-gray-900">
                  ₩{currentPrice.toLocaleString()}
                </span>
              </div>
              {/* [qkey 표시] 1 쿠키 = 10원 + QTA 적립 안내(현금결제 5%) */}
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                  <span aria-hidden>🍪</span>
                  {krwToQkeyDisplay(currentPrice).toLocaleString()} 쿠키
                </span>
                {krwToQtaDisplay(currentPrice) > 0 && (
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                    <span aria-hidden>🎁</span>
                    현금결제 시 {krwToQtaDisplay(currentPrice).toLocaleString()} QTA 적립
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-2 text-sm">
                {shippingFree ? (
                  <span className="text-green-600 font-medium">무료배송</span>
                ) : (
                  <span className="text-gray-500">
                    {shippingConfig.shippingFee === 0
                      ? '전 상품 무료배송'
                      : shippingConfig.freeShippingThreshold > 0
                        ? `배송비 ₩${shippingConfig.shippingFee.toLocaleString()} (₩${shippingConfig.freeShippingThreshold.toLocaleString()} 이상 무료)`
                        : `배송비 ₩${shippingConfig.shippingFee.toLocaleString()}`}
                  </span>
                )}
              </div>
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag, i) => (
                  <Link
                    key={i}
                    href={`/products?search=${encodeURIComponent(tag)}`}
                    className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full hover:bg-blue-100 transition"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            )}

            {/* Product Variants / Options */}
            {product.hasOptions && product.variants && product.variants.length > 0 && (
              <div id="product-options" className="space-y-3 scroll-mt-20">
                <h3 className="text-sm font-semibold text-gray-700">
                  옵션 선택 <span className="text-red-500">*</span>
                  {optionRequired && optionRows.length === 0 && (
                    <span className="ml-2 text-xs font-normal text-red-500">옵션을 선택해주세요</span>
                  )}
                  {optionRows.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-gray-500">다른 옵션을 눌러 함께 담을 수 있어요</span>
                  )}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {product.variants.map((variant) => {
                    let optVals: Record<string, string> = {};
                    try { optVals = JSON.parse(variant.optionValues); } catch {}
                    const label = Object.values(optVals).join(' / ');
                    const isSelected = optionRows.some(r => r.variant.id === variant.id);
                    const isAvailable = variant.stock > 0;

                    return (
                      <button
                        key={variant.id}
                        onClick={() => addOptionRow(variant)}
                        disabled={!isAvailable}
                        className={`min-h-[44px] px-3 py-2 text-sm rounded-lg border text-left transition ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                            : isAvailable
                              ? 'border-gray-200 hover:border-gray-400 text-gray-700'
                              : 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                        }`}
                      >
                        <span>{label}</span>
                        {variant.price && variant.price !== product.price && (
                          <span className="block text-xs mt-0.5">₩{variant.price.toLocaleString()}</span>
                        )}
                        {!isAvailable && <span className="block text-xs">품절</span>}
                      </button>
                    );
                  })}
                </div>

                {/* 선택한 옵션 행 (옵션마다 수량 따로) */}
                {optionRows.length > 0 && (
                  <ul className="space-y-2">
                    {optionRows.map(r => {
                      const rowPrice = r.variant.price ?? product.price;
                      return (
                        <li key={r.variant.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm text-gray-800 break-words min-w-0">
                              {buildOptionLabel(r.variant.optionValues) || '옵션'}
                            </p>
                            <button
                              onClick={() => removeOptionRow(r.variant.id)}
                              className="flex-shrink-0 -m-2 p-2 text-gray-400 hover:text-red-500"
                              aria-label="옵션 삭제"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white">
                              <button
                                onClick={() => changeOptionRowQty(r.variant.id, -1)}
                                disabled={r.quantity <= 1}
                                className="w-10 h-9 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                                aria-label="수량 감소"
                              >
                                -
                              </button>
                              <span className="w-10 text-center text-sm font-medium text-gray-900">{r.quantity}</span>
                              <button
                                onClick={() => changeOptionRowQty(r.variant.id, 1)}
                                disabled={r.quantity >= r.variant.stock}
                                className="w-10 h-9 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                                aria-label="수량 증가"
                              >
                                +
                              </button>
                            </div>
                            <span className="text-sm font-bold text-gray-900">₩{(rowPrice * r.quantity).toLocaleString()}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {/* Quantity (옵션 없는 상품만 — 옵션 상품은 위 옵션 행마다 수량 조절) */}
            {!optionRequired && (
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700">수량</span>
              <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="px-3 py-2 text-gray-500 hover:bg-gray-100 transition"
                >
                  -
                </button>
                <span className="w-12 text-center font-medium text-gray-900">{quantity}</span>
                <button
                  onClick={() => setQuantity(q => Math.min(currentStock, q + 1))}
                  className="px-3 py-2 text-gray-500 hover:bg-gray-100 transition"
                >
                  +
                </button>
              </div>
              <span className="text-sm text-gray-500">
                {currentStock > 0 ? `재고 ${currentStock}개` : ''}
              </span>
            </div>
            )}

            {/* Total */}
            <div className="flex justify-between items-center py-3 border-t border-b border-gray-200">
              <span className="text-sm font-medium text-gray-700">
                총 상품 금액{totalQuantity > 0 && <span className="text-gray-400 font-normal"> ({totalQuantity}개)</span>}
              </span>
              <div className="text-right">
                <span className="text-xl font-bold text-blue-600">₩{totalPrice.toLocaleString()}</span>
                {/* [qkey 표시] 1 쿠키 = 10원 */}
                <p className="text-xs font-semibold text-purple-600 mt-0.5">🍪 {krwToQkeyDisplay(totalPrice).toLocaleString()} 쿠키</p>
              </div>
            </div>

            {/* Cart notification */}
            {cartMessage && (
              <div className={`text-sm px-4 py-2 rounded-lg ${
                cartMessage.includes('실패') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
              }`}>
                {cartMessage}
              </div>
            )}

            {/* 선물하기 / 공유하기 (쿠팡식) — 모바일·데스크톱 공통 노출 */}
            <div className="flex gap-3 border-y border-gray-100 py-3">
              <button
                onClick={openGiftModal}
                className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium text-gray-700 hover:text-blue-600 transition"
              >
                <span className="text-lg">🎁</span> 선물하기
              </button>
              <div className="w-px bg-gray-200" />
              <button
                onClick={handleShare}
                className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium text-gray-700 hover:text-blue-600 transition"
              >
                <span className="text-lg">🔗</span> 공유하기
              </button>
            </div>

            {/* 공유 완료 토스트 */}
            {shareMessage && (
              <div className="text-center text-sm font-semibold text-green-600 bg-green-50 border border-green-200 rounded-lg py-2">
                {shareMessage}
              </div>
            )}

            {/* Action buttons (데스크톱 전용) */}
            {/* ★★★ 2026-08-15 수정 (구매 버튼 2개 중복 노출 사건):
                모바일에는 화면 하단 고정 액션바(장바구니/바로구매)가 별도로 있어서,
                본문의 이 액션 버튼까지 모바일에 보이면 '장바구니/구매'가 2세트로 중복됐다.
                → 본문 액션 버튼은 hidden md:flex 로 데스크톱에서만 표시.
                  (모바일은 하단 고정바만, 데스크톱은 하단바가 md:hidden 이라 이 본문 버튼만 노출) */}
            <div className="hidden md:flex gap-3">
              {currentStock > 0 ? (
                <>
                  <button
                    onClick={handleAddToCart}
                    disabled={addingToCart}
                    className="flex-1 py-3.5 border-2 border-blue-600 text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-50 transition disabled:opacity-50"
                  >
                    {addingToCart ? '추가 중...' : '장바구니'}
                  </button>
                  <button
                    onClick={handleBuyNow}
                    className="flex-1 py-3.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition"
                  >
                    바로 구매
                  </button>
                </>
              ) : (
                <button disabled className="flex-1 py-3.5 bg-gray-300 text-gray-500 rounded-xl font-bold text-sm cursor-not-allowed">
                  품절
                </button>
              )}
            </div>

            {/* Legal info: Origin / Manufacturer / Brand */}
            {(product.origin || product.manufacturer || product.brand) && (
              <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-4 text-sm">
                <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-1">
                  <span>⚖️</span> 상품 필수 정보
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-gray-600">
                  {product.origin && (
                    <div>
                      <span className="text-gray-400 text-xs">원산지</span>
                      <p className="font-medium">{product.origin}</p>
                    </div>
                  )}
                  {product.manufacturer && (
                    <div>
                      <span className="text-gray-400 text-xs">제조사</span>
                      <p className="font-medium">{product.manufacturer}</p>
                    </div>
                  )}
                  {product.brand && (
                    <div>
                      <span className="text-gray-400 text-xs">브랜드</span>
                      <p className="font-medium">{tr(product.brand)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tabs section */}
        <div className="mt-10" ref={tabsSectionRef}>
          <div className="bg-white border-b sticky top-0 z-20 rounded-t-xl">
            <div className="flex overflow-x-auto no-scrollbar">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 min-w-fit px-3 sm:px-6 py-4 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600 bg-blue-50/60'
                      : tab.id === 'reviews'
                        ? 'border-transparent text-purple-600 hover:text-purple-700'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-b-xl p-4 sm:p-8 min-h-[400px]">
            {/* Detail tab */}
            {activeTab === 'detail' && (
              <div>
                {/* Detail content (WYSIWYG HTML) */}
                {product.detailContent && (
                  <div
                    className="prose max-w-none mb-8"
                    dangerouslySetInnerHTML={{ __html: product.detailContent }}
                  />
                )}

                {/* Detail images */}
                {detailImages.length > 0 && (
                  <div className="space-y-4">
                    {detailImages.map((url, i) => (
                      <img
                        key={i}
                        src={thumbUrl(url, 800)}
                        alt={`${product.name} 상세 ${i + 1}`}
                        className="w-full rounded-lg"
                        loading="lazy"
                      />
                    ))}
                  </div>
                )}

                {/* Description */}
                {!product.detailContent && detailImages.length === 0 && (
                  <div className="text-gray-600 whitespace-pre-wrap leading-relaxed">
                    {tr(product.description)}
                  </div>
                )}
              </div>
            )}

            {/* Specs tab */}
            {activeTab === 'specs' && (
              <div className="space-y-6">
                {/* Specifications table */}
                {specs.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-4">상품 스펙</h3>
                    <table className="w-full border-collapse">
                      <tbody>
                        {specs.map((spec, i) => (
                          <tr key={i} className="border-b border-gray-100">
                            <td className="py-3 px-4 text-sm font-medium text-gray-500 bg-gray-50 w-1/3">{spec.key}</td>
                            <td className="py-3 px-4 text-sm text-gray-900">{spec.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Legal required info */}
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">필수 표시 정보</h3>
                  <table className="w-full border-collapse">
                    <tbody>
                      {product.origin && (
                        <tr className="border-b border-gray-100">
                          <td className="py-3 px-4 text-sm font-medium text-gray-500 bg-gray-50 w-1/3">원산지</td>
                          <td className="py-3 px-4 text-sm text-gray-900">{product.origin}</td>
                        </tr>
                      )}
                      {product.manufacturer && (
                        <tr className="border-b border-gray-100">
                          <td className="py-3 px-4 text-sm font-medium text-gray-500 bg-gray-50 w-1/3">제조사</td>
                          <td className="py-3 px-4 text-sm text-gray-900">{product.manufacturer}</td>
                        </tr>
                      )}
                      {product.brand && (
                        <tr className="border-b border-gray-100">
                          <td className="py-3 px-4 text-sm font-medium text-gray-500 bg-gray-50 w-1/3">브랜드</td>
                          <td className="py-3 px-4 text-sm text-gray-900">{tr(product.brand)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Shipping info */}
                {product.shippingInfo && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-4">배송 안내</h3>
                    <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
                      {product.shippingInfo}
                    </div>
                  </div>
                )}

                {/* Return info */}
                {product.returnInfo && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-4">교환/반품 안내</h3>
                    <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
                      {product.returnInfo}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sellers tab */}
            {activeTab === 'sellers' && (
              <div>
                {(!product.partnerProducts || product.partnerProducts.length === 0) ? (
                  <p className="text-gray-500 text-center py-8">등록된 판매자가 없습니다.</p>
                ) : (
                  <div className="space-y-4">
                    {product.partnerProducts.map((pp) => (
                      <div key={pp.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                            {pp.partner.storeName.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{pp.partner.storeName}</p>
                            <p className="text-xs text-gray-500">{pp.partner.user.name}</p>
                          </div>
                        </div>
                        {pp.customPrice && (
                          <span className="font-bold text-gray-900">₩{pp.customPrice.toLocaleString()}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Reviews tab */}
            {activeTab === 'reviews' && (
              <ProductReviews productId={product.id} productName={product.name} initialReviews={safeReviews} />
            )}

            {/* Q&A tab */}
            {activeTab === 'qna' && (
              <ProductQnA productId={product.id} />
            )}
          </div>
        </div>
      </div>

      {/* 하단 배너 (position: bottom | both) */}
      {showBottomBanner && renderBanner('mt-6 mb-24 md:mb-8')}

      {/* Mobile bottom action bar */}
      {/* ★ 장바구니 담기 성공/실패 메시지를 모바일 하단 바 '바로 위'에도 노출.
          (옵션 미선택은 별도 경고창(alert)으로 처리 — 사장님 요구) */}
      {cartMessage && (
        <div className={`fixed bottom-[72px] left-0 right-0 mx-3 rounded-lg px-4 py-2.5 text-sm font-semibold text-center shadow-lg md:hidden z-50 ${
          cartMessage.includes('실패') ? 'bg-red-500 text-white' : 'bg-gray-900 text-white'
        }`}>
          {cartMessage}
        </div>
      )}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-3 flex gap-3 md:hidden z-50">
        {currentStock > 0 ? (
          <>
            <button
              onClick={handleAddToCart}
              disabled={addingToCart}
              className="flex-1 py-3 border-2 border-blue-600 text-blue-600 rounded-xl font-bold text-sm"
            >
              장바구니
            </button>
            <button
              onClick={handleBuyNow}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm"
            >
              {totalPrice > 0 ? `₩${totalPrice.toLocaleString()} 구매` : '바로 구매'}
            </button>
          </>
        ) : (
          <button disabled className="flex-1 py-3 bg-gray-300 text-gray-500 rounded-xl font-bold text-sm cursor-not-allowed">
            품절된 상품입니다
          </button>
        )}
      </div>

      {/* ===== 선물하기 모달 ===== */}
      {showGiftModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
          onClick={() => setShowGiftModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="px-6 pt-6 pb-3 border-b border-gray-100 shrink-0 flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">🎁 선물하기</h2>
              <button
                onClick={() => setShowGiftModal(false)}
                className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
                aria-label="닫기"
              >
                ×
              </button>
            </div>

            {/* 본문 */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* 상품 요약 */}
              <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                <img
                  src={thumbUrl(product.thumbnail, 200)}
                  alt={product.name}
                  className="w-14 h-14 rounded-lg object-cover bg-gray-100 flex-shrink-0"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 line-clamp-2">{tr(product.name)}</p>
                  <p className="text-sm text-blue-600 font-bold mt-0.5">
                    ₩{totalPrice.toLocaleString()} <span className="text-gray-400 font-normal">({totalQuantity}개)</span>
                  </p>
                  {optionRows.length > 0 && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                      {optionRows.map(r => `${buildOptionLabel(r.variant.optionValues) || '옵션'} ×${r.quantity}`).join(', ')}
                    </p>
                  )}
                </div>
              </div>

              {/* 받는 분: 큐라이브/큐알쳇 회원 닉네임 검색 후 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  받는 분 (닉네임 검색) <span className="text-red-500">*</span>
                </label>

                {/* 선택된 받는 분 */}
                {giftRecipient ? (
                  <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {Array.from(giftRecipient.nickname)[0] || '?'}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {giftRecipient.nickname}
                          <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full align-middle ${giftRecipient.origin === 'QRCHAT' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
                            {giftRecipient.origin === 'QRCHAT' ? '큐알쳇' : '큐라이브'}
                          </span>
                        </p>
                        <p className="text-xs text-gray-500 truncate">{giftRecipient.maskedName}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setGiftRecipient(null); setGiftQuery(''); setGiftResults([]); }}
                      className="text-xs text-gray-500 hover:text-red-600 font-medium flex-shrink-0"
                    >
                      변경
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      value={giftQuery}
                      onChange={(e) => setGiftQuery(e.target.value)}
                      placeholder="큐알쳇/큐라이브 닉네임을 입력하세요"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      autoComplete="off"
                    />

                    {/* 검색 결과 */}
                    <div className="mt-2">
                      {giftSearching && (
                        <p className="text-xs text-gray-400 px-1 py-2">검색 중...</p>
                      )}
                      {!giftSearching && giftQuery.trim().length >= 1 && giftResults.length === 0 && (
                        <p className="text-xs text-gray-400 px-1 py-2">일치하는 회원이 없습니다.</p>
                      )}
                      {!giftSearching && giftResults.length > 0 && (
                        <ul className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-52 overflow-y-auto">
                          {giftResults.map((r) => (
                            <li key={r.userId}>
                              <button
                                type="button"
                                onClick={() => {
                                  setGiftRecipient({ userId: r.userId, nickname: r.nickname, maskedName: r.maskedName, origin: r.origin });
                                  setGiftResults([]);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 text-left transition"
                              >
                                <span className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                                  {Array.from(r.nickname)[0] || '?'}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-gray-900 truncate">
                                    {r.nickname}
                                    <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full align-middle ${r.origin === 'QRCHAT' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
                                      {r.origin === 'QRCHAT' ? '큐알쳇' : '큐라이브'}
                                    </span>
                                  </p>
                                  <p className="text-xs text-gray-500 truncate">{r.maskedName} {r.maskedPhone && `· ${r.maskedPhone}`}</p>
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">선물 메시지 <span className="text-gray-400 font-normal">(선택)</span></label>
                <textarea
                  value={giftMessage}
                  onChange={(e) => setGiftMessage(e.target.value)}
                  rows={3}
                  maxLength={200}
                  placeholder="마음을 담은 메시지를 적어보세요"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
                />
              </div>

              <p className="text-xs text-gray-400 leading-relaxed">
                * 받는 분을 닉네임으로 선택하시면, 다음 결제 단계에서 배송지·결제 정보를 입력해 선물을 보낼 수 있습니다.
              </p>
            </div>

            {/* 하단 버튼 (고정) */}
            <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex gap-3 bg-white">
              <button
                onClick={submitGift}
                className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition"
              >
                선물 결제하기
              </button>
              <button
                onClick={() => setShowGiftModal(false)}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-bold text-sm hover:bg-gray-300 transition"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
