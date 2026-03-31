// 택배사 목록 및 배송 추적 유틸리티
// Korean courier company codes and tracking URL generators

export interface CourierCompany {
  code: string;
  name: string;
  trackingUrl: (trackingNumber: string) => string;
}

export const COURIER_COMPANIES: CourierCompany[] = [
  {
    code: 'cj',
    name: 'CJ대한통운',
    trackingUrl: (num) => `https://trace.cjlogistics.com/web/detail.jsp?slipno=${num}`,
  },
  {
    code: 'lotte',
    name: '롯데택배',
    trackingUrl: (num) => `https://www.lotteglogis.com/home/reservation/tracking/link498View/${num}`,
  },
  {
    code: 'hanjin',
    name: '한진택배',
    trackingUrl: (num) => `https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mession=open&wblnumText2=${num}`,
  },
  {
    code: 'logen',
    name: '로젠택배',
    trackingUrl: (num) => `https://www.ilogen.com/web/personal/trace/${num}`,
  },
  {
    code: 'post',
    name: '우체국택배',
    trackingUrl: (num) => `https://service.epost.go.kr/trace.RetrieveDomRi498.postal?sid1=${num}`,
  },
  {
    code: 'gspost',
    name: 'GS Postbox 편의점택배',
    trackingUrl: (num) => `https://www.cvsnet.co.kr/invoice/tracking.do?invoice_no=${num}`,
  },
  {
    code: 'kdexp',
    name: '경동택배',
    trackingUrl: (num) => `https://kdexp.com/service/delivery/etc/deliverySearch.do?barcode=${num}`,
  },
  {
    code: 'daesin',
    name: '대신택배',
    trackingUrl: (num) => `https://www.ds3211.co.kr/freight/internalFreightSearch.do?billno=${num}`,
  },
  {
    code: 'ems',
    name: 'EMS (국제우편)',
    trackingUrl: (num) => `https://service.epost.go.kr/trace.RetrieveEmsRi498.postal?POST_CODE=${num}`,
  },
];

export function getCourierByCode(code: string): CourierCompany | undefined {
  return COURIER_COMPANIES.find(c => c.code === code);
}

export function getCourierByName(name: string): CourierCompany | undefined {
  return COURIER_COMPANIES.find(c => c.name === name);
}

export function getTrackingUrl(courierNameOrCode: string, trackingNumber: string): string | null {
  const courier = getCourierByCode(courierNameOrCode) || getCourierByName(courierNameOrCode);
  return courier ? courier.trackingUrl(trackingNumber) : null;
}

// Order status labels & colors
export const ORDER_STATUS_MAP: Record<string, { label: string; color: string; bgColor: string }> = {
  PENDING: { label: '주문 대기', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  CONFIRMED: { label: '주문 확인', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  SHIPPING: { label: '배송중', color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
  DELIVERED: { label: '배송완료', color: 'text-green-700', bgColor: 'bg-green-100' },
  CANCELLED: { label: '취소됨', color: 'text-red-700', bgColor: 'bg-red-100' },
  REFUNDED: { label: '환불됨', color: 'text-gray-700', bgColor: 'bg-gray-100' },
};
