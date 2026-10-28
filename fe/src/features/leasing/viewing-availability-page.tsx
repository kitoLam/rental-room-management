import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Field, Notice, Page, Panel, QueryState } from '@/components/common/page'
import { StatusBadge } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import {
  viewingDependenciesService,
  type ViewingAvailability,
} from '@/services/viewing-dependencies'
import { shiftLabels, viewingToday } from './viewing-time'
import { ViewingRequestForm } from './viewing-request-form'
import { ApiError } from '@/services/http'

const reasonLabels: Record<ViewingAvailability['periods'][number]['reason'], string> = {
  AVAILABLE: 'Còn trống',
  DISABLED: 'Tạm ngừng nhận lịch',
  STARTED: 'Ca đã bắt đầu',
  ROOM_TAKEN: 'Ca đã có lịch',
  ROOM_UNAVAILABLE: 'Phòng chưa nhận lịch xem',
  TENANT_ROOM_DAY: 'Bạn đã có lịch của phòng này trong ngày',
  TENANT_SAME_TYPE: 'Bạn đã có lịch cùng loại ca',
  TENANT_TIME_OVERLAP: 'Trùng giờ với lịch của bạn',
}
const roomReasons: Record<string, string> = {
  BRANCH_INACTIVE: 'Chi nhánh đang ngừng nhận lịch xem.',
  ROOM_UNAVAILABLE: 'Phòng đang tạm ngừng nhận lịch xem.',
  TEMPORARY_HOLD: 'Phòng hoặc chỗ trống cuối đang được giữ tạm. Vui lòng kiểm tra lại sau.',
  OFFICIAL_HOLD: 'Phòng hiện đã được giữ chỗ thuê.',
  NO_VACANCY: 'Phòng hiện không còn chỗ cho thuê.',
}

