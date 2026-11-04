import { Modal, Notice, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { Facts } from '@/features/tenant/components'
import { dateOnly } from '@/lib/activity'
import { managerApi } from '@/services/manager'
import { useState } from 'react'
import { useParams } from 'react-router'
import { z } from 'zod'
import { ActionDialog, ManagerForm, ManagerLink, ManagerPage, ManagerStatus } from './components'
import { useManagerAction, useManagerQuery } from './context'
import { History } from './leasing-shared'
export function ManagerContractDetail() {
  const { contractId = '' } = useParams(),
    query = useManagerQuery(
      'contract',
      (b) => managerApi.get(b, 'contracts', contractId),
      [contractId],
      true,
    ),
    [action, setAction] = useState(''),
    [adjustedSignedDate, setAdjustedSignedDate] = useState(''),
    [firstBillingStartDate, setFirstBillingStartDate] = useState(''),
    [evidenceNote, setEvidenceNote] = useState(''),
    mutation = useManagerAction(() => setAction(''))
  return (
    <ManagerPage
      title="Hồ sơ hợp đồng"
      actions={<ManagerLink to="/manager/contracts">Danh sách hợp đồng</ManagerLink>}
    >
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {query.data && (
          <>
            <Panel>
              <h2 className="mb-5 text-xl font-bold">{query.data.code}</h2>
              <Facts
                items={[
                  ['Trạng thái', <ManagerStatus value={query.data.status} />],
                  ['Đại diện', query.data.representativeName],
                  ['Phòng', query.data.roomName],
                  ['Địa chỉ thuê', query.data.roomAddress || '—'],
                  ['Bên cho thuê', `${query.data.landlordName || '—'} · CCCD/CMND ${query.data.landlordIdNumber || '—'} · ${query.data.landlordAddress || '—'}`],
                  ['Bên thuê', `${query.data.tenantName || query.data.representativeName || '—'} · CCCD/CMND ${query.data.tenantIdNumber || '—'} · ${query.data.tenantAddress || '—'}`],
                  ['Giá thuê / tháng', query.data.rentPrice == null ? '—' : `${query.data.rentPrice.toLocaleString('vi-VN')} ₫`],
                  ['Tiền cọc hợp đồng', query.data.contractDepositAmount == null ? '—' : `${query.data.contractDepositAmount.toLocaleString('vi-VN')} ₫`],
                  ['Ngày thanh toán mỗi tháng', query.data.paymentDueDay ?? '—'],
                  [
                    'Thời hạn',
                    query.data.evidenceSubmittedAt
                      ? `${dateOnly(query.data.startDate)} – ${dateOnly(query.data.endDate)}`
                      : 'Chưa duyệt evidence',
                  ],
                  ['Số quan hệ thuê', query.data.tenantCount],
                ]}
              />
              <p className="mt-6 whitespace-pre-wrap text-sm leading-7">{query.data.terms}</p>
              <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                <p>Chỉ số điện đầu kỳ: {query.data.electricityInitialReading ?? '—'} · {query.data.electricityRate ?? '—'} VND/kWh</p>
                <p>Chỉ số nước đầu kỳ: {query.data.waterInitialReading ?? '—'} · {query.data.waterRate ?? '—'} VND/m³</p>
                <p>Số slot trong hợp đồng: {query.data.roomSlotIds?.length ?? query.data.maxOccupants ?? '—'}</p>
                {query.data.signedFileUrl && <a className="text-primary underline" href={query.data.signedFileUrl} target="_blank" rel="noreferrer">Mở hợp đồng đã ký</a>}
              </div>
              {!!query.data.services?.length && <div className="mt-4 space-y-2 text-sm">
                <h3 className="font-semibold">Dịch vụ theo snapshot hợp đồng</h3>
                {query.data.services.map((service: { serviceId: string; name: string; unit: string; unitPrice: number; mandatory: boolean; selected: boolean; quantity?: number | null }) =>
                  <p key={service.serviceId}>{service.name} · {service.quantity ?? 'Theo chỉ số'} {service.unit} × {service.unitPrice.toLocaleString('vi-VN')} đ · {service.mandatory ? 'Bắt buộc' : 'Tùy chọn'}</p>)}
              </div>}
              {query.data.status === 'DRAFT' && query.data.evidenceSubmittedAt && <div className="mt-5 grid gap-4 rounded-xl border p-4">
                <h3 className="font-semibold">Duyệt evidence đã ký</h3>
                {query.data.signedEvidenceUrl && <a className="text-sm text-primary underline" href={query.data.signedEvidenceUrl} target="_blank" rel="noreferrer">Mở evidence người thuê đã gửi</a>}
                <label className="grid gap-1 text-sm">Ngày ký đã xác minh (để trống để giữ ngày người thuê nhập)<input className="input" type="date" value={adjustedSignedDate || query.data.signedDate || ''} onChange={(event) => setAdjustedSignedDate(event.target.value)} /></label>
                <label className="grid gap-1 text-sm">Ngày bắt đầu tính tiền kỳ đầu<input className="input" type="date" required value={firstBillingStartDate} onChange={(event) => setFirstBillingStartDate(event.target.value)} /></label>
                <label className="grid gap-1 text-sm">Lý do nếu yêu cầu gửi lại<textarea className="input min-h-20" value={evidenceNote} onChange={(event) => setEvidenceNote(event.target.value)} /></label>
                <div className="flex flex-wrap gap-3">
                  <Button disabled={!firstBillingStartDate} loading={mutation.isPending} onClick={() => mutation.mutate({ resource: 'contracts', id: contractId, action: 'review-evidence', value: { approved: true, firstBillingStartDate, ...(adjustedSignedDate ? { adjustedSignedDate } : {}) } })}>Duyệt và kích hoạt</Button>
                  <Button variant="outline" disabled={!evidenceNote.trim()} loading={mutation.isPending} onClick={() => mutation.mutate({ resource: 'contracts', id: contractId, action: 'review-evidence', value: { approved: false, note: evidenceNote.trim() } })}>Yêu cầu gửi lại</Button>
                </div>
              </div>}
              <div className="mt-6 flex flex-wrap gap-3">
                <ManagerLink to={`/manager/contracts/${contractId}/tenants`}>
                  Thành viên & nghĩa vụ cá nhân
                </ManagerLink>
                <ManagerLink to={`/manager/rooms/${query.data.roomId}`}>Phòng / chỗ ở</ManagerLink>
                {query.data.sourceBookingId && (
                  <ManagerLink to={`/manager/bookings/${query.data.sourceBookingId}`}>
                    Giữ phòng gốc
                  </ManagerLink>
                )}
                {query.data.status === 'DRAFT' && !query.data.sourceBookingId && (
                  <>
                    <Button onClick={() => setAction('check-in')}>Ghi nhận bàn giao và ký giấy</Button>
                  </>
                )}
                {query.data.status === 'ACTIVE' && (
                  <Button variant="outline" onClick={() => setAction('end')}>
                    Kết thúc khi hết hạn
                  </Button>
                )}
              </div>
            </Panel>
            <Notice>
              Hợp đồng chỉ được kích hoạt sau khi manager duyệt evidence; các slot và snapshot dịch vụ được lưu trên cùng một hợp đồng.
            </Notice>
            <Panel>
              <h2 className="mb-5 font-bold">Lịch sử hợp đồng</h2>
              <History
                items={query.data.history.map((h) => ({ ...h, note: `${h.actor}: ${h.note}` }))}
              />
            </Panel>
          </>
        )}
      </QueryState>
      {action === 'check-in' ? <Modal title="Bàn giao và lưu hợp đồng đã ký" open onOpenChange={(open) => !open && setAction('')}>
        <ManagerForm
          schema={z.object({ signedFileUrl: z.string().url() })}
          defaults={{ signedFileUrl: '' }}
          fields={[{ name: 'signedFileUrl', label: 'URL bản hợp đồng giấy đã ký' }]}
          pending={mutation.isPending}
          error={mutation.error}
          submitLabel="Xác nhận bàn giao"
          onSubmit={(value) => mutation.mutate({ resource: 'contracts', id: contractId, action: 'check-in', value })}
        />
      </Modal> : <ActionDialog
        title="Xác nhận thay đổi trạng thái hợp đồng"
        open={!!action}
        onOpenChange={(v) => {
          if (!v) setAction('')
        }}
        pending={mutation.isPending}
        error={mutation.error}
        onConfirm={(value) =>
          mutation.mutate({ resource: 'contracts', id: contractId, action, value })
        }
      />}
    </ManagerPage>
  )
}
