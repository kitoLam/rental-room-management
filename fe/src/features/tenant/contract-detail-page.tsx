import { Notice, Panel, QueryState } from '@/components/common/page'
import { dateOnly } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { tenantApi } from '@/services/tenant'
import type { TenantContract, Tenancy } from '@/interfaces/tenant'
import { ExternalLink } from 'lucide-react'
import { useParams } from 'react-router'
import { EmptyRows, Facts, TenantLink, TenantPage, TenantStatus } from './components'
import { useTenant, useTenantQuery } from './context'
import { PrepaidPanel } from './prepaid-panel'

export function ContractDetailPage({ terms = false }: { terms?: boolean }) {
  const { contractId = '' } = useParams(),
    { tenancy: t } = useTenant(),
    query = useTenantQuery<TenantContract | Tenancy>(
      'contract',
      (id) => tenantApi.contract(id, contractId),
      [contractId],
    ),
    payments = useTenantQuery('payments', tenantApi.payments),
    contract = query.data && 'contractNumber' in query.data ? query.data : null
  const prepaid = (payments.data || []).filter((p) => p.status === 'VERIFIED' && !p.invoiceId)
  const tenancyMatchesContract = Boolean(contract && contract.id === t.contractId)
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
                <h2 className="text-xl font-bold">{contract?.contractNumber || t.code}</h2>
                <TenantStatus value={terms ? t.status : contract?.status || t.contractStatus} />
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
                        [contract ? 'Địa chỉ thuê' : 'Chi nhánh', contract?.roomAddress || t.branchName],
                        [
                          'Phòng / chỗ ở',
                          tenancyMatchesContract
                            ? `${t.roomName}${t.slotName ? ` · ${t.slotName}` : ''}`
                            : contract?.roomSlotId
                              ? 'Chỗ ở theo hợp đồng'
                              : contract
                                ? 'Phòng thuê'
                                : t.roomName,
                        ],
                        [
                          'Hình thức thuê',
                          contract?.roomMode === 'PER_SLOT'
                            ? 'Thuê chỗ'
                            : contract?.roomMode === 'WHOLE_ROOM'
                              ? 'Thuê nguyên phòng'
                              : t.rentalMode === 'SLOT'
                                ? 'Thuê chỗ'
                                : 'Thuê nguyên phòng',
                        ],
                        [
                          'Thời hạn',
                          `${dateOnly(contract?.startDate || t.startDate)} – ${dateOnly(contract?.endDate || t.endDate)} (không gồm ngày kết thúc)`,
                        ],
                        ...(tenancyMatchesContract
                          ? [
                              ['Vai trò của bạn', t.role === 'REPRESENTATIVE' ? 'Đại diện' : 'Thành viên'] as [string, string],
                              ['Trạng thái quan hệ cá nhân', <TenantStatus value={t.status} />] as [string, React.ReactNode],
                            ]
                          : []),
                      ]
                }
              />
              <p className="mt-6 border-t border-border pt-5 text-sm leading-7 text-muted-foreground">
                {terms ? t.terms : contract?.terms || (tenancyMatchesContract ? t.sharedTerms : '')}
              </p>
              {!terms && contract && (
                <>
                  <h3 className="mt-6 font-bold">Thông tin trên hợp đồng</h3>
                  <Facts
                    items={[
                      ['Địa chỉ thuê', contract.roomAddress || t.branchName],
                      ['Bên cho thuê', `${contract.landlordName || '—'} · CCCD/CMND ${contract.landlordIdNumber || '—'}`],
                      ['Bên thuê', `${contract.tenantName || '—'} · CCCD/CMND ${contract.tenantIdNumber || '—'}`],
                      ['Giá thuê / tháng', contract.rentPrice == null ? '—' : formatVnd(contract.rentPrice)],
                      ['Tiền cọc hợp đồng', contract.contractDepositAmount == null ? '—' : formatVnd(contract.contractDepositAmount)],
                      ['Ngày thanh toán hàng tháng', contract.paymentDueDay ?? '—'],
                      ['Chỉ số điện đầu kỳ', contract.electricityInitialReading ?? '—'],
                      ['Chỉ số nước đầu kỳ', contract.waterInitialReading ?? '—'],
                    ]}
                  />
                  {contract.services?.length ? (
                    <div className="mt-5 space-y-2">
                      <h3 className="font-bold">Dịch vụ theo hợp đồng</h3>
                      {contract.services.map((service) => (
                        <p key={service.serviceId} className="text-sm">
                          {service.name} · {formatVnd(service.unitPrice)}/{service.unit} ·{' '}
                          {service.mandatory ? 'Bắt buộc' : 'Tùy chọn'} ·{' '}
                          {service.selected ? 'Đã chọn' : 'Chưa chọn'}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </>
              )}
              {!terms && tenancyMatchesContract && (
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
                {contract?.signedFileUrl ? (
                  <a
                    href={contract.signedFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 text-sm text-primary"
                  >
                    Mở bản hợp đồng đã ký
                    <ExternalLink size={16} />
                  </a>
                ) : t.document ? (
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
                    {contract?.status === 'DRAFT'
                      ? 'Hợp đồng đang ở trạng thái nháp; quản lý sẽ cập nhật bản đã ký sau khi bàn giao.'
                      : 'Chưa có văn bản được cung cấp. Liên hệ quản lý để nhận bản hợp đồng.'}
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
