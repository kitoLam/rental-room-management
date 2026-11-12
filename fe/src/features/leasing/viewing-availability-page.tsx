import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
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
  NO_SLOT_SELECTED: 'Chưa chọn slot',
  SLOT_UNAVAILABLE: 'Slot chưa thể xem vào ngày này',
}
const roomReasons: Record<string, string> = {
  BRANCH_INACTIVE: 'Chi nhánh đang ngừng nhận lịch xem.',
  ROOM_UNAVAILABLE: 'Phòng đang tạm ngừng nhận lịch xem.',
  TEMPORARY_HOLD: 'Phòng hoặc chỗ trống cuối đang được giữ tạm. Vui lòng kiểm tra lại sau.',
  OFFICIAL_HOLD: 'Phòng hiện đã được giữ chỗ thuê.',
  NO_VACANCY: 'Phòng hiện không còn chỗ cho thuê.',
  VIEWING_DISABLED: 'Owner/Manager đang tắt tính năng đặt lịch xem của phòng này.',
}

export function ViewingAvailabilityPage() {
  const { roomId = '' } = useParams()
  const [params] = useSearchParams()
  const [roomSlotIds, setRoomSlotIds] = useState<string[]>(() => {
    try {
      const value: unknown = JSON.parse(params.get('slots') || '[]')
      return Array.isArray(value) &&
        value.every((id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id))
        ? [...new Set((value as string[]).map((id) => id.toLowerCase()))]
        : []
    } catch {
      return []
    }
  })
  const [date, setDate] = useState(() =>
    /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') || '') ? params.get('date')! : viewingToday(),
  )
  const [selection, setSelection] = useState<{
    date: string
    id: string
    version: number
    slots: string
  } | null>(null)
  const valid = /^[0-9a-fA-F]{24}$/.test(roomId)
  const context = useQuery({
    queryKey: ['viewing-context'],
    queryFn: viewingDependenciesService.context,
    enabled: valid,
    retry: false,
    staleTime: 0,
  })
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= viewingToday()
  const slotKey = [...roomSlotIds].sort().join(',')
  const query = useQuery({
    queryKey: ['viewing-availability', roomId, date, slotKey],
    queryFn: () => viewingDependenciesService.availability(roomId, date, roomSlotIds),
    enabled: valid && validDate,
    refetchInterval: 30000,
    placeholderData: keepPreviousData,
  })
  const chosen = query.isPlaceholderData
    ? undefined
    : query.data?.periods.find(
        (p) =>
          p.id === selection?.id &&
          selection.slots === slotKey &&
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
                  <fieldset className="mt-5 rounded-xl border border-border p-5">
                    <legend className="px-2 text-sm font-bold">Slot muốn xem (bắt buộc)</legend>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {query.data.room.slots.map((slot) => (
                        <label key={slot.id} className="flex items-start gap-3 text-sm">
                          <input
                            type="checkbox"
                            className="mt-1 accent-primary"
                            checked={roomSlotIds.includes(slot.id)}
                            disabled={!slot.selectable}
                            onChange={(e) => {
                              setRoomSlotIds((current) =>
                                e.target.checked
                                  ? [...current, slot.id]
                                  : current.filter((id) => id !== slot.id),
                              )
                              setSelection(null)
                            }}
                          />
                          <span>
                            <span className="font-semibold">{slot.slotCode}</span>
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {!slot.selectable
                                ? 'Bảo trì / ngừng hoạt động'
                                : slot.status === 'OCCUPIED'
                                  ? 'Đang thuê · chọn ngày xem sau khi kết thúc hợp đồng'
                                  : 'Có thể chọn để kiểm tra ngày xem'}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Chọn một hoặc nhiều slot trong phòng, kể cả phòng chỉ có một slot.
                    </p>
                  </fieldset>
                  {query.isPlaceholderData && (
                    <p role="status" className="mt-4 text-sm text-muted-foreground">
                      Đang kiểm tra ngày và slot đã chọn…
                    </p>
                  )}
                  {!query.isPlaceholderData && query.data.selectionError && (
                    <div role="alert" className="mt-4 whitespace-pre-line">
                      <Notice tone="warning">{query.data.selectionError}</Notice>
                    </div>
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
                          disabled={!period.available || query.isPlaceholderData}
                          checked={chosen?.id === period.id}
                          className="size-4 accent-primary"
                          onChange={() =>
                            setSelection({
                              date,
                              id: period.id,
                              version: query.data!.configurationVersion,
                              slots: slotKey,
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
                      roomSlotIds={roomSlotIds}
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
                          to={`/login?redirect=${encodeURIComponent(`/rooms/${roomId}/viewing?${new URLSearchParams({ slots: JSON.stringify(roomSlotIds), date })}`)}`}
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
                        <Link to="/tenant/appointments">Theo dõi lịch xem</Link>
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
