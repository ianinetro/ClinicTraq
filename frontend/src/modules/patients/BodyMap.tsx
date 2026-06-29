import { useState, useEffect } from 'react'
import { Plus, X, Search } from 'lucide-react'
import { clsx } from 'clsx'
import { apiClient } from '../../services/api'

// ─── Types ───────────────────────────────────────────────────────────────────

interface BodyMapProps {
  patientId: string
  sex?: 'male' | 'female' | 'other' | string
  visits?: Array<{
    id: string
    visitDate?: string
    diagnoses?: Array<{ icd10Code?: string; diagnosis_code?: string; description?: string }>
  }>
  compact?: boolean
}

type AnnotationType = 'note' | 'symptom' | 'finding' | 'diagnosis'
type SeverityType = 'mild' | 'moderate' | 'severe'

interface LocalAnnotation {
  id: string
  region: string
  type: AnnotationType
  text: string
  severity?: SeverityType
  icd10Code?: string
  icd10Description?: string
}

interface Icd10Result {
  code: string
  description: string
}

interface VisitWithDate {
  id: string
  visitDate?: string
  diagnoses?: Array<{ icd10Code?: string; diagnosis_code?: string; description?: string }>
}

// ─── Common ICD-10 Quick Picks ───────────────────────────────────────────────

const QUICK_ICD10: Icd10Result[] = [
  { code: 'M54.5', description: 'Low back pain' },
  { code: 'M25.511', description: 'Pain in right shoulder' },
  { code: 'M54.2', description: 'Cervicalgia (neck pain)' },
  { code: 'R51', description: 'Headache' },
  { code: 'M79.3', description: 'Panniculitis' },
  { code: 'M79.1', description: 'Myalgia' },
]

// ─── ICD-10 → Body Region Mapping ────────────────────────────────────────────

const ICD10_REGION_MAP: Array<{ pattern: RegExp; regions: string[] }> = [
  { pattern: /^[GRH][0-9]|^R51|^G43|^H6/, regions: ['head-front', 'head-back'] },
  { pattern: /^M54\.[23]|^S1[34]/, regions: ['neck-front', 'neck-back'] },
  { pattern: /^[IJ]|^R07|^S2[0-9]/, regions: ['chest-left', 'chest-right', 'upper-back'] },
  { pattern: /^K[0-9]|^R10$|^R10\.[012]/, regions: ['abdomen-upper'] },
  { pattern: /^N[0-9]|^R10\.[34]/, regions: ['abdomen-lower'] },
  { pattern: /^M54\.5|^M54\.4|^S32|^M47|^M48|^M51/, regions: ['lower-back'] },
  { pattern: /^M25\.51[12]|^M75|^S41|^S42/, regions: ['shoulder-left', 'shoulder-back-left'] },
  { pattern: /^M25\.511|^M25\.51[45]|^S40/, regions: ['shoulder-right', 'shoulder-back-right'] },
  { pattern: /^S41|^S42|^M65\.2/, regions: ['arm-left', 'arm-back-left'] },
  { pattern: /^S40|^S42/, regions: ['arm-right', 'arm-back-right'] },
  { pattern: /^M17|^M25\.56|^S80|^S82/, regions: ['knee-left', 'knee-right'] },
  { pattern: /^M16|^M25\.55|^S70|^S72/, regions: ['hip-left', 'hip-right'] },
  { pattern: /^M20|^M79\.67|^S90|^S92/, regions: ['foot-left', 'foot-right', 'foot-back-left', 'foot-back-right'] },
]

function icdCodesToRegions(code: string): string[] {
  for (const entry of ICD10_REGION_MAP) {
    if (entry.pattern.test(code)) return entry.regions
  }
  return []
}

// ─── Visit Marker Color ───────────────────────────────────────────────────────

type MarkerType = 'recent' | 'month' | 'past' | 'annotated'

function visitMarkerType(visitDate?: string): MarkerType {
  if (!visitDate) return 'past'
  const days = (Date.now() - new Date(visitDate).getTime()) / 86_400_000
  if (days <= 7) return 'recent'
  if (days <= 30) return 'month'
  return 'past'
}

const MARKER_COLORS: Record<MarkerType, string> = {
  recent: '#DC2626',
  month: '#D97706',
  past: '#16A34A',
  annotated: '#0410BD',
}

// ─── Body Regions ─────────────────────────────────────────────────────────────

interface BodyRegion {
  id: string
  label: string
  view: 'front' | 'back'
  dotX: number
  dotY: number
  d: string
}

// All paths use viewBox 0 0 160 400 (centered at x=100, but we'll use x=80 center for 160-wide)
// Regions are centered around x=80

