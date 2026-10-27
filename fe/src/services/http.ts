import { z } from 'zod'
import { useSession } from '@/features/auth/session-store'
import { endpoint, provider, type Feature } from './config'
import { sessionSchema, type Session } from '@/interfaces/domain'
import { realApiIssue } from './real-api'

export class ApiError extends Error {
  status: number
  code?: number
  constructor(message: string, status = 500, code?: number) {
    super(message)
    this.status = status
    this.code = code
  }
}
const envelope = z.object({
  status: z.number().optional(),
  code: z.number().optional(),
  message: z.string().optional(),
  data: z.unknown().optional(),
})
const messages: Record<string, string> = {
  'Invalid login credentials': 'Email hoặc mật khẩu chưa đúng.',
  'Email is already in use': 'Email này đã được đăng ký.',
  'Verify your email before logging in': 'Vui lòng xác minh email trước khi đăng nhập.',
}
const errorMessages: Record<number, string> = {
  1001: 'Dữ liệu gửi lên chưa hợp lệ. Kiểm tra lại các trường.',
  1003: 'Không tìm thấy dữ liệu bạn yêu cầu.',
  1007: 'Dữ liệu bị trùng hoặc xung đột. Vui lòng kiểm tra lại.',
  1008: 'Dữ liệu đã thay đổi. Tải lại rồi thử tiếp.',
  1108: 'Tài khoản hiện chưa thể thực hiện thao tác này.',
  1110: 'Liên kết xác minh không hợp lệ hoặc đã hết hạn.',
  1116: 'Mật khẩu chưa đáp ứng yêu cầu. Dùng 8 ký tự trở lên và tối đa 72 byte.',
  1204: 'Phòng hoặc chỗ ở không còn trống trong khoảng ngày đã chọn.',
  1205: 'Chi nhánh chưa có chính sách khả dụng.',
  1302: 'Yêu cầu giữ chỗ đã hết hạn.',
  1305: 'Khoảng thời gian thuê chưa hợp lệ.',
  1306: 'Trạng thái yêu cầu không cho phép thực hiện thao tác này.',
}
export async function request<T>(
  feature: Feature,
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  if (provider(feature) === 'real') {
    const issue = realApiIssue(feature, path, init.method || 'GET')
    if (issue) throw new ApiError(issue, 501)
  }
  const { accessToken: token, user } = useSession.getState()
  const scenario =
    provider(feature) === 'mock' && feature !== 'auth' && feature !== 'recovery'
      ? new URLSearchParams(window.location.search).get('demo')
      : null
  const mockHeaders: Record<string, string> = {}
  if (feature === 'manager' && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('workspace') === 'owner') mockHeaders['X-TroPro-Workspace'] = 'OWNER'
  if (scenario && ['loading', 'error', 'empty'].includes(scenario))
    mockHeaders['X-TroPro-Demo-Scenario'] = scenario
  if (
    import.meta.env.DEV &&
    feature === 'tenant' &&
    provider(feature) === 'mock' &&
    new URLSearchParams(window.location.search).get('workflow') === 'reject'
  )
    mockHeaders['X-TroPro-Tenant-Workflow'] = 'reject'
  if (provider(feature) === 'mock' && provider('auth') === 'real' && user)
    mockHeaders['X-TroPro-Demo-Identity'] = encodeURIComponent(JSON.stringify(user))
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20000)
  let response: Response
  try {
    response = await fetch(endpoint(feature, path), {
      ...init,
      credentials: 'include',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...mockHeaders,
        ...init.headers,
      },
    })
  } catch {
    throw new ApiError('Không kết nối được máy chủ. Kiểm tra kết nối rồi thử lại.', 0)
  } finally {
    clearTimeout(timer)
  }
  if (response.status === 401 && retry && !path.startsWith('/api/auth/')) {
    if (useSession.getState().accessToken !== token)
      throw new ApiError('Phiên của yêu cầu đã thay đổi.', 401)
    try {
      await recoverSession()
    } catch {
      if (useSession.getState().accessToken === token) useSession.getState().clear()
    }
    if (useSession.getState().accessToken) return request(feature, path, schema, init, false)
  }
  if (response.status === 204) {
    const data = schema.safeParse(null)
    if (!data.success) throw new ApiError('Phản hồi máy chủ không đúng định dạng.', response.status)
    return data.data
  }
  const parsed = envelope.safeParse(await response.json().catch(() => null))
  if (!parsed.success) throw new ApiError('Phản hồi máy chủ không đúng định dạng.', response.status)
  const body = parsed.data
  if (!response.ok || (body.code && body.code !== 0)) {
    const message = body.message || ''
    throw new ApiError(
      response.status >= 500
        ? 'Máy chủ đang gặp sự cố. Vui lòng thử lại.'
        : errorMessages[body.code || 0] ||
            messages[message] ||
            (provider(feature) === 'mock'
              ? message
              : response.status === 401
                ? 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.'
                : response.status === 403
                  ? 'Bạn chưa có quyền thực hiện thao tác này.'
                  : response.status === 409
                    ? 'Dữ liệu đã thay đổi hoặc bị trùng. Vui lòng kiểm tra lại.'
                    : message || 'Không thể thực hiện yêu cầu.'),
      response.status,
      body.code,
    )
  }
  const data = schema.safeParse(body.data)
  if (!data.success) {
    if (import.meta.env.DEV) {
      console.error('[API Contract mismatch]', path, data.error.issues, 'payload was:', body.data)
    }
    throw new ApiError('Dữ liệu máy chủ chưa khớp hợp đồng API.', 502)
  }
  return data.data
}
export const write = (method: string, value?: unknown): RequestInit => ({
  method,
  ...(value !== undefined ? { body: JSON.stringify(value) } : {}),
})
const realAuthSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number(),
  accountId: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string(),
  role: z.enum(['USER', 'TENANT', 'MANAGER', 'OWNER', 'ADMIN']),
})
export async function authRequest(path: string, body?: unknown): Promise<Session> {
  if (provider('auth') === 'mock')
    return request('auth', path, sessionSchema, write('POST', body), false)
  const data = await request('auth', path, realAuthSchema, write('POST', body), false)
  return {
    accessToken: data.accessToken,
    expiresIn: data.expiresIn,
    user: {
      id: data.accountId,
      email: data.email,
      fullName: data.fullName,
      roles: [data.role],
      phone: null,
      dateOfBirth: null,
      gender: null,
      status: 'ACTIVE',
    },
  }
}
let recovery: Promise<void> | null = null
export function recoverSession() {
  const previousToken = useSession.getState().accessToken
  if (!recovery)
    recovery = authRequest('/api/auth/refresh')
      .then((s) => {
        if (useSession.getState().accessToken === previousToken) useSession.getState().setSession(s)
      })
      .finally(() => {
        recovery = null
      })
  return recovery
}
