import { Modal, Notice, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { Facts } from '@/features/tenant/components'
import { addMonths, dateOnly, firstBillingStartDate as suggestedFirstBillingStartDate } from '@/lib/activity'
import { managerApi } from '@/services/manager'
import { bookingService } from '@/services/guest-user'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router'
import { z } from 'zod'
import { ActionDialog, ManagerForm, ManagerLink, ManagerPage } from './components'
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
    [evidenceNote, setEvidenceNote] = useState(''),
    mutation = useManagerAction(() => setAction(''))
  const sourceBooking = useQuery({
    queryKey: ['contract-booking', query.data?.sourceBookingId],
    queryFn: () => bookingService.get(query.data!.sourceBookingId!),
    enabled: Boolean(query.data?.sourceBookingId && !query.data?.startDate),
    retry: false,
  })
  // Hợp đồng chốt ngày bắt đầu từ booking gốc; dùng cho cả hiển thị nháp lẫn min ngày tính tiền kỳ đầu.
  const expectedStartDate = query.data?.startDate || sourceBooking.data?.startDate || null
  // Ngày tính tiền kỳ đầu gợi ý = mùng 1 đầu tiên không trước ngày hiệu lực; input chỉ đọc.
  const firstBillingStartDate = query.data?.evidenceSubmittedAt
    ? suggestedFirstBillingStartDate(query.data.evidenceSubmittedAt, undefined, expectedStartDate)
    : ''
  const billingDateMinimum = firstBillingStartDate
  const validFirstBillingStartDate = Boolean(
    firstBillingStartDate && firstBillingStartDate >= billingDateMinimum && firstBillingStartDate.endsWith('-01'),
  )
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
                  [
                    'Thời hạn',
                    query.data.status === 'ACTIVE'
                      ? `${dateOnly(query.data.startDate)} – ${dateOnly(query.data.endDate)}`
                      : expectedStartDate
                        ? `Dự kiến từ ${dateOnly(expectedStartDate)}${query.data.termMonths ? ` → ${dateOnly(addMonths(expectedStartDate, query.data.termMonths))}` : ''} — chưa duyệt evidence`
                        : 'Chưa duyệt evidence',
                  ],
                ]}
              />
              <h3 className="mt-6 font-bold">Thông tin trên hợp đồng</h3>
              <Facts items={[
                ['Địa chỉ thuê', query.data.roomAddress || '—'],
                ['Phòng / chỗ ở', query.data.roomName],
                ['Giá thuê / tháng', query.data.rentPrice == null ? '—' : `${query.data.rentPrice.toLocaleString('vi-VN')} ₫`],
                ['Tiền cọc hợp đồng', query.data.contractDepositAmount == null ? '—' : `${query.data.contractDepositAmount.toLocaleString('vi-VN')} ₫`],
              ]} />
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
                <label className="grid gap-1 text-sm">Ngày bắt đầu tính tiền kỳ đầu<input className="input disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground" type="date" required min={billingDateMinimum} value={firstBillingStartDate} disabled /></label>
                <label className="grid gap-1 text-sm">Lý do nếu yêu cầu gửi lại<textarea className="input min-h-20" value={evidenceNote} onChange={(event) => setEvidenceNote(event.target.value)} /></label>
                <div className="flex flex-wrap gap-3">
                  <Button disabled={!validFirstBillingStartDate} loading={mutation.isPending} onClick={() => mutation.mutate({ resource: 'contracts', id: contractId, action: 'review-evidence', value: { approved: true, firstBillingStartDate } })}>Duyệt và kích hoạt</Button>
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
            {query.data.status === 'DRAFT' && <Notice>
              Hợp đồng chỉ được kích hoạt sau khi manager duyệt evidence; các slot và snapshot dịch vụ được lưu trên cùng một hợp đồng.
            </Notice>}
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