const FRONT_REGIONS: BodyRegion[] = [
  {
    id: 'head-front', label: 'Head', view: 'front',
    dotX: 80, dotY: 28,
    d: 'M80,12 C101,12 116,27 116,46 C116,65 101,80 80,80 C59,80 44,65 44,46 C44,27 59,12 80,12 Z',
  },
  {
    id: 'neck-front', label: 'Neck', view: 'front',
    dotX: 80, dotY: 90,
    d: 'M69,80 L91,80 L93,102 L67,102 Z',
  },
  {
    id: 'shoulder-left', label: 'Left Shoulder', view: 'front',
    dotX: 38, dotY: 112,
    d: 'M54,102 C52,100 46,98 36,98 C26,98 16,104 14,114 C12,124 16,134 24,136 C30,138 38,136 44,132 L44,102 Z',
  },
  {
    id: 'shoulder-right', label: 'Right Shoulder', view: 'front',
    dotX: 122, dotY: 112,
    d: 'M106,102 C108,100 114,98 124,98 C134,98 144,104 146,114 C148,124 144,134 136,136 C130,138 122,136 116,132 L116,102 Z',
  },
  {
    id: 'chest-left', label: 'Chest Left', view: 'front',
    dotX: 66, dotY: 126,
    d: 'M54,102 L80,102 L80,154 L54,150 C50,140 49,122 54,102 Z',
  },
  {
    id: 'chest-right', label: 'Chest Right', view: 'front',
    dotX: 94, dotY: 126,
    d: 'M80,102 L106,102 C111,122 110,140 106,150 L80,154 Z',
  },
  {
    id: 'abdomen-upper', label: 'Upper Abdomen', view: 'front',
    dotX: 80, dotY: 166,
    d: 'M54,150 L80,154 L106,150 L108,180 L52,180 Z',
  },
  {
    id: 'abdomen-lower', label: 'Lower Abdomen', view: 'front',
    dotX: 80, dotY: 196,
    d: 'M52,180 L108,180 L106,210 L54,210 Z',
  },
  {
    id: 'hip-left', label: 'Left Hip', view: 'front',
    dotX: 62, dotY: 224,
    d: 'M54,210 L80,210 L78,240 L48,244 C44,234 45,220 54,210 Z',
  },
  {
    id: 'hip-right', label: 'Right Hip', view: 'front',
    dotX: 98, dotY: 224,
    d: 'M80,210 L106,210 C115,220 116,234 112,244 L82,240 Z',
  },
  {
    id: 'arm-left', label: 'Left Upper Arm', view: 'front',
    dotX: 28, dotY: 158,
    d: 'M44,132 C38,134 32,136 28,136 L20,184 C18,194 18,208 22,218 L36,218 L36,132 Z',
  },
  {
    id: 'arm-right', label: 'Right Upper Arm', view: 'front',
    dotX: 132, dotY: 158,
    d: 'M116,132 C122,134 128,136 132,136 L140,184 C142,194 142,208 138,218 L124,218 L124,132 Z',
  },
  {
    id: 'forearm-left', label: 'Left Forearm', view: 'front',
    dotX: 24, dotY: 242,
    d: 'M22,218 L36,218 L38,266 C36,272 30,276 24,274 C18,272 14,264 16,258 Z',
  },
  {
    id: 'forearm-right', label: 'Right Forearm', view: 'front',
    dotX: 136, dotY: 242,
    d: 'M138,218 L124,218 L122,266 C124,272 130,276 136,274 C142,272 146,264 144,258 Z',
  },
  {
    id: 'hand-left', label: 'Left Hand', view: 'front',
    dotX: 24, dotY: 286,
    d: 'M24,274 C20,276 16,282 16,290 C16,298 20,306 26,308 C32,310 38,306 40,298 C42,290 40,280 38,266 C32,272 26,274 24,274 Z',
  },
  {
    id: 'hand-right', label: 'Right Hand', view: 'front',
    dotX: 136, dotY: 286,
    d: 'M136,274 C140,276 144,282 144,290 C144,298 140,306 134,308 C128,310 122,306 120,298 C118,290 120,280 122,266 C128,272 134,276 136,274 Z',
  },
  {
    id: 'thigh-left', label: 'Left Thigh', view: 'front',
    dotX: 62, dotY: 284,
    d: 'M48,244 L78,240 L76,326 L50,326 C44,308 44,270 48,244 Z',
  },
  {
    id: 'thigh-right', label: 'Right Thigh', view: 'front',
    dotX: 98, dotY: 284,
    d: 'M82,240 L112,244 C116,270 116,308 110,326 L84,326 Z',
  },
  {
    id: 'knee-left', label: 'Left Knee', view: 'front',
    dotX: 63, dotY: 338,
    d: 'M50,326 L76,326 L75,354 L51,354 Z',
  },
  {
    id: 'knee-right', label: 'Right Knee', view: 'front',
    dotX: 97, dotY: 338,
    d: 'M84,326 L110,326 L109,354 L85,354 Z',
  },
  {
    id: 'lower-leg-left', label: 'Left Lower Leg', view: 'front',
    dotX: 62, dotY: 375,
    d: 'M51,354 L75,354 L74,396 L52,396 Z',
  },
  {
    id: 'lower-leg-right', label: 'Right Lower Leg', view: 'front',
    dotX: 98, dotY: 375,
    d: 'M85,354 L109,354 L108,396 L86,396 Z',
  },
  {
    id: 'foot-left', label: 'Left Foot', view: 'front',
    dotX: 61, dotY: 406,
    d: 'M52,396 L74,396 C73,403 70,408 64,409 C56,409 50,405 50,400 Z',
  },
  {
    id: 'foot-right', label: 'Right Foot', view: 'front',
    dotX: 99, dotY: 406,
    d: 'M86,396 L108,396 L110,400 C110,405 104,409 96,409 C90,408 87,403 86,396 Z',
  },
]

