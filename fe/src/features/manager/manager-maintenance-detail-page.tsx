import { Modal, Notice, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-store'
import { Facts } from '@/features/tenant/components'
import { recordInputSchema } from '@/interfaces/manager'
import type { Attachment } from '@/interfaces/tenant'
import { dateTime } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { managerApi } from '@/services/manager'
import { useState } from 'react'
import { useParams } from 'react-router'
import { z } from 'zod'
import { ActionDialog, ManagerForm, ManagerLink, ManagerPage, ManagerStatus } from './components'
import { useManagerAction, useManagerQuery } from './context'
import { EvidenceInput } from './evidence-input'

export function ManagerMaintenanceDetail() {
  const { reportId = '' } = useParams(),
    isAdmin = useSession((s) => Boolean(s.user?.roles.includes('ADMIN') || s.activeRole === 'ADMIN')),
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
      query.refetch()
    })

  const getActionButtons = (status: string): [string, string][] => {
    switch (status) {
      case 'PENDING':
      case 'OPEN':
        return [
          ['start', 'Bắt đầu xử lý'],
          ['request-info', 'Yêu cầu bổ sung'],
          ['reject', 'Từ chối'],
        ]
      case 'IN_PROGRESS':
      case 'ACCEPTED':
        return [
          ['progress', 'Cập nhật tiến độ'],
          ['resolve', 'Báo kết quả giải quyết'],
          ['request-info', 'Yêu cầu bổ sung'],
          ['reject', 'Từ chối'],
        ]
      case 'WAITING_INFO':
        return [
          ['reject', 'Từ chối'],
        ]
      default:
        return []
    }
  }

  return (
    <ManagerPage
      title="Xử lý yêu cầu hỗ trợ"
      actions={<ManagerLink to="/manager/maintenance">Danh sách yêu cầu</ManagerLink>}
    >
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {query.data && (
          <>
            <Panel>
              <h2 className="mb-5 text-xl font-bold">{query.data.title}</h2>
              <Facts
                items={[
                  ['Mục / Loại', query.data.assetName],
                  ['Phòng', query.data.roomName],
                  ['Người gửi', query.data.tenantName],
                  ['Trạng thái', <ManagerStatus value={query.data.status} />],
                  ['Mức độ', <ManagerStatus value={query.data.priority} />],
                  ['Phụ trách', query.data.assignedTo || 'Quản lý phụ trách'],
                ]}
              />
              <p className="mt-6 whitespace-pre-wrap text-sm leading-7">{query.data.description}</p>
              {query.data.attachments.length > 0 && (
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
              )}

              {/* Status information banners */}
              {query.data.requestedInfoNote && query.data.status === 'WAITING_INFO' && (
                <div className="mt-6 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
                  <p className="font-bold">Đang chờ khách thuê bổ sung thông tin:</p>
                  <p className="mt-1 whitespace-pre-wrap">{query.data.requestedInfoNote}</p>
                </div>
              )}
              {query.data.solutionResult && (
                <div className="mt-6 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-900 dark:text-emerald-200">
                  <p className="font-bold">Kết quả đã giải quyết:</p>
                  <p className="mt-1 whitespace-pre-wrap">{query.data.solutionResult}</p>
                </div>
              )}
              {query.data.rejectReason && query.data.status === 'REJECTED' && (
                <div className="mt-6 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
                  <p className="font-bold">Lý do từ chối:</p>
                  <p className="mt-1 whitespace-pre-wrap">{query.data.rejectReason}</p>
                </div>
              )}
              {query.data.status === 'ESCALATED_ADMIN' && (
                <div className="mt-6 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
                  <p className="font-bold">Hồ sơ đã chuyển lên Admin phân xử. Đang chờ kết luận:</p>
                  <p className="mt-1 whitespace-pre-wrap">
                    Lý do khiếu nại: {query.data.disputeReason || 'Chờ phân xử'}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      Các thao tác của Quản lý tạm khóa chờ Admin giải quyết.
                    </p>
                    {isAdmin && (
                      <Button onClick={() => setAction('admin-resolve')}>
                        Admin phân xử & đóng
                      </Button>
                    )}
                  </div>
                </div>
              )}
              {query.data.adminConclusion && query.data.status === 'CLOSED' && (
                <div className="mt-6 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-900 dark:text-emerald-200">
                  <p className="font-bold">Hồ sơ đã được Admin phân xử & đóng:</p>
                  <p className="mt-1 whitespace-pre-wrap">Kết luận Admin: {query.data.adminConclusion}</p>
                </div>
              )}

              {/* Action buttons (for Manager) */}
              <div className="mt-6 flex flex-wrap gap-3">
                {getActionButtons(query.data.status).map(([a, label]) => (
                  <Button variant="outline" key={a} onClick={() => setAction(a)}>
                    {label}
                  </Button>
                ))}
              </div>
            </Panel>

            <Panel>
              <h2 className="mb-5 font-bold">Nhật ký xử lý & Tiến trình</h2>
              <ol className="grid gap-6">
                {query.data.records.map((r) => (
                  <li key={r.id} className="border-l-2 border-border pl-4">
                    <p className="text-xs text-muted-foreground">
                      {dateTime(r.at)} · {r.performedBy}
                    </p>
                    <p className="mt-2 text-sm leading-6 whitespace-pre-wrap">{r.description}</p>
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
              Tất cả các bước xử lý (bắt đầu xử lý, bổ sung thông tin, cập nhật tiến độ, báo giải quyết, từ chối) đều
              được lưu vết tự động vào lịch sử hệ thống.
            </Notice>
          </>
        )}
      </QueryState>

      {/* Modal: Progress Update */}
      {action === 'record' || action === 'progress' ? (
        <Modal
          title={action === 'progress' ? 'Cập nhật tiến độ xử lý' : 'Thêm nhật ký xử lý'}
          open
          onOpenChange={(v) => {
            if (!v && !mutation.isPending) setAction('')
          }}
        >
          <ManagerForm
            schema={recordInputSchema.omit({ evidence: true })}
            defaults={{ description: '', cost: 0, responsibleParty: '' }}
            fields={[
              { name: 'description', label: 'Nội dung tiến độ xử lý (bắt buộc)', kind: 'textarea' },
              { name: 'cost', label: 'Chi phí phát sinh (VND, nếu có)', kind: 'number' },
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
                action: 'progress',
                value: {
                  ...value,
                  evidence,
                  progressNote: value.description,
                  reason: value.description,
                },
              })
            }
          >
            <EvidenceInput value={evidence} onChange={setEvidence} disabled={mutation.isPending} />
          </ManagerForm>
        </Modal>
      ) : action === 'resolve' ? (
        <Modal
          title="Báo kết quả đã giải quyết"
          open
          onOpenChange={(v) => {
            if (!v && !mutation.isPending) setAction('')
          }}
        >
          <ManagerForm
            schema={z.object({
              solutionResult: z.string().trim().min(5, 'Cần nhập kết quả xử lý ít nhất 5 ký tự'),
            })}
            defaults={{ solutionResult: '' }}
            fields={[
              {
                name: 'solutionResult',
                label: 'Kết quả giải quyết & bàn giao (bắt buộc)',
                kind: 'textarea',
              },
            ]}
            pending={mutation.isPending}
            error={mutation.error}
            onSubmit={(value) =>
              mutation.mutate({
                resource: 'maintenance',
                id: reportId,
                action: 'resolve',
                value: { ...value, evidence, solutionNote: value.solutionResult },
              })
            }
          >
            <EvidenceInput value={evidence} onChange={setEvidence} disabled={mutation.isPending} />
          </ManagerForm>
        </Modal>
      ) : action === 'admin-resolve' && isAdmin ? (
        <Modal
          title="Admin phân xử & Đóng hồ sơ tranh chấp"
          description="Đưa ra kết luận phân xử chính thức. Quyết định của Admin là quyết định cuối cùng và hồ sơ sẽ được đóng hoàn tất."
          open
          onOpenChange={(v) => {
            if (!v && !mutation.isPending) setAction('')
          }}
        >
          <ManagerForm
            schema={z.object({
              adminConclusion: z.string().trim().min(5, 'Cần nhập kết luận phân xử ít nhất 5 ký tự'),
            })}
            defaults={{ adminConclusion: '' }}
            fields={[
              {
                name: 'adminConclusion',
                label: 'Kết luận phân xử chính thức (bắt buộc)',
                kind: 'textarea',
              },
            ]}
            pending={mutation.isPending}
            error={mutation.error}
            onSubmit={(value) =>
              mutation.mutate({
                resource: 'maintenance',
                id: reportId,
                action: 'admin-resolve',
                value: { adminConclusion: value.adminConclusion },
              })
            }
          />
        </Modal>
      ) : (
        <ActionDialog
          title={
            action === 'start'
              ? 'Xác nhận bắt đầu tiếp nhận và xử lý yêu cầu'
              : action === 'request-info'
                ? 'Yêu cầu khách thuê bổ sung thông tin'
                : action === 'reject'
                  ? 'Từ chối yêu cầu hỗ trợ'
                  : 'Xác nhận thao tác'
          }
          open={!!action}
          onOpenChange={(v) => {
            if (!v) setAction('')
          }}
          fields={
            action === 'request-info'
              ? [{ name: 'note', label: 'Nội dung thông tin cần bổ sung (bắt buộc)' }]
              : action === 'reject'
                ? [{ name: 'reason', label: 'Lý do từ chối (bắt buộc)' }]
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
