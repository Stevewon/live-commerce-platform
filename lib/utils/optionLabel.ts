// [옵션] 변형 optionValues JSON 을 "색상: 빨강 / 사이즈: L" 라벨로 변환
export function buildOptionLabel(raw: any): string | null {
  if (!raw) return null;
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      const parts = Object.entries(obj)
        .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
        .map(([k, v]) => `${k}: ${v}`);
      return parts.length ? parts.join(' / ') : null;
    }
    return String(obj) || null;
  } catch {
    return typeof raw === 'string' ? raw : null;
  }
}
