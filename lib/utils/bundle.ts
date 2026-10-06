// [1+1 / 2+1 묶음 상품] 한 세트 가격으로 여러 개를 받고, 각 개별 상품의 옵션(색상 등)을 고르는 상품.
//   예) "티셔츠 1+1" → 1세트 = 2개, 핑크 1 + 블루 1 을 골라도 금액은 1세트 가격.
//   상품명 규칙 (옵션이 있는 상품에서만 적용 — 옵션 없는 상품은 기존처럼 수량 = 세트 수)
//   - "N+M"  → 1세트 = N+M개   (예: "1+1" → 2, "2+1" → 3)
//   - "N개 / N켤레 / N족 / N장 / N팩" (2~5) → 1세트 = N개  (예: "패딩 털 슬리퍼 2개")
//     ※ "N개입"(동일 상품 대용량 포장)은 제외

/** 1세트당 옵션 선택 개수 (묶음 상품이 아니면 1) */
export function getBundleSize(name: string | null | undefined): number {
  if (!name) return 1;
  const s = String(name);
  const plus = s.match(/(\d{1,2})\s*\+\s*(\d{1,2})/);
  if (plus) {
    const size = Number(plus[1]) + Number(plus[2]);
    return size >= 2 && size <= 20 ? size : 1;
  }
  const unit = s.match(/(\d{1,2})\s*(개|켤레|족|장|팩)(?!입)/);
  if (unit) {
    const size = Number(unit[1]);
    return size >= 2 && size <= 5 ? size : 1;
  }
  return 1;
}

/** 묶음 상품의 개별 상품 1개당 금액 (세트가 / 구성 개수) */
export function bundlePiecePrice(setPrice: number, bundleSize: number): number {
  return bundleSize > 1 ? setPrice / bundleSize : setPrice;
}
