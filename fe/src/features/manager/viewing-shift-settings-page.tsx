import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Field, InlineError, Notice, Page, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { shiftLabels } from '@/features/leasing/viewing-time'
import {
  viewingDependenciesService,
  viewingConfigurationInputSchema,
  type ViewingConfiguration,
  type ViewingConfigurationInput,
} from '@/services/viewing-dependencies'

function ConfigurationForm({
  configuration,
  save,
  pending,
}: {
  configuration: ViewingConfiguration
  save: (input: ViewingConfigurationInput) => void
  pending: boolean
}) {
  const [periods, setPeriods] = useState(
    configuration.periods.map(({ type, startTime, endTime, isActive }) => ({
      type,
      startTime,
      endTime,
      isActive,
    })),
  )
  const [error, setError] = useState('')
  const original = configuration.periods.map(({ type, startTime, endTime, isActive }) => ({
    type,
    startTime,
    endTime,
    isActive,
  }))
  const dirty = JSON.stringify(original) !== JSON.stringify(periods)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = viewingConfigurationInputSchema.safeParse({
      version: configuration.version,
      periods,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }
    setError('')
    save(parsed.data)
  }
  return (
    <form onSubmit={submit} className="grid gap-6">
      <fieldset disabled={pending} className="grid gap-0 divide-y divide-border">
        <legend className="sr-only">Giờ hoạt động của ba ca</legend>
        {periods.map((period, index) => (
          <div key={period.type} className="grid gap-4 py-6 first:pt-0 sm:grid-cols-[1fr_1fr_1fr]">
            <div>
              <h2 className="font-bold">{shiftLabels[period.type]}</h2>
              <label className="mt-3 flex min-h-8 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={period.isActive}
                  onChange={(e) =>
                    setPeriods((items) =>
                      items.map((p, i) => (i === index ? { ...p, isActive: e.target.checked } : p)),
                    )
                  }
                />
                Nhận lịch mỗi ngày
              </label>
            </div>
            <Field id={`${period.type}-start`} label="Giờ bắt đầu (VN)">
              <input
                id={`${period.type}-start`}
                type="time"
                required
                step="60"
                className="input"
                value={period.startTime}
                onChange={(e) =>
                  setPeriods((items) =>
                    items.map((p, i) => (i === index ? { ...p, startTime: e.target.value } : p)),
                  )
                }
              />
            </Field>
            <Field id={`${period.type}-end`} label="Giờ kết thúc (VN)">
              <input
                id={`${period.type}-end`}
                type="time"
                required
                step="60"
                className="input"
                value={period.endTime}
                onChange={(e) =>
                  setPeriods((items) =>
                    items.map((p, i) => (i === index ? { ...p, endTime: e.target.value } : p)),
                  )
                }
              />
            </Field>
          </div>
        ))}
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div>
        <Button type="submit" loading={pending} disabled={!dirty}>
          Lưu cấu hình ca
        </Button>
      </div>
    </form>
  )
}

export function ViewingShiftSettingsPage() {
  const { roomId = '' } = useParams()
  const valid = /^[0-9a-fA-F]{24}$/.test(roomId)
  const client = useQueryClient()
  const [reloadKey, setReloadKey] = useState(0)
  const key = ['viewing-configuration', roomId]
  const context = useQuery({
    queryKey: ['viewing-context'],
    queryFn: viewingDependenciesService.context,
    enabled: valid,
    retry: false,
  })
  const query = useQuery({
    queryKey: key,
    queryFn: () => viewingDependenciesService.configuration(roomId),
    enabled: valid && !!context.data?.manageableBranchIds.length,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const mutation = useMutation({
    mutationFn: (input: ViewingConfigurationInput) =>
      viewingDependenciesService.updateConfiguration(roomId, input),
    onSuccess: async (saved) => {
      client.setQueryData(key, saved)
      await client.invalidateQueries({ queryKey: ['viewing-availability', roomId] })
    },
  })
  return (
    <Page
      title="Cấu hình ca xem phòng"
      eyebrow="QUẢN LÝ PHÒNG"
      narrow
      description="Điều chỉnh ba ca sáng, chiều, tối. Ca đang bật nhận lịch hằng ngày theo giờ Việt Nam."
    >
      {!valid ? (
        <Notice>Liên kết phòng không hợp lệ.</Notice>
      ) : (
        <QueryState pending={context.isPending} error={context.error} retry={context.refetch}>
          {context.data &&
            (context.data.manageableBranchIds.length === 0 ? (
              <Notice tone="warning">
                Tài khoản của bạn không có quyền quản lý lịch xem phòng.
              </Notice>
            ) : (
              <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
                {query.data && (
                  <>
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-muted-foreground">
                        {query.data.roomNumber} · {query.data.branchName}
                      </p>
                      <Button asChild variant="outline">
                        <Link to={`/branches/${query.data.branchId}/viewing-settings`}>
                          Cập nhật cả chi nhánh
                        </Link>
                      </Button>
                    </div>
                    <Notice>
                      Thay đổi chỉ áp dụng cho yêu cầu mới. Lịch đã đặt giữ nguyên ngày, giờ và
                      trạng thái; nếu không thể tiếp khách, hãy hủy lịch có lý do.
                    </Notice>
                    {mutation.isSuccess && (
                      <div className="mt-5">
                        <Notice tone="success">
                          Đã lưu cấu hình ca.{' '}
                          {mutation.data.existingAppointments.length > 0
                            ? `${mutation.data.existingAppointments.length} lịch hiện hữu bị ảnh hưởng vẫn giữ nguyên giờ đã hẹn.`
                            : ''}
                        </Notice>
                      </div>
                    )}
                    <Panel className="mt-5">
                      <ConfigurationForm
                        key={`${query.data.version}-${reloadKey}`}
                        configuration={query.data}
                        save={(input) => mutation.mutate(input)}
                        pending={mutation.isPending}
                      />
                      <InlineError error={mutation.error} />
                      <Button
                        className="mt-4"
                        variant="ghost"
                        disabled={mutation.isPending || query.isFetching}
                        onClick={async () => {
                          mutation.reset()
                          const result = await query.refetch()
                          if (result.isSuccess) setReloadKey((value) => value + 1)
                        }}
                      >
                        Tải lại cấu hình
                      </Button>
                    </Panel>
                    {query.data.existingAppointments.length > 0 && (
                      <Panel className="mt-6">
                        <h2 className="font-bold">Lịch đã đặt giữ nguyên giờ</h2>
                        <ul className="mt-4 divide-y divide-border">
                          {query.data.existingAppointments.map((appointment) => (
                            <li key={appointment.id} className="py-4 text-sm">
                              <p className="font-bold">
                                {appointment.date.split('-').reverse().join('/')} ·{' '}
                                {appointment.type ? shiftLabels[appointment.type] : 'Lịch đã đặt'}
                              </p>
                              <p className="mt-1 text-muted-foreground">
                                {appointment.startAt && appointment.endAt
                                  ? `${new Date(appointment.startAt).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })}–${new Date(appointment.endAt).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })}`
                                  : 'Cần kiểm tra lại giờ đã hẹn'}{' '}
                                · {appointment.status === 'PENDING' ? 'Chờ duyệt' : 'Đã xác nhận'}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </Panel>
                    )}
                  </>
                )}
              </QueryState>
            ))}
        </QueryState>
      )}
    </Page>
  )
}
