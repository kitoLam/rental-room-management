import { z } from 'zod'
import { useSession, readStoredToken } from '@/features/auth/session-store'
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

/**
 * Spring StandardResponse envelope:
 *   { success, message (string | string[] for validation), data, errorCode, timestamp }
 */
const envelope = z.object({
  success: z.boolean().optional(),
  message: z.union([z.string(), z.array(z.string())]).nullish(),
  errorCode: z.string().nullish(),
  data: z.unknown().optional(),
  // legacy / old numeric code kept for mock compatibility
  code: z.number().optional(),
  status: z.number().optional(),
})

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

/** Auth paths that must never trigger the 401-retry/refresh cycle. */
const AUTH_PATHS = ['/api/v1/auth/', '/api/auth/']
function isAuthPath(path: string) {
  return AUTH_PATHS.some((p) => path.startsWith(p))
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
  if (
    feature === 'manager' &&
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('workspace') === 'owner'
  )
    mockHeaders['X-TroPro-Workspace'] = 'OWNER'
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
        'ngrok-skip-browser-warning': 'true',
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
  if (response.status === 401 && retry && !isAuthPath(path)) {
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
  if (!parsed.success)
    throw new ApiError('Phản hồi máy chủ không đúng định dạng.', response.status)
  const body = parsed.data
  if (!response.ok || body.success === false) {
    const rawMsg = body.message
    const message = Array.isArray(rawMsg) ? rawMsg.join(' | ') : rawMsg || ''
    throw new ApiError(
      response.status >= 500
        ? 'Máy chủ đang gặp sự cố. Vui lòng thử lại.'
        : errorMessages[body.code || 0] ||
            (provider(feature) === 'real' && message ? message : '') ||
            (provider(feature) === 'mock' ? message : '') ||
            (response.status === 401
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
  if (!data.success) throw new ApiError('Dữ liệu máy chủ chưa khớp hợp đồng API.', 502)
  return data.data
}
export const write = (method: string, value?: unknown): RequestInit => ({
  method,
  ...(value !== undefined ? { body: JSON.stringify(value) } : {}),
})

/**
 * Real backend login/refresh response shape.
 * The Spring backend returns:
 *   { token, authenticated, expiresIn }
 * and the tenant id is in the JWT sub claim.
 * We need the user's profile from the JWT claims.
 */
const realAuthSchema = z.union([
  z.object({
    token: z.string(),
    authenticated: z.boolean().optional(),
    expiresIn: z.number(),
  }),
  z.object({
    accessToken: z.string(),
    expiresIn: z.number(),
    accountId: z.string(),
    email: z.string().email(),
    fullName: z.string(),
    role: z.enum(['USER', 'TENANT', 'MANAGER', 'OWNER', 'ADMIN']),
  }),
])

/**
 * Decode JWT payload without verification (the server already verified it).
 * Returns null if the token is malformed.
 */
function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  try {
    const parts = jwt.split('.')
    if (parts.length !== 3) return null
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = payload + '=='.slice(0, (4 - (payload.length % 4)) % 4)
    return JSON.parse(atob(padded))
  } catch {
    return null
  }
}

export async function authRequest(path: string, body?: unknown): Promise<Session> {
  if (provider('auth') === 'mock')
    return request('auth', path, sessionSchema, write('POST', body), false)
  const data = await request('auth', path, realAuthSchema, write('POST', body), false)
  if ('token' in data) {
    const claims = decodeJwtPayload(data.token)
    const sub = (claims?.['sub'] as string) || ''
    const email = (claims?.['email'] as string) || ''
    const fullName = (claims?.['fullName'] as string) || ''
    const role = (claims?.['role'] as string) || 'TENANT'
    return {
      accessToken: data.token,
      expiresIn: data.expiresIn,
      user: {
        id: sub,
        email,
        fullName,
        roles: [role as 'TENANT' | 'MANAGER' | 'OWNER' | 'ADMIN' | 'USER'],
        phone: null,
        dateOfBirth: null,
        gender: null,
        status: 'ACTIVE',
      },
    }
  }
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
  const storedToken = readStoredToken()
  const tokenToUse = previousToken ?? storedToken
  if (!recovery) {
    const payload = tokenToUse ? { token: tokenToUse } : undefined
    const path = provider('auth') === 'real' ? '/api/v1/auth/refresh' : '/api/auth/refresh'
    recovery = authRequest(path, payload)
      .then((s) => {
        if (useSession.getState().accessToken === previousToken) {
          useSession.getState().setSession(s)
        }
      })
      .catch((err) => {
        if (useSession.getState().accessToken === previousToken) {
          useSession.getState().clear()
        }
        throw err
      })
      .finally(() => {
        recovery = null
      })
  }
  return recovery
}