const BACK_REGIONS: BodyRegion[] = [
  {
    id: 'head-back', label: 'Head (Back)', view: 'back',
    dotX: 80, dotY: 28,
    d: 'M80,12 C101,12 116,27 116,46 C116,65 101,80 80,80 C59,80 44,65 44,46 C44,27 59,12 80,12 Z',
  },
  {
    id: 'neck-back', label: 'Neck (Back)', view: 'back',
    dotX: 80, dotY: 90,
    d: 'M69,80 L91,80 L93,102 L67,102 Z',
  },
  {
    id: 'shoulder-back-left', label: 'Left Shoulder (Back)', view: 'back',
    dotX: 38, dotY: 112,
    d: 'M54,102 C52,100 46,98 36,98 C26,98 16,104 14,114 C12,124 16,134 24,136 C30,138 38,136 44,132 L44,102 Z',
  },
  {
    id: 'shoulder-back-right', label: 'Right Shoulder (Back)', view: 'back',
    dotX: 122, dotY: 112,
    d: 'M106,102 C108,100 114,98 124,98 C134,98 144,104 146,114 C148,124 144,134 136,136 C130,138 122,136 116,132 L116,102 Z',
  },
  {
    id: 'upper-back', label: 'Upper Back', view: 'back',
    dotX: 80, dotY: 130,
    d: 'M54,102 L106,102 C110,114 111,144 106,154 L54,154 C49,144 50,114 54,102 Z',
  },
  {
    id: 'lower-back', label: 'Lower Back', view: 'back',
    dotX: 80, dotY: 174,
    d: 'M54,154 L106,154 L106,197 L54,197 Z',
  },
  {
    id: 'arm-back-left', label: 'Left Arm (Back)', view: 'back',
    dotX: 27, dotY: 174,
    d: 'M44,132 C38,134 32,136 28,136 L18,186 C16,198 16,218 22,230 L36,230 L36,132 Z',
  },
  {
    id: 'arm-back-right', label: 'Right Arm (Back)', view: 'back',
    dotX: 133, dotY: 174,
    d: 'M116,132 C122,134 128,136 132,136 L142,186 C144,198 144,218 138,230 L124,230 L124,132 Z',
  },
  {
    id: 'buttock-left', label: 'Left Buttock', view: 'back',
    dotX: 65, dotY: 218,
    d: 'M54,197 L80,197 L78,244 L48,248 C43,236 43,212 54,197 Z',
  },
  {
    id: 'buttock-right', label: 'Right Buttock', view: 'back',
    dotX: 95, dotY: 218,
    d: 'M80,197 L106,197 C117,212 117,236 112,248 L82,244 Z',
  },
  {
    id: 'hamstring-left', label: 'Left Hamstring', view: 'back',
    dotX: 63, dotY: 284,
    d: 'M48,248 L78,244 L76,330 L50,330 C44,312 44,272 48,248 Z',
  },
  {
    id: 'hamstring-right', label: 'Right Hamstring', view: 'back',
    dotX: 97, dotY: 284,
    d: 'M82,244 L112,248 C116,272 116,312 110,330 L84,330 Z',
  },
  {
    id: 'calf-left', label: 'Left Calf', view: 'back',
    dotX: 62, dotY: 370,
    d: 'M50,330 L76,330 L75,396 L52,396 Z',
  },
  {
    id: 'calf-right', label: 'Right Calf', view: 'back',
    dotX: 98, dotY: 370,
    d: 'M84,330 L110,330 L108,396 L86,396 Z',
  },
  {
    id: 'foot-back-left', label: 'Left Foot (Back)', view: 'back',
    dotX: 62, dotY: 406,
    d: 'M52,396 L75,396 C74,403 71,408 65,409 C57,409 50,405 50,400 Z',
  },
  {
    id: 'foot-back-right', label: 'Right Foot (Back)', view: 'back',
    dotX: 98, dotY: 406,
    d: 'M86,396 L108,396 L110,400 C110,405 103,409 95,409 C89,408 87,403 86,396 Z',
  },
]

// ─── Male silhouette paths (viewBox 0 0 160 420) ─────────────────────────────
// Broader shoulders (~130px span), narrower hips (~90px), rectangular torso

const MALE_FRONT_SILHOUETTE = `
  M80,12 C101,12 116,27 116,46 C116,65 101,80 80,80 C59,80 44,65 44,46 C44,27 59,12 80,12 Z
  M69,80 L91,80 L93,102 L67,102 Z
  M14,98 C8,104 6,116 8,126 C10,136 18,142 26,140 C32,138 40,134 44,130 L44,102 C36,100 24,96 14,98 Z
  M146,98 C152,104 154,116 152,126 C150,136 142,142 134,140 C128,138 120,134 116,130 L116,102 C124,100 136,96 146,98 Z
  M44,102 L116,102 C118,130 118,160 116,175 L44,175 C42,160 42,130 44,102 Z
  M44,175 L80,178 L116,175 L116,215 L44,215 Z
  M44,215 L80,215 L78,248 L42,248 C38,236 38,222 44,215 Z
  M80,215 L116,215 C122,222 122,236 118,248 L82,248 Z
  M20,134 C14,136 8,138 4,138 L-6,188 C-8,200 -8,216 -4,226 L12,226 L12,134 Z
  M140,134 C146,136 152,138 156,138 L166,188 C168,200 168,216 164,226 L148,226 L148,134 Z
  M-4,226 L12,226 L14,268 C12,274 6,278 0,276 C-6,274 -10,266 -8,260 Z
  M164,226 L148,226 L146,268 C148,274 154,278 160,276 C166,274 170,266 168,260 Z
  M0,276 C-4,278 -8,284 -8,292 C-8,300 -4,308 2,310 C8,312 14,308 16,300 C18,292 16,282 14,268 C8,274 2,278 0,276 Z
  M160,276 C164,278 168,284 168,292 C168,300 164,308 158,310 C152,312 146,308 144,300 C142,292 144,282 146,268 C152,274 158,278 160,276 Z
  M42,248 L78,244 L76,330 L48,330 C42,310 42,272 42,248 Z
  M82,244 L118,248 C118,272 118,310 112,330 L84,330 Z
  M48,330 L76,330 L75,356 L49,356 Z
  M84,330 L112,330 L111,356 L85,356 Z
  M49,356 L75,356 L74,398 L50,398 Z
  M85,356 L111,356 L110,398 L86,398 Z
  M50,398 L74,398 C73,406 70,411 64,412 C56,412 48,408 48,402 Z
  M86,398 L110,398 L112,402 C112,408 104,412 96,412 C90,411 87,406 86,398 Z
`

