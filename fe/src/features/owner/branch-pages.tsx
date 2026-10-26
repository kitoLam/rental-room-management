import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { z } from 'zod'
import { Panel, QueryState, Notice, InlineError, Modal } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { Facts } from '@/features/tenant/components'
import {
  Records,
  ManagerStatus,
  ManagerForm,
  ImagePicker,
  ActionDialog,
  type FieldSpec,
} from '@/features/manager/components'
import {
  branchInputSchema,
  policyInputSchema,
  type BranchInput,
  type OwnedBranch,
} from '@/interfaces/owner'
import { ownerApi } from '@/services/owner'
import { useOwnerList, useOwnerQuery, useOwnerMutation, operationsLink } from './context'
import { OwnerPage, OwnerFilters, MoneyStats } from './components'
import { useOwnerFilters } from './context'
import { useNow } from '@/hooks/use-now'
import { dateTime } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
export function OwnerBranches() {
  const state = useOwnerFilters({ managerId: '' }),
    query = useOwnerList('branches', state.filters),
    managers = useOwnerList('managers', { size: '100' })
  return (
    <OwnerPage
      title="Chi nhánh"
      description="Thông tin tài sản và trạng thái vận hành."
      actions={
        <Button asChild>
          <Link to="/owner/branches/new">Tạo chi nhánh</Link>
        </Button>
      }
    >
      <OwnerFilters
        state={state}
        statuses={[
          { value: 'DRAFT', label: 'Nháp' },
          { value: 'ACTIVE', label: 'Hoạt động' },
          { value: 'INACTIVE', label: 'Ngừng hoạt động' },
        ]}
      >
        <select
          aria-label="Lọc quản lý"
          className="input w-auto max-w-full"
          value={state.filters.managerId}
          onChange={(e) => state.change('managerId', e.target.value)}
        >
          <option value="">Tất cả quản lý</option>
          {managers.data?.content.map((m) => (
            <option value={m.id} key={m.id}>
              {m.user.fullName}
            </option>
          ))}
        </select>
      </OwnerFilters>
      <Records
        query={query}
        page={state.page}
        onPage={state.onPage}
        empty="Chưa có chi nhánh phù hợp."
        columns={[
          {
            label: 'Chi nhánh',
            render: (b) => (
              <Link className="font-bold text-primary" to={`/owner/branches/${b.id}`}>
                {b.name}
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  {b.code} · {b.address}
                </span>
              </Link>
            ),
          },
          { label: 'Trạng thái', render: (b) => <ManagerStatus value={b.status} /> },
          { label: 'Quản lý', render: (b) => b.managerName || 'Chưa phân công' },
          {
            label: 'Phòng / công khai',
            render: (b) => `${b.roomCount} phòng · ${b.isPublic ? 'Công khai' : 'Riêng tư'}`,
          },
          {
            label: 'Vận hành',
            render: (b) => (
              <Link className="font-bold text-primary" to={operationsLink(b.id)}>
                Mở vận hành
              </Link>
            ),
          },
        ]}
      />
      <InlineError error={managers.error} />
    </OwnerPage>
  )
}
export function OwnerBranchDetail() {
  const clock = useNow()
  const { branchId = '' } = useParams(),
    query = useOwnerQuery('branch', () => ownerApi.branch(branchId), [branchId]),
    policies = useOwnerQuery('policies', () => ownerApi.policies(branchId), [branchId]),
    summary = useOwnerQuery(
      'branch-summary',
      () => ownerApi.summary({ branchId, month: new Date().toISOString().slice(0, 7) }),
      [branchId],
    ),
    [remove, setRemove] = useState(false),
    navigate = useNavigate(),
    mutation = useOwnerMutation(() => navigate('/owner/branches'))
  const current = policies.data?.find((p) => Date.parse(p.effectiveFrom) <= clock)
  return (
    <OwnerPage
      title={query.data?.name || 'Chi nhánh'}
      actions={
        <Button variant="outline" asChild>
          <Link to="/owner/branches">Danh sách chi nhánh</Link>
        </Button>
      }
    >
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {query.data && (
          <>
            <Panel>
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <ManagerStatus value={query.data.status} />
                <span className="text-xs text-muted-foreground">{query.data.code}</span>
              </div>
              <Facts
                items={[
                  ['Địa chỉ', query.data.address],
                  ['Quản lý', query.data.managerName || 'Chưa phân công'],
                  ['Phòng', String(query.data.roomCount)],
                  ['Chính sách', current ? `Phiên bản ${current.version}` : 'Chưa có hiệu lực'],
                  ['QR nhận tiền', query.data.qrPublicId ? 'Đã cấu hình' : 'Chưa cấu hình'],
                  ['Zalo', query.data.zaloEnabled ? 'Đang bật' : 'Chưa bật'],
                ]}
              />
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild>
                  <Link to={operationsLink(branchId)}>Vận hành chi nhánh</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to={`/owner/branches/${branchId}/edit`}>Sửa chi nhánh</Link>
                </Button>
                <Link
                  className="py-3 text-sm font-bold text-primary"
                  to={`/owner/manager-assignments?branchId=${branchId}`}
                >
                  Phân công quản lý
                </Link>
              </div>
            </Panel>
            <div className="grid gap-5 sm:grid-cols-2">
              <Panel>
                <h2 className="mb-4 font-bold">Chính sách & thanh toán</h2>
                <div className="grid gap-3 text-sm font-bold text-primary">
                  <Link to={`/owner/branches/${branchId}/policies`}>
                    Chính sách và lịch sử phiên bản
                  </Link>
                  <Link to={`/owner/branches/${branchId}/payments/settings`}>
                    Cấu hình QR nhận tiền
                  </Link>
                  <Link to={operationsLink(branchId, 'settings/zalo')}>Cấu hình nhóm Zalo</Link>
                </div>
              </Panel>
              <Panel>
                <h2 className="mb-4 font-bold">Thông tin công khai</h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  {query.data.description || 'Chưa có mô tả.'}
                </p>
                <p className="my-3 text-xs">
                  {query.data.isPublic
                    ? 'Đang công khai khi chi nhánh hoạt động'
                    : 'Đang ẩn khỏi tìm kiếm'}
                </p>
                <div className="flex flex-wrap gap-4 text-sm font-bold text-primary">
                  <Link to={`/owner/branches/${branchId}/edit`}>Sửa ảnh, liên hệ, nội quy</Link>
                  {query.data.isPublic && query.data.status === 'ACTIVE' && (
                    <Link to={`/branches/${branchId}`}>Xem trang công khai</Link>
                  )}
                </div>
              </Panel>
            </div>
            {query.data.images.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {query.data.images.map((image, i) => (
                  <img
                    key={image}
                    src={image}
                    alt={`${query.data!.name}, ảnh ${i + 1}`}
                    className="aspect-[4/3] w-full rounded-lg object-cover"
                  />
                ))}
              </div>
            )}
            <QueryState pending={summary.isPending} error={summary.error} retry={summary.refetch}>
              {summary.data && (
                <MoneyStats
                  items={[
                    ['Hóa đơn đã phát hành trong kỳ', summary.data.totals.billed],
                    ['Thực thu xác minh trong kỳ', summary.data.totals.receipts],
                    ['Dư nợ kỳ báo cáo', summary.data.totals.debt],
                  ]}
                />
              )}
            </QueryState>
            <InlineError error={policies.error} />
            {query.data.status === 'DRAFT' && (
              <Button
                variant="outline"
                className="justify-self-start"
                onClick={() => setRemove(true)}
              >
                Xóa chi nhánh nháp
              </Button>
            )}
          </>
        )}
      </QueryState>
      <ActionDialog
        title="Xóa chi nhánh nháp?"
        open={remove}
        onOpenChange={setRemove}
        pending={mutation.isPending}
        error={mutation.error}
        onConfirm={() =>
          mutation.mutate({
            path: `/branches/${branchId}`,
            value: { version: query.data?.version },
            method: 'DELETE',
          })
        }
      />
    </OwnerPage>
  )
}
const emptyBranch: BranchInput = {
  code: '',
  name: '',
  address: '',
  province: '',
  district: '',
  ward: '',
  latitude: null,
  longitude: null,
  description: '',
  rules: [],
  publicPhone: '',
  publicEmail: '',
  images: [],
  isPublic: false,
  status: 'DRAFT',
  managerId: null,
}
function BranchForm({ branch }: { branch?: OwnedBranch }) {
  const navigate = useNavigate(),
    mutation = useOwnerMutation((result) =>
      navigate(`/owner/branches/${result?.id || branch?.id}`),
    ),
    managers = useOwnerQuery('eligible-managers', () => ownerApi.list('managers', { size: '100' })),
    [images, setImages] = useState(branch?.images || []),
    [preview, setPreview] = useState<BranchInput | null>(null)
  const defaults = branch
    ? Object.fromEntries(
        Object.keys(emptyBranch).map((k) => [
          k,
          branch[k as keyof OwnedBranch] ?? emptyBranch[k as keyof BranchInput],
        ]),
      )
    : emptyBranch
  const fields: FieldSpec[] = [
    { name: 'code', label: 'Mã chi nhánh' },
    { name: 'name', label: 'Tên chi nhánh' },
    { name: 'address', label: 'Địa chỉ' },
    { name: 'province', label: 'Tỉnh / thành phố' },
    { name: 'district', label: 'Quận / huyện' },
    { name: 'ward', label: 'Phường / xã' },
    { name: 'latitude', label: 'Vĩ độ', kind: 'number', nullable: true, step: 0.0000001 },
    { name: 'longitude', label: 'Kinh độ', kind: 'number', nullable: true, step: 0.0000001 },
    { name: 'description', label: 'Mô tả công khai', kind: 'textarea' },
    { name: 'rules', label: 'Nội quy (mỗi dòng một mục)', kind: 'list' },
    { name: 'publicPhone', label: 'Điện thoại công khai' },
    { name: 'publicEmail', label: 'Email công khai' },
    {
      name: 'status',
      label: 'Trạng thái',
      kind: 'select',
      options: [
        { value: 'DRAFT', label: 'Nháp' },
        { value: 'ACTIVE', label: 'Hoạt động' },
        { value: 'INACTIVE', label: 'Ngừng hoạt động' },
      ],
    },
    {
      name: 'managerId',
      label: 'Quản lý chính',
      kind: 'select',
      nullable: true,
      options:
        managers.data?.content
          .filter((m) => m.user.status === 'ACTIVE')
          .map((m) => ({ value: m.id, label: m.user.fullName })) || [],
    },
    { name: 'isPublic', label: 'Công khai khi chi nhánh hoạt động', kind: 'check' },
  ]
  return (
    <Panel>
      <Notice>
        Chi nhánh mới được lưu nháp. Cần có chính sách hiệu lực và quản lý chính trước khi kích
        hoạt.
      </Notice>
      <div className="mt-6">
        <ManagerForm
          schema={branchInputSchema}
          defaults={{
            ...defaults,
            latitude: defaults.latitude ?? '',
            longitude: defaults.longitude ?? '',
            managerId: defaults.managerId || '',
          }}
          fields={fields}
          onSubmit={(v) => setPreview({ ...v, images } as BranchInput)}
          pending={mutation.isPending}
          error={mutation.error}
          submitLabel="Kiểm tra thay đổi"
        >
          <ImagePicker value={images} onChange={setImages} disabled={mutation.isPending} />
        </ManagerForm>
      </div>
      <InlineError error={managers.error} />
      <Modal
        open={!!preview}
        onOpenChange={(v) => {
          if (!mutation.isPending && !v) setPreview(null)
        }}
        title="Xác nhận thông tin chi nhánh"
      >
        <p className="text-sm leading-6">
          {preview?.name} · {preview?.address}
        </p>
        <p className="my-4 text-sm">
          Trạng thái: <ManagerStatus value={preview?.status || 'DRAFT'} />
        </p>
        <InlineError error={mutation.error} />
        <Button
          disabled={mutation.isPending}
          onClick={() =>
            mutation.mutate({
              path: branch ? `/branches/${branch.id}` : '/branches',
              value: branch ? { value: preview, version: branch.version } : preview,
              method: branch ? 'PATCH' : 'POST',
            })
          }
        >
          {mutation.isPending ? 'Đang lưu…' : 'Xác nhận lưu'}
        </Button>
      </Modal>
    </Panel>
  )
}
export function OwnerBranchEditor() {
  const { branchId } = useParams()
  return (
    <OwnerPage title={branchId ? 'Sửa chi nhánh' : 'Tạo chi nhánh'}>
      {branchId ? <ExistingBranchForm id={branchId} /> : <BranchForm />}
    </OwnerPage>
  )
}
function ExistingBranchForm({ id }: { id: string }) {
  const query = useOwnerQuery('branch', () => ownerApi.branch(id), [id])
  return (
    <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
      {query.data && <BranchForm key={`${id}:${query.data.version}`} branch={query.data} />}
    </QueryState>
  )
}
export function OwnerPolicies() {
  const clock = useNow()
  const { branchId = '' } = useParams(),
    query = useOwnerQuery('policies', () => ownerApi.policies(branchId), [branchId]),
    [open, setOpen] = useState(false),
    [preview, setPreview] = useState<Record<string, unknown> | null>(null),
    mutation = useOwnerMutation(() => setOpen(false))
  const schema = z
    .object(policyInputSchema.shape)
    .omit({ appointmentPolicy: true })
    .extend({
      openingHour: z.number().int().min(0).max(23),
      closingHour: z.number().int().min(1).max(24),
      maxDurationMinutes: z.number().int().min(15).max(480),
      cancellationHours: z.number().int().min(0).max(168),
    })
  const last = query.data?.[0],
    defaults = {
      effectiveFrom: new Date(clock + 60000).toISOString(),
      collectionDay: last?.collectionDay ?? 5,
      paymentGraceDays: last?.paymentGraceDays ?? 3,
      bookingHoldAmount: last?.bookingHoldAmount ?? 500000,
      paymentWindowMinutes: last?.paymentWindowMinutes ?? 15,
      temporaryHoldMinutes: last?.temporaryHoldMinutes ?? 30,
      confirmedHoldMinutes: last?.confirmedHoldMinutes ?? 1440,
      cancellationTerms: last?.cancellationTerms || '',
      openingHour: last?.appointmentPolicy.openingHour ?? 8,
      closingHour: last?.appointmentPolicy.closingHour ?? 20,
      maxDurationMinutes: last?.appointmentPolicy.maxDurationMinutes ?? 60,
      cancellationHours: last?.appointmentPolicy.cancellationHours ?? 2,
    }
  const fields: FieldSpec[] = [
    {
      name: 'effectiveFrom',
      label: 'Hiệu lực từ (ISO, gồm múi giờ)',
      hint: 'Ví dụ 2026-10-20T08:00:00+07:00',
    },
    ...[
      ['collectionDay', 'Ngày thu tiền (1–28)'],
      ['paymentGraceDays', 'Số ngày gia hạn'],
      ['bookingHoldAmount', 'Tiền giữ phòng (VND)'],
      ['paymentWindowMinutes', 'Hạn thanh toán (phút)'],
      ['temporaryHoldMinutes', 'Giữ tạm (phút)'],
      ['confirmedHoldMinutes', 'Giữ đã xác nhận (phút)'],
      ['openingHour', 'Giờ mở cửa'],
      ['closingHour', 'Giờ đóng cửa'],
      ['maxDurationMinutes', 'Thời lượng xem tối đa (phút)'],
      ['cancellationHours', 'Hủy lịch trước (giờ)'],
    ].map(([name, label]) => ({ name, label, kind: 'number' as const, step: 1 })),
    { name: 'cancellationTerms', label: 'Điều khoản hủy', kind: 'textarea' },
  ]
  return (
    <OwnerPage
      title="Chính sách chi nhánh"
      description="Mỗi thay đổi tạo một phiên bản mới. Booking và hóa đơn giữ snapshot đã chốt."
      actions={
        <Button
          onClick={() => {
            setOpen(true)
            setPreview(null)
          }}
        >
          Tạo phiên bản
        </Button>
      }
    >
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
        empty={query.data?.length === 0}
        emptyMessage="Chi nhánh chưa có chính sách."
        emptyAction={<Button onClick={() => setOpen(true)}>Tạo chính sách đầu tiên</Button>}
      >
        <div className="grid gap-5">
          {query.data?.map((p) => (
            <Panel key={p.id}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-bold">Phiên bản {p.version}</h2>
                <span className="text-xs text-muted-foreground">
                  {Date.parse(p.effectiveFrom) > clock ? 'Sắp hiệu lực' : 'Đã hiệu lực'} ·{' '}
                  {dateTime(p.effectiveFrom)}
                </span>
              </div>
              <Facts
                items={[
                  ['Thu tiền / gia hạn', `Ngày ${p.collectionDay} · ${p.paymentGraceDays} ngày`],
                  ['Tiền giữ phòng', formatVnd(p.bookingHoldAmount)],
                  [
                    'Thanh toán / giữ tạm',
                    `${p.paymentWindowMinutes} / ${p.temporaryHoldMinutes} phút`,
                  ],
                  ['Giữ xác nhận', `${p.confirmedHoldMinutes} phút`],
                  [
                    'Lịch xem',
                    `${p.appointmentPolicy.openingHour}h–${p.appointmentPolicy.closingHour}h · tối đa ${p.appointmentPolicy.maxDurationMinutes} phút`,
                  ],
                  ['Hủy lịch trước', `${p.appointmentPolicy.cancellationHours} giờ`],
                  ['Điều khoản hủy', p.cancellationTerms],
                ]}
              />
            </Panel>
          ))}
        </div>
      </QueryState>
      <Modal
        open={open}
        onOpenChange={(v) => {
          if (!mutation.isPending) setOpen(v)
        }}
        title="Phiên bản chính sách mới"
      >
        {!preview ? (
          <ManagerForm
            schema={schema}
            defaults={defaults}
            fields={fields}
            onSubmit={(v) => setPreview(v)}
            pending={false}
            error={null}
            submitLabel="Xem trước"
          />
        ) : (
          <div className="grid gap-4">
            <Facts
              items={[
                ['Hiệu lực', String(preview.effectiveFrom)],
                ['Tiền giữ', formatVnd(Number(preview.bookingHoldAmount))],
                ['Ngày thu', String(preview.collectionDay)],
                ['Hạn giữ tạm', `${preview.temporaryHoldMinutes} phút`],
                ['Điều khoản hủy', String(preview.cancellationTerms)],
              ]}
            />
            <InlineError error={mutation.error} />
            <Button
              disabled={mutation.isPending}
              onClick={() => {
                const { openingHour, closingHour, maxDurationMinutes, cancellationHours, ...rest } =
                  preview
                mutation.mutate({
                  path: `/branches/${branchId}/policies`,
                  value: {
                    ...rest,
                    appointmentPolicy: {
                      openingHour,
                      closingHour,
                      maxDurationMinutes,
                      cancellationHours,
                    },
                  },
                })
              }}
            >
              Lưu phiên bản
            </Button>
            <Button
              disabled={mutation.isPending}
              variant="outline"
              onClick={() => setPreview(null)}
            >
              Chỉnh sửa
            </Button>
          </div>
        )}
      </Modal>
    </OwnerPage>
  )
}
export function OwnerQrSettings() {
  const { branchId = '' } = useParams(),
    query = useOwnerQuery('branch', () => ownerApi.branch(branchId), [branchId]),
    [images, setImages] = useState<string[]>([]),
    mutation = useOwnerMutation(() => setImages([]))
  return (
    <OwnerPage title="QR nhận tiền" description="Cấu hình QR thủ công theo chi nhánh.">
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {query.data && (
          <Panel>
            <h2 className="mb-4 font-bold">{query.data.name}</h2>
            <Notice>
              Ảnh QR không xác minh giao dịch. Nội dung chuyển tiền được cấp riêng theo nghĩa vụ.
              Demo không kết nối ngân hàng.
            </Notice>
            {query.data.qrUrl && (
              <img
                src={query.data.qrUrl}
                alt="QR nhận tiền của chi nhánh"
                className="mx-auto my-5 max-h-60 max-w-full rounded-lg"
              />
            )}
            <p className="my-4 break-all text-xs text-muted-foreground">
              Mã tài nguyên: {query.data.qrPublicId || 'Chưa có'} · QR thủ công
            </p>
            <ImagePicker
              value={images}
              onChange={(v) => setImages(v.slice(-1))}
              disabled={mutation.isPending}
            />
            <InlineError error={mutation.error} />
            {mutation.isSuccess && <Notice tone="success">Đã lưu QR chi nhánh.</Notice>}
            <Button
              className="mt-5"
              disabled={!images[0] || mutation.isPending}
              onClick={() =>
                mutation.mutate({
                  path: `/branches/${branchId}/qr`,
                  value: { image: images[0], version: query.data!.version },
                  method: 'PUT',
                })
              }
            >
              {mutation.isPending ? 'Đang lưu…' : 'Lưu QR'}
            </Button>
          </Panel>
        )}
      </QueryState>
    </OwnerPage>
  )
}
