import { Modal, Notice } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { type ManagerRecord } from '@/interfaces/manager'
import { dateTime } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { useState } from 'react'
import { ActionDialog, ManagerLink, ManagerPage, ManagerStatus, Records } from './components'
import { useManagerAction, useManagerList } from './context'

export function ManagerAllocations() {
  const [status, setStatus] = useState(''),
    [page, setPage] = useState(1),
    query = useManagerList('cost-allocations', { status, page: String(page - 1) }, true),
    [selected, setSelected] = useState<ManagerRecord<'cost-allocations'> | null>(null),
    [decision, setDecision] = useState(''),
    mutation = useManagerAction(() => {
      setDecision('')
      setSelected(null)
    })
  return (
    <ManagerPage title="Xét phân bổ chi phí">
      <select
        aria-label="Trạng thái phân bổ"
        className="input max-w-xs"
        value={status}
        onChange={(e) => {
          setStatus(e.target.value)
          setPage(1)
        }}
      >
        <option value="">Tất cả trạng thái</option>
        <option value="PENDING">Chờ duyệt</option>
        <option value="APPROVED">Đã duyệt</option>
        <option value="REJECTED">Từ chối</option>
        <option value="SUPERSEDED">Đã thay thế</option>
      </select>
      <Records
        query={query}
        page={page}
        onPage={setPage}
        columns={[
          {
            label: 'Đề xuất',
            render: (p) => (
              <>
                <strong>{p.chargeName}</strong>
                <p className="text-xs text-muted-foreground">
                  {p.tenantName} · {dateTime(p.createdAt)}
                </p>
              </>
            ),
          },
          { label: 'Tổng nguồn', render: (p) => formatVnd(p.sourceAmount) },
          { label: 'Trạng thái', render: (p) => <ManagerStatus value={p.status} /> },
          {
            label: 'Chi tiết',
            render: (p) => (
              <Button variant="outline" onClick={() => setSelected(p)}>
                So sánh phân bổ
              </Button>
            ),
          },
        ]}
      />
      <Modal
        title="So sánh phân bổ"
        open={!!selected && !decision}
        onOpenChange={(v) => {
          if (!v) setSelected(null)
        }}
      >
        {selected && (
          <div className="grid gap-5">
            <p className="text-sm leading-6">{selected.reason}</p>
            <div className="flex flex-wrap gap-5">
              <ManagerLink to={`/manager/utility-charges/${selected.chargeId}`}>
                Khoản phí nguồn
              </ManagerLink>
              {selected.invoiceId && (
                <ManagerLink to={`/manager/invoices/${selected.invoiceId}`}>
                  Hóa đơn liên quan
                </ManagerLink>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="py-3">Cư trú</th>
                    <th>Mặc định</th>
                    <th>Đề xuất</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.defaultShares.map((s) => (
                    <tr key={s.id} className="border-t border-border">
                      <td className="py-3">{s.label}</td>
                      <td>{formatVnd(s.amount)}</td>
                      <td>{formatVnd(selected.shares.find((v) => v.id === s.id)?.amount || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm font-bold">
              Tổng đề xuất: {formatVnd(selected.shares.reduce((s, v) => s + v.amount, 0))}
            </p>
            <Notice>
              Hóa đơn đã phát hành giữ nguyên. Phân bổ chỉ cập nhật nguồn chưa chốt vào hóa đơn.
            </Notice>
            {selected.decision && <p className="text-sm">{selected.decision}</p>}
            {selected.status === 'PENDING' && (
              <div className="flex gap-3">
                <Button onClick={() => setDecision('approve')}>Duyệt phân bổ</Button>
                <Button variant="outline" onClick={() => setDecision('reject')}>
                  Từ chối
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
      <ActionDialog
        title="Xác nhận kết quả phân bổ"
        open={!!decision}
        onOpenChange={(v) => {
          if (!v) setDecision('')
        }}
        pending={mutation.isPending}
        error={mutation.error}
        onConfirm={(value) =>
          mutation.mutate({
            resource: 'cost-allocations',
            id: selected!.id,
            value: { ...value, decision },
          })
        }
      />
    </ManagerPage>
  )
}