const MALE_BACK_SILHOUETTE = `
  M80,12 C101,12 116,27 116,46 C116,65 101,80 80,80 C59,80 44,65 44,46 C44,27 59,12 80,12 Z
  M69,80 L91,80 L93,102 L67,102 Z
  M14,98 C8,104 6,116 8,126 C10,136 18,142 26,140 C32,138 40,134 44,130 L44,102 C36,100 24,96 14,98 Z
  M146,98 C152,104 154,116 152,126 C150,136 142,142 134,140 C128,138 120,134 116,130 L116,102 C124,100 136,96 146,98 Z
  M44,102 L116,102 C118,122 118,160 116,175 L44,175 C42,160 42,122 44,102 Z
  M44,175 L116,175 L116,210 L44,210 Z
  M20,134 C14,136 8,138 4,138 L-6,188 C-8,200 -8,218 -4,228 L12,228 L12,134 Z
  M140,134 C146,136 152,138 156,138 L166,188 C168,200 168,218 164,228 L148,228 L148,134 Z
  M44,210 L80,210 L78,248 L42,248 C38,236 38,220 44,210 Z
  M80,210 L116,210 C122,220 122,236 118,248 L82,248 Z
  M42,248 L78,244 L76,330 L48,330 C42,310 42,270 42,248 Z
  M82,244 L118,248 C118,270 118,310 112,330 L84,330 Z
  M48,330 L76,330 L75,398 L50,398 Z
  M84,330 L112,330 L110,398 L86,398 Z
  M50,398 L74,398 C73,406 70,411 64,412 C56,412 48,408 48,402 Z
  M86,398 L110,398 L112,402 C112,408 104,412 96,412 C90,411 87,406 86,398 Z
`

// ─── Female silhouette paths — narrower shoulders, defined waist, wider hips ──

const FEMALE_FRONT_SILHOUETTE = `
  M80,12 C100,12 114,27 114,46 C114,65 100,80 80,80 C60,80 46,65 46,46 C46,27 60,12 80,12 Z
  M70,80 L90,80 L92,102 L68,102 Z
  M24,100 C18,106 16,118 18,128 C20,138 28,144 36,142 C40,140 46,136 48,132 L48,102 C40,100 30,98 24,100 Z
  M136,100 C142,106 144,118 142,128 C140,138 132,144 124,142 C120,140 114,136 112,132 L112,102 C120,100 130,98 136,100 Z
  M48,102 L80,102 L80,140 C80,148 74,160 68,168 L52,172 C48,156 47,130 48,102 Z
  M80,102 L112,102 C113,130 112,156 108,172 L92,168 C86,160 80,148 80,140 Z
  M52,172 L68,168 L80,172 L92,168 L108,172 L110,196 L50,196 Z
  M50,196 L110,196 L108,216 L52,216 Z
  M52,216 L80,216 L78,252 L42,258 C36,244 37,226 52,216 Z
  M80,216 L108,216 C123,226 124,244 118,258 L82,252 Z
  M26,136 C20,138 14,140 10,140 L2,190 C0,202 0,218 4,228 L18,228 L18,136 Z
  M134,136 C140,138 146,140 150,140 L158,190 C160,202 160,218 156,228 L142,228 L142,136 Z
  M4,228 L18,228 L20,270 C18,276 12,280 6,278 C0,276 -4,268 -2,262 Z
  M156,228 L142,228 L140,270 C142,276 148,280 154,278 C160,276 164,268 162,262 Z
  M6,278 C2,280 -2,286 -2,294 C-2,302 2,310 8,312 C14,314 20,310 22,302 C24,294 22,284 20,270 C14,276 8,280 6,278 Z
  M154,278 C158,280 162,286 162,294 C162,302 158,310 152,312 C146,314 140,310 138,302 C136,294 138,284 140,270 C146,276 152,280 154,278 Z
  M42,258 L78,252 L76,330 L46,330 C40,310 40,280 42,258 Z
  M82,252 L118,258 C120,280 120,310 114,330 L84,330 Z
  M46,330 L76,330 L75,356 L47,356 Z
  M84,330 L114,330 L113,356 L85,356 Z
  M47,356 L75,356 L74,398 L48,398 Z
  M85,356 L113,356 L112,398 L86,398 Z
  M48,398 L74,398 C73,406 70,411 64,412 C56,412 48,408 48,402 Z
  M86,398 L112,398 L114,402 C114,408 106,412 98,412 C92,411 87,406 86,398 Z
`

