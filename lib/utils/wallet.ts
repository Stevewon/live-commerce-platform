/**
 * 퀀타리움 지갑주소 유틸리티
 * - 회원 식별/본인확인(닉네임·비밀번호 찾기)에 사용하는 퀀타리움 지갑주소 검증
 * - EVM 호환 주소 형식(0x + 40 hex = 총 42자)
 */

/** 0x로 시작하는 42자리(0x + 40 hex) 지갑주소 정규식 */
export const QUANTARIUM_WALLET_REGEX = /^0x[a-fA-F0-9]{40}$/;

/** 퀀타리움 지갑주소 형식 검증 */
export function isValidQuantariumWallet(address: string | null | undefined): boolean {
  if (!address) return false;
  return QUANTARIUM_WALLET_REGEX.test(address.trim());
}

/**
 * 지갑주소 정규화(트림 + 소문자)
 * - EVM 호환 주소는 대소문자를 구분하지 않으므로, 저장/비교 시 항상 소문자로 정규화한다.
 * - 이를 통해 회원가입/조회 시 대소문자가 달라도 동일 주소로 취급된다.
 */
export function normalizeWalletAddress(address: string | null | undefined): string {
  return (address || '').trim().toLowerCase();
}
