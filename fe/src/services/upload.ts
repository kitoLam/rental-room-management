import { z } from 'zod'
import { request } from './http'

export const uploadResponseSchema = z.object({
  publicId: z.string().nullish(),
  url: z.string().nullish(),
  secureUrl: z.string().nullish(),
  format: z.string().nullish(),
  resourceType: z.string().nullish(),
  bytes: z.number().nullish(),
  width: z.number().nullish(),
  height: z.number().nullish(),
})

export type UploadResponse = z.infer<typeof uploadResponseSchema>

/**
 * Tải file ảnh lên Cloudinary thông qua API backend `/api/v1/public/upload`.
 * Trả về secureUrl hoặc url của Cloudinary.
 */
export async function uploadToCloudinary(file: File, folder?: string): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)

  const endpoint = folder
    ? `/api/v1/public/upload?folder=${encodeURIComponent(folder)}`
    : '/api/v1/public/upload'

  const res = await request<UploadResponse>(
    'tenant',
    endpoint,
    uploadResponseSchema,
    {
      method: 'POST',
      body: formData,
    },
  )

  const finalUrl = res.secureUrl || res.url
  if (!finalUrl) {
    throw new Error('Không nhận được URL ảnh sau khi tải lên Cloudinary.')
  }
  return finalUrl
}

/**
 * Tải nhiều file ảnh lên Cloudinary thông qua API backend `/api/v1/public/upload/multiple`.
 */
export async function uploadMultipleToCloudinary(files: File[], folder?: string): Promise<string[]> {
  const formData = new FormData()
  files.forEach((file) => formData.append('files', file))

  const endpoint = folder
    ? `/api/v1/public/upload/multiple?folder=${encodeURIComponent(folder)}`
    : '/api/v1/public/upload/multiple'

  const res = await request<UploadResponse[]>(
    'tenant',
    endpoint,
    z.array(uploadResponseSchema),
    {
      method: 'POST',
      body: formData,
    },
  )

  return (res || []).map((item) => item.secureUrl || item.url).filter(Boolean) as string[]
}
