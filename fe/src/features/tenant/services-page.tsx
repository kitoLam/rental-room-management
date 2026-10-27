import { InlineError, Modal, Notice, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { type TenantService } from '@/interfaces/tenant'
import { dateOnly, dateTime } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { tenantApi } from '@/services/tenant'
import { useState } from 'react'
import { Facts, TenantPage, TenantStatus } from './components'
import { isActive, useTenant, useTenantMutation, useTenantQuery } from './context'
import { RegisterService } from './service-shared'
export function ServicesPage() {
  const { tenancy: t } = useTenant(),
    query = useTenantQuery('services', (id) => tenantApi.services(id, t), [], true),
    [selected, setSelected] = useState<TenantService | null>(null),
    [success, setSuccess] = useState('')
  const cancel = useTenantMutation(tenantApi.cancelService, () => {
    setSelected(null)
    setSuccess('Đã gửi yêu cầu hủy. Dịch vụ chỉ ngừng sau khi quản lý duyệt.')
  })
  const current = query.data?.find((s) => s.id === selected?.id)
  return (
    <TenantPage
      title="Dịch vụ phòng"
      description="Điện, nước luôn có sẵn. Dịch vụ bổ sung được quản lý duyệt riêng."
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
                    {dateOnly(s.startDate)} – {dateOnly(s.endDate!)}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {s.status && <TenantStatus value={s.status} />}
                <Button
                  variant="outline"
                  disabled={!isActive(t) && !s.subscriptionId}
                  onClick={() => {
                    cancel.reset()
                    setSelected(s)
                  }}
                >
                  {!s.subscriptionId || ['REJECTED', 'CANCELLED'].includes(s.status || '')
                    ? 'Đăng ký'
                    : 'Chi tiết'}
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
          ((!current.subscriptionId || ['REJECTED', 'CANCELLED'].includes(current.status || '')) &&
          !current.mandatory ? (
            <RegisterService
              service={current}
              onSuccess={() => {
                setSelected(null)
                setSuccess('Đã gửi đăng ký dịch vụ, đang chờ quản lý duyệt.')
              }}
            />
          ) : (
            <div className="grid min-w-0 grid-cols-1 gap-5">
              <Facts
                items={[
                  ['Đơn giá', `${formatVnd(current.unitPrice)} / ${current.unit}`],
                  ['Trạng thái', current.status ? <TenantStatus value={current.status} /> : null],
                  ['Bắt đầu', current.startDate ? dateOnly(current.startDate) : null],
                  ['Kết thúc', current.endDate ? dateOnly(current.endDate) : null],
                ]}
              />
              {current.mandatory ? (
                <Notice>Điện và nước là dịch vụ bắt buộc, không thể hủy.</Notice>
              ) : (
                <>
                  <InlineError error={cancel.error} />
                  <Button
                    variant="outline"
                    loading={cancel.isPending}
                    disabled={!isActive(t) || current.status !== 'APPROVED'}
                    onClick={() => cancel.mutate(current.subscriptionId || current.id)}
                  >
                    Yêu cầu ngừng dịch vụ
                  </Button>
                </>
              )}
              <h3 className="font-bold">Lịch sử xử lý</h3>
              {current.history.length ? (
                current.history.map((h, i) => (
                  <div key={i} className="border-l-2 border-border pl-4 text-sm">
                    <TenantStatus value={h.status} />
                    <p className="mt-2 leading-6 text-muted-foreground">{h.note}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{dateTime(h.at)}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Được cung cấp theo hợp đồng thuê.</p>
              )}
            </div>
          ))}
      </Modal>
    </TenantPage>
  )
}
