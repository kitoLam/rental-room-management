import { Field, InlineError, Modal, Notice, Panel, Pagination, QueryState } from '@/components/common/page'
import { StatusBadge } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-store'
import {
  branchTenantsService,
  createTenantAccountSchema,
  type CreateTenantAccountInput,
  type TenantAccountItem,
} from '@/services/branch-tenants'
import type { Feature } from '@/services/config'
import { queryClient } from '@/services/query-client'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowDownCircle, ArrowUpCircle, Mail, ShieldAlert, ShieldCheck, UserPlus, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { SearchBox } from './components'

interface BranchOption {
  id: string
  name: string
}

export function BranchTenantAccountsSection({
  branchId,
  branches = [],
  feature = 'manager',
  allowBranchSelect = false,
}: {
  branchId?: string
  branches?: BranchOption[]
  feature?: Feature
  allowBranchSelect?: boolean
}) {
  const user = useSession((s) => s.user)
  const isOwner = feature === 'owner' || Boolean(user?.roles.includes('OWNER'))
  const [selectedBranchId, setSelectedBranchId] = useState(branchId || '')
  useEffect(() => {
    setSelectedBranchId(branchId || '')
  }, [branchId])
  const effectiveBranchId = allowBranchSelect ? selectedBranchId : branchId || ''

  const [keyword, setKeyword] = useState('')
  const [roleFilter, setRoleFilter] = useState<'TENANT' | 'MANAGER'>('TENANT')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [togglingTenant, setTogglingTenant] = useState<{
    tenant: TenantAccountItem
    targetBranchId: string
    nextStatus: 'ACTIVE' | 'INACTIVE'
  } | null>(null)
  const [roleTarget, setRoleTarget] = useState<{
    account: TenantAccountItem
    targetBranchId: string
    nextRole: 'TENANT' | 'MANAGER'
  } | null>(null)

  const statsQuery = useQuery({
    queryKey: ['branch-tenant-stats', feature, effectiveBranchId],
    queryFn: () => branchTenantsService.stats(effectiveBranchId || undefined, feature),
  })

  const effectiveRoleFilter = isOwner ? roleFilter : 'TENANT'

  const listQuery = useQuery({
    queryKey: [
      'branch-tenant-accounts',
      feature,
      effectiveBranchId,
      effectiveRoleFilter,
      isOwner ? status : '',
      keyword,
      page,
    ],
    queryFn: () =>
      branchTenantsService.list(
        {
          branchId: effectiveBranchId || undefined,
          role: effectiveRoleFilter,
          status: isOwner ? status || undefined : undefined,
          keyword: keyword || undefined,
          page: page - 1,
          size: 8,
        },
        feature,
      ),
  })

  const defaultCreateBranchId =
    effectiveBranchId || (branches.length === 1 ? branches[0].id : branches[0]?.id || '')

  const form = useForm<CreateTenantAccountInput>({
    resolver: zodResolver(createTenantAccountSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      branchId: defaultCreateBranchId,
      gender: undefined,
      dateOfBirth: '',
    },
  })

  const createMutation = useMutation({
    mutationFn: (values: CreateTenantAccountInput) =>
      branchTenantsService.create(
        {
          ...values,
          branchId: allowBranchSelect ? values.branchId || effectiveBranchId : effectiveBranchId,
        },
        feature,
      ),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ['branch-tenant-stats'] })
      void queryClient.invalidateQueries({ queryKey: ['branch-tenant-accounts'] })
      setCreateOpen(false)
      form.reset({
        fullName: '',
        email: '',
        phone: '',
        branchId: defaultCreateBranchId,
        gender: undefined,
        dateOfBirth: '',
      })
      setFeedback(
        `Đã tạo tài khoản cho ${created.fullName} (${created.email}) và gửi liên kết xác thực qua Gmail. Người thuê sẽ xác thực email trước rồi tự đặt mật khẩu.`,
      )
    },
  })

  const statusMutation = useMutation({
    mutationFn: (payload: {
      tenantId: string
      branchId?: string
      status: 'ACTIVE' | 'INACTIVE'
    }) =>
      branchTenantsService.updateBranchStatus(
        payload.tenantId,
        { branchId: payload.branchId, status: payload.status },
        feature,
      ),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: ['branch-tenant-stats'] })
      void queryClient.invalidateQueries({ queryKey: ['branch-tenant-accounts'] })
      setTogglingTenant(null)
      setFeedback(
        `Đã chuyển trạng thái của ${updated.fullName} tại cơ sở sang ${updated.status === 'ACTIVE' ? 'Đang hoạt động (ACTIVE)' : 'Tạm ngưng (INACTIVE)'}.`,
      )
    },
  })

  const roleMutation = useMutation({
    mutationFn: (payload: {
      accountId: string
      role: 'TENANT' | 'MANAGER'
      branchId?: string
    }) =>
      branchTenantsService.updateRole(
        payload.accountId,
        { role: payload.role, branchId: payload.branchId },
        feature,
      ),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: ['branch-tenant-stats'] })
      void queryClient.invalidateQueries({ queryKey: ['branch-tenant-accounts'] })
      setRoleTarget(null)
      setFeedback(
        updated.role === 'MANAGER'
          ? `Đã nâng vai trò của ${updated.fullName} (${updated.email}) lên Quản lý cơ sở (MANAGER).`
          : `Đã hạ vai trò của ${updated.fullName} (${updated.email}) xuống Người thuê (TENANT).`,
      )
    },
  })

  const resendMutation = useMutation({
    mutationFn: (payload: { tenantId: string; branchId?: string; email: string }) =>
      branchTenantsService.resendVerification(payload.tenantId, payload.branchId, feature),
    onSuccess: (_res, vars) => {
      setFeedback(`Đã gửi lại liên kết xác thực và đặt mật khẩu tới ${vars.email}.`)
    },
  })

  const stats = statsQuery.data
  const sortedItems = [...(listQuery.data?.content || [])].sort((a, b) => {
    const roomA = a.currentRoomNumber?.trim() || ''
    const roomB = b.currentRoomNumber?.trim() || ''
    if (roomA && roomB) {
      const cmp = roomA.localeCompare(roomB, 'vi', { numeric: true, sensitivity: 'base' })
      if (cmp !== 0) return cmp
    } else if (roomA !== roomB) {
      return roomA ? -1 : 1
    }
    return a.fullName.localeCompare(b.fullName, 'vi', { sensitivity: 'base' })
  })

  return (
    <div className="grid min-w-0 gap-5">
      <div
        className={`grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 ${isOwner ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}
      >
        <div className="bg-surface p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Đang thuê tại cơ sở (Tenant)
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums">{stats?.totalTenants ?? 0}</p>
        </div>
        {isOwner && (
          <div className="bg-surface p-4 sm:p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Quản lý cơ sở (Manager)
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums">{stats?.totalManagers ?? 0}</p>
          </div>
        )}
        <div className="bg-surface p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Đang hoạt động (Active)
          </p>
          <p className="mt-2 text-2xl font-bold text-primary tabular-nums">
            {stats?.activeTenants ?? 0}
          </p>
        </div>
        <div className="bg-surface p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Tạm ngưng (Inactive)
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums">{stats?.inactiveTenants ?? 0}</p>
        </div>
        <div className="bg-surface p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Chờ xác thực / Mật khẩu
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums">
            {stats?.pendingVerificationTenants ?? 0}
          </p>
        </div>
      </div>

      {feedback && <Notice tone="success">{feedback}</Notice>}

      <Panel className="min-w-0 overflow-hidden">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Users size={19} className="shrink-0 text-primary" />
              {isOwner
                ? roleFilter === 'MANAGER'
                  ? 'Danh sách Quản lý (Manager) tại cơ sở'
                  : 'Danh sách Người đang thuê phòng (Tenant) tại cơ sở'
                : 'Danh sách Người đang thuê phòng (Tenant) tại cơ sở'}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {isOwner
                ? 'Chọn tab Tenant hoặc Manager để lọc danh sách theo vai trò, sắp xếp theo phòng đang thuê và nâng/hạ vai trò.'
                : 'Chỉ hiển thị người đang thuê phòng trong cơ sở (sắp xếp theo phòng) và tìm kiếm theo tên.'}
            </p>
          </div>
          <Button
            onClick={() => {
              setFeedback(null)
              createMutation.reset()
              form.reset({
                fullName: '',
                email: '',
                phone: '',
                branchId: effectiveBranchId || branches[0]?.id || '',
                gender: undefined,
                dateOfBirth: '',
              })
              setCreateOpen(true)
            }}
          >
            <UserPlus size={16} />
            Tạo tài khoản Tenant
          </Button>
        </div>

        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          {isOwner && (
            <div
              role="group"
              aria-label="Lọc theo vai trò"
              className="inline-flex shrink-0 rounded-xl border border-border bg-background p-1"
            >
              <button
                type="button"
                onClick={() => {
                  setRoleFilter('TENANT')
                  setPage(1)
                }}
                className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
                  roleFilter === 'TENANT'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Tenant ({stats?.totalTenants ?? 0})
              </button>
              <button
                type="button"
                onClick={() => {
                  setRoleFilter('MANAGER')
                  setPage(1)
                }}
                className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
                  roleFilter === 'MANAGER'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Manager ({stats?.totalManagers ?? 0})
              </button>
            </div>
          )}

          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
            <SearchBox
              value={keyword}
              onChange={(v) => {
                setKeyword(v)
                setPage(1)
              }}
              placeholder={
                isOwner
                  ? roleFilter === 'MANAGER'
                    ? 'Tìm theo tên, email, SĐT quản lý…'
                    : 'Tìm theo phòng, tên, email, SĐT…'
                  : 'Tìm kiếm theo tên người thuê…'
              }
            />
            {isOwner && allowBranchSelect && branches.length > 0 && (
              <select
                aria-label="Lọc theo cơ sở"
                className="input w-auto max-w-full text-sm"
                value={effectiveBranchId}
                onChange={(e) => {
                  setSelectedBranchId(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">Tất cả cơ sở ({branches.length})</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
            {isOwner && (
              <select
                aria-label="Trạng thái tại cơ sở"
                className="input w-auto max-w-full text-sm"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="ACTIVE">Đang hoạt động (ACTIVE)</option>
                <option value="INACTIVE">Tạm ngưng (INACTIVE)</option>
              </select>
            )}
          </div>
        </div>

        <InlineError error={resendMutation.error} />

        <QueryState
          pending={listQuery.isPending}
          error={listQuery.error}
          retry={listQuery.refetch}
          empty={!listQuery.data || sortedItems.length === 0}
          emptyMessage={
            effectiveRoleFilter === 'MANAGER'
              ? 'Chưa có tài khoản Manager nào trong phạm vi cơ sở này.'
              : 'Chưa có người thuê nào đang thuê phòng trong cơ sở này.'
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-border text-xs font-bold uppercase text-muted-foreground whitespace-nowrap">
                  <th className="py-3 pr-3">
                    {effectiveRoleFilter === 'MANAGER' ? 'Họ và tên' : 'Phòng | Tên người thuê'}
                  </th>
                  <th className="py-3 pr-3">Liên hệ</th>
                  {isOwner && <th className="py-3 pr-3">Vai trò</th>}
                  <th className="py-3 pr-3">Cơ sở</th>
                  <th className="py-3 pr-3">Trạng thái tại cơ sở</th>
                  <th className="py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedItems.map((item) => {
                  const targetBranch =
                    effectiveBranchId || item.branchIds?.[0] || branches[0]?.id || ''
                  const isBranchActive = item.status === 'ACTIVE'
                  const needsActivation = !item.emailVerified || !item.passwordSet
                  const currentRole = item.role === 'MANAGER' ? 'MANAGER' : 'TENANT'
                  return (
                    <tr key={`${item.role}-${item.id}`} className="whitespace-nowrap">
                      <td className="py-3.5 pr-3 whitespace-nowrap">
                        {currentRole === 'TENANT' ? (
                          <p className="font-bold text-foreground whitespace-nowrap">
                            <span className="text-primary">
                              {item.currentRoomNumber ? `Phòng ${item.currentRoomNumber}` : 'Phòng —'}
                            </span>
                            <span className="mx-2 text-muted-foreground">|</span>
                            <span>{item.fullName}</span>
                          </p>
                        ) : (
                          <p className="font-bold text-foreground whitespace-nowrap">
                            {item.fullName}
                          </p>
                        )}
                        <p className="mt-0.5 text-xs text-muted-foreground whitespace-nowrap">
                          {item.gender === 'MALE'
                            ? 'Nam'
                            : item.gender === 'FEMALE'
                              ? 'Nữ'
                              : item.gender === 'OTHER'
                                ? 'Khác'
                                : currentRole === 'MANAGER'
                                  ? 'Quản lý vận hành cơ sở'
                                  : 'Đang thuê tại cơ sở'}
                          {item.dateOfBirth ? ` · NS: ${item.dateOfBirth}` : ''}
                        </p>
                      </td>
                      <td className="py-3.5 pr-3 whitespace-nowrap">
                        <p className="font-medium whitespace-nowrap">{item.email}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground whitespace-nowrap">
                          {item.phone || 'Chưa có SĐT'}
                        </p>
                      </td>
                      {isOwner && (
                        <td className="py-3.5 pr-3 whitespace-nowrap">
                          <StatusBadge tone={currentRole === 'MANAGER' ? 'info' : 'neutral'}>
                            {currentRole === 'MANAGER' ? 'MANAGER' : 'TENANT'}
                          </StatusBadge>
                        </td>
                      )}
                      <td className="py-3.5 pr-3 whitespace-nowrap">
                        <p className="text-xs font-medium whitespace-nowrap">
                          {item.branchNames?.length
                            ? item.branchNames.join(', ')
                            : 'Cơ sở hiện tại'}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground whitespace-nowrap">
                          {needsActivation
                            ? !item.emailVerified
                              ? 'Chờ xác thực email'
                              : 'Chờ đặt mật khẩu'
                            : 'Đã kích hoạt tài khoản'}
                        </p>
                      </td>
                      <td className="py-3.5 pr-3 whitespace-nowrap">
                        <StatusBadge tone={isBranchActive ? 'success' : 'danger'}>
                          {isBranchActive ? 'ACTIVE' : 'INACTIVE'}
                        </StatusBadge>
                      </td>
                      <td className="py-3.5 text-right whitespace-nowrap">
                        <div className="flex flex-nowrap items-center justify-end gap-2">
                          {needsActivation && currentRole === 'TENANT' && (
                            <Button
                              variant="outline"
                              className="whitespace-nowrap"
                              disabled={resendMutation.isPending}
                              onClick={() =>
                                resendMutation.mutate({
                                  tenantId: item.id,
                                  branchId: targetBranch || undefined,
                                  email: item.email,
                                })
                              }
                            >
                              <Mail size={14} />
                              Gửi lại link
                            </Button>
                          )}
                          {isOwner && (
                            <Button
                              variant="outline"
                              className="whitespace-nowrap"
                              onClick={() => {
                                roleMutation.reset()
                                setRoleTarget({
                                  account: item,
                                  targetBranchId: targetBranch,
                                  nextRole: currentRole === 'TENANT' ? 'MANAGER' : 'TENANT',
                                })
                              }}
                            >
                              {currentRole === 'TENANT' ? (
                                <>
                                  <ArrowUpCircle size={14} />
                                  Nâng lên Manager
                                </>
                              ) : (
                                <>
                                  <ArrowDownCircle size={14} />
                                  Hạ xuống Tenant
                                </>
                              )}
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            className="whitespace-nowrap"
                            onClick={() => {
                              statusMutation.reset()
                              setTogglingTenant({
                                tenant: item,
                                targetBranchId: targetBranch,
                                nextStatus: isBranchActive ? 'INACTIVE' : 'ACTIVE',
                              })
                            }}
                          >
                            {isBranchActive ? (
                              <>
                                <ShieldAlert size={14} />
                                Tạm ngưng
                              </>
                            ) : (
                              <>
                                <ShieldCheck size={14} />
                                Kích hoạt lại
                              </>
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {listQuery.data && (
            <Pagination
              page={page}
              totalPages={listQuery.data.totalPages}
              onPage={(nextPage) => setPage(nextPage)}
            />
          )}
        </QueryState>
      </Panel>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Tạo tài khoản cho người thuê (Tenant)"
      >
        <form
          className="grid gap-4"
          noValidate
          onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
        >
          <Notice>
            Hệ thống sẽ gửi liên kết xác thực tới Gmail của người thuê. Người thuê phải bấm xác thực
            email trước, sau đó tự đặt mật khẩu riêng (Quản lý/Chủ cơ sở không thể biết mật khẩu
            này).
          </Notice>

          {allowBranchSelect && branches.length > 0 && (
            <Field
              id="tenant-create-branch"
              label="Cơ sở quản lý"
              error={form.formState.errors.branchId?.message}
            >
              <select
                id="tenant-create-branch"
                className="input"
                {...form.register('branchId')}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field
            id="tenant-create-fullname"
            label="Họ và tên người thuê"
            error={form.formState.errors.fullName?.message}
          >
            <input
              id="tenant-create-fullname"
              className="input"
              placeholder="Nguyễn Văn A"
              {...form.register('fullName')}
            />
          </Field>

          <Field
            id="tenant-create-email"
            label="Địa chỉ Email (nhận link xác thực & đặt mật khẩu)"
            error={form.formState.errors.email?.message}
          >
            <input
              id="tenant-create-email"
              type="email"
              className="input"
              placeholder="tenant@gmail.com"
              {...form.register('email')}
            />
          </Field>

          <Field
            id="tenant-create-phone"
            label="Số điện thoại di động"
            error={form.formState.errors.phone?.message}
          >
            <input
              id="tenant-create-phone"
              className="input"
              placeholder="0912345678"
              {...form.register('phone')}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="tenant-create-gender"
              label="Giới tính (không bắt buộc)"
              error={form.formState.errors.gender?.message}
            >
              <select
                id="tenant-create-gender"
                className="input"
                {...form.register('gender', {
                  setValueAs: (v) => (v === '' ? undefined : v),
                })}
              >
                <option value="">-- Chọn --</option>
                <option value="MALE">Nam</option>
                <option value="FEMALE">Nữ</option>
                <option value="OTHER">Khác</option>
              </select>
            </Field>

            <Field
              id="tenant-create-dob"
              label="Ngày sinh (không bắt buộc)"
              error={form.formState.errors.dateOfBirth?.message}
            >
              <input
                id="tenant-create-dob"
                type="date"
                className="input"
                {...form.register('dateOfBirth')}
              />
            </Field>
          </div>

          <InlineError error={createMutation.error} />

          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Tạo tài khoản & Gửi link qua Gmail
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!togglingTenant}
        onClose={() => setTogglingTenant(null)}
        hideClose
        title={
          togglingTenant?.nextStatus === 'INACTIVE'
            ? 'Tạm ngưng tài khoản tại cơ sở?'
            : 'Kích hoạt lại tài khoản tại cơ sở?'
        }
      >
        {togglingTenant && (
          <div className="grid gap-4">
            <p className="text-sm leading-6 text-muted-foreground">
              {togglingTenant.nextStatus === 'INACTIVE'
                ? `Tài khoản của "${togglingTenant.tenant.fullName}" (${togglingTenant.tenant.email}) sẽ bị tạm ngưng (INACTIVE) chỉ trong phạm vi cơ sở này và không ảnh hưởng tới các cơ sở khác.`
                : `Khôi phục trạng thái hoạt động (ACTIVE) cho "${togglingTenant.tenant.fullName}" (${togglingTenant.tenant.email}) tại cơ sở này.`}
            </p>
            {allowBranchSelect && togglingTenant.tenant.branchIds.length > 1 && (
              <Field id="toggle-branch-select" label="Chọn cơ sở áp dụng">
                <select
                  id="toggle-branch-select"
                  className="input"
                  value={togglingTenant.targetBranchId}
                  onChange={(e) =>
                    setTogglingTenant({
                      ...togglingTenant,
                      targetBranchId: e.target.value,
                    })
                  }
                >
                  {branches
                    .filter((b) => togglingTenant.tenant.branchIds.includes(b.id))
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                </select>
              </Field>
            )}
            <InlineError error={statusMutation.error} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setTogglingTenant(null)}>
                Hủy
              </Button>
              <Button
                loading={statusMutation.isPending}
                onClick={() =>
                  statusMutation.mutate({
                    tenantId: togglingTenant.tenant.id,
                    branchId: togglingTenant.targetBranchId || undefined,
                    status: togglingTenant.nextStatus,
                  })
                }
              >
                Xác nhận
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!roleTarget}
        onClose={() => setRoleTarget(null)}
        hideClose
        title={
          roleTarget?.nextRole === 'MANAGER'
            ? 'Nâng vai trò từ Tenant lên Manager?'
            : 'Hạ vai trò từ Manager xuống Tenant?'
        }
      >
        {roleTarget && (
          <div className="grid gap-4">
            <p className="text-sm leading-6 text-muted-foreground">
              {roleTarget.nextRole === 'MANAGER'
                ? `Nâng tài khoản "${roleTarget.account.fullName}" (${roleTarget.account.email}) lên làm Quản lý cơ sở (MANAGER).`
                : `Hạ tài khoản "${roleTarget.account.fullName}" (${roleTarget.account.email}) từ Quản lý cơ sở xuống Người thuê (TENANT).`}
            </p>
            {branches.length > 0 && (
              <Field id="role-branch-select" label="Cơ sở áp dụng">
                <select
                  id="role-branch-select"
                  className="input"
                  value={roleTarget.targetBranchId}
                  onChange={(e) =>
                    setRoleTarget({
                      ...roleTarget,
                      targetBranchId: e.target.value,
                    })
                  }
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <InlineError error={roleMutation.error} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRoleTarget(null)}>
                Hủy
              </Button>
              <Button
                loading={roleMutation.isPending}
                onClick={() =>
                  roleMutation.mutate({
                    accountId: roleTarget.account.id,
                    role: roleTarget.nextRole,
                    branchId: roleTarget.targetBranchId || undefined,
                  })
                }
              >
                {roleTarget.nextRole === 'MANAGER' ? 'Xác nhận nâng lên Manager' : 'Xác nhận hạ xuống Tenant'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
