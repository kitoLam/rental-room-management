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
// Access tokens live only in memory. Session recovery uses the HttpOnly refresh cookie.
export const useSession = create<SessionState>((set, get) => ({
  user: null,
  accessToken: null,
  ready: false,
  activeRole: null,
  setSession: (session) =>
    set({
      user: session.user,
      accessToken: session.accessToken,
      ready: true,
      activeRole: session.user.roles.includes(get().activeRole!)
        ? get().activeRole
        : session.user.roles[0],
    }),
  clear: () => set({ user: null, accessToken: null, activeRole: null, ready: true }),
  setReady: () => set({ ready: true }),
  updateUser: (user) => set({ user }),
  setActiveRole: (role) => {
    if (get().user?.roles.includes(role)) set({ activeRole: role })
  },
}))