const FEMALE_BACK_SILHOUETTE = `
  M80,12 C100,12 114,27 114,46 C114,65 100,80 80,80 C60,80 46,65 46,46 C46,27 60,12 80,12 Z
  M70,80 L90,80 L92,102 L68,102 Z
  M24,100 C18,106 16,118 18,128 C20,138 28,144 36,142 C40,140 46,136 48,132 L48,102 C40,100 30,98 24,100 Z
  M136,100 C142,106 144,118 142,128 C140,138 132,144 124,142 C120,140 114,136 112,132 L112,102 C120,100 130,98 136,100 Z
  M48,102 L112,102 C114,122 114,160 112,175 L48,175 C46,160 46,122 48,102 Z
  M48,175 L112,175 L112,210 L48,210 Z
  M26,136 C20,138 14,140 10,140 L2,190 C0,202 0,218 4,228 L18,228 L18,136 Z
  M134,136 C140,138 146,140 150,140 L158,190 C160,202 160,218 156,228 L142,228 L142,136 Z
  M48,210 L80,210 L78,252 L38,258 C32,244 33,222 48,210 Z
  M80,210 L112,210 C127,222 128,244 122,258 L82,252 Z
  M38,258 L78,252 L76,330 L44,330 C38,310 38,278 38,258 Z
  M82,252 L122,258 C122,278 122,310 116,330 L84,330 Z
  M44,330 L76,330 L75,398 L46,398 Z
  M84,330 L116,330 L114,398 L86,398 Z
  M46,398 L75,398 C74,406 71,411 65,412 C57,412 46,408 46,402 Z
  M86,398 L114,398 L116,402 C116,408 108,412 100,412 C94,411 87,406 86,398 Z
`

// ─── ICD-10 Search Hook ───────────────────────────────────────────────────────

function useIcd10Search(query: string) {
  const [results, setResults] = useState<Icd10Result[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([])
      return
    }
    const timeout = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await apiClient.get('/icd10/search', { params: { q: query, limit: 8 } })
        setResults(res.data || [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timeout)
  }, [query])

  return { results, loading }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Returns { regionId → { type, visits } } for visit markers
function buildRegionMarkers(visits: VisitWithDate[] = []) {
  const map: Record<string, { type: MarkerType; visits: VisitWithDate[] }> = {}
  for (const visit of visits) {
    const codes = (visit.diagnoses ?? []).map(d => d.icd10Code ?? d.diagnosis_code ?? '')
    for (const code of codes) {
      if (!code) continue
      const regions = icdCodesToRegions(code)
      for (const regionId of regions) {
        const marker = visitMarkerType(visit.visitDate)
        if (!map[regionId]) {
          map[regionId] = { type: marker, visits: [visit] }
        } else {
          map[regionId].visits.push(visit)
          // Escalate color to most recent
          const order: MarkerType[] = ['recent', 'month', 'past', 'annotated']
          if (order.indexOf(marker) < order.indexOf(map[regionId].type)) {
            map[regionId].type = marker
          }
        }
      }
    }
  }
  return map
}

// ─── SilhouetteLayer ─────────────────────────────────────────────────────────

function SilhouetteLayer({ sex, view }: { sex: string; view: 'front' | 'back' }) {
  const isFemale = sex === 'female'
  const pathData = isFemale
    ? view === 'front' ? FEMALE_FRONT_SILHOUETTE : FEMALE_BACK_SILHOUETTE
    : view === 'front' ? MALE_FRONT_SILHOUETTE : MALE_BACK_SILHOUETTE

  // Split on Z and render as separate paths so each sub-path closes properly
  const subPaths = pathData
    .split('Z')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s + ' Z')

  return (
    <g className="pointer-events-none">
      {subPaths.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="#F2EDE6"
          stroke="#C4A882"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      ))}
    </g>
  )
}

// ─── RegionLayer ─────────────────────────────────────────────────────────────

interface RegionLayerProps {
  regions: BodyRegion[]
  selectedRegion: string | null
  annotations: LocalAnnotation[]
  markerMap: Record<string, { type: MarkerType; visits: VisitWithDate[] }>
  onRegionClick: (region: BodyRegion) => void
}

