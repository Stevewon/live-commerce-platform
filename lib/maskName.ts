// 리뷰 등 공개 화면에서 작성자 이름/닉네임을 마스킹 처리
// 첫 글자만 남기고 나머지는 모두 * 로 가림
// 예) 오로로 -> 오**,  김 -> 김,  홍길동 -> 홍**,  abcd -> a***,  익명 -> 익*
export function maskName(raw?: string | null): string {
  const name = (raw ?? '').trim();
  if (!name) return '익명';

  // 이메일이 들어온 경우 @ 앞부분만 사용
  const base = name.includes('@') ? name.split('@')[0] : name;

  const chars = Array.from(base); // 이모지/서로게이트 안전 처리
  const len = chars.length;

  if (len <= 1) return chars[0] ?? '익명';
  // 첫 글자만 노출, 나머지는 전부 * 로 마스킹
  return chars[0] + '*'.repeat(len - 1);
}
