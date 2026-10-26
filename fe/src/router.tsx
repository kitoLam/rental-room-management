import { createBrowserRouter, Navigate } from 'react-router'
import { HomePage } from '@/features/home/home-page'
import { PublicLayout } from '@/layouts/public-layout'
import { AuthLayout } from '@/layouts/auth-layout'
import { UserLayout } from '@/layouts/user-layout'
import { TenantLayout } from '@/layouts/tenant-layout'
import { ManagerLayout } from '@/layouts/manager-layout'
import { OwnerLayout } from '@/layouts/owner-layout'
import { AdminLayout } from '@/layouts/admin-layout'
import { RouteGuard } from '@/features/auth/route-guard'
import { NotFoundPage } from '@/pages/not-found-page'
import { RouteErrorPage } from '@/pages/route-error-page'
export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: 'rooms',
        lazy: async () => ({
          Component: (await import('@/features/rooms/room-search-page')).default,
        }),
      },
      {
        path: 'rooms/:roomId',
        lazy: async () => ({
          Component: (await import('@/features/rooms/room-detail-page')).default,
        }),
      },
      {
        path: 'branches/:branchId',
        lazy: async () => ({
          Component: (await import('@/features/rooms/branch-detail-page')).default,
        }),
      },
      {
        path: 'owner-onboarding',
        lazy: async () => ({ Component: (await import('@/pages/owner-onboarding-page')).default }),
      },
      {
        element: <RouteGuard />,
        children: [
          {path:'admin',element:<AdminLayout/>,children:[
            {index:true,element:<Navigate to="/admin/dashboard" replace/>},
            {path:'dashboard',lazy:async()=>({Component:(await import('@/features/admin/platform-pages')).AdminDashboard})},
            {path:'users',lazy:async()=>({Component:(await import('@/features/admin/user-pages')).AdminUsers})},
            {path:'users/new',lazy:async()=>({Component:(await import('@/features/admin/user-pages')).AdminUserCreate})},
            {path:'users/:userId',lazy:async()=>({Component:(await import('@/features/admin/user-pages')).AdminUserDetail})},
            {path:'roles',lazy:async()=>({Component:(await import('@/features/admin/platform-pages')).AdminRoles})},
            {path:'owner-verifications',lazy:async()=>({Component:(await import('@/features/admin/verification-pages')).AdminVerificationQueue})},
            {path:'owner-verifications/:userId',lazy:async()=>({Component:(await import('@/features/admin/verification-pages')).AdminVerificationDetail})},
            {path:'owners',lazy:async()=>({Component:(await import('@/features/admin/platform-pages')).AdminOwners})},
            {path:'branches',lazy:async()=>({Component:(await import('@/features/admin/platform-pages')).AdminBranches})},
            {path:'activity',lazy:async()=>({Component:(await import('@/features/admin/platform-pages')).AdminActivity})},
            {path:'activity/:eventId',lazy:async()=>({Component:(await import('@/features/admin/platform-pages')).AdminAuditDetail})},
          ]},
          {
            path: 'owner', element: <OwnerLayout />, children: [
              { index: true, element: <Navigate to="/owner/dashboard" replace /> },
              { path: 'onboarding', lazy: async()=>({ Component:(await import('@/features/owner/onboarding-pages')).OwnerOnboarding }) },
              { path: 'verification', lazy: async()=>({ Component:(await import('@/features/owner/onboarding-pages')).OwnerVerificationPage }) },
              { path: 'dashboard', lazy: async()=>({ Component:(await import('@/features/owner/finance-pages')).OwnerDashboard }) },
              { path: 'branches', lazy: async()=>({ Component:(await import('@/features/owner/branch-pages')).OwnerBranches }) },
              { path: 'branches/new', lazy: async()=>({ Component:(await import('@/features/owner/branch-pages')).OwnerBranchEditor }) },
              { path: 'branches/:branchId', lazy: async()=>({ Component:(await import('@/features/owner/branch-pages')).OwnerBranchDetail }) },
              { path: 'branches/:branchId/edit', lazy: async()=>({ Component:(await import('@/features/owner/branch-pages')).OwnerBranchEditor }) },
              { path: 'branches/:branchId/policies', lazy: async()=>({ Component:(await import('@/features/owner/branch-pages')).OwnerPolicies }) },
              { path: 'branches/:branchId/payments/settings', lazy: async()=>({ Component:(await import('@/features/owner/branch-pages')).OwnerQrSettings }) },
              { path: 'managers', lazy: async()=>({ Component:(await import('@/features/owner/manager-pages')).OwnerManagers }) },
              { path: 'managers/invite', lazy: async()=>({ Component:(await import('@/features/owner/manager-pages')).OwnerInvite }) },
              { path: 'managers/:managerId', lazy: async()=>({ Component:(await import('@/features/owner/manager-pages')).OwnerManagerDetail }) },
              { path: 'manager-assignments', lazy: async()=>({ Component:(await import('@/features/owner/manager-pages')).OwnerAssignments }) },
              { path: 'finance', lazy: async()=>({ Component:(await import('@/features/owner/finance-pages')).OwnerFinance }) },
              { path: 'payments', lazy: async()=>({ Component:(await import('@/features/owner/finance-pages')).OwnerPayments }) },
              { path: 'approvals/invoices', lazy: async()=>({ Component:(await import('@/features/owner/finance-pages')).OwnerApprovals }) },
              { path: 'reports', lazy: async()=>({ Component:(await import('@/features/owner/finance-pages')).OwnerReports }) },
              { path: 'activity', lazy: async()=>({ Component:(await import('@/features/owner/finance-pages')).OwnerActivityPage }) },
            ],
          },
          { path:'manager-invitations', lazy:async()=>({Component:(await import('@/features/owner/onboarding-pages')).ManagerInvitationsPage}) },
          {
            path: 'manager',
            element: <ManagerLayout />,
            children: [
              { index: true, element: <Navigate to="/manager/dashboard" replace /> },
              {
                path: 'dashboard',
                lazy: async () => ({
                  Component: (await import('@/features/manager/dashboard-page')).ManagerDashboard,
                }),
              },
              {
                path: 'reports',
                lazy: async () => ({
                  Component: (await import('@/features/manager/dashboard-page')).ManagerReports,
                }),
              },
              {
                path: 'rooms',
                lazy: async () => ({
                  Component: (await import('@/features/manager/property-pages')).ManagerRooms,
                }),
              },
              {
                path: 'rooms/new',
                lazy: async () => ({
                  Component: (await import('@/features/manager/property-pages')).ManagerRoomEditor,
                }),
              },
              {
                path: 'rooms/:roomId',
                lazy: async () => ({
                  Component: (await import('@/features/manager/property-pages')).ManagerRoomDetail,
                }),
              },
              {
                path: 'rooms/:roomId/edit',
                lazy: async () => ({
                  Component: (await import('@/features/manager/property-pages')).ManagerRoomEditor,
                }),
              },
              {
                path: 'rooms/:roomId/slots',
                lazy: async () => ({
                  Component: (await import('@/features/manager/property-pages')).ManagerSlots,
                }),
              },
              {
                path: 'tenants',
                lazy: async () => ({
                  Component: (await import('@/features/manager/property-pages')).ManagerTenants,
                }),
              },
              {
                path: 'tenancies/:contractTenantId',
                lazy: async () => ({
                  Component: (await import('@/features/manager/property-pages'))
                    .ManagerTenancyDetail,
                }),
              },
              {
                path: 'room-types',
                lazy: async () => ({
                  Component: (await import('@/features/manager/catalog-pages')).ManagerRoomTypes,
                }),
              },
              {
                path: 'services',
                lazy: async () => ({
                  Component: (await import('@/features/manager/catalog-pages')).ManagerServices,
                }),
              },
              {
                path: 'room-services',
                lazy: async () => ({
                  Component: (await import('@/features/manager/catalog-pages')).ManagerRoomServices,
                }),
              },
              {
                path: 'furnitures',
                lazy: async () => ({
                  Component: (await import('@/features/manager/catalog-pages')).ManagerFurnitures,
                }),
              },
              {
                path: 'furnitures/:furnitureId',
                lazy: async () => ({
                  Component: (await import('@/features/manager/catalog-pages'))
                    .ManagerFurnitureDetail,
                }),
              },
              {
                path: 'appointments',
                lazy: async () => ({
                  Component: (await import('@/features/manager/leasing-pages')).ManagerAppointments,
                }),
              },
              {
                path: 'appointments/:appointmentId',
                lazy: async () => ({
                  Component: (await import('@/features/manager/leasing-pages'))
                    .ManagerAppointmentDetail,
                }),
              },
              {
                path: 'bookings',
                lazy: async () => ({
                  Component: (await import('@/features/manager/leasing-pages')).ManagerBookings,
                }),
              },
              {
                path: 'bookings/:bookingId',
                lazy: async () => ({
                  Component: (await import('@/features/manager/leasing-pages'))
                    .ManagerBookingDetail,
                }),
              },
              {
                path: 'contracts',
                lazy: async () => ({
                  Component: (await import('@/features/manager/leasing-pages')).ManagerContracts,
                }),
              },
              {
                path: 'contracts/new',
                lazy: async () => ({
                  Component: (await import('@/features/manager/leasing-pages'))
                    .ManagerContractEditor,
                }),
              },
              {
                path: 'contracts/:contractId',
                lazy: async () => ({
                  Component: (await import('@/features/manager/leasing-pages'))
                    .ManagerContractDetail,
                }),
              },
              {
                path: 'contracts/:contractId/edit',
                lazy: async () => ({
                  Component: (await import('@/features/manager/leasing-pages'))
                    .ManagerContractEditor,
                }),
              },
              {
                path: 'contracts/:contractId/tenants',
                lazy: async () => ({
                  Component: (await import('@/features/manager/leasing-pages'))
                    .ManagerContractTenants,
                }),
              },
              {
                path: 'service-requests',
                lazy: async () => ({
                  Component: (await import('@/features/manager/operations-pages'))
                    .ManagerServiceRequests,
                }),
              },
              {
                path: 'utility-charges',
                lazy: async () => ({
                  Component: (await import('@/features/manager/operations-pages')).ManagerUtilities,
                }),
              },
              {
                path: 'utility-charges/new',
                lazy: async () => ({
                  Component: (await import('@/features/manager/operations-pages'))
                    .ManagerUtilityEditor,
                }),
              },
              {
                path: 'utility-charges/:chargeId/edit',
                lazy: async () => ({
                  Component: (await import('@/features/manager/operations-pages'))
                    .ManagerUtilityEditor,
                }),
              },
              {
                path: 'utility-charges/:chargeId',
                lazy: async () => ({
                  Component: (await import('@/features/manager/operations-pages'))
                    .ManagerUtilityDetail,
                }),
              },
              {
                path: 'cost-allocations',
                lazy: async () => ({
                  Component: (await import('@/features/manager/operations-pages'))
                    .ManagerAllocations,
                }),
              },
              {
                path: 'maintenance',
                lazy: async () => ({
                  Component: (await import('@/features/manager/operations-pages'))
                    .ManagerMaintenance,
                }),
              },
              {
                path: 'maintenance/:reportId',
                lazy: async () => ({
                  Component: (await import('@/features/manager/operations-pages'))
                    .ManagerMaintenanceDetail,
                }),
              },
              {
                path: 'invoices',
                lazy: async () => ({
                  Component: (await import('@/features/manager/finance-pages')).ManagerInvoices,
                }),
              },
              {
                path: 'invoices/new',
                lazy: async () => ({
                  Component: (await import('@/features/manager/finance-pages'))
                    .ManagerInvoiceEditor,
                }),
              },
              {
                path: 'invoices/:invoiceId',
                lazy: async () => ({
                  Component: (await import('@/features/manager/finance-pages'))
                    .ManagerInvoiceDetail,
                }),
              },
              {
                path: 'invoices/:invoiceId/edit',
                lazy: async () => ({
                  Component: (await import('@/features/manager/finance-pages'))
                    .ManagerInvoiceEditor,
                }),
              },
              {
                path: 'payments',
                lazy: async () => ({
                  Component: (await import('@/features/manager/finance-pages')).ManagerPayments,
                }),
              },
              {
                path: 'payments/:paymentId',
                lazy: async () => ({
                  Component: (await import('@/features/manager/finance-pages'))
                    .ManagerPaymentDetail,
                }),
              },
              {
                path: 'debts',
                lazy: async () => ({
                  Component: (await import('@/features/manager/finance-pages')).ManagerDebts,
                }),
              },
              {
                path: 'settings/zalo',
                lazy: async () => ({
                  Component: (await import('@/features/manager/finance-pages')).ManagerZaloSettings,
                }),
              },
            ],
          },
          {
            path: 'tenant',
            element: <TenantLayout />,
            children: [
              { index: true, element: <Navigate to="/tenant/dashboard" replace /> },
              {
                path: 'dashboard',
                lazy: async () => ({
                  Component: (await import('@/features/tenant/living-pages')).TenantDashboard,
                }),
              },
              {
                path: 'my-room',
                lazy: async () => ({
                  Component: (await import('@/features/tenant/living-pages')).MyRoomPage,
                }),
              },
              {
                path: 'contracts',
                lazy: async () => ({
                  Component: (await import('@/features/tenant/living-pages')).ContractsPage,
                }),
              },
              {
                path: 'contracts/:contractId',
                lazy: async () => ({
                  Component: (await import('@/features/tenant/living-pages')).ContractDetailPage,
                }),
              },
              {
                path: 'contracts/:contractId/my-terms',
                lazy: async () => ({
                  Component: (await import('@/features/tenant/living-pages')).MyTermsPage,
                }),
              },
              {
                path: 'invoices',
                lazy: async () => ({
                  Component: (await import('@/features/tenant/billing-pages')).InvoicesPage,
                }),
              },
              {
                path: 'invoices/:invoiceId',
                lazy: async () => ({
                  Component: (await import('@/features/tenant/billing-pages')).InvoiceDetailPage,
                }),
              },
              {
                path: 'payments',
                lazy: async () => ({
                  Component: (await import('@/features/tenant/billing-pages')).PaymentsPage,
                }),
              },
              {
                path: 'services',
                lazy: async () => ({
                  Component: (await import('@/features/tenant/service-pages')).ServicesPage,
                }),
              },
              {
                path: 'utilities',
                lazy: async () => ({
                  Component: (await import('@/features/tenant/service-pages')).UtilitiesPage,
                }),
              },
              {
                path: 'utilities/allocations',
                lazy: async () => ({
                  Component: (await import('@/features/tenant/service-pages')).AllocationsPage,
                }),
              },
              {
                path: 'maintenance',
                lazy: async () => ({
                  Component: (await import('@/features/tenant/maintenance-pages')).MaintenancePage,
                }),
              },
              {
                path: 'maintenance/new',
                lazy: async () => ({
                  Component: (await import('@/features/tenant/maintenance-pages'))
                    .CreateMaintenancePage,
                }),
              },
              {
                path: 'maintenance/:reportId',
                lazy: async () => ({
                  Component: (await import('@/features/tenant/maintenance-pages'))
                    .MaintenanceDetailPage,
                }),
              },
            ],
          },
          {
            path: 'rooms/:roomId/appointments/new',
            lazy: async () => ({
              Component: (await import('@/features/leasing/create-pages')).CreateAppointmentPage,
            }),
          },
          {
            path: 'rooms/:roomId/bookings/new',
            lazy: async () => ({
              Component: (await import('@/features/leasing/create-pages')).CreateBookingPage,
            }),
          },
          {
            element: <UserLayout />,
            children: [
              { path: 'user', element: <Navigate to="/user/dashboard" replace /> },
              {
                path: 'user/dashboard',
                lazy: async () => ({
                  Component: (await import('@/features/user/dashboard-page')).default,
                }),
              },
              {
                path: 'user/appointments',
                lazy: async () => ({
                  Component: (await import('@/features/leasing/activity-pages')).AppointmentsPage,
                }),
              },
              {
                path: 'user/appointments/:appointmentId',
                lazy: async () => ({
                  Component: (await import('@/features/leasing/activity-pages'))
                    .AppointmentDetailPage,
                }),
              },
              {
                path: 'user/bookings',
                lazy: async () => ({
                  Component: (await import('@/features/leasing/activity-pages')).BookingsPage,
                }),
              },
              {
                path: 'user/bookings/:bookingId',
                lazy: async () => ({
                  Component: (await import('@/features/leasing/activity-pages')).BookingDetailPage,
                }),
              },
              {
                path: 'user/bookings/:bookingId/payment',
                lazy: async () => ({
                  Component: (await import('@/features/leasing/payment-page')).default,
                }),
              },
              {
                path: 'profile',
                lazy: async () => ({
                  Component: (await import('@/features/user/profile-page')).default,
                }),
              },
              {
                path: 'notifications',
                lazy: async () => ({
                  Component: (await import('@/features/user/notifications-page')).default,
                }),
              },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    element: <AuthLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        path: 'login',
        lazy: async () => ({ Component: (await import('@/features/auth/auth-pages')).LoginPage }),
      },
      {
        path: 'register',
        lazy: async () => ({
          Component: (await import('@/features/auth/auth-pages')).RegisterPage,
        }),
      },
      {
        path: 'verify-email',
        lazy: async () => ({
          Component: (await import('@/features/auth/auth-pages')).VerifyEmailPage,
        }),
      },
      {
        path: 'forgot-password',
        lazy: async () => ({
          Component: (await import('@/features/auth/auth-pages')).ForgotPasswordPage,
        }),
      },
      {
        path: 'reset-password',
        lazy: async () => ({
          Component: (await import('@/features/auth/auth-pages')).ResetPasswordPage,
        }),
      },
    ],
  },
])
