export interface Patient {
  id: string
  accountNumber: string
  firstName: string
  lastName: string
  dateOfBirth: string
  ssn?: string
  gender: 'M' | 'F' | 'O' | 'U'
  email?: string
  phone?: string
  address?: Address
  status: 'active' | 'inactive' | 'archived'
  primaryProviderId?: string
  practiceId: string
  createdAt: string
  updatedAt: string
}

export interface Address {
  line1: string
  line2?: string
  city: string
  state: string
  zip: string
  country?: string
}

export interface PatientInsurance {
  id: string
  patientId: string
  payerId: string
  payerName: string
  memberId: string
  groupNumber?: string
  planName?: string
  relationshipToInsured: string
  insuredFirstName?: string
  insuredLastName?: string
  insuredDOB?: string
  priority: 'primary' | 'secondary' | 'tertiary'
  effectiveDate?: string
  terminationDate?: string
  copay?: number
  deductible?: number
  deductibleMet?: number
  outOfPocketMax?: number
  outOfPocketMet?: number
}

export interface Provider {
  id: string
  npi: string
  firstName: string
  lastName: string
  credentials?: string
  specialtyCode?: string
  specialtyDescription?: string
  taxId?: string
  taxonomy?: string
  type: 'rendering' | 'billing' | 'referring' | 'supervising'
  status: 'active' | 'inactive'
}

export interface Facility {
  id: string
  name: string
  npi?: string
  address: Address
  pos: string
  status: 'active' | 'inactive'
}

export interface Visit {
  id: string
  patientId: string
  patient?: Patient
  providerId: string
  provider?: Provider
  facilityId?: string
  facility?: Facility
  visitDate: string
  visitType: string
  pos: string
  status: 'scheduled' | 'checked-in' | 'in-progress' | 'completed' | 'cancelled' | 'no-show'
  diagnoses: Diagnosis[]
  chargeLines: ChargeLine[]
  totalCharges: number
  claimId?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface Diagnosis {
  id: string
  code: string
  description: string
  pointer: string
  isPrimary: boolean
}

export interface ChargeLine {
  id: string
  seq: number
  dosFrom: string
  dosTo: string
  pos: string
  cptCode: string
  cptDescription: string
  modifiers: string[]
  dxPointers: string[]
  charge: number
  units: number
  balance: number
}

export type ClaimStatus =
  | 'draft'
  | 'validation-failed'
  | 'ready'
  | 'submitted'
  | 'acknowledged'
  | 'pending'
  | 'paid'
  | 'denied'
  | 'rejected'
  | 'appealed'
  | 'void'

export interface Claim {
  id: string
  claimNumber: string
  patientId: string
  patient?: Patient
  visitId: string
  visit?: Visit
  payerId: string
  payerName: string
  renderingProviderId: string
  billingProviderId: string
  dos: string
  totalCharges: number
  totalPaid: number
  balance: number
  status: ClaimStatus
  validationStatus: 'passed' | 'warnings' | 'failed' | 'unchecked'
  validationErrors: ValidationError[]
  submittedAt?: string
  adjudicatedAt?: string
  claimLines: ClaimLine[]
  createdAt: string
  updatedAt: string
}

export interface ClaimLine {
  id: string
  seq: number
  cptCode: string
  cptDescription: string
  modifiers: string[]
  dxPointers: string[]
  dosFrom: string
  dosTo: string
  pos: string
  charge: number
  units: number
  paid?: number
  adjustment?: number
  balance?: number
  status?: string
}

export interface ValidationError {
  id: string
  field?: string
  code: string
  message: string
  severity: 'error' | 'warning'
  suggestion?: string
}

export interface Payment {
  id: string
  paymentNumber: string
  payerId?: string
  payerName?: string
  patientId?: string
  checkNumber?: string
  checkDate?: string
  amount: number
  appliedAmount: number
  unappliedAmount: number
  paymentMethod: 'check' | 'eft' | 'credit-card' | 'cash' | 'other'
  status: 'unapplied' | 'partial' | 'applied' | 'reconciled' | 'void'
  eraFileId?: string
  receivedDate: string
  createdAt: string
}

export interface ERAFile {
  id: string
  filename: string
  payerId: string
  payerName: string
  checkNumber?: string
  checkDate?: string
  totalAmount: number
  matchedCount: number
  unmatchedCount: number
  status: 'pending' | 'reviewed' | 'posted'
  importedAt: string
  claimPayments: ERAClaimPayment[]
}

export interface ERAClaimPayment {
  id: string
  eraFileId: string
  claimNumber: string
  patientName: string
  dos: string
  billedAmount: number
  paidAmount: number
  adjustments: ERAdjustment[]
  matchedClaimId?: string
  matchConfidence?: number
  status: 'matched' | 'unmatched' | 'posted' | 'skipped'
}

export interface ERAdjustment {
  groupCode: string
  reasonCode: string
  description: string
  amount: number
}

export type WorkItemType =
  | 'visit-missing-insurance'
  | 'visit-charges-no-claim'
  | 'claim-validation-failed'
  | 'claim-rejected'
  | 'claim-denied'
  | 'era-unmatched'
  | 'payment-unapplied'
  | 'secondary-claim-needed'
  | 'no-payer-response'
  | 'patient-balance-remaining'
  | 'near-tfl'
  | 'stale-claim'
  | 'missing-superbill'

export interface WorkItem {
  id: string
  type: WorkItemType
  priority: 'critical' | 'high' | 'medium' | 'low'
  patientId: string
  patient?: Patient
  visitId?: string
  claimId?: string
  payerId?: string
  payerName?: string
  amount?: number
  ageInDays: number
  status: 'open' | 'in-progress' | 'snoozed' | 'resolved'
  assignedTo?: string
  snoozeUntil?: string
  nextAction?: string
  description: string
  createdAt: string
  updatedAt: string
}

export interface WorkQueueSummary {
  visitMissingInsurance: number
  visitChargesNoClaim: number
  claimValidationFailed: number
  claimRejected: number
  claimDenied: number
  eraUnmatched: number
  paymentUnapplied: number
  secondaryClaimNeeded: number
  noPay: number
  patientBalance: number
  nearTfl: number
  staleClaim: number
  missingSuperBill: number
}

export interface AuditEvent {
  id: string
  entityType: string
  entityId: string
  action: string
  performedBy: string
  performedAt: string
  changes?: Record<string, { before: unknown; after: unknown }>
  metadata?: Record<string, unknown>
}

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  permissions: string[]
  practiceId: string
  avatarUrl?: string
}

export interface Payer {
  id: string
  name: string
  payerId: string
  type: 'commercial' | 'medicare' | 'medicaid' | 'tricare' | 'workers-comp' | 'other'
  address?: Address
  phone?: string
  tflDays: number
  status: 'active' | 'inactive'
}

export interface CPTCode {
  code: string
  description: string
  category?: string
  defaultUnits?: number
  defaultCharge?: number
}

export interface ICD10Code {
  code: string
  description: string
  category?: string
}

export interface BodyAnnotation {
  id: string
  patientId: string
  region: string
  view: 'front' | 'back'
  type: 'note' | 'symptom' | 'finding' | 'diagnosis'
  text: string
  severity?: 'mild' | 'moderate' | 'severe'
  icd10Code?: string
  icd10Description?: string
  createdBy: string
  createdAt: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ApiError {
  message: string
  code?: string
  details?: Record<string, string[]>
}
