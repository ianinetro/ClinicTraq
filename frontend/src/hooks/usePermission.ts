import { useAuthStore } from '../stores/authStore'

/**
 * Returns true if the current user has the given permission code.
 * Superusers always get true.
 */
export function usePermission(permission: string): boolean {
  return useAuthStore(s => s.hasPermission(permission))
}

/**
 * Returns true if the user has ALL of the given permissions.
 */
export function useAllPermissions(...permissions: string[]): boolean {
  const has = useAuthStore(s => s.hasPermission)
  return permissions.every(p => has(p))
}

/**
 * Returns true if the user has ANY of the given permissions.
 */
export function useAnyPermission(...permissions: string[]): boolean {
  const has = useAuthStore(s => s.hasPermission)
  return permissions.some(p => has(p))
}

// Permission code constants for use in components
export const PERMS = {
  // Patients
  PATIENTS_VIEW: 'patients:view',
  PATIENTS_CREATE: 'patients:create',
  PATIENTS_EDIT_DEMOGRAPHICS: 'patients:edit_demographics',
  PATIENTS_EDIT_INSURANCE: 'patients:edit_insurance',
  PATIENTS_VIEW_PHI: 'patients:view_phi',

  // Scheduling
  SCHEDULE_VIEW: 'schedule:view',
  SCHEDULE_BOOK: 'schedule:book',
  SCHEDULE_MANAGE: 'schedule:manage',

  // Clinical
  CLINICAL_ROOM_PATIENT: 'clinical:room_patient',
  CLINICAL_VIEW_NOTES: 'clinical:view_notes',
  CLINICAL_DRAFT_NOTES: 'clinical:draft_notes',
  CLINICAL_SIGN_NOTES: 'clinical:sign_notes',
  CLINICAL_PLACE_ORDERS: 'clinical:place_orders',
  CLINICAL_SIGN_ORDERS: 'clinical:sign_orders',
  CLINICAL_PRESCRIBE: 'clinical:prescribe',
  CLINICAL_BODY_MAP: 'clinical:body_map',

  // Billing
  BILLING_VIEW_CHARGES: 'billing:view_charges',
  BILLING_ENTER_CHARGES: 'billing:enter_charges',
  BILLING_VIEW_CLAIMS: 'billing:view_claims',
  BILLING_SUBMIT_CLAIMS: 'billing:submit_claims',
  BILLING_POST_PAYMENTS: 'billing:post_payments',
  BILLING_WRITE_OFF: 'billing:write_off',
  BILLING_WORK_DENIALS: 'billing:work_denials',
  BILLING_FILE_APPEALS: 'billing:file_appeals',
  BILLING_VIEW_AR: 'billing:view_ar',
  BILLING_VIEW_ERA: 'billing:view_era',
  BILLING_IMPORT_ERA: 'billing:import_era',
  BILLING_PATIENT_PAYMENTS: 'billing:patient_payments',

  // Eligibility
  ELIGIBILITY_CHECK: 'eligibility:check',

  // Settings
  SETTINGS_VIEW: 'settings:view',
  SETTINGS_EDIT_PRACTICE: 'settings:edit_practice',
  SETTINGS_MANAGE_USERS: 'settings:manage_users',
  SETTINGS_MANAGE_PROVIDERS: 'settings:manage_providers',
  SETTINGS_MANAGE_PAYERS: 'settings:manage_payers',

  // Org
  ORG_VIEW_CLINICS: 'org:view_clinics',
  ORG_MANAGE_CLINICS: 'org:manage_clinics',
  ORG_VIEW_BILLING_COMPANIES: 'org:view_billing_companies',
  ORG_MANAGE_BILLING_COMPANIES: 'org:manage_billing_companies',
  ORG_VIEW_MANAGEMENT_GROUPS: 'org:view_management_groups',
  ORG_MANAGE_MANAGEMENT_GROUPS: 'org:manage_management_groups',

  // Reports
  REPORTS_BILLING: 'reports:billing',
  REPORTS_OPERATIONAL: 'reports:operational',
} as const
