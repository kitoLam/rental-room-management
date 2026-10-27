import { Notice, Panel, QueryState } from '@/components/common/page'
import { dateOnly } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { tenantApi } from '@/services/tenant'
import { ExternalLink } from 'lucide-react'
import { useParams } from 'react-router'
import { EmptyRows, Facts, TenantLink, TenantPage, TenantStatus } from './components'
import { useTenant, useTenantQuery } from './context'
import { PrepaidPanel } from './prepaid-panel'

export function ContractDetailPage({ terms = false }: { terms?: boolean }) {
  const { contractId = '' } = useParams(),
    { tenancy: t } = useTenant(),
    query = useTenantQuery('contract', (id) => tenantApi.contract(id, contractId), [contractId]),
    payments = useTenantQuery('payments', tenantApi.payments)
  const prepaid = (payments.data || []).filter((p) => p.status === 'VERIFIED' && !p.invoiceId)
  return (
    <TenantPage
      title={terms ? 'Điều khoản cá nhân' : 'Chi tiết hợp đồng'}
      actions={<TenantLink to="/tenant/contracts">Danh sách hợp đồng</TenantLink>}
    >
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {query.data && (
          <>
            <Panel>
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold">{query.data.code}</h2>
                <TenantStatus value={terms ? t.status : t.contractStatus} />
              </div>
              <Facts
                items={
                  terms
                    ? [
                        ['Quan hệ thuê', t.id],
                        ['Chỗ ở', `${t.roomName}${t.slotName ? ` · ${t.slotName}` : ''}`],
                        ['Tiền thuê thỏa thuận / tháng', formatVnd(t.monthlyRent)],
                        [
                          'Kỳ đầu / kỳ cuối',
                          `${formatVnd(t.firstMonthRent)} / ${formatVnd(t.lastMonthRent)}`,
                        ],
                        ['Trả trước kỳ đầu yêu cầu', formatVnd(t.prepaidFirstRequired)],
                        ['Trả trước kỳ cuối yêu cầu', formatVnd(t.prepaidLastRequired)],
                        ['Thời hạn cá nhân', `${dateOnly(t.startDate)} – ${dateOnly(t.endDate)}`],
                        [
                          'Ngày rời đi thực tế',
                          t.actualLeaveDate ? dateOnly(t.actualLeaveDate) : 'Chưa có',
                        ],
                      ]
                    : [
                        ['Chi nhánh', t.branchName],
                        ['Phòng', t.roomName],
                        [
                          'Hình thức thuê',
                          t.rentalMode === 'SLOT' ? 'Thuê chỗ' : 'Thuê nguyên phòng',
                        ],
                        [
                          'Thời hạn',
                          `${dateOnly(t.startDate)} – ${dateOnly(t.endDate)} (không gồm ngày kết thúc)`,
                        ],
                        [
                          'Vai trò của bạn',
                          t.role === 'REPRESENTATIVE' ? 'Đại diện' : 'Thành viên',
                        ],
                        ['Trạng thái quan hệ cá nhân', <TenantStatus value={t.status} />],
                      ]
                }
              />
              <p className="mt-6 border-t border-border pt-5 text-sm leading-7 text-muted-foreground">
                {terms ? t.terms : t.sharedTerms}
              </p>
              {!terms && (
                <div className="mt-4">
                  <TenantLink to={`/tenant/contracts/${t.contractId}/my-terms`}>
                    Điều khoản & nghĩa vụ của tôi
                  </TenantLink>
                </div>
              )}
            </Panel>
            {terms ? (
              <>
                <PrepaidPanel />
                <Panel>
                  <h2 className="mb-5 font-bold">Tiền thuê trả trước</h2>
                  <QueryState
                    pending={payments.isPending}
                    error={payments.error}
                    retry={payments.refetch}
                  >
                    {prepaid.length ? (
                      prepaid.map((p) => (
                        <div key={p.id} className="grid gap-4">
                          <Facts
                            items={[
                              ['Đã xác minh kỳ đầu', formatVnd(p.prepaidFirstAmount)],
                              ['Đã xác minh kỳ cuối', formatVnd(p.prepaidLastAmount)],
                              ['Đã áp dụng kỳ đầu', formatVnd(p.prepaidFirstApplied)],
                              ['Đã áp dụng kỳ cuối', formatVnd(p.prepaidLastApplied)],
                            ]}
                          />
                          <p className="break-all text-xs text-muted-foreground">
                            Nguồn tiền: {p.reference}
                          </p>
                        </div>
                      ))
                    ) : (
                      <EmptyRows>Chưa có khoản trả trước đã xác minh.</EmptyRows>
                    )}
                  </QueryState>
                </Panel>
                <Notice>
                  Trả trước được áp dụng từ nguồn tiền đã nhận, không tạo thêm giao dịch thu tiền.
                  Số tiền theo hồ sơ đã duyệt; chính sách tháng lẻ và hoàn trả chưa được chốt.
                </Notice>
                <TenantLink to="/tenant/invoices">Hóa đơn của quan hệ thuê này</TenantLink>
              </>
            ) : (
              <Panel>
                <h2 className="mb-3 font-bold">Văn bản hợp đồng</h2>
                {t.document ? (
                  <a
                    href={t.document.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 text-sm text-primary"
                  >
                    {t.document.name}
                    <ExternalLink size={16} />
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Chưa có văn bản được cung cấp. Liên hệ quản lý để nhận bản hợp đồng.
                  </p>
                )}
              </Panel>
            )}
          </>
        )}
      </QueryState>
    </TenantPage>
  )
}
