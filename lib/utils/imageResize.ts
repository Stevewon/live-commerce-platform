// [썸네일 자동 리사이즈/WebP] 클라이언트(브라우저) 전용 유틸
//
// Cloudflare Workers 런타임에는 sharp 같은 네이티브 이미지 처리 라이브러리가 없고,
// Cloudflare Image Resizing(/cdn-cgi/image)도 이 계정에선 비활성(404)이라 서버 리사이즈가 불가.
// 따라서 업로드 직전 브라우저 Canvas 로 리사이즈 + WebP 변환하여 파일 크기를 줄인다.
//   (예: 174KB JPG → 20~30KB WebP)
//
// - WebP 미지원 브라우저(구형 사파리 등)에서는 자동으로 원본 형식으로 폴백.
// - GIF(애니메이션)는 프레임이 깨질 수 있으므로 리사이즈하지 않고 원본 유지.

export interface ResizeOptions {
  maxWidth?: number;   // 최대 가로 (기본 800: 상세/갤러리 용). 썸네일은 400 권장.
  maxHeight?: number;  // 최대 세로 (기본 maxWidth 와 동일)
  quality?: number;    // WebP/JPEG 품질 0~1 (기본 0.8)
  mimeType?: string;   // 출력 형식 (기본 'image/webp')
}

const DEFAULTS: Required<Omit<ResizeOptions, 'maxHeight'>> & { maxHeight?: number } = {
  maxWidth: 800,
  quality: 0.8,
  mimeType: 'image/webp',
};

/** 브라우저가 canvas.toBlob 으로 WebP 출력이 가능한지 (1회 캐시) */
let _webpSupported: boolean | null = null;
function supportsWebP(): boolean {
  if (_webpSupported !== null) return _webpSupported;
  try {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    _webpSupported = c.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    _webpSupported = false;
  }
  return _webpSupported;
}

/**
 * 이미지 파일을 최대 크기 이내로 리사이즈하고 WebP(또는 폴백 형식)로 변환한 File 을 반환.
 * 처리 불가/실패 시 원본 File 을 그대로 반환한다 (업로드 자체를 막지 않기 위함).
 */
export async function resizeImageToWebP(file: File, options: ResizeOptions = {}): Promise<File> {
  // 브라우저 환경이 아니거나 이미지가 아니면 원본 반환
  if (typeof window === 'undefined' || typeof document === 'undefined') return file;
  if (!file.type.startsWith('image/')) return file;
  // GIF 는 애니메이션 손상 위험 → 원본 유지
  if (file.type === 'image/gif') return file;

  const opts = { ...DEFAULTS, ...options };
  const maxW = opts.maxWidth;
  const maxH = options.maxHeight ?? opts.maxWidth;

  try {
    const dataUrl = await readFileAsDataURL(file);
    const img = await loadImage(dataUrl);

    let { width, height } = img;
    if (width <= 0 || height <= 0) return file;

    // 이미 충분히 작으면 형식 변환만 (WebP 로) — 그래도 용량 이득이 있음
    const scale = Math.min(1, maxW / width, maxH / height);
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, targetW, targetH);

    // 출력 형식 결정 (WebP 미지원 시 JPEG 폴백; PNG 투명 유지가 필요하면 PNG)
    let outType = opts.mimeType;
    if (outType === 'image/webp' && !supportsWebP()) {
      outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    }

    const blob = await canvasToBlob(canvas, outType, opts.quality);
    if (!blob) return file;

    // 변환 결과가 원본보다 오히려 크면 원본 사용 (작은 PNG 등)
    if (blob.size >= file.size && outType === file.type) return file;

    const ext = outType === 'image/webp' ? 'webp' : outType === 'image/png' ? 'png' : 'jpg';
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${baseName}.${ext}`, { type: outType });
  } catch {
    // 어떤 이유로든 실패하면 원본 그대로 업로드
    return file;
  }
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (canvas.toBlob) {
      canvas.toBlob((b) => resolve(b), type, quality);
    } else {
      // 구형 브라우저 폴백
      try {
        const dataUrl = canvas.toDataURL(type, quality);
        const arr = dataUrl.split(',');
        const bstr = atob(arr[1]);
        const u8 = new Uint8Array(bstr.length);
        for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
        resolve(new Blob([u8], { type }));
      } catch {
        resolve(null);
      }
    }
  });
}
