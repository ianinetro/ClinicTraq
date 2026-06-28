import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, Phone, Mail } from 'lucide-react'

import { Tabs, TabList, Tab, TabPanel } from '../../components/ui/Tabs'
import { Button } from '../../components/ui/Button'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { PHIField } from '../../components/shared/PHIField'
import { KPICard } from '../../components/ui/KPICard'
import { BodyMap } from './BodyMap'
import { usePatient } from '../../services/queries'

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: patient, isLoading } = usePatient(id ?? '')

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[#E3E3F1] rounded w-64" />
          <div className="h-4 bg-[#E3E3F1] rounded w-48" />
        </div>
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="p-6">
        <p className="text-sm text-[#676687]">Patient not found.</p>
        <Button size="sm" variant="secondary" onClick={() => navigate('/patients')} className="mt-3">
          Back to Patients
        </Button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      {/* Back nav */}
      <button
        onClick={() => navigate('/patients')}
        className="flex items-center gap-1.5 text-sm text-[#676687] hover:text-[#12122C] mb-2"
      >
        <ArrowLeft size={14} />
        Back to Patients
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#EFF0FF] flex items-center justify-center text-[#0410BD] font-bold text-lg">
            {patient.firstName[0]}{patient.lastName[0]}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <PHIField
                value={`${patient.firstName} ${patient.lastName}`}
                fieldName="Patient Name"
                patientId={patient.id}
                fieldType="name"
                className="text-2xl font-bold text-[#12122C]"
              />
              <StatusBadge status={patient.status} />
            </div>
            <p className="text-sm text-[#676687]">Account #{patient.accountNumber}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultTab="overview">
        <TabList>
          <Tab id="overview">Overview</Tab>
          <Tab id="demographics">Demographics</Tab>
          <Tab id="insurance">Insurance</Tab>
          <Tab id="visits">Visits</Tab>
          <Tab id="claims">Claims</Tab>
          <Tab id="payments">Payments</Tab>
          <Tab id="bodymap">Body Map</Tab>
          <Tab id="notes">Notes & Activity</Tab>
        </TabList>

        <TabPanel id="overview" className="pt-4 space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <KPICard label="Total Charges" value="—" />
            <KPICard label="Total Paid" value="—" />
            <KPICard label="Balance" value="—" />
            <KPICard label="Open Claims" value="—" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-[#E3E3F1] rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-[#12122C]">Contact Information</h3>
              <div className="space-y-2">
                {patient.phone && (
                  <div className="flex items-center gap-2 text-sm text-[#676687]">
                    <Phone size={14} />
                    <PHIField value={patient.phone} fieldName="Phone" patientId={patient.id} fieldType="phone" inline />
                  </div>
                )}
                {patient.email && (
                  <div className="flex items-center gap-2 text-sm text-[#676687]">
                    <Mail size={14} />
                    <PHIField value={patient.email} fieldName="Email" patientId={patient.id} fieldType="email" inline />
                  </div>
                )}
                {patient.address && (
                  <div className="flex items-start gap-2 text-sm text-[#676687]">
                    <MapPin size={14} className="mt-0.5 flex-shrink-0" />
                    <PHIField
                      value={`${patient.address.line1}, ${patient.address.city}, ${patient.address.state} ${patient.address.zip}`}
                      fieldName="Address"
                      patientId={patient.id}
                      fieldType="address"
                      inline
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="bg-white border border-[#E3E3F1] rounded-lg p-4">
              <h3 className="text-sm font-semibold text-[#12122C] mb-3">Body Map Preview</h3>
              <BodyMap patientId={patient.id} compact />
            </div>
          </div>
        </TabPanel>

        <TabPanel id="demographics" className="pt-4">
          <div className="bg-white border border-[#E3E3F1] rounded-lg p-6 space-y-4 max-w-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#676687] mb-1">First Name</p>
                <PHIField value={patient.firstName} fieldName="First Name" patientId={patient.id} fieldType="name" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#676687] mb-1">Last Name</p>
                <PHIField value={patient.lastName} fieldName="Last Name" patientId={patient.id} fieldType="name" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#676687] mb-1">Date of Birth</p>
                <PHIField value={patient.dateOfBirth} fieldName="Date of Birth" patientId={patient.id} fieldType="dob" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#676687] mb-1">Gender</p>
                <p className="text-sm">{patient.gender === 'M' ? 'Male' : patient.gender === 'F' ? 'Female' : 'Other/Unknown'}</p>
              </div>
              {patient.ssn && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#676687] mb-1">SSN</p>
                  <PHIField value={patient.ssn} fieldName="SSN" patientId={patient.id} fieldType="ssn" />
                </div>
              )}
            </div>
          </div>
        </TabPanel>

        <TabPanel id="insurance" className="pt-4">
          <p className="text-sm text-[#676687]">Insurance records will appear here.</p>
        </TabPanel>
        <TabPanel id="visits" className="pt-4">
          <p className="text-sm text-[#676687]">Patient visits will appear here.</p>
        </TabPanel>
        <TabPanel id="claims" className="pt-4">
          <p className="text-sm text-[#676687]">Patient claims will appear here.</p>
        </TabPanel>
        <TabPanel id="payments" className="pt-4">
          <p className="text-sm text-[#676687]">Patient payments will appear here.</p>
        </TabPanel>

        <TabPanel id="bodymap" className="pt-4">
          <BodyMap patientId={patient.id} />
        </TabPanel>

        <TabPanel id="notes" className="pt-4">
          <p className="text-sm text-[#676687]">Notes and audit activity will appear here.</p>
        </TabPanel>
      </Tabs>
    </div>
  )
}
