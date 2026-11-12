import { Field, InlineError } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { imageAttachment, MAX_ATTACHMENT_COUNT } from '@/features/tenant/attachments'
import type { Attachment } from '@/interfaces/tenant'
import { useState } from 'react'

export function EvidenceInput({
  value,
  onChange,
  disabled = false,
}: {
  value: Attachment[]
  onChange: (v: Attachment[]) => void
  disabled?: boolean
}) {
  const [error, setError] = useState<Error | null>(null),
    [loading, setLoading] = useState(false)
  return (
    <div className="grid min-w-0 grid-cols-1 gap-3">
      <Field
        id="manager-evidence"
        label="Ảnh minh chứng"
        hint={`Tối đa ${MAX_ATTACHMENT_COUNT} ảnh PNG, JPG hoặc WebP; mỗi ảnh 5 MB.`}
      >
        <input
          id="manager-evidence"
          className="input min-w-0 w-full max-w-full text-xs"
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp"
          disabled={disabled || loading}
          onChange={async (e) => {
            const files = Array.from(e.target.files || [])
            e.target.value = ''
            if (files.length + value.length > MAX_ATTACHMENT_COUNT) {
              setError(new Error(`Tối đa ${MAX_ATTACHMENT_COUNT} ảnh.`))
              return
            }
            setLoading(true)
            setError(null)
            try {
              onChange([...value, ...(await Promise.all(files.map(imageAttachment)))])
            } catch (e) {
              setError(e instanceof Error ? e : new Error('Không đọc được ảnh.'))
            } finally {
              setLoading(false)
            }
          }}
        />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        {value.map((a) => (
          <div key={a.id} className="min-w-0">
            <img
              src={a.url}
              alt={a.name}
              className="aspect-square w-full rounded-lg object-cover"
            />
            <Button
              type="button"
              variant="ghost"
              disabled={disabled}
              onClick={() => onChange(value.filter((v) => v.id !== a.id))}
            >
              Xóa ảnh
            </Button>
          </div>
        ))}
      </div>
      <InlineError error={error} />
    </div>
  )
}