function RegionLayer({ regions, selectedRegion, annotations, markerMap, onRegionClick }: RegionLayerProps) {
  return (
    <>
      {regions.map(region => {
        const isSelected = selectedRegion === region.id
        const hasAnnotation = annotations.some(a => a.region === region.id)
        const marker = markerMap[region.id]
        const hasMarker = !!marker || hasAnnotation

        const fillColor = isSelected ? '#0410BD'
          : hasMarker ? (marker ? MARKER_COLORS[marker.type] : MARKER_COLORS.annotated)
          : '#0410BD'
        const fillOpacity = isSelected ? 0.4 : hasMarker ? 0.25 : 0
        const strokeColor = isSelected ? '#0410BD' : hasMarker ? fillColor : '#C4A882'
        const strokeOpacity = isSelected ? 1 : hasMarker ? 0.6 : 0.2

        return (
          <g key={region.id}>
            <path
              d={region.d}
              fill={fillColor}
              fillOpacity={fillOpacity}
              stroke={strokeColor}
              strokeWidth={isSelected ? 1.5 : 0.6}
              strokeOpacity={strokeOpacity}
              className="cursor-pointer transition-all duration-100"
              onClick={() => onRegionClick(region)}
              onMouseEnter={e => {
                if (!isSelected) {
                  const el = e.currentTarget as SVGPathElement
                  el.style.fillOpacity = '0.22'
                  el.style.strokeOpacity = '0.5'
                }
              }}
              onMouseLeave={e => {
                if (!isSelected) {
                  const el = e.currentTarget as SVGPathElement
                  el.style.fillOpacity = String(fillOpacity)
                  el.style.strokeOpacity = String(strokeOpacity)
                }
              }}
              role="button"
              aria-label={region.label}
              tabIndex={0}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onRegionClick(region)
                }
              }}
            />
            {/* Visit marker dot */}
            {marker && (
              marker.visits.length === 1 ? (
                <circle
                  cx={region.dotX}
                  cy={region.dotY}
                  r={4}
                  fill={MARKER_COLORS[marker.type]}
                  stroke="white"
                  strokeWidth={1.2}
                  className="pointer-events-none"
                />
              ) : (
                <g className="pointer-events-none">
                  <circle
                    cx={region.dotX}
                    cy={region.dotY}
                    r={6}
                    fill={MARKER_COLORS[marker.type]}
                    stroke="white"
                    strokeWidth={1.2}
                  />
                  <text
                    x={region.dotX}
                    y={region.dotY + 3.5}
                    textAnchor="middle"
                    fontSize={7}
                    fontWeight="700"
                    fill="white"
                  >
                    {marker.visits.length > 9 ? '9+' : marker.visits.length}
                  </text>
                </g>
              )
            )}
            {/* Annotation-only dot (no visit marker) */}
            {!marker && hasAnnotation && (
              <circle
                cx={region.dotX}
                cy={region.dotY}
                r={4}
                fill={MARKER_COLORS.annotated}
                stroke="white"
                strokeWidth={1.2}
                className="pointer-events-none"
              />
            )}
          </g>
        )
      })}
    </>
  )
}

// ─── BodyFigure ───────────────────────────────────────────────────────────────

interface BodyFigureProps {
  view: 'front' | 'back'
  sex: string
  selectedRegion: string | null
  annotations: LocalAnnotation[]
  markerMap: Record<string, { type: MarkerType; visits: VisitWithDate[] }>
  onRegionClick: (region: BodyRegion) => void
}

