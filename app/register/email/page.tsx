'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/contexts/AuthContext';

export default function EmailRegisterPage() {
  const router = useRouter();
  const { register: authRegister } = useAuth();
  
  const [formData, setFormData] = useState({
    securetQrUrl: '',
    nickname: '',
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
  });
  
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');

  // Securet QR URL 형식 검증
  const validateSecuretUrl = (url: string): boolean => {
    const pattern = /^https:\/\/securet\.kr\/securet\.php\?key=idcard&nick=.+&token=.+&voip=.+&os=.+$/;
    return pattern.test(url);
  };

  // 이메일 유효성 검증
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // 전화번호 포맷팅
  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/[^\d]/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  };

  // 폼 유효성 검증
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.securetQrUrl.trim()) {
      newErrors.securetQrUrl = '시큐릿 QR 주소를 입력해주세요.';
    } else if (!validateSecuretUrl(formData.securetQrUrl)) {
      newErrors.securetQrUrl = '올바른 시큐릿 QR 주소 형식이 아닙니다.';
    }

    if (!formData.nickname.trim()) {
      newErrors.nickname = '닉네임을 입력해주세요.';
    }

    if (!formData.name.trim()) {
      newErrors.name = '이름을 입력해주세요.';
    }

    if (!formData.email.trim()) {
      newErrors.email = '이메일을 입력해주세요.';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = '올바른 이메일 형식이 아닙니다.';
    }

    if (!formData.password || formData.password.length < 6) {
      newErrors.password = '비밀번호는 최소 6자 이상이어야 합니다.';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = '비밀번호가 일치하지 않습니다.';
    }

    if (formData.phone && formData.phone.replace(/[^\d]/g, '').length < 10) {
      newErrors.phone = '올바른 전화번호를 입력해주세요.';
    }

    if (!agreeTerms) {
      newErrors.terms = '이용약관 및 개인정보처리방침에 동의해주세요.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 회원가입 처리
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // AuthContext의 register 사용 - 자동으로 상태 업데이트 + 쿠키 설정 + 리다이렉트
      await authRegister({
        nickname: formData.nickname,
        password: formData.password,
        securetQrUrl: formData.securetQrUrl,
        name: formData.name,
        email: formData.email,
        phone: formData.phone.replace(/[^\d]/g, '') || undefined,
        role: 'CUSTOMER',
      });
      // authRegister 성공 시 자동으로 리다이렉트됨
    } catch (error: any) {
      console.error('회원가입 오류:', error);
      setGeneralError(error.message || '회원가입 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 입력 변경 처리
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name === 'phone') {
      setFormData({ ...formData, [name]: formatPhoneNumber(value) });
    } else {
      setFormData({ ...formData, [name]: value });
    }

    // 입력 시 해당 필드의 에러 메시지 제거
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        {/* 헤더 */}
        <div className="text-center mb-6 sm:mb-8">
          <Link href="/" className="inline-block mb-4 sm:mb-6">
            <div className="flex items-center justify-center space-x-2">
              <div className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                QRLIVE
              </div>
            </div>
          </Link>
          <Link 
            href="/register"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            다른 방법으로 가입하기
          </Link>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            이메일로 가입하기
          </h2>
          <p className="text-sm text-gray-600">
            시큐릿 QR 주소와 함께 이메일로 가입합니다
          </p>
        </div>

        {/* 회원가입 폼 */}
        <form className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 space-y-5" onSubmit={handleSubmit} autoComplete="off">
          {generalError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-600 text-sm whitespace-pre-line">{generalError}</p>
            </div>
          )}

          {/* 시큐릿 QR 주소 */}
          <div>
            <label htmlFor="securetQrUrl" className="block text-sm font-medium text-gray-700 mb-1.5">
              시큐릿 QR 주소 <span className="text-red-500">*</span>
            </label>
            <input
              id="securetQrUrl"
              name="securetQrUrl"
              type="text"
              value={formData.securetQrUrl}
              onChange={handleChange}
              className={`w-full px-4 py-3 border ${
                errors.securetQrUrl ? 'border-red-300' : 'border-gray-200'
              } rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all`}
              placeholder=""
              autoComplete="off"
              data-lpignore="true"
              data-form-type="other"
            />
            <p className="mt-1 text-xs text-gray-500">
              시큐릿 메신저의 QR 주소를 입력해주세요
            </p>
            {errors.securetQrUrl && (
              <p className="mt-1.5 text-sm text-red-600">{errors.securetQrUrl}</p>
            )}
          </div>

          {/* 닉네임 */}
          <div>
            <label htmlFor="nickname" className="block text-sm font-medium text-gray-700 mb-1.5">
              닉네임 <span className="text-red-500">*</span>
            </label>
            <input
              id="nickname"
              name="nickname"
              type="text"
              value={formData.nickname}
              onChange={handleChange}
              className={`w-full px-4 py-3 border ${
                errors.nickname ? 'border-red-300' : 'border-gray-200'
              } rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all`}
              placeholder=""
              autoComplete="off"
              data-lpignore="true"
              data-form-type="other"
            />
            {errors.nickname && (
              <p className="mt-1.5 text-sm text-red-600">{errors.nickname}</p>
            )}
          </div>

          {/* 이름 */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">
              이름 <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              className={`w-full px-4 py-3 border ${
                errors.name ? 'border-red-300' : 'border-gray-200'
              } rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all`}
              placeholder=""
              autoComplete="off"
              data-lpignore="true"
              data-form-type="other"
            />
            {errors.name && (
              <p className="mt-1.5 text-sm text-red-600">{errors.name}</p>
            )}
          </div>

          {/* 이메일 */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
              이메일 <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              className={`w-full px-4 py-3 border ${
                errors.email ? 'border-red-300' : 'border-gray-200'
              } rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all`}
              placeholder=""
              autoComplete="off"
              data-lpignore="true"
              data-form-type="other"
            />
            {errors.email && (
              <p className="mt-1.5 text-sm text-red-600">{errors.email}</p>
            )}
          </div>

          {/* 비밀번호 */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
              비밀번호 <span className="text-red-500">*</span>
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={formData.password}
              onChange={handleChange}
              className={`w-full px-4 py-3 border ${
                errors.password ? 'border-red-300' : 'border-gray-200'
              } rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all`}
              placeholder=""
              data-lpignore="true"
              data-form-type="other"
            />
            <p className="mt-1 text-xs text-gray-500">최소 6자 이상</p>
            {errors.password && (
              <p className="mt-1.5 text-sm text-red-600">{errors.password}</p>
            )}
          </div>

          {/* 비밀번호 확인 */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
              비밀번호 확인 <span className="text-red-500">*</span>
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={formData.confirmPassword}
              onChange={handleChange}
              className={`w-full px-4 py-3 border ${
                errors.confirmPassword ? 'border-red-300' : 'border-gray-200'
              } rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all`}
              placeholder=""
              data-lpignore="true"
              data-form-type="other"
            />
            {errors.confirmPassword && (
              <p className="mt-1.5 text-sm text-red-600">{errors.confirmPassword}</p>
            )}
          </div>

          {/* 전화번호 (선택) */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1.5">
              전화번호 <span className="text-gray-400">(선택)</span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
              className={`w-full px-4 py-3 border ${
                errors.phone ? 'border-red-300' : 'border-gray-200'
              } rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all`}
              placeholder=""
              autoComplete="off"
              data-lpignore="true"
              data-form-type="other"
            />
            {errors.phone && (
              <p className="mt-1.5 text-sm text-red-600">{errors.phone}</p>
            )}
          </div>

          {/* 이용약관 동의 */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <label className="flex items-start space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => {
                  setAgreeTerms(e.target.checked);
                  if (errors.terms) {
                    setErrors({ ...errors, terms: '' });
                  }
                }}
                className="mt-1 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <span className="text-sm text-gray-700">
                <Link href="/terms" target="_blank" className="text-purple-600 hover:underline font-medium">이용약관</Link> 및{' '}
                <Link href="/privacy" target="_blank" className="text-purple-600 hover:underline font-medium">개인정보처리방침</Link>에 동의합니다 *
              </span>
            </label>
            {errors.terms && (
              <p className="mt-1.5 text-sm text-red-600">{errors.terms}</p>
            )}
          </div>

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                가입 중...
              </div>
            ) : (
              '가입 완료'
            )}
          </button>

          {/* 로그인 링크 */}
          <div className="text-center pt-2">
            <p className="text-sm text-gray-600">
              이미 계정이 있으신가요?{' '}
              <Link 
                href="/login" 
                className="font-semibold text-purple-600 hover:text-purple-700 transition-colors"
              >
                로그인
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