export function ViewingAvailabilityPage() {
  const { roomId = '' } = useParams()
  const [date, setDate] = useState(viewingToday)
  const [selection, setSelection] = useState<{ date: string; id: string; version: number } | null>(
    null,
  )
  const valid = /^[0-9a-fA-F]{24}$/.test(roomId)
  const context = useQuery({
    queryKey: ['viewing-context'],
    queryFn: viewingDependenciesService.context,
    enabled: valid,
    retry: false,
    staleTime: 0,
  })
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= viewingToday()
  const query = useQuery({
    queryKey: ['viewing-availability', roomId, date],
    queryFn: () => viewingDependenciesService.availability(roomId, date),
    enabled: valid && validDate,
    refetchInterval: 30000,
  })
  const chosen = query.data?.periods.find(
    (p) =>
      p.id === selection?.id &&
      selection.date === date &&
      selection.version === query.data?.configurationVersion &&
      p.available,
  )
  return (
    <Page
      title="Ca xem phòng"
      eyebrow="LỊCH XEM PHÒNG"
      narrow
      description="Chọn ngày và kiểm tra ca còn trống. Tất cả thời gian hiển thị theo giờ Việt Nam."
    >
      {!valid ? (
        <Notice>Liên kết phòng không hợp lệ. Hãy chọn phòng từ danh sách.</Notice>
      ) : (
        <>
          <Panel>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <Field id="viewing-date" label="Ngày xem phòng">
                <input
                  id="viewing-date"
                  type="date"
                  min={viewingToday()}
                  value={date}
                  className="input"
                  onChange={(e) => {
                    setDate(e.target.value)
                    setSelection(null)
                  }}
                />
              </Field>
              <Button
                variant="outline"
                onClick={() => void query.refetch()}
                disabled={!validDate || query.isFetching}
              >
                Kiểm tra lại
              </Button>
            </div>
          </Panel>
          {!validDate ? (
            <Notice tone="warning">Chọn ngày hôm nay hoặc một ngày trong tương lai.</Notice>
          ) : (
            <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
              {query.data && (
                <>
                  <div className="mb-5 mt-8">
                    <h2 className="text-xl font-bold">{query.data.room.roomNumber}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {query.data.room.branchName}
                    </p>
                  </div>
                  {!query.data.room.canReceiveRequest && (
                    <Notice tone="warning">{roomReasons[query.data.room.reason]}</Notice>
                  )}
                  <fieldset className="mt-5 grid gap-3" aria-label="Ca xem phòng">
                    <legend className="sr-only">Chọn một ca còn trống</legend>
                    {query.data.periods.map((period) => (
                      <label
                        key={period.id}
                        className={`flex min-h-24 items-center gap-4 rounded-xl border p-5 ${period.available ? 'cursor-pointer bg-surface' : 'bg-background text-muted-foreground'} ${chosen?.id === period.id ? 'border-primary ring-1 ring-primary' : 'border-border'}`}
                      >
                        <input
                          type="radio"
                          name="viewing-period"
                          value={period.id}
                          disabled={!period.available}
                          checked={chosen?.id === period.id}
                          className="size-4 accent-primary"
                          onChange={() =>
                            setSelection({
                              date,
                              id: period.id,
                              version: query.data!.configurationVersion,
                            })
                          }
                        />
                        <span className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3">
                          <span>
                            <span className="block font-bold">{shiftLabels[period.type]}</span>
                            <span className="mt-1 block text-sm tabular-nums">
                              {period.startTime}–{period.endTime}
                            </span>
                          </span>
                          <StatusBadge tone={period.available ? 'success' : 'neutral'}>
                            {reasonLabels[period.reason]}
                          </StatusBadge>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                  {chosen && (
                    <div role="status" className="mt-5">
                      <Notice>
                        Ca đã chọn: {shiftLabels[chosen.type]}, {chosen.startTime}–{chosen.endTime}.
                        Vui lòng đến lúc {chosen.startTime}.
                      </Notice>
                    </div>
                  )}
                  <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
                    Chọn ca trên màn hình chưa giữ lịch. Đặt lịch xem phòng chỉ giữ ca xem, không
                    giữ chỗ thuê phòng.
                  </p>
                  {context.data?.canRequest && (
                    <ViewingRequestForm
                      key={`${context.data.accountId}:${roomId}`}
                      account={context.data}
                      roomId={roomId}
                      date={date}
                      period={chosen}
                      version={query.data.configurationVersion}
                    />
                  )}
                  {context.data && !context.data.canRequest && (
                    <div className="mt-5">
                      <Notice>Tài khoản hiện tại không có quyền gửi yêu cầu xem phòng.</Notice>
                    </div>
                  )}
                  {context.error instanceof ApiError && context.error.status === 401 && (
                    <div className="mt-5">
                      <Notice>
                        <Link
                          className="font-bold underline"
                          to={`/login?redirect=${encodeURIComponent(`/rooms/${roomId}/viewing`)}`}
                        >
                          Đăng nhập để gửi yêu cầu xem phòng
                        </Link>
                      </Notice>
                    </div>
                  )}
                  {context.error &&
                    (!(context.error instanceof ApiError) || context.error.status !== 401) && (
                      <p role="alert" className="mt-4 text-sm text-danger">
                        {context.error.message}
                      </p>
                    )}
                  <div className="mt-6 flex flex-wrap gap-4">
                    {context.data && (
                      <Button asChild variant="outline">
                        <Link to="/user/appointments">Theo dõi lịch xem</Link>
                      </Button>
                    )}
                    <Button asChild variant="outline">
                      <Link to="/rooms">Danh sách phòng</Link>
                    </Button>
                    {query.data.room.publicContactPhone && (
                      <a
                        className="inline-flex min-h-11 items-center text-sm font-bold text-primary"
                        href={`tel:${query.data.room.publicContactPhone}`}
                      >
                        Liên hệ chi nhánh
                      </a>
                    )}
                  </div>
                </>
              )}
            </QueryState>
          )}
        </>
      )}
    </Page>
  )
}
