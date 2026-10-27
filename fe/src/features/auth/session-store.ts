import { create } from 'zustand'
import type { Role, Session, User } from '@/interfaces/domain'

type SessionState = {
  user: User | null
  accessToken: string | null
  ready: boolean
  activeRole: Role | null
  setSession: (session: Session) => void
  clear: () => void
  setReady: () => void
  updateUser: (user: User) => void
  setActiveRole: (role: Role) => void
}

/**
 * The backend issues a stateless JWT (no HttpOnly refresh cookie), so the token is kept in
 * localStorage to survive page reloads. Refresh sends this token to /api/v1/auth/refresh.
 */
export const TOKEN_STORAGE_KEY = 'tropro.accessToken'

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null
  } catch {
    return null
  }
}
export function readStoredToken(): string | null {
  return storage()?.getItem(TOKEN_STORAGE_KEY) ?? null
}
function writeStoredToken(token: string | null) {
  const store = storage()
  if (!store) return
  if (token) store.setItem(TOKEN_STORAGE_KEY, token)
  else store.removeItem(TOKEN_STORAGE_KEY)
}

export const useSession = create<SessionState>((set, get) => ({
  user: null,
  accessToken: null,
  ready: false,
  activeRole: null,
  setSession: (session) => {
    writeStoredToken(session.accessToken)
    set({
      user: session.user,
      accessToken: session.accessToken,
      ready: true,
      activeRole: session.user.roles.includes(get().activeRole!)
        ? get().activeRole
        : session.user.roles[0],
    })
  },
  clear: () => {
    writeStoredToken(null)
    set({ user: null, accessToken: null, activeRole: null, ready: true })
  },
  setReady: () => set({ ready: true }),
  updateUser: (user) => set({ user }),
  setActiveRole: (role) => {
    if (get().user?.roles.includes(role)) set({ activeRole: role })
  },
}))
