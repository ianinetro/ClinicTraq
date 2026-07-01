import { useAuthStore } from '../stores/authStore'

/**
 * Returns role-based permission flags derived from the authenticated user's
 * global role. Components should gate UI elements on these flags rather than
 * comparing role strings directly so that permission logic stays in one place.
 */
export function useRole() {
  const user = useAuthStore((s) => s.user)
  // Fall back to the most-restrictive role when no user is loaded yet.
  const role: string = user?.role ?? 'read_only'

  return {
    role,
    /** Can access billing workflows (claims, ERA, fee schedules). */
    canBill: ['billing_admin', 'billing_member', 'payment_poster', 'admin'].includes(role),
    /** Can post and reconcile payments. */
    canPostPayments: ['billing_admin', 'payment_poster', 'admin'].includes(role),
    /** Can access org-level settings and user management. */
    canManageSettings: ['billing_admin', 'admin', 'practice_admin'].includes(role),
    /** Can create and submit claims to a clearinghouse. */
    canSubmitClaims: ['billing_admin', 'billing_member', 'admin'].includes(role),
    /** User has no write access — view-only throughout the app. */
    canViewOnly: role === 'read_only',
    /** Has administrative privileges (user management, audit log, etc.). */
    isAdmin: ['billing_admin', 'admin'].includes(role),
  }
}
