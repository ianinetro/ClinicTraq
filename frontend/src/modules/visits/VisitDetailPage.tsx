import { useParams } from 'react-router-dom'
export function VisitDetailPage() {
  const { id } = useParams()
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[#12122C]">Visit {id}</h1>
      <p className="text-[#676687] mt-1">Visit detail coming soon.</p>
    </div>
  )
}
