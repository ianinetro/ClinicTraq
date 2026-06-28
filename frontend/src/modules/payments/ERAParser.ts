// EDI 835 (ERA) parser — parses text content of an 835 file into structured data

export interface ERA835Claim {
  claimId: string
  patientControlNumber: string
  claimStatus: string
  claimBilled: number
  claimPaid: number
  patientResponsibility: number
  adjustments: { groupCode: string; reasonCode: string; amount: number; description: string }[]
  serviceLines: {
    cptCode: string
    modifiers: string[]
    dos: string
    billed: number
    paid: number
    adjustments: { groupCode: string; reasonCode: string; amount: number }[]
  }[]
}

export interface ERA835 {
  checkNumber: string
  checkDate: string
  payerName: string
  payerNpi: string
  payeeName: string
  payeeNpi: string
  totalPaid: number
  claims: ERA835Claim[]
  parseErrors: string[]
}

const GROUP_CODE_MAP: Record<string, string> = {
  CO: 'Contractual Obligation',
  PR: 'Patient Responsibility',
  OA: 'Other Adjustment',
  PI: 'Payer Initiated',
}

const REASON_CODE_DESCRIPTIONS: Record<string, string> = {
  '1': 'Deductible amount',
  '2': 'Coinsurance amount',
  '3': 'Co-payment amount',
  '4': 'Late filing penalty',
  '6': 'Claim filed well beyond 1 year from date of service',
  '18': 'Exact duplicate claim/service',
  '22': 'This care may be covered by another payer',
  '45': 'Charge exceeds fee schedule/maximum allowable',
  '97': 'Payment is included in allowance for another service',
  '100': 'Payment made to patient/insured/responsible party',
  '109': 'Claim not covered by this payer',
  '119': 'Benefit maximum for this time period has been reached',
  '139': 'Contractual adjustment',
  '253': 'Sequestration — reduction in federal spending',
}

function parseClaim(segments: string[][]): ERA835Claim {
  const claim: ERA835Claim = {
    claimId: '', patientControlNumber: '', claimStatus: '',
    claimBilled: 0, claimPaid: 0, patientResponsibility: 0,
    adjustments: [], serviceLines: [],
  }

  let currentSL: ERA835Claim['serviceLines'][number] | null = null

  for (const seg of segments) {
    const id = seg[0]

    if (id === 'CLP') {
      claim.patientControlNumber = seg[1] ?? ''
      claim.claimStatus = seg[2] ?? ''
      claim.claimBilled = parseFloat(seg[3] ?? '0')
      claim.claimPaid = parseFloat(seg[4] ?? '0')
      claim.patientResponsibility = parseFloat(seg[5] ?? '0')
      claim.claimId = seg[7] ?? seg[1]
    } else if (id === 'CAS' && currentSL === null) {
      // Claim-level adjustment
      const groupCode = seg[1] ?? ''
      for (let i = 2; i < seg.length - 1; i += 3) {
        const reasonCode = seg[i] ?? ''
        const amount = parseFloat(seg[i + 1] ?? '0')
        if (reasonCode && amount) {
          claim.adjustments.push({
            groupCode,
            reasonCode,
            amount,
            description: `${GROUP_CODE_MAP[groupCode] ?? groupCode} — ${REASON_CODE_DESCRIPTIONS[reasonCode] ?? `Reason ${reasonCode}`}`,
          })
        }
      }
    } else if (id === 'SVC') {
      if (currentSL) claim.serviceLines.push(currentSL)
      const composite = seg[1]?.split(':') ?? []
      currentSL = {
        cptCode: composite[1] ?? composite[0] ?? '',
        modifiers: composite.slice(2).filter(Boolean),
        dos: '',
        billed: parseFloat(seg[2] ?? '0'),
        paid: parseFloat(seg[3] ?? '0'),
        adjustments: [],
      }
    } else if (id === 'DTM' && currentSL) {
      if (seg[1] === '472') currentSL.dos = seg[2] ?? ''
    } else if (id === 'CAS' && currentSL) {
      const groupCode = seg[1] ?? ''
      for (let i = 2; i < seg.length - 1; i += 3) {
        const reasonCode = seg[i] ?? ''
        const amount = parseFloat(seg[i + 1] ?? '0')
        if (reasonCode && amount) {
          currentSL.adjustments.push({ groupCode, reasonCode, amount })
        }
      }
    }
  }

  if (currentSL) claim.serviceLines.push(currentSL)
  return claim
}

export function parseERA835(content: string): ERA835 {
  const result: ERA835 = {
    checkNumber: '', checkDate: '', payerName: '', payerNpi: '',
    payeeName: '', payeeNpi: '', totalPaid: 0, claims: [], parseErrors: [],
  }

  try {
    // Detect element separator (default is *)
    const isa = content.indexOf('ISA')
    if (isa === -1) {
      result.parseErrors.push('No ISA segment found — file may not be a valid EDI 835')
      return result
    }

    const elemSep = content[isa + 3] ?? '*'
    const segTerm = content.slice(isa).match(/ISA.{103}(.)/)?.[1] ?? '~'

    const rawSegments = content.split(segTerm).map(s => s.trim()).filter(Boolean)
    const segments = rawSegments.map(s => s.split(elemSep))

    let claimSegments: string[][] = []
    let inClaim = false

    for (const seg of segments) {
      const id = seg[0]?.trim()

      if (id === 'BPR') {
        result.totalPaid = parseFloat(seg[2] ?? '0')
        result.checkDate = seg[16] ?? ''
        result.checkNumber = seg[9] ?? ''
      } else if (id === 'N1') {
        if (seg[1] === 'PR') result.payerName = seg[2] ?? ''
        if (seg[1] === 'PE') {
          result.payeeName = seg[2] ?? ''
          result.payeeNpi = seg[4] ?? ''
        }
      } else if (id === 'CLP') {
        if (inClaim && claimSegments.length) {
          result.claims.push(parseClaim(claimSegments))
        }
        claimSegments = [seg]
        inClaim = true
      } else if (inClaim) {
        if (id === 'SE' || id === 'GE' || id === 'IEA') {
          if (claimSegments.length) result.claims.push(parseClaim(claimSegments))
          inClaim = false
        } else {
          claimSegments.push(seg)
        }
      }
    }

    if (inClaim && claimSegments.length) result.claims.push(parseClaim(claimSegments))

  } catch (err) {
    result.parseErrors.push(`Parse error: ${err instanceof Error ? err.message : String(err)}`)
  }

  return result
}

// Format a raw EDI date string YYYYMMDD → MM/DD/YYYY
export function formatEDIDate(raw: string): string {
  if (!raw || raw.length < 8) return raw
  return `${raw.slice(4, 6)}/${raw.slice(6, 8)}/${raw.slice(0, 4)}`
}
