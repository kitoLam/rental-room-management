import type { Attachment } from '@/interfaces/tenant'
import { MockError } from './database'
export function validateAttachments(images:Attachment[]){for(const image of images)validateImage(image.url,image.mime,image.size)}
export function validateImage(url:string,mime?:string,size?:number) {
  const match=url.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/)
  if(!match)throw new MockError('Ảnh tải lên chưa đúng định dạng.',422)
  let bytes:string
  try{bytes=atob(match[2])}catch{throw new MockError('Không đọc được nội dung ảnh.',422)}
  const valid=match[1]==='image/png'?bytes.startsWith('\x89PNG\r\n\x1a\n'):match[1]==='image/jpeg'?bytes.startsWith('\xff\xd8\xff'):bytes.startsWith('RIFF')&&bytes.slice(8,12)==='WEBP'
  if(!valid||!bytes.length||bytes.length>1048576||(mime&&match[1]!==mime)||(size!==undefined&&size!==bytes.length))throw new MockError('Nội dung ảnh không khớp định dạng hoặc kích thước tối đa 1 MB.',422)
}
