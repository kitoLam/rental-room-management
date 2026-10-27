import { InlineError, Modal, Notice, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import {
  ImagePicker,
  ManagerForm,
  ManagerStatus,
  type FieldSpec,
} from '@/features/manager/components'
import { branchInputSchema, type BranchInput, type OwnedBranch } from '@/interfaces/owner'
import { ownerApi } from '@/services/owner'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useOwnerMutation, useOwnerQuery } from './context'

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
export function BranchForm({ branch }: { branch?: OwnedBranch }) {
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
export function ExistingBranchForm({ id }: { id: string }) {
  const query = useOwnerQuery('branch', () => ownerApi.branch(id), [id])
  return (
    <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
      {query.data && <BranchForm key={`${id}:${query.data.version}`} branch={query.data} />}
    </QueryState>
  )
}
