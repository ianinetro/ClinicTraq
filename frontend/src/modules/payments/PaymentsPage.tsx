import { useState, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Upload, FileUp, CheckCircle2, XCircle, AlertCircle, Search, ChevronDown, ChevronRight, Archive } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { apiClient as api } from '../../services/api'
import { parseERA835, formatEDIDate } from './ERAParser'
import type { ERA835 } from './ERAParser'
import JSZip from 'jszip'

const TABS = ['Payment History', 'ERA Import', 'Post Payment'] as const
type Tab = typeof TABS[number]

interface Payment {
  id: string; date: string; patient: string; payer: string
  checkNumber: string; amount: number; type: string; status: string; claimsCount?: number
}


interface ImportedFile {
  name: string
  size: number
  content: string
  parsed: ERA835 | null
  status: 'parsing' | 'ready' | 'error'
  error?: string
}

interface PostForm {
  patient: string; claimId: string; amount: string
  checkNumber: string; date: string; payer: string; memo: string
}

export function PaymentsPage() {
  const [tab, setTab] = useState<Tab>('Payment History')
  const [search, setSearch] = useState('')
  const [importedFiles, setImportedFiles] = useState<ImportedFile[]>([])
  const [dragging, setDragging] = useState(false)
  const [expandedFile, setExpandedFile] = useState<string | null>(null)
  const [postForm, setPostForm] = useState<PostForm>({ patient: '', claimId: '', amount: '', checkNumber: '', date: '', payer: '', memo: '' })
  const [postStatus, setPostStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: paymentsData } = useQuery({
    queryKey: ['payments'],
    queryFn: async () => (await api.get('/payments')).data,
  })

  const payments: Payment[] = paymentsData?.items ?? []
  const filtered = search
    ? payments.filter(p => p.patient.toLowerCase().includes(search.toLowerCase()) || p.payer.toLowerCase().includes(search.toLowerCase()) || p.checkNumber.toLowerCase().includes(search.toLowerCase()))
    : payments

  const totalPosted = payments.filter(p => p.status === 'Posted').reduce((s, p) => s + p.amount, 0)
  const unmatched = payments.filter(p => p.status === 'Unmatched').length

  async function processFile(file: File) {
    const entry: ImportedFile = { name: file.name, size: file.size, content: '', parsed: null, status: 'parsing' }
    setImportedFiles(prev => [...prev.filter(f => f.name !== file.name), entry])

    try {
      let text = ''
      if (file.name.endsWith('.zip')) {
        const zip = await JSZip.loadAsync(file)
        const ediFiles = Object.values(zip.files).filter(f => !f.dir && (f.name.endsWith('.835') || f.name.endsWith('.edi') || f.name.endsWith('.txt') || f.name.endsWith('.ERA')))
        if (!ediFiles.length) throw new Error('No EDI 835 files found in ZIP archive')
        text = await ediFiles[0].async('string')
      } else {
        text = await file.text()
      }
      const parsed = parseERA835(text)
      setImportedFiles(prev => prev.map(f => f.name === file.name ? { ...f, content: text, parsed, status: parsed.parseErrors.length > 0 ? 'error' : 'ready' } : f))
    } catch (err) {
      setImportedFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'error', error: err instanceof Error ? err.message : 'Unknown error' } : f))
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    Array.from(e.dataTransfer.files).forEach(processFile)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    Array.from(e.target.files ?? []).forEach(processFile)
    e.target.value = ''
  }

  const handlePostSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setPostStatus('submitting')
    try {
      await api.post('/payments', { ...postForm, amount: parseFloat(postForm.amount) })
      setPostStatus('success')
      setPostForm({ patient: '', claimId: '', amount: '', checkNumber: '', date: '', payer: '', memo: '' })
    } catch {
      setPostStatus('error')
    }
    setTimeout(() => setPostStatus('idle'), 3000)
  }, [postForm])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#676687', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Billing</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#12122C' }}>Payments & Posting</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#676687' }}>Post payments, import ERA 835 files, and track payment history.</p>
        </div>
        <div style={{ display: 'flex', gap: 12, textAlign: 'right' }}>
          <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 8, padding: '8px 16px' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#047857' }}>${totalPosted.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: '#047857' }}>Posted this period</div>
          </div>
          {unmatched > 0 && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 16px' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#DC2626' }}>{unmatched}</div>
              <div style={{ fontSize: 11, color: '#DC2626' }}>Unmatched</div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #E3E3F1' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600,
            color: tab === t ? '#0410BD' : '#676687',
            borderBottom: tab === t ? '2px solid #0410BD' : '2px solid transparent',
            marginBottom: -1, transition: 'color 0.12s',
          }}>{t}</button>
        ))}
      </div>

      {/* Payment History */}
      {tab === 'Payment History' && (
        <div style={{ background: 'white', border: '1px solid #E3E3F1', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #E3E3F1', display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#BABACE' }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search patient, payer, or check number…"
                style={{ width: '100%', height: 36, paddingLeft: 32, paddingRight: 12, border: '1px solid #BABACE', borderRadius: 6, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <span style={{ fontSize: 13, color: '#676687' }}>{filtered.length} payment{filtered.length !== 1 ? 's' : ''}</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F2F2F8', borderBottom: '1px solid #E3E3F1' }}>
                {['Date', 'Patient', 'Payer', 'Check / EFT #', 'Claims', 'Amount', 'Type', 'Status'].map(h => (
                  <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#676687', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #F2F2F8' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FAFAFA')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '11px 14px', color: '#676687' }}>{p.date}</td>
                  <td style={{ padding: '11px 14px', fontWeight: 500 }}>{p.patient}</td>
                  <td style={{ padding: '11px 14px', color: '#676687' }}>{p.payer}</td>
                  <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontSize: 12 }}>{p.checkNumber}</td>
                  <td style={{ padding: '11px 14px', color: '#676687' }}>{p.claimsCount ?? '—'}</td>
                  <td style={{ padding: '11px 14px', fontWeight: 700, color: '#16A34A', fontVariantNumeric: 'tabular-nums' }}>${p.amount.toFixed(2)}</td>
                  <td style={{ padding: '11px 14px' }}><Badge variant="info">{p.type}</Badge></td>
                  <td style={{ padding: '11px 14px' }}><Badge variant={p.status === 'Posted' ? 'success' : 'warning'}>{p.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ERA Import */}
      {tab === 'ERA Import' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? '#0410BD' : '#BABACE'}`,
              borderRadius: 12, padding: '40px 32px', textAlign: 'center', cursor: 'pointer',
              background: dragging ? '#EFF0FF' : 'white', transition: 'all 0.15s',
            }}
          >
            <FileUp size={36} style={{ color: dragging ? '#0410BD' : '#BABACE', marginBottom: 12 }} />
            <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600, color: '#12122C' }}>
              Drop ERA 835 files here to import
            </p>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#676687' }}>
              Accepts <strong>.835</strong>, <strong>.edi</strong>, <strong>.txt</strong> EDI files, or a <strong>.zip</strong> archive containing ERA files
            </p>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#0410BD', color: 'white', padding: '8px 18px', borderRadius: 6, fontSize: 13, fontWeight: 600 }}>
              <Upload size={14} /> Browse files
            </div>
            <input ref={fileRef} type="file" multiple accept=".835,.edi,.txt,.ERA,.zip" style={{ display: 'none' }} onChange={handleFileInput} />
          </div>

          {/* Parsed files */}
          {importedFiles.map(file => (
            <div key={file.name} style={{ background: 'white', border: `1px solid ${file.status === 'error' ? '#FECACA' : '#E3E3F1'}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{
                padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12,
                background: file.status === 'parsing' ? '#F2F2F8' : file.status === 'error' ? '#FEF2F2' : '#ECFDF5',
                cursor: file.status === 'ready' ? 'pointer' : 'default',
              }}
                onClick={() => file.status === 'ready' && setExpandedFile(expandedFile === file.name ? null : file.name)}
              >
                {file.status === 'parsing' && <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #0410BD', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />}
                {file.status === 'ready' && <CheckCircle2 size={18} color="#16A34A" />}
                {file.status === 'error' && <XCircle size={18} color="#DC2626" />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#12122C' }}>
                    <Archive size={13} style={{ display: 'inline', marginRight: 6, color: '#676687' }} />
                    {file.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#676687', marginTop: 2 }}>
                    {file.status === 'parsing' && 'Parsing EDI 835…'}
                    {file.status === 'error' && (file.error ?? 'Failed to parse — check file format')}
                    {file.status === 'ready' && file.parsed && (
                      <>
                        {file.parsed.payerName} · {file.parsed.claims.length} claim{file.parsed.claims.length !== 1 ? 's' : ''} · ${file.parsed.totalPaid.toFixed(2)} total · Check {file.parsed.checkNumber} · {formatEDIDate(file.parsed.checkDate)}
                      </>
                    )}
                  </div>
                </div>
                {file.status === 'ready' && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {expandedFile === file.name ? <ChevronDown size={16} color="#676687" /> : <ChevronRight size={16} color="#676687" />}
                    <button onClick={e => { e.stopPropagation(); /* TODO: post to backend */ }} style={{
                      height: 32, padding: '0 14px', background: '#0410BD', color: 'white',
                      border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}>
                      Auto-post all
                    </button>
                  </div>
                )}
              </div>

              {/* Expanded claim details */}
              {file.status === 'ready' && expandedFile === file.name && file.parsed && (
                <div style={{ borderTop: '1px solid #E3E3F1' }}>
                  {/* ERA header */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, borderBottom: '1px solid #F2F2F8' }}>
                    {[
                      { label: 'Payer', value: file.parsed.payerName },
                      { label: 'Check / EFT #', value: file.parsed.checkNumber },
                      { label: 'Check Date', value: formatEDIDate(file.parsed.checkDate) },
                      { label: 'Total Paid', value: `$${file.parsed.totalPaid.toFixed(2)}` },
                    ].map(item => (
                      <div key={item.label} style={{ padding: '12px 20px', borderRight: '1px solid #F2F2F8' }}>
                        <div style={{ fontSize: 11, color: '#676687', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{item.label}</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#12122C' }}>{item.value || '—'}</div>
                      </div>
                    ))}
                  </div>

                  {/* Claims table */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#F2F2F8', borderBottom: '1px solid #E3E3F1' }}>
                        {['Claim / Patient Control #', 'Status', 'Billed', 'Paid', 'Patient Resp.', 'Adjustments'].map(h => (
                          <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#676687', textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {file.parsed.claims.map((claim, ci) => (
                        <tr key={ci} style={{ borderBottom: '1px solid #F2F2F8' }}>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: '#0410BD', fontWeight: 700 }}>{claim.claimId || claim.patientControlNumber}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <Badge variant={claim.claimStatus === '1' ? 'success' : claim.claimStatus === '4' ? 'danger' : 'warning'}>
                              {claim.claimStatus === '1' ? 'Paid' : claim.claimStatus === '2' ? 'Adjusted' : claim.claimStatus === '4' ? 'Denied' : `Status ${claim.claimStatus}`}
                            </Badge>
                          </td>
                          <td style={{ padding: '10px 14px', fontVariantNumeric: 'tabular-nums' }}>${claim.claimBilled.toFixed(2)}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 700, color: '#16A34A', fontVariantNumeric: 'tabular-nums' }}>${claim.claimPaid.toFixed(2)}</td>
                          <td style={{ padding: '10px 14px', fontVariantNumeric: 'tabular-nums', color: claim.patientResponsibility > 0 ? '#D97706' : '#676687' }}>
                            ${claim.patientResponsibility.toFixed(2)}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 12, color: '#676687' }}>
                            {claim.adjustments.slice(0, 2).map((adj, ai) => (
                              <div key={ai}>{adj.groupCode}-{adj.reasonCode}: ${adj.amount.toFixed(2)}</div>
                            ))}
                            {claim.adjustments.length > 2 && <div style={{ color: '#BABACE' }}>+{claim.adjustments.length - 2} more</div>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {file.parsed.parseErrors.length > 0 && (
                    <div style={{ padding: '10px 20px', background: '#FFFBEB', borderTop: '1px solid #FDE68A', display: 'flex', gap: 8 }}>
                      <AlertCircle size={14} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
                      <div style={{ fontSize: 12, color: '#92400E' }}>
                        {file.parsed.parseErrors.map((e, i) => <div key={i}>{e}</div>)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {importedFiles.length === 0 && (
            <div style={{ textAlign: 'center', color: '#BABACE', fontSize: 13, padding: '12px 0' }}>
              No ERA files imported yet. Drag files above or click to browse.
            </div>
          )}
        </div>
      )}

      {/* Post Payment */}
      {tab === 'Post Payment' && (
        <div style={{ background: 'white', border: '1px solid #E3E3F1', borderRadius: 10, padding: 28, maxWidth: 640 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#12122C' }}>Post manual payment</h3>
          <p style={{ margin: '0 0 24px', fontSize: 13, color: '#676687' }}>Record a check, cash, or patient payment not included in an ERA file.</p>

          {postStatus === 'success' && (
            <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 8, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 8, fontSize: 13, color: '#047857' }}>
              <CheckCircle2 size={16} /> Payment posted successfully.
            </div>
          )}
          {postStatus === 'error' && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 8, fontSize: 13, color: '#DC2626' }}>
              <XCircle size={16} /> Failed to post payment. Check your entries and try again.
            </div>
          )}

          <form onSubmit={handlePostSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                { key: 'patient', label: 'Patient name or MRN', placeholder: 'Search patient…', type: 'text', required: true },
                { key: 'claimId', label: 'Claim ID', placeholder: 'e.g. A10042', type: 'text', required: true },
                { key: 'payer', label: 'Payer', placeholder: 'Insurance or "Patient"', type: 'text', required: true },
                { key: 'checkNumber', label: 'Check / EFT number', placeholder: 'CHK-00000', type: 'text' },
                { key: 'amount', label: 'Payment amount', placeholder: '0.00', type: 'number', required: true },
                { key: 'date', label: 'Payment date', placeholder: '', type: 'date', required: true },
              ].map(field => (
                <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#676687', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {field.label}{field.required && <span style={{ color: '#DC2626', marginLeft: 3 }}>*</span>}
                  </label>
                  <input
                    type={field.type}
                    placeholder={field.placeholder}
                    value={(postForm as unknown as Record<string, string>)[field.key]}
                    onChange={e => setPostForm(p => ({ ...p, [field.key]: e.target.value }))}
                    required={field.required}
                    style={{ height: 38, padding: '0 12px', border: '1px solid #BABACE', borderRadius: 6, fontSize: 13, outline: 'none', background: 'white' }}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#676687', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Notes / Memo</label>
              <textarea
                value={postForm.memo}
                onChange={e => setPostForm(p => ({ ...p, memo: e.target.value }))}
                placeholder="Optional notes about this payment…"
                rows={3}
                style={{ padding: '8px 12px', border: '1px solid #BABACE', borderRadius: 6, fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
              />
            </div>
            <div style={{ marginTop: 20 }}>
              <button type="submit" disabled={postStatus === 'submitting'} style={{
                height: 40, padding: '0 24px', background: postStatus === 'submitting' ? '#BABACE' : '#0410BD',
                color: 'white', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600,
                cursor: postStatus === 'submitting' ? 'not-allowed' : 'pointer',
              }}>
                {postStatus === 'submitting' ? 'Posting…' : 'Post payment'}
              </button>
            </div>
          </form>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
