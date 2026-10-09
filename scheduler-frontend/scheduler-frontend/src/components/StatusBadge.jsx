const STYLES = {
  pending: 'text-status-pending bg-status-pendingBg',
  approved: 'text-status-approved bg-status-approvedBg',
  rejected: 'text-status-rejected bg-status-rejectedBg',
  completed: 'text-blue-700 bg-blue-100',
  cancelled: 'text-gray-700 bg-gray-100',
  paid: 'text-green-700 bg-green-100',
}

const LABELS = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  completed: 'Completed',
  cancelled: 'Cancelled',
  paid: 'Paid',
  accepted: 'Accepted',
  confirmed: 'Confirmed',
}

export default function StatusBadge({ status }) {
  const normalizedStatus = (status || "").toLowerCase().trim()
  const style = STYLES[normalizedStatus] || 'text-steel bg-line'
  const label = LABELS[normalizedStatus] || status || 'Unknown'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[13px] font-medium ${style}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  )
}
