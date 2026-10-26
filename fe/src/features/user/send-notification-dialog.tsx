import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Send, Users, User, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal, InlineError } from '@/components/common/page'
import { utilitiesService } from '@/services/utilities'
import { queryClient } from '@/services/query-client'

interface SendNotificationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultRecipientId?: string
}

export function SendNotificationDialog({
  open,
  onOpenChange,
  defaultRecipientId = '',
}: SendNotificationDialogProps) {
  const [mode, setMode] = useState<'single' | 'bulk'>('single')
  const [recipientUserId, setRecipientUserId] = useState(defaultRecipientId)
  const [recipientUserIds, setRecipientUserIds] = useState('')
  const [type, setType] = useState('ANNOUNCEMENT')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const singleMutation = useMutation({
    mutationFn: () =>
      utilitiesService.notifications.send({
        recipientUserId: recipientUserId.trim(),
        type,
        title: title.trim(),
        message: message.trim(),
        channel: 'IN_APP',
      }),
    onSuccess: () => {
      setSuccessMessage('Đã gửi thông báo thành công!')
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
      setTimeout(() => {
        resetForm()
        onOpenChange(false)
      }, 1500)
    },
  })

  const bulkMutation = useMutation({
    mutationFn: () => {
      const ids = recipientUserIds
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean)
      return utilitiesService.notifications.sendBulk({
        recipientUserIds: ids,
        type,
        title: title.trim(),
        message: message.trim(),
        channel: 'IN_APP',
      })
    },
    onSuccess: (data) => {
      setSuccessMessage(`Đã gửi thông báo thành công tới ${data.length} người nhận!`)
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
      setTimeout(() => {
        resetForm()
        onOpenChange(false)
      }, 1500)
    },
  })

  function resetForm() {
    setRecipientUserId(defaultRecipientId)
    setRecipientUserIds('')
    setType('ANNOUNCEMENT')
    setTitle('')
    setMessage('')
    setSuccessMessage('')
  }

  const isPending = singleMutation.isPending || bulkMutation.isPending
  const error = singleMutation.error || bulkMutation.error

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSuccessMessage('')
    if (mode === 'single') {
      singleMutation.mutate()
    } else {
      bulkMutation.mutate()
    }
  }

  return (
    <Modal
      title="Gửi thông báo hệ thống"
      open={open}
      onOpenChange={(v) => {
        if (!v && !isPending) {
          resetForm()
          onOpenChange(false)
        }
      }}
    >
      {successMessage ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <CheckCircle2 size={48} className="text-success mb-3" />
          <h3 className="text-base font-bold text-foreground">{successMessage}</h3>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="flex rounded-lg border border-border p-1 bg-surface">
            <button
              type="button"
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-md transition-colors ${
                mode === 'single'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setMode('single')}
            >
              <User size={14} />
              Gửi một người
            </button>
            <button
              type="button"
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-md transition-colors ${
                mode === 'bulk'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setMode('bulk')}
            >
              <Users size={14} />
              Gửi hàng loạt (Bulk)
            </button>
          </div>

          <InlineError error={error} />

          {mode === 'single' ? (
            <div>
              <label className="block text-xs font-bold mb-1 text-foreground">
                Mã người nhận (User ID) <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="VD: 123e4567-e89b-12d3-a456-426614174000"
                value={recipientUserId}
                onChange={(e) => setRecipientUserId(e.target.value)}
                className="input w-full"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold mb-1 text-foreground">
                Danh sách mã người nhận (Mỗi ID trên một dòng hoặc cách nhau bởi dấu phẩy){' '}
                <span className="text-danger">*</span>
              </label>
              <textarea
                required
                rows={3}
                placeholder="123e4567-e89b-12d3-a456-426614174000&#10;123e4567-e89b-12d3-a456-426614174001"
                value={recipientUserIds}
                onChange={(e) => setRecipientUserIds(e.target.value)}
                className="input w-full font-mono text-xs"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold mb-1 text-foreground">
              Loại thông báo <span className="text-danger">*</span>
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="input w-full"
            >
              <option value="ANNOUNCEMENT">Thông báo chung</option>
              <option value="TENANT_SERVICE">Dịch vụ & Tiện ích</option>
              <option value="UTILITY_BILL">Chỉ số điện nước</option>
              <option value="TENANT_ALLOCATION">Phân bổ chi phí</option>
              <option value="MAINTENANCE">Bảo trì & Sự cố</option>
              <option value="REMINDER">Nhắc nhở hạn nộp phí</option>
              <option value="SYSTEM">Hệ thống</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 text-foreground">
              Tiêu đề thông báo <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={255}
              placeholder="VD: Thông báo chốt chỉ số điện nước tháng 10"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 text-foreground">
              Nội dung thông báo <span className="text-danger">*</span>
            </label>
            <textarea
              required
              rows={4}
              placeholder="Nhập nội dung chi tiết thông báo gửi đến khách thuê..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="input w-full"
            />
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => onOpenChange(false)}
            >
              Hủy
            </Button>
            <Button type="submit" loading={isPending}>
              <Send size={14} className="mr-1.5" />
              Gửi thông báo
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
