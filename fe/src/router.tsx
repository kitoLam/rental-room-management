import { RouteGuard } from '@/features/auth/route-guard'
import { HomePage } from '@/features/home/home-page'
import { AdminLayout } from '@/layouts/admin-layout'
import { AuthLayout } from '@/layouts/auth-layout'
import { ManagerLayout } from '@/layouts/manager-layout'
import { OwnerLayout } from '@/layouts/owner-layout'
import { PublicLayout } from '@/layouts/public-layout'
import { TenantLayout } from '@/layouts/tenant-layout'
import { UserLayout } from '@/layouts/user-layout'
import { NotFoundPage } from '@/pages/not-found-page'
import { RouteErrorPage } from '@/pages/route-error-page'
import { createBrowserRouter, Navigate } from 'react-router'
export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: 'notifications/viewing',
        lazy: async () => ({
          Component: (await import('@/features/leasing/viewing-notifications-page')).default,
        }),
      },
      {
        path: 'preview',
        lazy: async () => ({ Component: (await import('@/pages/preview-page')).default }),
      },
      {
        path: 'payment/vnpay-test',
        lazy: async () => ({
          Component: (await import('@/features/payment/vnpay-test-page')).VnPayTestPage,
        }),
      },
      {
        path: 'payment/vnpay-return',
        lazy: async () => ({
          Component: (await import('@/features/payment/vnpay-return-page')).VnPayReturnPage,
        }),
      },
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
        path: 'rooms/:roomId/viewing',
        lazy: async () => ({
          Component: (await import('@/features/leasing/viewing-availability-page'))
            .ViewingAvailabilityPage,
        }),
      },
      {
        path: 'rooms/:roomId/viewing-settings',
        lazy: async () => ({
          Component: (await import('@/features/manager/viewing-shift-settings-page'))
            .ViewingShiftSettingsPage,
        }),
      },
      {
        path: 'rooms/:roomId/utility-rates',
        lazy: async () => ({ Component: (await import('@/features/manager/utility-rates-page')).default }),
      },
      {
        element: <UserLayout />,
        children: [
          {
            path: 'user/appointments',
            lazy: async () => ({
              Component: (await import('@/features/leasing/appointments-page')).AppointmentsPage,
            }),
          },
          {
            path: 'user/appointments/:appointmentId',
            lazy: async () => ({
              Component: (await import('@/features/leasing/appointment-detail-page'))
                .AppointmentDetailPage,
            }),
          },
        ],
      },
      {
        path: 'manager/appointments',
        lazy: async () => ({
          Component: (await import('@/features/manager/manager-appointments-page'))
            .ManagerAppointments,
        }),
      },
      {
        path: 'manager/appointments/:appointmentId',
        lazy: async () => ({
          Component: (await import('@/features/manager/manager-appointment-detail-page'))
            .ManagerAppointmentDetail,
        }),
      },
      {
        path: 'branches/:branchId',
        lazy: async () => ({
          Component: (await import('@/features/rooms/branch-detail-page')).default,
        }),
      },
      {
        path: 'branches/:branchId/viewing-settings',
        lazy: async () => ({
          Component: (await import('@/features/manager/branch-viewing-settings-page'))
            .BranchViewingSettingsPage,
        }),
      },
      {
        path: 'owner-onboarding',
        lazy: async () => ({ Component: (await import('@/pages/owner-onboarding-page')).default }),
      },
      {
        element: <RouteGuard />,
        children: [
          {
            path: 'admin',
            element: <AdminLayout />,
            children: [
              { index: true, element: <Navigate to="/admin/dashboard" replace /> },
              {
                path: 'dashboard',
                lazy: async () => ({
                  Component: (await import('@/features/admin/admin-dashboard-page')).AdminDashboard,
                }),
              },
              {
                path: 'users',
                lazy: async () => ({
                  Component: (await import('@/features/admin/admin-users-page')).AdminUsers,
                }),
              },
              {
                path: 'users/new',
                lazy: async () => ({
                  Component: (await import('@/features/admin/admin-user-create-page'))
                    .AdminUserCreate,
                }),
              },
              {
                path: 'users/:userId',
                lazy: async () => ({
                  Component: (await import('@/features/admin/admin-user-detail-page'))
                    .AdminUserDetail,
                }),
              },
              {
                path: 'roles',
                lazy: async () => ({
                  Component: (await import('@/features/admin/admin-roles-page')).AdminRoles,
                }),
              },
              {
                path: 'owner-verifications',
                lazy: async () => ({
                  Component: (await import('@/features/admin/admin-verification-queue-page'))
                    .AdminVerificationQueue,
                }),
              },
              {
                path: 'owner-verifications/:userId',
                lazy: async () => ({
                  Component: (await import('@/features/admin/admin-verification-detail-page'))
                    .AdminVerificationDetail,
                }),
              },
              {
                path: 'owners',
                lazy: async () => ({
                  Component: (await import('@/features/admin/admin-owners-page')).AdminOwners,
                }),
              },
              {
                path: 'branches',
                lazy: async () => ({
                  Component: (await import('@/features/admin/admin-branches-page')).AdminBranches,
                }),
              },
              {
                path: 'activity',
                lazy: async () => ({
                  Component: (await import('@/features/admin/admin-activity-page')).AdminActivity,
                }),
              },
              {
                path: 'activity/:eventId',
                lazy: async () => ({
                  Component: (await import('@/features/admin/admin-audit-detail-page'))
                    .AdminAuditDetail,
                }),
              },
              {
                path: 'maintenance',
                lazy: async () => ({
                  Component: (await import('@/features/admin/admin-maintenance-page'))
                    .AdminMaintenancePage,
                }),
              },
              {
                path: 'maintenance/:reportId',
                lazy: async () => ({
                  Component: (await import('@/features/admin/admin-maintenance-detail-page'))
                    .AdminMaintenanceDetailPage,
                }),
              },
            ],
          },
          {
            path: 'owner',
            element: <OwnerLayout />,
            children: [
              { index: true, element: <Navigate to="/owner/dashboard" replace /> },
              {
                path: 'onboarding',
                lazy: async () => ({
                  Component: (await import('@/features/owner/owner-onboarding-page'))
                    .OwnerOnboarding,
                }),
              },
              {
                path: 'verification',
                lazy: async () => ({
                  Component: (await import('@/features/owner/owner-verification-page'))
                    .OwnerVerificationPage,
                }),
              },
              {
                path: 'dashboard',
                lazy: async () => ({
                  Component: (await import('@/features/owner/owner-dashboard-page')).OwnerDashboard,
                }),
              },
              {
                path: 'branches',
                lazy: async () => ({
                  Component: (await import('@/features/owner/owner-properties-page'))
                    .OwnerProperties,
                }),
              },
              {
                path: 'branches/new',
                lazy: async () => ({
                  Component: (await import('@/features/owner/owner-property-editor-page'))
                    .OwnerPropertyEditor,
                }),
              },
              {
                path: 'branches/:branchId',
                lazy: async () => ({
                  Component: (await import('@/features/owner/owner-property-detail-page'))
                    .OwnerPropertyDetail,
                }),
              },
              {
                path: 'branches/:branchId/edit',
                lazy: async () => ({
                  Component: (await import('@/features/owner/owner-property-editor-page'))
                    .OwnerPropertyEditor,
                }),
              },
              {
                path: 'branches/:branchId/rooms/new',
                lazy: async () => ({
                  Component: (await import('@/features/owner/owner-room-registration-page'))
                    .OwnerRoomRegistration,
                }),
              },
              {
                path: 'branches/:branchId/policies',
                lazy: async () => ({
                  Component: (await import('@/features/owner/owner-policies-page')).OwnerPolicies,
                }),
              },
              {
                path: 'branches/:branchId/payments/settings',
                lazy: async () => ({
                  Component: (await import('@/features/owner/owner-qr-settings-page'))
                    .OwnerQrSettings,
                }),
              },
              {
                path: 'managers',
                lazy: async () => ({
                  Component: (await import('@/features/owner/owner-managers-page')).OwnerManagers,
                }),
              },
              {
                path: 'managers/invite',
                lazy: async () => ({
                  Component: (await import('@/features/owner/owner-invite-page')).OwnerInvite,
                }),
              },
              {
                path: 'managers/:managerId',
                lazy: async () => ({
                  Component: (await import('@/features/owner/owner-manager-detail-page'))
                    .OwnerManagerDetail,
                }),
              },
              {
                path: 'manager-assignments',
                lazy: async () => ({
                  Component: (await import('@/features/owner/owner-assignments-page'))
                    .OwnerAssignments,
                }),
              },
              {
                path: 'finance',
                lazy: async () => ({
                  Component: (await import('@/features/owner/owner-finance-page')).OwnerFinance,
                }),
              },
              {
                path: 'payments',
                lazy: async () => ({
                  Component: (await import('@/features/owner/owner-payments-page')).OwnerPayments,
                }),
              },
              {
                path: 'approvals/invoices',
                lazy: async () => ({
                  Component: (await import('@/features/owner/owner-approvals-page')).OwnerApprovals,
                }),
              },
              {
                path: 'reports',
                lazy: async () => ({
                  Component: (await import('@/features/owner/owner-reports-page')).OwnerReports,
                }),
              },
              {
                path: 'activity',
                lazy: async () => ({
                  Component: (await import('@/features/owner/owner-activity-page'))
                    .OwnerActivityPage,
                }),
              },
            ],
          },
          {
            path: 'manager-invitations',
            lazy: async () => ({
              Component: (await import('@/features/owner/manager-invitations-page'))
                .ManagerInvitationsPage,
            }),
          },
          {
            path: 'manager',
            element: <ManagerLayout />,
            children: [
              { index: true, element: <Navigate to="/manager/dashboard" replace /> },
              {
                path: 'dashboard',
                lazy: async () => ({
                  Component: (await import('@/features/manager/manager-dashboard-page'))
                    .ManagerDashboard,
                }),
              },
              {
                path: 'reports',
                lazy: async () => ({
                  Component: (await import('@/features/manager/manager-reports-page'))
                    .ManagerReports,
                }),
              },
              {
                path: 'rooms',
                lazy: async () => ({
                  Component: (await import('@/features/manager/manager-rooms-page')).ManagerRooms,
                }),
              },
              {
                path: 'rooms/new',
                lazy: async () => ({
                  Component: (await import('@/features/manager/manager-room-editor-page'))
                    .ManagerRoomEditor,
                }),
              },
              {
                path: 'rooms/:roomId',
                lazy: async () => ({
                  Component: (await import('@/features/manager/manager-room-detail-page'))
                    .ManagerRoomDetail,
                }),
              },
              {
                path: 'rooms/:roomId/edit',
                lazy: async () => ({
                  Component: (await import('@/features/manager/manager-room-editor-page'))
                    .ManagerRoomEditor,
                }),
              },
              {
                path: 'rooms/:roomId/slots',
                lazy: async () => ({
                  Component: (await import('@/features/manager/manager-slots-page')).ManagerSlots,
                }),
              },
              {
                path: 'tenants',
                lazy: async () => ({
                  Component: (await import('@/features/manager/manager-tenants-page'))
                    .ManagerTenants,
                }),
              },
              {
                path: 'tenancies/:contractTenantId',
                lazy: async () => ({
                  Component: (await import('@/features/manager/manager-tenancy-detail-page'))
                    .ManagerTenancyDetail,
                }),
              },
              {
                path: 'room-types',
                lazy: async () => ({
                  Component: (await import('@/features/manager/manager-room-types-page'))
                    .ManagerRoomTypes,
                }),
              },
              {
                path: 'services',
                lazy: async () => ({
                  Component: (await import('@/features/manager/manager-services-page'))
                    .ManagerServices,
                }),
              },
              {
                path: 'room-services',
                lazy: async () => ({
                  Component: (await import('@/features/manager/manager-room-services-page'))
                    .ManagerRoomServices,
                }),
              },
              {
                path: 'furnitures',
                lazy: async () => ({
                  Component: (await import('@/features/manager/manager-furnitures-page'))
                    .ManagerFurnitures,
                }),
              },
              {
                path: 'furnitures/:furnitureId',
                lazy: async () => ({
                  Component: (await import('@/features/manager/manager-furniture-detail-page'))
                    .ManagerFurnitureDetail,
                }),
              },
              {
                path: 'bookings',
                lazy: async () => ({
                  Component: (await import('@/features/manager/manager-bookings-page'))
                    .ManagerBookings,
                }),
              },
              {
                path: 'bookings/:bookingId',
                lazy: async () => ({
                  Component: (await import('@/features/manager/manager-booking-detail-page'))
                    .ManagerBookingDetail,
                }),
              },
              {
                path: 'contracts',
                lazy: async () => ({
                  Component: (await import('@/features/manager/manager-contracts-page'))
                    .ManagerContracts,
                }),
              },
              {
                path: 'contracts/new',
                lazy: async () => ({
                  Component: (await import('@/features/manager/manager-contract-editor-page'))
                    .ManagerContractEditor,
                }),
              },
              {
                path: 'contracts/:contractId',
                lazy: async () => ({
                  Component: (await import('@/features/manager/manager-contract-detail-page'))
                    .ManagerContractDetail,
                }),
              },
              {
                path: 'contracts/:contractId/edit',
                lazy: async () => ({
                  Component: (await import('@/features/manager/manager-contract-editor-page'))
                    .ManagerContractEditor,
                }),
              },
              {
                path: 'contracts/:contractId/tenants',
                lazy: async () => ({
                  Component: (await import('@/features/manager/manager-contract-tenants-page'))
                    .ManagerContractTenants,
                }),
              },
              {
                path: 'service-requests',
                lazy: async () => ({
                  Component: (await import('@/features/manager/manager-service-requests-page'))
                    .ManagerServiceRequests,
                }),
              },
              {
                path: 'utility-charges',
                lazy: async () => ({
                  Component: (await import('@/features/manager/manager-utilities-page'))
                    .ManagerUtilities,
                }),
              },
              {
                path: 'utility-charges/new',
                lazy: async () => ({
                  Component: (await import('@/features/manager/manager-utility-editor-page'))
                    .ManagerUtilityEditor,
                }),
              },
              {
                path: 'utility-charges/:chargeId/edit',
                lazy: async () => ({
                  Component: (await import('@/features/manager/manager-utility-editor-page'))
                    .ManagerUtilityEditor,
                }),
              },
              {
                path: 'utility-charges/:chargeId',
                lazy: async () => ({
                  Component: (await import('@/features/manager/manager-utility-detail-page'))
                    .ManagerUtilityDetail,
                }),
              },
              {
                path: 'cost-allocations',
                lazy: async () => ({
                  Component: (await import('@/features/manager/manager-allocations-page'))
                    .ManagerAllocations,
                }),
              },
              {
                path: 'maintenance',
                lazy: async () => ({
                  Component: (await import('@/features/manager/manager-maintenance-page'))
                    .ManagerMaintenance,
                }),
              },
              {
                path: 'maintenance/:reportId',
                lazy: async () => ({
                  Component: (await import('@/features/manager/manager-maintenance-detail-page'))
                    .ManagerMaintenanceDetail,
                }),
              },
              {
                path: 'invoices',
                lazy: async () => ({
                  Component: (await import('@/features/manager/manager-invoices-page'))
                    .ManagerInvoices,
                }),
              },
              {
                path: 'invoices/new',
                lazy: async () => ({
                  Component: (await import('@/features/manager/manager-invoice-editor-page'))
                    .ManagerInvoiceEditor,
                }),
              },
              {
                path: 'invoices/:invoiceId',
                lazy: async () => ({
                  Component: (await import('@/features/manager/manager-invoice-detail-page'))
                    .ManagerInvoiceDetail,
                }),
              },
              {
                path: 'invoices/:invoiceId/edit',
                lazy: async () => ({
                  Component: (await import('@/features/manager/manager-invoice-editor-page'))
                    .ManagerInvoiceEditor,
                }),
              },
              {
                path: 'payments',
                lazy: async () => ({
                  Component: (await import('@/features/manager/manager-payments-page'))
                    .ManagerPayments,
                }),
              },
              {
                path: 'payments/:paymentId',
                lazy: async () => ({
                  Component: (await import('@/features/manager/manager-payment-detail-page'))
                    .ManagerPaymentDetail,
                }),
              },
              {
                path: 'debts',
                lazy: async () => ({
                  Component: (await import('@/features/manager/manager-debts-page')).ManagerDebts,
                }),
              },
              {
                path: 'settings/zalo',
                lazy: async () => ({
                  Component: (await import('@/features/manager/manager-zalo-settings-page'))
                    .ManagerZaloSettings,
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
                  Component: (await import('@/features/tenant/tenant-dashboard-page'))
                    .TenantDashboard,
                }),
              },
              {
                path: 'my-room',
                lazy: async () => ({
                  Component: (await import('@/features/tenant/my-room-page')).MyRoomPage,
                }),
              },
              {
                path: 'contracts',
                lazy: async () => ({
                  Component: (await import('@/features/tenant/contracts-page')).ContractsPage,
                }),
              },
              {
                path: 'contracts/:contractId',
                lazy: async () => ({
                  Component: (await import('@/features/tenant/contract-detail-page'))
                    .ContractDetailPage,
                }),
              },
              {
                path: 'contracts/:contractId/my-terms',
                lazy: async () => ({
                  Component: (await import('@/features/tenant/my-terms-page')).MyTermsPage,
                }),
              },
              {
                path: 'invoices',
                lazy: async () => ({
                  Component: (await import('@/features/tenant/invoices-page')).InvoicesPage,
                }),
              },
              {
                path: 'invoices/:invoiceId',
                lazy: async () => ({
                  Component: (await import('@/features/tenant/invoice-detail-page'))
                    .InvoiceDetailPage,
                }),
              },
              {
                path: 'payments',
                lazy: async () => ({
                  Component: (await import('@/features/tenant/payments-page')).PaymentsPage,
                }),
              },
              {
                path: 'services',
                lazy: async () => ({
                  Component: (await import('@/features/tenant/services-page')).ServicesPage,
                }),
              },
              {
                path: 'utilities',
                lazy: async () => ({
                  Component: (await import('@/features/tenant/utilities-page')).UtilitiesPage,
                }),
              },
              {
                path: 'utilities/allocations',
                lazy: async () => ({
                  Component: (await import('@/features/tenant/allocations-page')).AllocationsPage,
                }),
              },
              {
                path: 'maintenance',
                lazy: async () => ({
                  Component: (await import('@/features/tenant/maintenance-page')).MaintenancePage,
                }),
              },
              {
                path: 'maintenance/new',
                lazy: async () => ({
                  Component: (await import('@/features/tenant/create-maintenance-page'))
                    .CreateMaintenancePage,
                }),
              },
              {
                path: 'maintenance/:reportId',
                lazy: async () => ({
                  Component: (await import('@/features/tenant/maintenance-detail-page'))
                    .MaintenanceDetailPage,
                }),
              },
            ],
          },
          {
            path: 'rooms/:roomId/appointments/new',
            lazy: async () => ({
              Component: (await import('@/features/leasing/create-appointment-page'))
                .CreateAppointmentPage,
            }),
          },
          {
            path: 'rooms/:roomId/bookings/new',
            lazy: async () => ({
              Component: (await import('@/features/leasing/create-booking-page')).CreateBookingPage,
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
                path: 'user/bookings',
                lazy: async () => ({
                  Component: (await import('@/features/leasing/bookings-page')).BookingsPage,
                }),
              },
              {
                path: 'user/bookings/:bookingId',
                lazy: async () => ({
                  Component: (await import('@/features/leasing/booking-detail-page'))
                    .BookingDetailPage,
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
        lazy: async () => ({ Component: (await import('@/features/auth/login-page')).LoginPage }),
      },
      {
        path: 'register',
        lazy: async () => ({
          Component: (await import('@/features/auth/register-page')).RegisterPage,
        }),
      },
      {
        path: 'verify-email',
        lazy: async () => ({
          Component: (await import('@/features/auth/verify-email-page')).VerifyEmailPage,
        }),
      },
      {
        path: 'forgot-password',
        lazy: async () => ({
          Component: (await import('@/features/auth/forgot-password-page')).ForgotPasswordPage,
        }),
      },
      {
        path: 'reset-password',
        lazy: async () => ({
          Component: (await import('@/features/auth/reset-password-page')).ResetPasswordPage,
        }),
      },
    ],
  },
])
