// [qkey 표시 유틸] 클라이언트/서버 공용 (서버 전용 import 없음)
// 환율: 1 QKEY = 10원 (lib/balance.ts 의 QKEY_TO_KRW 와 동일 값)
// 사용자에게는 "쿠키"라는 명칭으로 보여질 수 있으나, 코드/데이터상 명칭은 QKEY 로 통일.

export const QKEY_TO_KRW = 10; // 1 QKEY = 10원

/**
 * 원(KRW) 금액을 QKEY(쿠키) 개수로 환산.
 * 가격 표시용이므로 소수점 없는 정수로 반올림하여 반환.
 * 예) 11,100원 → 1,110 QKEY
 */
export function krwToQkeyDisplay(krw: number | null | undefined): number {
  const won = Number(krw) || 0;
  if (won <= 0) return 0;
  return Math.round(won / QKEY_TO_KRW);
}

/**
 * 결제 차감용 QKEY 환산 (올림 — 사용자가 손해 보지 않도록).
 * 예) 105원 → 11 QKEY (110원어치)
 */
export function krwToQkeyCharge(krw: number | null | undefined): number {
  const won = Number(krw) || 0;
  if (won <= 0) return 0;
  return Math.ceil(won / QKEY_TO_KRW);
}

/** QKEY 개수를 원(KRW) 금액으로 환산. 예) 1,110 QKEY → 11,100원 */
export function qkeyToKrw(qkey: number | null | undefined): number {
  const q = Number(qkey) || 0;
  if (q <= 0) return 0;
  return q * QKEY_TO_KRW;
}

/** 표시용 문자열: "1,110 쿠키" (locale toLocaleString 적용) */
export function formatQkey(krw: number | null | undefined, label = '쿠키'): string {
  return `${krwToQkeyDisplay(krw).toLocaleString()} ${label}`;
}
