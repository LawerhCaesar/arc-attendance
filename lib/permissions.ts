export const BUILTIN_ROLES = ['admin', 'pastor', 'attendance', 'fellowship_leader', 'welfare', 'first_timers'] as const;
export type BuiltinRole = typeof BUILTIN_ROLES[number];

export const TAB_OPTIONS = [
  { id: 'overview', label: 'Overview', description: 'Church-wide attendance, care alerts and member insights' },
  { id: 'past-entry', label: 'Past Entry', description: 'Record and correct past attendance; import roster data' },
  { id: 'past-sundays', label: 'Past Sundays', description: 'View service attendance history' },
  { id: 'absenteeism', label: 'Absenteeism', description: 'View member attendance and absence history' },
  { id: 'demographics', label: 'Birthdays', description: 'View member location and birthday summaries' },
  { id: 'first-timers', label: 'First Timers', description: 'View and manage visitor progression' },
  { id: 'fellowship-services', label: 'By Fellowship', description: 'View fellowship attendance reports' },
  { id: 'members', label: 'Member Roster', description: 'View, add, edit, import and remove roster members' },
  { id: 'raw-data', label: 'Raw Data', description: 'View and export attendance records' },
  { id: 'welfare', label: 'Welfare / Birthdays', description: 'View birthday lists and outreach information' },
  { id: 'entry', label: 'Attendance Staff Tools', description: 'View attendance history and correct attendance on the public check-in page' },
] as const;
export type Permission = typeof TAB_OPTIONS[number]['id'] | 'users';
export const ALL_PERMISSIONS: Permission[] = [...TAB_OPTIONS.map(tab => tab.id), 'users'];
export const DEFAULT_PERMISSIONS: Record<BuiltinRole, Permission[]> = {
  admin: ALL_PERMISSIONS,
  pastor: TAB_OPTIONS.map(tab => tab.id),
  attendance: ['entry', 'past-entry'],
  fellowship_leader: ['entry'],
  welfare: ['welfare'],
  first_timers: ['first-timers'],
};

export interface PermissionContext { role: string; permissions: readonly string[] }
export function canAccess(context: PermissionContext | null, ...permissions: Permission[]): boolean {
  return Boolean(context && permissions.some(permission => context.permissions.includes(permission)));
}
export function homeForPermissions(context: PermissionContext): string {
  if (context.permissions.some(permission => permission !== 'entry')) return '/admin';
  return '/entry';
}
export const ATTENDANCE_READ_PERMISSIONS: Permission[] = ['entry', 'past-entry', 'past-sundays', 'absenteeism', 'raw-data'];

export function validateRolePermissions(value: unknown): Permission[] {
  if (!Array.isArray(value) || !value.length || value.some(item => !TAB_OPTIONS.some(tab => tab.id === item))) {
    throw new Error('Choose at least one valid tab. Account administration is reserved for administrators.');
  }
  return Array.from(new Set(value)) as Permission[];
}

export function validateNewPassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < 12 || new TextEncoder().encode(value).length > 72) {
    throw new Error('Use a password of at least 12 characters and no more than 72 bytes.');
  }
  return value;
}
