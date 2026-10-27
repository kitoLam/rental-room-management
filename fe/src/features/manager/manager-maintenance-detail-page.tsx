import { Modal, Notice, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { Facts } from '@/features/tenant/components'
import { recordInputSchema } from '@/interfaces/manager'
import type { Attachment } from '@/interfaces/tenant'
import { dateTime } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { managerApi } from '@/services/manager'
import { useState } from 'react'
import { useParams } from 'react-router'
import { ActionDialog, ManagerForm, ManagerLink, ManagerPage, ManagerStatus } from './components'
import { useManagerAction, useManagerQuery } from './context'
import { EvidenceInput } from './evidence-input'
export function ManagerMaintenanceDetail() {
  const { reportId = '' } = useParams(),
    query = useManagerQuery(
      'maintenance-detail',
      (b) => managerApi.get(b, 'maintenance', reportId),
      [reportId],
      true,
    ),
    [action, setAction] = useState(''),
    [recordId, setRecordId] = useState(''),
    [evidence, setEvidence] = useState<Attachment[]>([]),
    mutation = useManagerAction(() => {
      setAction('')
      setEvidence([])
    })
  return (
    <ManagerPage
      title="Xử lý sửa chữa"
      actions={<ManagerLink to="/manager/maintenance">Danh sách sửa chữa</ManagerLink>}
    >
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {query.data && (
          <>
            <Panel>
              <h2 className="mb-5 text-xl font-bold">{query.data.title}</h2>
              <Facts
                items={[
                  ['Tài sản / dịch vụ', query.data.assetName],
                  ['Phòng', query.data.roomName],
                  ['Người gửi', query.data.tenantName],
                  ['Trạng thái', <ManagerStatus value={query.data.status} />],
                  ['Mức độ', <ManagerStatus value={query.data.priority} />],
                  ['Phụ trách', query.data.assignedTo],
                ]}
              />
              <p className="mt-6 whitespace-pre-wrap text-sm leading-7">{query.data.description}</p>
              <div className="mt-5 grid grid-cols-3 gap-3">
                {query.data.attachments.map((a) => (
                  <img
                    src={a.url}
                    alt={a.name}
                    key={a.id}
                    className="aspect-square w-full rounded-lg object-cover"
                  />
                ))}
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                {(query.data.status === 'OPEN'
                  ? [
                      ['accept', 'Tiếp nhận'],
                      ['reject', 'Từ chối'],
                    ]
                  : query.data.status === 'ACCEPTED'
                    ? [
                        ['assign', 'Phân công'],
                        ['start', 'Bắt đầu xử lý'],
                        ['record', 'Thêm nhật ký'],
                      ]
                    : query.data.status === 'IN_PROGRESS'
                      ? [
                          ['assign', 'Phân công lại'],
                          ['record', 'Thêm nhật ký'],
                          ['complete', 'Hoàn tất sửa chữa'],
                        ]
                      : []
                ).map(([a, label]) => (
                  <Button variant="outline" key={a} onClick={() => setAction(a)}>
                    {label}
                  </Button>
                ))}
              </div>
            </Panel>
            <Panel>
              <h2 className="mb-5 font-bold">Nhật ký & trách nhiệm chi phí</h2>
              <ol className="grid gap-6">
                {query.data.records.map((r) => (
                  <li key={r.id} className="border-l-2 border-border pl-4">
                    <p className="text-xs text-muted-foreground">
                      {dateTime(r.at)} · {r.performedBy}
                    </p>
                    <p className="mt-2 text-sm leading-6">{r.description}</p>
                    {r.cost > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-bold">
                          {formatVnd(r.cost)} ·{' '}
                          {r.responsibleParty === 'TENANT' ? 'Người thuê' : 'Chủ nhà'} chịu
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          <ManagerStatus value={r.approvalStatus || 'PENDING'} />
                          {r.approvalStatus === 'PENDING' && (
                            <>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setRecordId(r.id)
                                  setAction('cost-approve')
                                }}
                              >
                                Duyệt trách nhiệm chi phí
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setRecordId(r.id)
                                  setAction('cost-reject')
                                }}
                              >
                                Từ chối chi phí
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      {r.evidence.map((url, n) => (
                        <img
                          src={url}
                          alt={`Minh chứng nhật ký ${n + 1}`}
                          key={n}
                          className="aspect-square w-full rounded-lg object-cover"
                        />
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
            </Panel>
            <Notice>
              Chỉ chi phí người thuê đã được duyệt của yêu cầu hoàn tất mới được chọn làm nguồn hóa
              đơn.
            </Notice>
          </>
        )}
      </QueryState>
      {action === 'record' ? (
        <Modal
          title="Thêm nhật ký xử lý"
          open
          onOpenChange={(v) => {
            if (!v && !mutation.isPending) setAction('')
          }}
        >
          <ManagerForm
            schema={recordInputSchema.omit({ evidence: true })}
            defaults={{ description: '', cost: 0, responsibleParty: '' }}
            fields={[
              { name: 'description', label: 'Công việc đã thực hiện', kind: 'textarea' },
              { name: 'cost', label: 'Chi phí (VND)', kind: 'number' },
              {
                name: 'responsibleParty',
                label: 'Bên chịu chi phí',
                kind: 'select',
                nullable: true,
                options: [
                  { value: 'OWNER', label: 'Chủ nhà' },
                  { value: 'TENANT', label: 'Người thuê' },
                ],
              },
            ]}
            pending={mutation.isPending}
            error={mutation.error}
            onSubmit={(value) =>
              mutation.mutate({
                resource: 'maintenance',
                id: reportId,
                action,
                value: { ...value, evidence, reason: value.description },
              })
            }
          >
            <EvidenceInput value={evidence} onChange={setEvidence} disabled={mutation.isPending} />
          </ManagerForm>
        </Modal>
      ) : (
        <ActionDialog
          title="Xác nhận xử lý sửa chữa"
          open={!!action}
          onOpenChange={(v) => {
            if (!v) setAction('')
          }}
          fields={
            ['accept', 'assign'].includes(action)
              ? [{ name: 'handler', label: 'Người được phân công' }]
              : []
          }
          pending={mutation.isPending}
          error={mutation.error}
          onConfirm={(value) =>
            mutation.mutate({
              resource: 'maintenance',
              id: reportId,
              action,
              value: { ...value, ...(recordId ? { recordId } : {}) },
            })
          }
        />
      )}
    </ManagerPage>
  )
}
