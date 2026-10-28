import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Field, Notice, Panel } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/services/http'
import {
  viewingDependenciesService,
  type ViewingAction,
  type ViewingAppointment,
} from '@/services/viewing-dependencies'

const viewingActionLabels: Record<ViewingAction, string> = {
  APPROVE: 'Duyệt lịch',
  REJECT: 'Từ chối',
  CANCEL: 'Hủy lịch',
  COMPLETE: 'Đã xem phòng',
  NO_SHOW: 'Không đến xem',
  CORRECT_RESULT: 'Sửa kết quả / ghi chú',
}

export function ViewingAppointmentActions({
  record,
  manager,
}: {
  record: ViewingAppointment
  manager: boolean
}) {
  const client = useQueryClient()
  const [selection, setSelection] = useState<{ action: ViewingAction; version: number } | null>(
    null,
  )
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [cause, setCause] = useState<'TENANT_REQUEST' | 'LANDLORD_UNAVAILABLE'>('TENANT_REQUEST')
  const [outcome, setOutcome] = useState<'COMPLETED' | 'NO_SHOW'>('COMPLETED')
  const [fact, setFact] = useState(false)
  const [secondFact, setSecondFact] = useState(false)
  const [success, setSuccess] = useState('')
  async function refresh() {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['viewing-appointment'] }),
      client.invalidateQueries({ queryKey: ['viewing-appointments'] }),
      client.invalidateQueries({ queryKey: ['viewing-availability', record.roomId] }),
    ])
  }
  const mutation = useMutation({
    mutationFn: ({ action, input }: { action: ViewingAction; input: unknown }) =>
      viewingDependenciesService.actOnAppointment(record.id, action, input),
    onSuccess: async () => {
      setSelection(null)
      setSuccess('Đã lưu thay đổi và lịch sử xử lý.')
      await refresh()
    },
    onError: async (error) => {
      if (error instanceof ApiError && error.status === 409) {
        setSelection(null)
        await refresh()
      }
    },
  })
  const action = selection?.action
  const stale = !!selection && selection.version !== record.actionVersion
  const isResult = action === 'COMPLETE' || action === 'NO_SHOW' || action === 'CORRECT_RESULT'
  const isNoShow = action === 'NO_SHOW' || (action === 'CORRECT_RESULT' && outcome === 'NO_SHOW')
  const requiresReason =
    action === 'REJECT' || action === 'CORRECT_RESULT' || (action === 'CANCEL' && manager)
  function choose(value: ViewingAction) {
    mutation.reset()
    setSuccess('')
    setReason('')
    setNote(record.result ?? '')
    setFact(false)
    setSecondFact(false)
    setCause('TENANT_REQUEST')
    setOutcome(record.status === 'NO_SHOW' ? 'NO_SHOW' : 'COMPLETED')
    setSelection({ action: value, version: record.actionVersion })
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selection || stale || mutation.isPending) return
    const input: Record<string, unknown> = { version: selection.version }
    if (action === 'REJECT' || action === 'CANCEL' || action === 'CORRECT_RESULT')
      input.reason = reason.trim()
    if (isResult) input.note = note.trim()
    if (action === 'CORRECT_RESULT') input.outcome = outcome
    if (isResult) {
      if (isNoShow) {
        input.tenantAbsent = fact
        input.landlordAvailable = secondFact
      } else input.viewingFinished = fact
    }
    if (action === 'CANCEL' && manager) {
      input.cause = cause
      input.viewingDidNotOccur = fact
      if (cause === 'TENANT_REQUEST') input.tenantRequestConfirmed = secondFact
    }
    mutation.mutate({ action: selection.action, input })
  }
  const error =
    mutation.error instanceof ApiError && mutation.error.status === 409
      ? 'Lịch hoặc điều kiện xử lý đã thay đổi. Dữ liệu đã được tải lại; hãy kiểm tra trước khi thao tác tiếp.'
      : mutation.error?.message
  return (
    <Panel className="mt-6">
      <h2 className="font-bold">Xử lý lịch xem</h2>
      {success && (
        <p role="status" className="mt-3 text-sm text-primary">
          {success}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
      {!selection && (
        <div className="mt-4 flex flex-wrap gap-3">
          {record.allowedActions.map((value) => (
            <Button
              key={value}
              variant={value === 'APPROVE' ? 'default' : 'outline'}
              onClick={() => choose(value)}
            >
              {viewingActionLabels[value]}
            </Button>
          ))}
        </div>
      )}
      {!selection && record.allowedActions.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          Không có thao tác phù hợp với quyền, trạng thái và thời gian hiện tại.
        </p>
      )}
      {!manager && record.status === 'CONFIRMED' && !record.allowedActions.includes('CANCEL') && (
        <div className="mt-4">
          <Notice tone="warning">
            Đã qua hạn tự hủy (hai giờ trước ca). Vui lòng liên hệ chi nhánh để được hỗ trợ; liên hệ
            chưa tự làm thay đổi lịch.
          </Notice>
        </div>
      )}
      {selection && (
        <form onSubmit={submit} className="mt-5 grid gap-5">
          <h3 className="font-bold">{viewingActionLabels[selection.action]}</h3>
          {stale && (
            <Notice tone="warning">
              Lịch đã thay đổi trong lúc bạn nhập. Hãy đóng biểu mẫu và kiểm tra dữ liệu mới.
            </Notice>
          )}
          <fieldset disabled={mutation.isPending || stale} className="grid gap-5">
            {action === 'APPROVE' && (
              <Notice>
                Duyệt ngày và giờ đã lưu trên lịch. Hệ thống kiểm tra lại hạn duyệt và tình trạng
                phòng trước khi xác nhận.
              </Notice>
            )}
            {action === 'CANCEL' && manager && (
              <Field id="viewing-cancel-cause" label="Bên yêu cầu / nguyên nhân hủy">
                <select
                  id="viewing-cancel-cause"
                  className="input"
                  value={cause}
                  onChange={(e) => {
                    setCause(e.target.value as typeof cause)
                    setFact(false)
                    setSecondFact(false)
                  }}
                >
                  <option value="TENANT_REQUEST">Người xem yêu cầu hủy</option>
                  <option value="LANDLORD_UNAVAILABLE">Phía cho thuê không thể tiếp khách</option>
                </select>
              </Field>
            )}
            {action === 'CORRECT_RESULT' && (
              <Field id="viewing-outcome" label="Kết quả đúng">
                <select
                  id="viewing-outcome"
                  className="input"
                  value={outcome}
                  onChange={(e) => {
                    setOutcome(e.target.value as typeof outcome)
                    setFact(false)
                    setSecondFact(false)
                  }}
                >
                  <option value="COMPLETED">Đã xem phòng</option>
                  <option value="NO_SHOW">Không đến xem</option>
                </select>
              </Field>
            )}
            {isResult && (
              <Field
                id="viewing-result-note"
                label="Ghi chú kết quả (không bắt buộc, tối đa 500 ký tự)"
              >
                <textarea
                  id="viewing-result-note"
                  className="input min-h-24"
                  value={note}
                  maxLength={500}
                  onChange={(e) => setNote(e.target.value)}
                />
              </Field>
            )}
            {(requiresReason || action === 'CANCEL') && (
              <Field
                id="viewing-action-reason"
                label={requiresReason ? 'Lý do (bắt buộc)' : 'Ghi chú hủy (không bắt buộc)'}
              >
                <textarea
                  id="viewing-action-reason"
                  className="input min-h-24"
                  value={reason}
                  maxLength={500}
                  required={requiresReason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </Field>
            )}
            {(isResult || (action === 'CANCEL' && manager)) && (
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={fact}
                  required
                  onChange={(e) => setFact(e.target.checked)}
                />
                {action === 'CANCEL'
                  ? 'Xác nhận buổi xem chưa thực tế diễn ra; nếu đã xem xong, cần ghi nhận kết quả.'
                  : isNoShow
                    ? 'Người xem không đến trong ca đã hẹn.'
                    : 'Người xem đã đến và buổi xem thực tế đã kết thúc.'}
              </label>
            )}
            {(isNoShow || (action === 'CANCEL' && manager && cause === 'TENANT_REQUEST')) && (
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={secondFact}
                  required
                  onChange={(e) => setSecondFact(e.target.checked)}
                />
                {isNoShow
                  ? 'Phía cho thuê vẫn có thể tiếp khách trong ca này.'
                  : 'Đã xác nhận đúng yêu cầu hủy của người xem.'}
              </label>
            )}
            {isNoShow && (
              <p className="text-sm text-muted-foreground">
                Chỉ ghi nhận không đến từ cuối ca. Nếu phía cho thuê không thể tiếp khách, hãy hủy
                với nguyên nhân tương ứng.
              </p>
            )}
          </fieldset>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" loading={mutation.isPending} disabled={stale}>
              Xác nhận {viewingActionLabels[selection.action].toLocaleLowerCase('vi-VN')}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => setSelection(null)}
            >
              Đóng
            </Button>
          </div>
        </form>
      )}
    </Panel>
  )
}
