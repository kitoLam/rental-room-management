import { InlineError, Modal, Notice, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { type TenantService } from '@/interfaces/tenant'
import { dateOnly, dateTime } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { tenantApi } from '@/services/tenant'
import { useState } from 'react'
import { Facts, TenantPage, TenantStatus } from './components'
import { isActive, useTenant, useTenantMutation, useTenantQuery } from './context'
import { RegisterService, StopService } from './service-shared'
import { serviceActions } from './status'

// Khi còn chờ duyệt / chờ lắp đặt, ngày hiển thị là ngày người thuê đề nghị, chưa phải ngày tính phí.
const proposalStatuses = ['PENDING', 'APPROVED']

export function ServicesPage() {
  const { tenancy: t } = useTenant(),
    query = useTenantQuery('services', (id) => tenantApi.services(id), [], true),
    [selected, setSelected] = useState<TenantService | null>(null),
    [success, setSuccess] = useState('')
  const done = (message: string) => {
    setSelected(null)
    setSuccess(message)
  }
  const cancelRequest = useTenantMutation(tenantApi.cancelServiceRequest, () =>
    done('Đã hủy yêu cầu dịch vụ.'),
  )
  const current = query.data?.find((s) => s.id === selected?.id)
  const actions = current ? serviceActions(current) : []
  return (
    <TenantPage
      title="Dịch vụ phòng"
      description="Điện, nước luôn có sẵn. Dịch vụ bổ sung được quản lý duyệt và xác nhận ngày lắp đặt."
    >
      {success && <Notice tone="success">{success}</Notice>}
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
        empty={query.data?.length === 0}
        emptyMessage="Chưa có dịch vụ được cung cấp cho phòng."
        emptyAction={null}
      >
        <Panel>
          {query.data?.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-4 border-t border-border py-5 first:border-0 first:pt-0 last:pb-0"
            >
              <div>
                <h2 className="text-sm font-bold">{s.name}</h2>
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatVnd(s.unitPrice)} / {s.unit} · {s.mandatory ? 'Bắt buộc' : 'Tùy chọn'}
                </p>
                {s.startDate && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {proposalStatuses.includes(s.status || '') ? 'Đề nghị từ ' : 'Từ '}
                    {dateOnly(s.startDate)}
                    {s.endDate && ` – ${dateOnly(s.endDate)}`}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {s.status && <TenantStatus value={s.status} />}
                <Button
                  variant="outline"
                  disabled={!isActive(t) && !s.subscriptionId}
                  onClick={() => {
                    cancelRequest.reset()
                    setSuccess('')
                    setSelected(s)
                  }}
                >
                  {serviceActions(s).includes('REGISTER') ? 'Đăng ký' : 'Chi tiết'}
                </Button>
              </div>
            </div>
          ))}
        </Panel>
      </QueryState>
      <Modal
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) setSelected(null)
        }}
        title={selected?.name || 'Dịch vụ'}
      >
        {current &&
          (actions.includes('REGISTER') ? (
            <RegisterService
              service={current}
              onSuccess={() => done('Đã gửi đăng ký dịch vụ, đang chờ quản lý duyệt.')}
            />
          ) : (
            <div className="grid min-w-0 grid-cols-1 gap-5">
              <Facts
                items={[
                  ['Đơn giá', `${formatVnd(current.unitPrice)} / ${current.unit}`],
                  ['Trạng thái', current.status ? <TenantStatus value={current.status} /> : null],
                  [
                    proposalStatuses.includes(current.status || '') ? 'Ngày đề nghị' : 'Bắt đầu tính phí',
                    current.startDate ? dateOnly(current.startDate) : null,
                  ],
                  ['Kết thúc', current.endDate ? dateOnly(current.endDate) : null],
                ]}
              />
              {current.mandatory && <Notice>Điện và nước là dịch vụ bắt buộc, không thể hủy.</Notice>}
              {current.status === 'APPROVED' && (
                <Notice>Quản lý đã duyệt, đang chờ xác nhận ngày lắp đặt.</Notice>
              )}
              {current.status === 'STOP_PENDING' && (
                <Notice>Yêu cầu ngừng đang chờ quản lý xác nhận ngày kết thúc.</Notice>
              )}
              {actions.includes('STOP') && (
                <StopService
                  service={current}
                  onSuccess={() =>
                    done('Đã gửi yêu cầu ngừng. Dịch vụ chỉ ngừng sau khi quản lý xác nhận ngày kết thúc.')
                  }
                />
              )}
              {actions.includes('CANCEL') && current.requestId && (
                <>
                  <InlineError error={cancelRequest.error} />
                  <Button
                    variant="outline"
                    loading={cancelRequest.isPending}
                    onClick={() => cancelRequest.mutate(current.requestId!)}
                  >
                    Hủy yêu cầu đang chờ duyệt
                  </Button>
                </>
              )}
              {current.history.length > 0 && (
                <>
                  <h3 className="font-bold">Lịch sử xử lý</h3>
                  {current.history.map((h, i) => (
                    <div key={i} className="border-l-2 border-border pl-4 text-sm">
                      <TenantStatus value={h.status} />
                      <p className="mt-2 leading-6 text-muted-foreground">{h.note}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{dateTime(h.at)}</p>
                    </div>
                  ))}
                </>
              )}
            </div>
          ))}
      </Modal>
    </TenantPage>
  )
}
