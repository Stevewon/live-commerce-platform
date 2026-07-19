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

/** 지갑주소 정규화(트림) */
export function normalizeWalletAddress(address: string): string {
  return (address || '').trim();
}
