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
const uploadResponse = z.object({ secureUrl: z.url() })

export type UploadResponse = z.infer<typeof uploadResponseSchema>
export async function uploadToCloudinary(file: File): Promise<string> {
  const body = new FormData()
  body.append('file', file)

/**
 * Tải file ảnh lên Cloudinary thông qua API backend `/api/v1/public/upload`.
 * Trả về secureUrl hoặc url của Cloudinary.
 */
export async function uploadToCloudinary(file: File, folder?: string): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  if (folder) {
    formData.append('folder', folder)
  }

  const res = await request<UploadResponse>(
    'tenant',
    '/api/v1/public/upload',
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
  const { secureUrl } = await request('tenant', '/api/v1/public/upload', uploadResponse, {
    method: 'POST',
    body,
  })
  return secureUrl
}
