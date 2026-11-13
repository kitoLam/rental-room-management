import { z } from 'zod'
import { request } from './http'

const uploadResponse = z.object({ secureUrl: z.url() })

export async function uploadToCloudinary(file: File): Promise<string> {
  const body = new FormData()
  body.append('file', file)

  const { secureUrl } = await request('tenant', '/api/v1/public/upload', uploadResponse, {
    method: 'POST',
    body,
  })
  return secureUrl
}
