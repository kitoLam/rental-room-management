import { InlineError, Modal, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { dateTime } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { tenantApi } from '@/services/tenant'
import { useState } from 'react'
import { useParams } from 'react-router'
import { Facts, TenantLink, TenantPage, TenantStatus } from './components'
import { isActive, useTenant, useTenantMutation, useTenantQuery } from './context'
import { tenantStatusLabel } from './status'

export function MaintenanceDetailPage() {
  const { reportId = '' } = useParams(),
    { tenancy: t } = useTenant(),
    query = useTenantQuery('report', (id) => tenantApi.report(id, reportId), [reportId], true),
    [confirm, setConfirm] = useState(false),
    [image, setImage] = useState<string | null>(null)
  const cancel = useTenantMutation(tenantApi.cancelReport, () => setConfirm(false))
  return (
    <TenantPage
      title="Chi tiết bảo trì"
      actions={<TenantLink to="/tenant/maintenance">Danh sách yêu cầu</TenantLink>}
    >
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {query.data && (
          <>
            <Panel>
              <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                <h2 className="max-w-xl break-words text-xl font-bold">{query.data.title}</h2>
                <TenantStatus value={query.data.status} />
              </div>
              <Facts
                items={[
                  [
                    'Chỗ ở',
                    `${t.branchName} · ${t.roomName}${t.slotName ? ` · ${t.slotName}` : ''}`,
                  ],
                  ['Tài sản / dịch vụ', query.data.assetName],
                  ['Mức ưu tiên', tenantStatusLabel(query.data.priority)],
                  ['Ngày gửi', dateTime(query.data.createdAt)],
                  ['Người xử lý', query.data.assignedTo || 'Chưa phân công'],
                ]}
              />
              <p className="mt-6 whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">
                {query.data.description}
              </p>
              {query.data.attachments.length > 0 && (
                <div className="mt-5 grid grid-cols-3 gap-3">
                  {query.data.attachments.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setImage(a.url)}
                      aria-label={`Xem ảnh ${a.name}`}
                    >
                      <img
                        src={a.url}
                        alt={a.name}
                        className="aspect-square w-full rounded-lg object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
              {query.data.status === 'OPEN' && isActive(t) && (
                <div className="mt-5">
                  <Button variant="outline" onClick={() => setConfirm(true)}>
                    Hủy yêu cầu bảo trì
                  </Button>
                </div>
              )}
            </Panel>
            <Panel>
              <h2 className="mb-6 font-bold">Tiến trình xử lý</h2>
              <ol className="space-y-7">
                {query.data.records.map((r) => (
                  <li key={r.id} className="relative border-l-2 border-border pl-5">
                    <span className="absolute top-1 -left-[5px] size-2 rounded-full bg-primary" />
                    <div className="flex flex-wrap items-center gap-3">
                      <TenantStatus value={r.status} />
                      <time className="text-xs text-muted-foreground">{dateTime(r.at)}</time>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{r.description}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{r.performedBy}</p>
                    {r.evidence.length > 0 && (
                      <div className="mt-4 grid max-w-sm grid-cols-3 gap-2">
                        {r.evidence.map((src) => (
                          <button
                            key={src}
                            onClick={() => setImage(src)}
                            aria-label={`Ảnh minh chứng ${r.description}`}
                          >
                            <img
                              src={src}
                              alt={`Minh chứng ${tenantStatusLabel(r.status).toLowerCase()}`}
                              className="aspect-square w-full rounded-lg object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                    {r.cost > 0 && (
                      <div className="mt-4 rounded-lg bg-background p-4">
                        <p className="text-sm font-bold">
                          {formatVnd(r.cost)} ·{' '}
                          {r.responsibleParty === 'OWNER' ? 'Chủ nhà' : 'Người thuê'} chịu
                        </p>
                        {r.approvalStatus && (
                          <div className="mt-2">
                            <TenantStatus value={r.approvalStatus} />
                          </div>
                        )}
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          {r.approvalStatus === 'APPROVED'
                            ? r.responsibleParty === 'TENANT'
                              ? 'Khoản được duyệt chỉ trở thành công nợ khi có trong hóa đơn đã phát hành.'
                              : 'Chi phí hao mòn được chủ nhà thanh toán.'
                            : 'Chưa được duyệt, chưa tính vào công nợ của bạn.'}
                        </p>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </Panel>
          </>
        )}
      </QueryState>
      <Modal
        title="Hủy yêu cầu bảo trì?"
        description="Chỉ có thể hủy yêu cầu chưa được tiếp nhận."
        open={confirm}
        onOpenChange={setConfirm}
      >
        <InlineError error={cancel.error} />
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={() => setConfirm(false)} disabled={cancel.isPending}>
            Giữ yêu cầu
          </Button>
          <Button loading={cancel.isPending} onClick={() => cancel.mutate(reportId)}>
            Xác nhận hủy
          </Button>
        </div>
      </Modal>
      <Modal title="Ảnh minh chứng" open={!!image} onOpenChange={() => setImage(null)}>
        {image && (
          <img src={image} alt="Ảnh minh chứng bảo trì mở rộng" className="w-full rounded-lg" />
        )}
      </Modal>
    </TenantPage>
  )
}
