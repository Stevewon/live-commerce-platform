import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-12">
        <div className="container mx-auto px-4 sm:px-6">
          <Link href="/" className="inline-flex items-center text-white/80 hover:text-white mb-4 text-sm">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            홈으로
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold">개인정보처리방침</h1>
          <p className="mt-2 text-white/80 text-sm sm:text-base">QRLIVE 플랫폼 개인정보 처리에 관한 정책</p>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 sm:px-6 py-10 sm:py-16 max-w-4xl">
        <div className="prose prose-gray max-w-none text-gray-700 leading-relaxed">

          <p className="text-sm text-gray-500 mb-8">시행일: 2026년 3월 1일 | 최종 수정일: 2026년 3월 10일</p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-10">
            <p className="text-sm text-blue-800">
              큐라이브(QRLIVE, 이하 &quot;회사&quot;)는 개인정보보호법, 정보통신망 이용촉진 및 정보보호 등에 관한 법률 등 관련 법령을 준수하며,
              이용자의 개인정보를 보호하기 위해 최선의 노력을 다하고 있습니다.
            </p>
          </div>

          {/* 제1조 */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">제1조 (개인정보의 수집 항목 및 수집 방법)</h2>
            
            <h3 className="text-base font-semibold text-gray-800 mt-4 mb-2">1. 수집하는 개인정보 항목</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300 text-sm mb-4">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-2 text-left font-semibold">구분</th>
                    <th className="border border-gray-300 px-4 py-2 text-left font-semibold">필수 항목</th>
                    <th className="border border-gray-300 px-4 py-2 text-left font-semibold">선택 항목</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2 font-medium">일반 회원가입</td>
                    <td className="border border-gray-300 px-4 py-2">닉네임, 비밀번호, 시큐릿 QR 인증 정보</td>
                    <td className="border border-gray-300 px-4 py-2">이메일, 전화번호, 이름</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-300 px-4 py-2 font-medium">파트너 가입</td>
                    <td className="border border-gray-300 px-4 py-2">닉네임, 비밀번호, 시큐릿 QR 인증 정보, 이름, 연락처, 상점 이름</td>
                    <td className="border border-gray-300 px-4 py-2">이메일, 상점 소개, SNS 채널 URL</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2 font-medium">상품 구매</td>
                    <td className="border border-gray-300 px-4 py-2">수령인 이름, 배송지 주소, 연락처</td>
                    <td className="border border-gray-300 px-4 py-2">배송 요청사항</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-300 px-4 py-2 font-medium">결제</td>
                    <td className="border border-gray-300 px-4 py-2">결제 수단 정보 (토스페이먼츠를 통해 처리)</td>
                    <td className="border border-gray-300 px-4 py-2">-</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2 font-medium">자동 수집</td>
                    <td className="border border-gray-300 px-4 py-2">접속 IP, 쿠키, 서비스 이용 기록, 접속 로그, 기기 정보</td>
                    <td className="border border-gray-300 px-4 py-2">-</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-base font-semibold text-gray-800 mt-4 mb-2">2. 수집 방법</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>회원가입 및 서비스 이용 과정에서 이용자가 직접 입력</li>
              <li>시큐릿(Securet) 메신저를 통한 본인 인증</li>
              <li>서비스 이용 과정에서 자동으로 생성 및 수집 (쿠키, 접속 로그 등)</li>
              <li>토스페이먼츠 등 결제 대행 서비스를 통한 결제 정보</li>
            </ul>
          </section>

          {/* 제2조 */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">제2조 (개인정보의 수집 및 이용 목적)</h2>
            <p className="mb-3">회사는 수집한 개인정보를 다음의 목적을 위해 이용합니다.</p>
            
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300 text-sm mb-4">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-2 text-left font-semibold">이용 목적</th>
                    <th className="border border-gray-300 px-4 py-2 text-left font-semibold">세부 내용</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2 font-medium">회원 관리</td>
                    <td className="border border-gray-300 px-4 py-2">회원제 서비스 제공, 본인 확인, 불량회원 부정 이용 방지, 가입 의사 확인, 분쟁 조정을 위한 기록 보존</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-300 px-4 py-2 font-medium">서비스 제공</td>
                    <td className="border border-gray-300 px-4 py-2">상품 주문 및 결제 처리, 배송, 콘텐츠 제공, 라이브 방송 참여, 고객 상담</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2 font-medium">마케팅 활용</td>
                    <td className="border border-gray-300 px-4 py-2">이벤트 및 프로모션 안내, 쿠폰 발급, 서비스 개선을 위한 통계 분석 (선택 동의 시)</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-300 px-4 py-2 font-medium">파트너 관리</td>
                    <td className="border border-gray-300 px-4 py-2">파트너 입점 심사, 수익 정산, 판매 내역 관리</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 제3조 */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">제3조 (개인정보의 보유 및 이용 기간)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>회원 탈퇴 시 지체 없이 파기합니다. 다만, 관련 법령에 의해 보존이 필요한 경우 해당 기간 동안 보관합니다.</li>
              <li>법령에 의한 보관 기간:
                <div className="overflow-x-auto mt-2">
                  <table className="w-full border-collapse border border-gray-300 text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-4 py-2 text-left font-semibold">보존 항목</th>
                        <th className="border border-gray-300 px-4 py-2 text-left font-semibold">보존 기간</th>
                        <th className="border border-gray-300 px-4 py-2 text-left font-semibold">근거 법령</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-gray-300 px-4 py-2">계약 또는 청약 철회에 관한 기록</td>
                        <td className="border border-gray-300 px-4 py-2">5년</td>
                        <td className="border border-gray-300 px-4 py-2">전자상거래법</td>
                      </tr>
                      <tr className="bg-gray-50">
                        <td className="border border-gray-300 px-4 py-2">대금 결제 및 재화 등의 공급에 관한 기록</td>
                        <td className="border border-gray-300 px-4 py-2">5년</td>
                        <td className="border border-gray-300 px-4 py-2">전자상거래법</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-4 py-2">소비자의 불만 또는 분쟁 처리에 관한 기록</td>
                        <td className="border border-gray-300 px-4 py-2">3년</td>
                        <td className="border border-gray-300 px-4 py-2">전자상거래법</td>
                      </tr>
                      <tr className="bg-gray-50">
                        <td className="border border-gray-300 px-4 py-2">웹사이트 방문 기록 (접속 로그)</td>
                        <td className="border border-gray-300 px-4 py-2">3개월</td>
                        <td className="border border-gray-300 px-4 py-2">통신비밀보호법</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </li>
            </ol>
          </section>

          {/* 제4조 */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">제4조 (개인정보의 제3자 제공)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>회사는 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다.</li>
              <li>다만, 다음의 경우에는 예외로 합니다.
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li>이용자가 사전에 동의한 경우</li>
                  <li>법령의 규정에 의하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>
                  <li>상품 배송을 위해 배송 업체에 필요 최소한의 정보(이름, 주소, 연락처)를 제공하는 경우</li>
                  <li>결제 처리를 위해 결제 대행사(토스페이먼츠)에 필요 최소한의 정보를 제공하는 경우</li>
                </ul>
              </li>
            </ol>
          </section>

          {/* 제5조 */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">제5조 (개인정보 처리의 위탁)</h2>
            <p className="mb-3">회사는 원활한 서비스 제공을 위해 다음과 같이 개인정보 처리를 위탁하고 있습니다.</p>
            
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300 text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-2 text-left font-semibold">수탁 업체</th>
                    <th className="border border-gray-300 px-4 py-2 text-left font-semibold">위탁 업무 내용</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2">KISPG(KIS정보통신)</td>
                    <td className="border border-gray-300 px-4 py-2">결제 처리 및 결제 정보 관리</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-300 px-4 py-2">Cloudflare, Inc.</td>
                    <td className="border border-gray-300 px-4 py-2">서비스 인프라 운영, 콘텐츠 전송, 보안 서비스</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2">시큐릿(Securet)</td>
                    <td className="border border-gray-300 px-4 py-2">본인 인증 서비스</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 제6조 */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">제6조 (개인정보의 파기)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>회사는 개인정보의 수집 및 이용 목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다.</li>
              <li>파기 방법:
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li>전자적 파일: 복구 불가능한 방법으로 영구 삭제</li>
                  <li>종이 문서: 분쇄기로 분쇄하거나 소각</li>
                </ul>
              </li>
              <li>법령에 의한 보관이 필요한 경우, 해당 기간 동안 별도의 데이터베이스(DB)에 분리하여 안전하게 보관합니다.</li>
            </ol>
          </section>

          {/* 제7조 */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">제7조 (이용자의 권리와 행사 방법)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>이용자는 언제든지 자신의 개인정보를 조회하거나 수정할 수 있습니다.</li>
              <li>이용자는 개인정보의 수집, 이용, 제공에 대한 동의를 철회할 수 있습니다.</li>
              <li>이용자는 개인정보의 삭제를 요청할 수 있으며, 회사는 지체 없이 처리합니다.</li>
              <li>개인정보 관련 요청은 마이페이지 또는 고객센터를 통해 가능합니다.</li>
              <li>만 14세 미만 아동의 개인정보는 수집하지 않습니다.</li>
            </ol>
          </section>

          {/* 제8조 */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">제8조 (개인정보의 안전성 확보 조치)</h2>
            <p className="mb-3">회사는 이용자의 개인정보를 안전하게 관리하기 위해 다음과 같은 조치를 취하고 있습니다.</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>비밀번호 암호화:</strong> 이용자의 비밀번호는 bcrypt 알고리즘으로 일방향 암호화하여 저장하며, 본인만이 알 수 있습니다.</li>
              <li><strong>전송 구간 암호화:</strong> 모든 데이터 전송은 SSL/TLS 암호화를 통해 보호됩니다.</li>
              <li><strong>접근 권한 관리:</strong> 개인정보에 대한 접근 권한을 최소한의 인원으로 제한하고 있습니다.</li>
              <li><strong>보안 인프라:</strong> Cloudflare를 통한 DDoS 방어, WAF(웹 애플리케이션 방화벽) 등 보안 서비스를 적용하고 있습니다.</li>
              <li><strong>인증 보안:</strong> JWT(JSON Web Token) 기반 인증 및 HTTP-Only 쿠키를 사용하여 토큰 탈취를 방지합니다.</li>
              <li><strong>시큐릿 인증:</strong> 시큐릿 메신저 기반의 2차 본인 인증을 통해 계정 보안을 강화합니다.</li>
            </ul>
          </section>

          {/* 제9조 */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">제9조 (쿠키의 운영 및 관리)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>회사는 서비스 이용 편의를 위해 쿠키(Cookie)를 사용합니다.</li>
              <li>쿠키의 사용 목적:
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li>로그인 상태 유지 및 자동 인증</li>
                  <li>이용자의 서비스 이용 패턴 분석 및 개선</li>
                  <li>장바구니 및 최근 본 상품 기능</li>
                </ul>
              </li>
              <li>이용자는 브라우저 설정을 통해 쿠키 허용/차단을 관리할 수 있습니다. 다만, 쿠키를 차단할 경우 일부 서비스 이용에 제한이 있을 수 있습니다.</li>
            </ol>
          </section>

          {/* 제10조 */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">제10조 (개인정보 보호책임자)</h2>
            <p className="mb-3">회사는 이용자의 개인정보 보호 및 관련 민원 처리를 위해 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.</p>
            
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 mb-4">
              <h3 className="font-semibold text-gray-900 mb-3">개인정보 보호책임자</h3>
              <ul className="space-y-1 text-sm">
                <li><strong>성명:</strong> 원스티브 (Stevewon)</li>
                <li><strong>직위:</strong> 대표</li>
                <li><strong>이메일:</strong> privacy@qrlive.io</li>
              </ul>
            </div>

            <p className="text-sm text-gray-600">
              기타 개인정보 침해에 대한 상담이 필요한 경우 아래 기관에 문의하시기 바랍니다.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600 mt-2">
              <li>개인정보침해신고센터 (privacy.kisa.or.kr / 118)</li>
              <li>개인정보 분쟁조정위원회 (www.kopico.go.kr / 1833-6972)</li>
              <li>대검찰청 사이버수사과 (www.spo.go.kr / 1301)</li>
              <li>경찰청 사이버안전국 (cyberbureau.police.go.kr / 182)</li>
            </ul>
          </section>

          {/* 제11조 */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">제11조 (개인정보처리방침의 변경)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>본 개인정보처리방침은 법령, 정책, 보안 기술의 변경에 따라 수정될 수 있습니다.</li>
              <li>변경 사항은 서비스 내 공지사항 또는 이메일을 통해 사전 고지합니다.</li>
              <li>변경된 방침은 공지 후 7일이 경과한 시점부터 효력이 발생합니다.</li>
            </ol>
          </section>

          {/* 부칙 */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">부칙</h2>
            <p>본 개인정보처리방침은 2026년 3월 1일부터 시행합니다.</p>
          </section>

        </div>

        {/* Navigation */}
        <div className="mt-12 pt-8 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
          <Link href="/terms" className="text-blue-600 hover:text-blue-700 font-medium text-sm">
            &larr; 이용약관 보기
          </Link>
          <Link href="/" className="text-gray-500 hover:text-gray-700 text-sm">
            홈으로 돌아가기
          </Link>
        </div>
      </main>
    </div>
  )
}
