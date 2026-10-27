import { Notice, Panel } from '@/components/common/page'
import { managerApi } from '@/services/manager'
import { queryClient } from '@/services/query-client'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { z } from 'zod'
import { ManagerForm, ManagerPage } from './components'
import { useManager } from './context'

export function ManagerZaloSettings() {
  const { branch } = useManager(),
    [success, setSuccess] = useState(false),
    mutation = useMutation({
      mutationFn: (value: unknown) => managerApi.zalo(branch.id, value),
      onSuccess: () => {
        setSuccess(true)
        void queryClient.invalidateQueries()
      },
    })
  return (
    <ManagerPage
      title="Nhóm Zalo chi nhánh"
      description="Thông tin nhóm chỉ hiển thị với người thuê được cấp quyền tại chi nhánh."
    >
      {success && <Notice tone="success">Đã lưu thông tin nhóm Zalo.</Notice>}
      <Panel>
        <ManagerForm
          schema={z.object({ url: z.string().trim().max(500), enabled: z.boolean() })}
          defaults={{ url: branch.zaloUrl || '', enabled: branch.zaloEnabled }}
          fields={[
            { name: 'url', label: 'Liên kết nhóm Zalo', hint: 'Dạng https://zalo.me/g/…' },
            { name: 'enabled', label: 'Hiển thị nhóm cho người thuê', kind: 'check' },
          ]}
          pending={mutation.isPending}
          error={mutation.error}
          onSubmit={(value) => mutation.mutate(value)}
        />
      </Panel>
    </ManagerPage>
  )
}
