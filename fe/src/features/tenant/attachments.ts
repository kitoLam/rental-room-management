import type { Attachment } from '@/interfaces/tenant'
export async function imageAttachment(file: File): Promise<Attachment> {
  if (
    !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
    file.size <= 0 ||
    file.size > 1048576
  )
    throw new Error('Chọn ảnh JPG, PNG hoặc WebP, tối đa 1 MB mỗi ảnh.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const valid =
    file.type === 'image/png'
      ? bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71
      : file.type === 'image/jpeg'
        ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
          String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  if (!valid) throw new Error('Nội dung ảnh không đúng định dạng đã chọn.')
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Không đọc được ảnh. Hãy chọn lại.'))
    reader.readAsDataURL(file)
  })
  return {
    id: crypto.randomUUID(),
    name: file.name.slice(0, 120),
    mime: file.type as Attachment['mime'],
    size: file.size,
    url,
  }
}
