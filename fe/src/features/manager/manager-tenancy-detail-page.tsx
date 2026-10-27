import { Panel, QueryState } from '@/components/common/page'
import { Facts } from '@/features/tenant/components'
import { dateOnly } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { managerApi } from '@/services/manager'
import { useParams } from 'react-router'
import { ManagerLink, ManagerPage, ManagerStatus } from './components'
import { useManagerList, useManagerQuery } from './context'

export function ManagerTenancyDetail() {
  const { contractTenantId = '' } = useParams(),
    query = useManagerQuery('tenancy', (b) => managerApi.get(b, 'tenants', contractTenantId), [
      contractTenantId,
    ]),
    invoices = useManagerList('invoices', { contractTenantId, size: '100' }),
    services = useManagerList('service-requests', { contractTenantId, size: '100' })
  return (
    <ManagerPage
      title="Hồ sơ thuê cá nhân"
      actions={<ManagerLink to="/manager/tenants">Danh sách người thuê</ManagerLink>}
    >
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {query.data && (
          <>
            <Panel>
              <h2 className="mb-5 text-xl font-bold">{query.data.userName}</h2>
              <Facts
                items={[
                  [
                    'Liên hệ',
                    `${query.data.email} · ${query.data.phone || 'Chưa có số điện thoại'}`,
                  ],
                  [
                    'Chỗ ở',
                    `${query.data.roomName}${query.data.slotName ? ` · ${query.data.slotName}` : ''}`,
                  ],
                  ['Quan hệ thuê', query.data.id],
                  ['Trạng thái', <ManagerStatus value={query.data.status} />],
                  ['Vai trò', query.data.role === 'REPRESENTATIVE' ? 'Đại diện' : 'Thành viên'],
                  ['Cư trú', `${dateOnly(query.data.startDate)} – ${dateOnly(query.data.endDate)}`],
                  [
                    'Ngày rời thực tế',
                    query.data.actualLeaveDate ? dateOnly(query.data.actualLeaveDate) : 'Chưa có',
                  ],
                  ['Giá thỏa thuận / tháng', formatVnd(query.data.monthlyRent)],
                  [
                    'Trả trước kỳ đầu / cuối',
                    `${formatVnd(query.data.prepaidFirstRequired)} / ${formatVnd(query.data.prepaidLastRequired)}`,
                  ],
                ]}
              />
              <p className="mt-5 text-sm leading-7 text-muted-foreground">{query.data.terms}</p>
              <div className="mt-5 flex flex-wrap gap-x-6">
                <ManagerLink to={`/manager/contracts/${query.data.contractId}`}>
                  Hợp đồng
                </ManagerLink>
                <ManagerLink to={`/manager/contracts/${query.data.contractId}/tenants`}>
                  Nghĩa vụ cá nhân
                </ManagerLink>
                <ManagerLink
                  to={`/manager/rooms/${query.data.roomId}${query.data.rentalMode === 'SLOT' ? '/slots' : ''}`}
                >
                  Cư trú / chỗ ở
                </ManagerLink>
              </div>
            </Panel>
            <Panel>
              <h2 className="mb-4 font-bold">Hóa đơn & dịch vụ</h2>
              <QueryState
                pending={invoices.isPending || services.isPending}
                error={invoices.error || services.error}
                retry={() => {
                  void invoices.refetch()
                  void services.refetch()
                }}
              >
                {invoices.data?.content.map((i) => (
                  <div
                    key={i.id}
                    className="flex flex-wrap justify-between gap-3 border-t border-border py-3"
                  >
                    <ManagerLink to={`/manager/invoices/${i.id}`}>{i.code}</ManagerLink>
                    <span className="text-sm">Còn {formatVnd(i.outstanding)}</span>
                  </div>
                ))}
                {services.data?.content.map((s) => (
                  <p key={s.id} className="border-t border-border py-3 text-sm">
                    {s.name} · <ManagerStatus value={s.status || 'DRAFT'} />
                  </p>
                ))}
              </QueryState>
            </Panel>
          </>
        )}
      </QueryState>
    </ManagerPage>
  )
}