function BodyFigure({ view, sex, selectedRegion, annotations, markerMap, onRegionClick }: BodyFigureProps) {
  const regions = view === 'front' ? FRONT_REGIONS : BACK_REGIONS
  return (
    <g>
      <SilhouetteLayer sex={sex} view={view} />
      <RegionLayer
        regions={regions}
        selectedRegion={selectedRegion}
        annotations={annotations}
        markerMap={markerMap}
        onRegionClick={onRegionClick}
      />
    </g>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BodyMap({ patientId: _patientId, sex = 'male', visits = [], compact = false }: BodyMapProps) {
  const [annotations, setAnnotations] = useState<LocalAnnotation[]>([])
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [addingAnnotation, setAddingAnnotation] = useState(false)
  const [newAnnotation, setNewAnnotation] = useState<{
    type: AnnotationType
    text: string
    severity: SeverityType
    icd10Code: string
    icd10Description: string
  }>({ type: 'symptom', text: '', severity: 'mild', icd10Code: '', icd10Description: '' })
  const [icd10Query, setIcd10Query] = useState('')
  const [showIcd10Dropdown, setShowIcd10Dropdown] = useState(false)

  const { results: icd10Results, loading: icd10Loading } = useIcd10Search(icd10Query)

  const normalizedSex = sex === 'female' ? 'female' : 'male'
  const markerMap = buildRegionMarkers(visits)

  // All regions from both views
  const allRegions = [...FRONT_REGIONS, ...BACK_REGIONS]

  function handleRegionClick(region: BodyRegion) {
    if (selectedRegion === region.id) {
      setSelectedRegion(null)
      setAddingAnnotation(false)
    } else {
      setSelectedRegion(region.id)
      setAddingAnnotation(false)
      setIcd10Query('')
      setShowIcd10Dropdown(false)
    }
  }

  function handleAddAnnotation() {
    if (!newAnnotation.text.trim() || !selectedRegion) return
    const anno: LocalAnnotation = {
      id: Math.random().toString(36).slice(2),
      region: selectedRegion,
      type: newAnnotation.type,
      text: newAnnotation.text,
      severity: newAnnotation.severity,
      icd10Code: newAnnotation.icd10Code || undefined,
      icd10Description: newAnnotation.icd10Description || undefined,
    }
    setAnnotations(prev => [...prev, anno])
    setNewAnnotation({ type: 'symptom', text: '', severity: 'mild', icd10Code: '', icd10Description: '' })
    setIcd10Query('')
    setAddingAnnotation(false)
  }

  function selectIcd10(item: Icd10Result) {
    setNewAnnotation(p => ({ ...p, icd10Code: item.code, icd10Description: item.description }))
    setIcd10Query(`${item.code} – ${item.description}`)
    setShowIcd10Dropdown(false)
  }

  const selectedRegionObj = selectedRegion ? allRegions.find(r => r.id === selectedRegion) : null
  const regionAnnotations = selectedRegion ? annotations.filter(a => a.region === selectedRegion) : []
  const regionVisits = selectedRegion && markerMap[selectedRegion] ? markerMap[selectedRegion].visits : []

  // SVG layout: two figures side by side in a fixed 360×460 viewBox.
  // CSS controls actual rendered size — this ensures uniform scaling, so click
  // hit areas always match the visual shapes regardless of container size.
  const FULL_W = 360
  const FULL_H = 460
  const figW = 160
  const figH = 420

  return (
    <div className="select-none">
      {/* Dual-figure SVG */}
      <div
        className="relative"
        style={{ width: compact ? 220 : 360 }}
        onClick={() => { setSelectedRegion(null); setAddingAnnotation(false) }}
      >
        <svg
          viewBox={`0 0 ${FULL_W} ${FULL_H}`}
          style={{ width: '100%', height: 'auto', display: 'block' }}
          aria-label="Body map — front and back views"
        >
          {/* FRONT figure */}
          <g onClick={e => e.stopPropagation()}>
            <BodyFigure
              view="front"
              sex={normalizedSex}
              selectedRegion={selectedRegion}
              annotations={annotations}
              markerMap={markerMap}
              onRegionClick={handleRegionClick}
            />
          </g>

          {/* BACK figure — translated right by 160px (half the viewBox width) */}
          <g
            transform={`translate(${figW + 40}, 0)`}
            onClick={e => e.stopPropagation()}
          >
            <BodyFigure
              view="back"
              sex={normalizedSex}
              selectedRegion={selectedRegion}
              annotations={annotations}
              markerMap={markerMap}
              onRegionClick={handleRegionClick}
            />
          </g>

          {/* Labels */}
          {!compact && (
            <>
              <text
                x={figW / 2}
                y={figH + 20}
                textAnchor="middle"
                fontSize={10}
                fontWeight="600"
                letterSpacing="1.5"
                fill="var(--bb-text-secondary)"
              >
                FRONT
              </text>
              <text
                x={figW + 40 + figW / 2}
                y={figH + 20}
                textAnchor="middle"
                fontSize={10}
                fontWeight="600"
                letterSpacing="1.5"
                fill="var(--bb-text-secondary)"
              >
                BACK
              </text>
            </>
          )}
        </svg>
      </div>

      {/* Legend */}
      {!compact && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
          {([
            ['recent', 'Recent (7d)'],
            ['month', 'Last Month'],
            ['past', 'Past Visit'],
            ['annotated', 'Annotated'],
          ] as [MarkerType, string][]).map(([type, label]) => (
            <div key={type} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: MARKER_COLORS[type] }}
              />
              <span className="text-[11px] text-[--bb-text-secondary]">{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Detail panel — shown below body map when a region is selected */}
      {selectedRegion && !compact && (
        <div
          className="mt-4 border border-[--bb-border] rounded-xl bg-[--bb-surface-card] p-4"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-[--bb-text-primary]">
              {selectedRegionObj?.label ?? selectedRegion}
            </span>
            <button
              onClick={() => { setSelectedRegion(null); setAddingAnnotation(false) }}
              className="text-[--bb-text-secondary] hover:text-[--bb-text-primary] transition-colors p-0.5"
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>

          {/* Visit diagnoses for this region */}
          {regionVisits.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[--bb-text-secondary] mb-1.5">
                Visit Diagnoses
              </p>
              <div className="space-y-1.5">
                {regionVisits.map((visit, i) => {
                  const markerType = visitMarkerType(visit.visitDate)
                  const matchingCodes = (visit.diagnoses ?? []).filter(d => {
                    const code = d.icd10Code ?? d.diagnosis_code ?? ''
                    return icdCodesToRegions(code).includes(selectedRegion)
                  })
                  return (
                    <div key={`${visit.id}-${i}`} className="bg-[--bb-surface-app] rounded-lg px-2.5 py-2">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: MARKER_COLORS[markerType] }}
                        />
                        <span className="text-xs font-medium text-[--bb-text-primary]">
                          {visit.visitDate
                            ? new Date(visit.visitDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            : 'Visit'}
                        </span>
                      </div>
                      {matchingCodes.map((d, j) => {
                        const code = d.icd10Code ?? d.diagnosis_code ?? ''
                        return (
                          <div key={j} className="text-xs text-[--bb-text-secondary] ml-3.5">
                            <span className="font-mono text-[--bb-brand-blue]">{code}</span>
                            {d.description && <span className="ml-1">{d.description}</span>}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Local annotations */}
          {regionAnnotations.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[--bb-text-secondary] mb-1.5">
                Annotations
              </p>
              <div className="space-y-1.5">
                {regionAnnotations.map(a => (
                  <div key={a.id} className="bg-[--bb-surface-app] rounded-lg px-2.5 py-2 text-xs">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: MARKER_COLORS.annotated }}
                      />
                      <span className="font-medium capitalize text-[--bb-text-primary]">{a.type}</span>
                      {a.severity && (
                        <span className="text-[--bb-text-secondary]">· {a.severity}</span>
                      )}
                    </div>
                    <p className="text-[--bb-text-primary] leading-snug ml-3.5">{a.text}</p>
                    {a.icd10Code && (
                      <p className="text-[--bb-text-secondary] font-mono mt-0.5 text-[10px] ml-3.5">
                        {a.icd10Code}
                        {a.icd10Description && (
                          <span className="font-sans not-italic ml-1">{a.icd10Description}</span>
                        )}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {regionVisits.length === 0 && regionAnnotations.length === 0 && !addingAnnotation && (
            <p className="text-xs text-[--bb-text-secondary] mb-3">No visit diagnoses or annotations for this region.</p>
          )}

          {/* Add Note button / form */}
          {!addingAnnotation ? (
            <button
              onClick={() => setAddingAnnotation(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-[--bb-brand-blue] hover:underline"
            >
              <Plus size={12} />
              Add Note
            </button>
          ) : (
            <div className="space-y-2.5 border-t border-[--bb-border] pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[--bb-text-secondary]">
                New Annotation
              </p>

              {/* Type */}
              <select
                value={newAnnotation.type}
                onChange={e => setNewAnnotation(p => ({ ...p, type: e.target.value as AnnotationType }))}
                className="w-full text-xs border border-[--bb-border] rounded-lg px-2.5 py-1.5 outline-none focus:border-[--bb-brand-blue] bg-white text-[--bb-text-primary]"
              >
                <option value="note">Note</option>
                <option value="symptom">Symptom</option>
                <option value="finding">Finding</option>
                <option value="diagnosis">Diagnosis</option>
              </select>

              {/* Description */}
              <textarea
                value={newAnnotation.text}
                onChange={e => setNewAnnotation(p => ({ ...p, text: e.target.value }))}
                placeholder="Describe finding…"
                rows={2}
                className="w-full text-xs border border-[--bb-border] rounded-lg px-2.5 py-1.5 outline-none focus:border-[--bb-brand-blue] resize-none bg-white text-[--bb-text-primary] placeholder:text-[--bb-text-secondary]"
              />

              {/* Severity */}
              <select
                value={newAnnotation.severity}
                onChange={e => setNewAnnotation(p => ({ ...p, severity: e.target.value as SeverityType }))}
                className="w-full text-xs border border-[--bb-border] rounded-lg px-2.5 py-1.5 outline-none focus:border-[--bb-brand-blue] bg-white text-[--bb-text-primary]"
              >
                <option value="mild">Mild</option>
                <option value="moderate">Moderate</option>
                <option value="severe">Severe</option>
              </select>

              {/* ICD-10 search */}
              <div className="relative">
                <div className="relative">
                  <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[--bb-text-secondary] pointer-events-none" />
                  <input
                    value={icd10Query}
                    onChange={e => {
                      setIcd10Query(e.target.value)
                      setNewAnnotation(p => ({ ...p, icd10Code: '', icd10Description: '' }))
                      setShowIcd10Dropdown(true)
                    }}
                    onFocus={() => setShowIcd10Dropdown(true)}
                    placeholder="Search ICD-10 code…"
                    className="w-full text-xs border border-[--bb-border] rounded-lg pl-7 pr-2.5 py-1.5 outline-none focus:border-[--bb-brand-blue] bg-white text-[--bb-text-primary] placeholder:text-[--bb-text-secondary]"
                  />
                </div>
                {showIcd10Dropdown && icd10Query.length >= 2 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[--bb-border] rounded-lg shadow-lg z-50 overflow-hidden max-h-40 overflow-y-auto">
                    {icd10Loading ? (
                      <div className="px-3 py-2 text-xs text-[--bb-text-secondary]">Searching…</div>
                    ) : icd10Results.length > 0 ? (
                      icd10Results.map(item => (
                        <button
                          key={`${item.code}-${item.description}`}
                          onClick={() => selectIcd10(item)}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-[--bb-surface-app] transition-colors"
                        >
                          <span className="font-mono text-[--bb-brand-blue]">{item.code}</span>
                          <span className="text-[--bb-text-primary] ml-1.5">{item.description}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-xs text-[--bb-text-secondary]">No results</div>
                    )}
                  </div>
                )}
              </div>

              {/* Quick-pick ICD-10 codes */}
              <div>
                <p className="text-[10px] font-medium text-[--bb-text-secondary] mb-1.5 uppercase tracking-wide">
                  Common codes
                </p>
                <div className="flex flex-wrap gap-1">
                  {QUICK_ICD10.map(item => (
                    <button
                      key={`${item.code}-${item.description}`}
                      onClick={() => selectIcd10(item)}
                      title={item.description}
                      className={clsx(
                        'text-[10px] px-1.5 py-0.5 rounded border transition-colors',
                        newAnnotation.icd10Code === item.code
                          ? 'border-[--bb-brand-blue] bg-[--bb-brand-blue] text-white'
                          : 'border-[--bb-border] text-[--bb-text-secondary] hover:border-[--bb-brand-blue] hover:text-[--bb-brand-blue] bg-white',
                      )}
                    >
                      {item.code}
                    </button>
                  ))}
                </div>
              </div>

              {/* Save / Cancel */}
              <div className="flex gap-1.5 pt-0.5">
                <button
                  onClick={handleAddAnnotation}
                  className="flex-1 bg-[--bb-brand-blue] text-white text-xs rounded-lg px-2.5 py-1.5 hover:opacity-90 transition-opacity font-medium"
                >
                  Save
                </button>
                <button
                  onClick={() => { setAddingAnnotation(false); setIcd10Query('') }}
                  className="flex-1 bg-[--bb-surface-app] text-[--bb-text-secondary] text-xs rounded-lg px-2.5 py-1.5 hover:bg-[#EFF0FF] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
