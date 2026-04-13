import Link from 'next/link'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-12">
        <div className="container mx-auto px-4 sm:px-6">
          <Link href="/" className="inline-flex items-center text-white/80 hover:text-white mb-4 text-sm">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            홈으로
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold">이용약관</h1>
          <p className="mt-2 text-white/80 text-sm sm:text-base">QRLIVE 플랫폼 서비스 이용약관</p>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 sm:px-6 py-10 sm:py-16 max-w-4xl">
        <div className="prose prose-gray max-w-none text-gray-700 leading-relaxed">

          <p className="text-sm text-gray-500 mb-8">시행일: 2026년 3월 1일 | 최종 수정일: 2026년 3월 10일</p>

          {/* 제1조 */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">제1조 (목적)</h2>
            <p>
              이 약관은 큐라이브(QRLIVE, 이하 &quot;회사&quot;)가 운영하는 라이브 커머스 플랫폼(이하 &quot;서비스&quot;)의 이용 조건 및 절차, 
              회사와 이용자의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.
            </p>
          </section>

          {/* 제2조 */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">제2조 (정의)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>&quot;서비스&quot;란 회사가 qrlive.io 도메인을 통해 제공하는 라이브 커머스 플랫폼 및 관련 제반 서비스를 말합니다.</li>
              <li>&quot;이용자&quot;란 본 약관에 따라 서비스를 이용하는 회원 및 비회원을 말합니다.</li>
              <li>&quot;회원&quot;이란 회사에 개인정보를 제공하고 회원등록을 한 자로서, 서비스를 지속적으로 이용할 수 있는 자를 말합니다.</li>
              <li>&quot;파트너&quot;란 회사와 제휴 계약을 체결하고, 플랫폼을 통해 상품을 판매하거나 라이브 방송을 진행하는 판매자를 말합니다.</li>
              <li>&quot;라이브 방송&quot;이란 파트너가 실시간 영상을 통해 상품을 소개하고 판매하는 서비스를 말합니다.</li>
              <li>&quot;시큐릿 인증&quot;이란 시큐릿(Securet) 메신저 기반의 본인 인증 수단을 말합니다.</li>
            </ol>
          </section>

          {/* 제3조 */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">제3조 (약관의 효력 및 변경)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>본 약관은 서비스 화면에 게시하거나 기타 방법으로 이용자에게 공지함으로써 효력이 발생합니다.</li>
              <li>회사는 관련 법령에 위배되지 않는 범위 내에서 약관을 변경할 수 있으며, 변경 시 적용일 7일 전부터 서비스 내 공지합니다.</li>
              <li>이용자가 변경된 약관에 동의하지 않을 경우, 서비스 이용을 중단하고 회원 탈퇴를 할 수 있습니다.</li>
            </ol>
          </section>

          {/* 제4조 */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">제4조 (회원가입 및 계정)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>회원가입은 이용자가 약관에 동의하고, 시큐릿 QR 인증 및 닉네임, 비밀번호를 등록함으로써 완료됩니다.</li>
              <li>회원은 가입 시 정확한 정보를 제공해야 하며, 허위 정보 제공 시 서비스 이용이 제한될 수 있습니다.</li>
              <li>회원은 자신의 계정 정보를 안전하게 관리할 책임이 있으며, 제3자에게 이를 양도하거나 대여할 수 없습니다.</li>
              <li>회사는 다음 각 호에 해당하는 경우 회원가입을 거부하거나 사후에 이용을 제한할 수 있습니다.
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li>실명이 아니거나 타인의 정보를 이용한 경우</li>
                  <li>허위 정보를 기재하거나 필수 항목을 누락한 경우</li>
                  <li>이전에 약관 위반으로 자격을 상실한 경우</li>
                  <li>관련 법령에 위배되는 경우</li>
                </ul>
              </li>
            </ol>
          </section>

          {/* 제5조 */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">제5조 (서비스의 제공 및 변경)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>회사는 다음과 같은 서비스를 제공합니다.
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li>라이브 방송을 통한 상품 판매 서비스</li>
                  <li>온라인 쇼핑몰 서비스 (상품 검색, 주문, 결제)</li>
                  <li>파트너 입점 및 분양형 쇼핑몰 운영 서비스</li>
                  <li>QR 코드 기반 상품 연결 서비스</li>
                  <li>쿠폰, 할인 등 프로모션 서비스</li>
                  <li>위시리스트, 장바구니 등 편의 기능</li>
                </ul>
              </li>
              <li>회사는 기술적 사양의 변경 등의 이유로 서비스 내용을 변경할 수 있으며, 변경 시 사전에 공지합니다.</li>
              <li>회사는 서비스의 안정적 운영을 위해 정기점검 또는 긴급점검을 실시할 수 있습니다.</li>
            </ol>
          </section>

          {/* 제6조 */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">제6조 (파트너 서비스)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>파트너는 회사의 심사를 거쳐 플랫폼에 입점할 수 있으며, 독립된 쇼핑몰(분양형)을 운영할 수 있습니다.</li>
              <li>파트너는 라이브 방송을 통해 상품을 소개하고 판매할 수 있습니다.</li>
              <li>판매 수익은 회사와 파트너 간 합의된 수수료율(기본 30%)에 따라 정산됩니다.</li>
              <li>파트너는 판매하는 상품의 품질, 배송, 교환, 환불에 대한 책임을 부담합니다.</li>
              <li>파트너는 관련 법령(전자상거래법, 소비자보호법 등)을 준수해야 합니다.</li>
            </ol>
          </section>

          {/* 제7조 */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">제7조 (구매 및 결제)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>이용자는 서비스를 통해 상품을 주문하고 결제할 수 있습니다.</li>
              <li>결제 수단은 KISPG(KIS정보통신) 등 회사가 제공하는 결제 방식을 통해 이루어집니다.</li>
              <li>이용자는 주문 시 정확한 배송 정보를 제공해야 하며, 잘못된 정보로 인한 배송 문제에 대해 회사는 책임을 지지 않습니다.</li>
              <li>라이브 방송 중 특별 할인이 적용된 상품은 방송 종료 후 정상 가격으로 변경될 수 있습니다.</li>
            </ol>
          </section>

          {/* 제8조 */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">제8조 (청약 철회 및 환불)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>이용자는 상품을 배송받은 날로부터 7일 이내에 청약을 철회할 수 있습니다.</li>
              <li>다음의 경우 청약 철회가 제한됩니다.
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li>이용자의 책임 있는 사유로 상품이 멸실 또는 훼손된 경우</li>
                  <li>이용자의 사용 또는 소비에 의하여 상품의 가치가 현저히 감소한 경우</li>
                  <li>복제 가능한 상품의 포장을 훼손한 경우</li>
                  <li>기타 전자상거래법에서 규정하는 경우</li>
                </ul>
              </li>
              <li>환불은 원 결제 수단으로 진행되며, 결제 수단에 따라 처리 기간이 상이할 수 있습니다.</li>
            </ol>
          </section>

          {/* 제9조 */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">제9조 (이용자의 의무)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>이용자는 다음 행위를 해서는 안 됩니다.
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li>타인의 정보를 도용하는 행위</li>
                  <li>서비스에서 얻은 정보를 회사의 사전 승낙 없이 복제, 배포, 이용하는 행위</li>
                  <li>회사 또는 제3자의 지적재산권을 침해하는 행위</li>
                  <li>회사 또는 제3자의 명예를 훼손하거나 업무를 방해하는 행위</li>
                  <li>외설적이거나 폭력적인 정보를 서비스에 게시하는 행위</li>
                  <li>서비스의 안정적 운영을 방해하는 행위</li>
                  <li>라이브 방송 중 부적절한 언어를 사용하거나 타인을 비방하는 행위</li>
                  <li>허위 리뷰를 작성하거나 부정한 방법으로 쿠폰을 사용하는 행위</li>
                </ul>
              </li>
            </ol>
          </section>

          {/* 제10조 */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">제10조 (회사의 의무)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>회사는 관련 법령과 본 약관이 금지하거나 미풍양속에 반하는 행위를 하지 않습니다.</li>
              <li>회사는 이용자의 개인정보를 보호하기 위해 개인정보처리방침을 수립하고 이를 준수합니다.</li>
              <li>회사는 서비스의 안정적 제공을 위해 최선의 노력을 다합니다.</li>
              <li>회사는 이용자로부터 제기된 의견이나 불만이 정당하다고 인정될 경우 적절한 조치를 취합니다.</li>
            </ol>
          </section>

          {/* 제11조 */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">제11조 (서비스 이용 제한 및 중지)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>회사는 다음의 경우 서비스 이용을 제한하거나 중지할 수 있습니다.
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li>서비스 설비의 보수, 교체, 점검 등 공사로 인해 부득이한 경우</li>
                  <li>전기통신사업법에 규정된 기간통신사업자가 전기통신 서비스를 중지한 경우</li>
                  <li>천재지변, 국가비상사태 등 불가항력적 사유가 있는 경우</li>
                </ul>
              </li>
              <li>회원이 약관을 위반한 경우, 회사는 사전 통보 후 이용을 제한할 수 있습니다.</li>
            </ol>
          </section>

          {/* 제12조 */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">제12조 (지적재산권)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>서비스에 포함된 콘텐츠(디자인, 텍스트, 이미지, 로고, 소프트웨어 등)에 대한 지적재산권은 회사에 귀속됩니다.</li>
              <li>이용자는 서비스를 통해 얻은 정보를 회사의 사전 승낙 없이 상업적으로 이용하거나 제3자에게 제공할 수 없습니다.</li>
              <li>파트너가 등록한 상품 정보 및 라이브 방송 콘텐츠의 저작권은 해당 파트너에게 귀속됩니다.</li>
            </ol>
          </section>

          {/* 제13조 */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">제13조 (면책조항)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>회사는 천재지변, 전쟁, 기간통신사업자의 서비스 중지 등 불가항력으로 인해 서비스를 제공할 수 없는 경우 책임이 면제됩니다.</li>
              <li>회사는 이용자의 귀책사유로 인한 서비스 이용 장애에 대해 책임을 지지 않습니다.</li>
              <li>회사는 파트너가 등록한 상품의 품질, 진위, 적법성에 대해 보증하지 않습니다.</li>
              <li>이용자 간 또는 이용자와 파트너 간의 거래에서 발생하는 분쟁에 대해 회사는 개입하지 않으며, 이에 대한 책임을 부담하지 않습니다.</li>
            </ol>
          </section>

          {/* 제14조 */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">제14조 (회원 탈퇴 및 자격 상실)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>회원은 언제든지 회사에 탈퇴를 요청할 수 있으며, 회사는 즉시 회원 탈퇴를 처리합니다.</li>
              <li>탈퇴 시 미처리 주문이 있는 경우, 해당 주문의 처리가 완료된 후 탈퇴가 진행됩니다.</li>
              <li>탈퇴 후 회원의 개인정보는 개인정보처리방침에 따라 처리됩니다.</li>
            </ol>
          </section>

          {/* 제15조 */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">제15조 (분쟁 해결)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>회사와 이용자 간에 발생한 분쟁에 관한 소송은 대한민국 법률을 준거법으로 합니다.</li>
              <li>서비스 이용으로 발생한 분쟁에 대해 소송이 제기될 경우, 회사의 본사 소재지를 관할하는 법원을 전속 관할 법원으로 합니다.</li>
              <li>회사와 이용자 간의 분쟁에 대해 한국소비자원, 전자거래분쟁조정위원회 등의 조정을 거칠 수 있습니다.</li>
            </ol>
          </section>

          {/* 부칙 */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">부칙</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>본 약관은 2026년 3월 1일부터 시행합니다.</li>
              <li>본 약관에 명시되지 않은 사항은 전자상거래 등에서의 소비자보호에 관한 법률, 약관의 규제에 관한 법률, 정보통신망 이용촉진 및 정보보호 등에 관한 법률 등 관련 법령에 따릅니다.</li>
            </ol>
          </section>

        </div>

        {/* Navigation */}
        <div className="mt-12 pt-8 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
          <Link href="/privacy" className="text-blue-600 hover:text-blue-700 font-medium text-sm">
            개인정보처리방침 보기 &rarr;
          </Link>
          <Link href="/" className="text-gray-500 hover:text-gray-700 text-sm">
            홈으로 돌아가기
          </Link>
        </div>
      </main>
    </div>
  )
}
