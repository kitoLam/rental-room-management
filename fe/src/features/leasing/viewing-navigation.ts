export function hasViewingManagementRole(roles: readonly string[]) {
  return roles.some((role) => role === 'OWNER' || role === 'MANAGER')
}

export function viewingAppointmentsPath(
  roles: readonly string[],
  options: { branchId?: string | null; appointmentId?: string; search?: URLSearchParams } = {},
) {
  const management = hasViewingManagementRole(roles)
  const base = management ? '/manager/appointments' : '/user/appointments'
  const path = options.appointmentId ? `${base}/${options.appointmentId}` : base
  const search = new URLSearchParams(options.search)
  if (management && options.branchId) search.set('branchId', options.branchId)
  else search.delete('branchId')
  const query = search.toString()
  return query ? `${path}?${query}` : path
}
