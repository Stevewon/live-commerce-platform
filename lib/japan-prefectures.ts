/**
 * 일본 47개 도도부현(都道府県) 마스터 데이터
 * - code: 시딩/식별용 고유 코드 (JIS 표준 순번, 01~47)
 * - ko  : 한글 표기 (어드민 화면)
 * - ja  : 일본어 표기 (일본 고객 화면)
 * - region: 지방 구분 (그룹 표시용)
 *
 * 해외배송비는 JapanShippingFee 테이블에 code 별로 저장하며,
 * 어드민이 원(KRW)으로 배송비를 입력한다. (미등록 현은 기본 해외배송비 적용)
 */
export interface JapanPrefecture {
  code: string;
  ko: string;
  ja: string;
  region: string;
}

export const JAPAN_PREFECTURES: JapanPrefecture[] = [
  { code: '01', ko: '홋카이도', ja: '北海道', region: '홋카이도' },
  { code: '02', ko: '아오모리현', ja: '青森県', region: '도호쿠' },
  { code: '03', ko: '이와테현', ja: '岩手県', region: '도호쿠' },
  { code: '04', ko: '미야기현', ja: '宮城県', region: '도호쿠' },
  { code: '05', ko: '아키타현', ja: '秋田県', region: '도호쿠' },
  { code: '06', ko: '야마가타현', ja: '山形県', region: '도호쿠' },
  { code: '07', ko: '후쿠시마현', ja: '福島県', region: '도호쿠' },
  { code: '08', ko: '이바라키현', ja: '茨城県', region: '간토' },
  { code: '09', ko: '도치기현', ja: '栃木県', region: '간토' },
  { code: '10', ko: '군마현', ja: '群馬県', region: '간토' },
  { code: '11', ko: '사이타마현', ja: '埼玉県', region: '간토' },
  { code: '12', ko: '지바현', ja: '千葉県', region: '간토' },
  { code: '13', ko: '도쿄도', ja: '東京都', region: '간토' },
  { code: '14', ko: '가나가와현', ja: '神奈川県', region: '간토' },
  { code: '15', ko: '니가타현', ja: '新潟県', region: '주부' },
  { code: '16', ko: '도야마현', ja: '富山県', region: '주부' },
  { code: '17', ko: '이시카와현', ja: '石川県', region: '주부' },
  { code: '18', ko: '후쿠이현', ja: '福井県', region: '주부' },
  { code: '19', ko: '야마나시현', ja: '山梨県', region: '주부' },
  { code: '20', ko: '나가노현', ja: '長野県', region: '주부' },
  { code: '21', ko: '기후현', ja: '岐阜県', region: '주부' },
  { code: '22', ko: '시즈오카현', ja: '静岡県', region: '주부' },
  { code: '23', ko: '아이치현', ja: '愛知県', region: '주부' },
  { code: '24', ko: '미에현', ja: '三重県', region: '긴키' },
  { code: '25', ko: '시가현', ja: '滋賀県', region: '긴키' },
  { code: '26', ko: '교토부', ja: '京都府', region: '긴키' },
  { code: '27', ko: '오사카부', ja: '大阪府', region: '긴키' },
  { code: '28', ko: '효고현', ja: '兵庫県', region: '긴키' },
  { code: '29', ko: '나라현', ja: '奈良県', region: '긴키' },
  { code: '30', ko: '와카야마현', ja: '和歌山県', region: '긴키' },
  { code: '31', ko: '돗토리현', ja: '鳥取県', region: '주고쿠' },
  { code: '32', ko: '시마네현', ja: '島根県', region: '주고쿠' },
  { code: '33', ko: '오카야마현', ja: '岡山県', region: '주고쿠' },
  { code: '34', ko: '히로시마현', ja: '広島県', region: '주고쿠' },
  { code: '35', ko: '야마구치현', ja: '山口県', region: '주고쿠' },
  { code: '36', ko: '도쿠시마현', ja: '徳島県', region: '시코쿠' },
  { code: '37', ko: '가가와현', ja: '香川県', region: '시코쿠' },
  { code: '38', ko: '에히메현', ja: '愛媛県', region: '시코쿠' },
  { code: '39', ko: '고치현', ja: '高知県', region: '시코쿠' },
  { code: '40', ko: '후쿠오카현', ja: '福岡県', region: '규슈' },
  { code: '41', ko: '사가현', ja: '佐賀県', region: '규슈' },
  { code: '42', ko: '나가사키현', ja: '長崎県', region: '규슈' },
  { code: '43', ko: '구마모토현', ja: '熊本県', region: '규슈' },
  { code: '44', ko: '오이타현', ja: '大分県', region: '규슈' },
  { code: '45', ko: '미야자키현', ja: '宮崎県', region: '규슈' },
  { code: '46', ko: '가고시마현', ja: '鹿児島県', region: '규슈' },
  { code: '47', ko: '오키나와현', ja: '沖縄県', region: '규슈' },
];

export const JAPAN_PREFECTURE_MAP: Record<string, JapanPrefecture> =
  JAPAN_PREFECTURES.reduce((acc, p) => {
    acc[p.code] = p;
    return acc;
  }, {} as Record<string, JapanPrefecture>);

/** 기본 해외배송비(원) — 어드민 미설정 현에 적용. SiteSetting(JP_DEFAULT_SHIPPING_FEE)로 덮어쓸 수 있음 */
export const JP_DEFAULT_SHIPPING_FEE = 15000;

/** 기본 환율: 1000원 = ? 엔 (100엔 ≒ 900원 기준, 1원 ≒ 0.11엔). SiteSetting(KRW_TO_JPY)로 덮어씀 */
export const DEFAULT_KRW_TO_JPY = 0.11;

/** 원화를 엔화로 환산 (소수점 올림, 최소 1엔 단위) */
export function krwToJpy(krw: number, rate: number = DEFAULT_KRW_TO_JPY): number {
  if (!krw || krw <= 0) return 0;
  return Math.ceil(krw * rate);
}
