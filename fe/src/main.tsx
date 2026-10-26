import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { router } from './router'
import { queryClient } from './services/query-client'
import { recoverSession } from './services/http'
import { useSession } from './features/auth/session-store'
import './index.css'
async function start() {
  // Unregister the old demo worker so a previous installation cannot serve mock responses.
  if ('serviceWorker' in navigator) {
    const controller = navigator.serviceWorker.controller
    const wasControlledByMock = controller &&
      new URL(controller.scriptURL).pathname.endsWith('/mockServiceWorker.js')
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.filter((registration) => {
      const worker = registration.active || registration.waiting || registration.installing
      return worker && new URL(worker.scriptURL).pathname.endsWith('/mockServiceWorker.js')
    }).map((registration) => registration.unregister()))
    if (wasControlledByMock) {
      window.location.reload()
      return
    }
  }
  void recoverSession().catch(() => {
    if (!useSession.getState().accessToken) useSession.getState().clear()
  })
  const root = document.getElementById('root')
  if (!root) throw new Error('Không tìm thấy phần tử #root.')
  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )
}
void start().catch(() => {
  const root = document.getElementById('root')
  if (root) {
    root.textContent = 'Chưa khởi động được TroPro. Kiểm tra cấu hình API và tải lại trang.'
    root.setAttribute('role', 'alert')
  }
})
