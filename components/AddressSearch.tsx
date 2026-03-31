'use client';

import { useEffect, useRef } from 'react';

interface DaumPostcodeData {
  zonecode: string;
  roadAddress: string;
  jibunAddress: string;
  buildingName: string;
  apartment: string;
  autoRoadAddress: string;
  autoJibunAddress: string;
}

interface Props {
  onComplete: (data: { zipCode: string; address: string }) => void;
  className?: string;
  children?: React.ReactNode;
}

declare global {
  interface Window {
    daum: any;
  }
}

export default function AddressSearch({ onComplete, className, children }: Props) {
  const scriptLoaded = useRef(false);

  useEffect(() => {
    if (scriptLoaded.current) return;
    if (typeof window !== 'undefined' && !window.daum) {
      const script = document.createElement('script');
      script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
      script.async = true;
      script.onload = () => { scriptLoaded.current = true; };
      document.head.appendChild(script);
    } else {
      scriptLoaded.current = true;
    }
  }, []);

  const handleClick = () => {
    if (typeof window === 'undefined' || !window.daum?.Postcode) {
      // Script not loaded yet, retry
      const script = document.createElement('script');
      script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
      script.async = true;
      script.onload = () => {
        scriptLoaded.current = true;
        openPostcode();
      };
      document.head.appendChild(script);
      return;
    }
    openPostcode();
  };

  const openPostcode = () => {
    new window.daum.Postcode({
      oncomplete: (data: DaumPostcodeData) => {
        const address = data.roadAddress || data.jibunAddress;
        const extraAddr = data.buildingName ? ` (${data.buildingName})` : '';
        onComplete({
          zipCode: data.zonecode,
          address: address + extraAddr,
        });
      },
      width: '100%',
      height: '100%',
    }).open();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className || 'px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 transition whitespace-nowrap'}
    >
      {children || '🔍 주소 검색'}
    </button>
  );
}
