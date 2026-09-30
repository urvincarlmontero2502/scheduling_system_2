const STYLES = {
  pending: 'text-status-pending bg-status-pendingBg',
  approved: 'text-status-approved bg-status-approvedBg',
  rejected: 'text-status-rejected bg-status-rejectedBg',
}

const LABELS = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
}

export default function StatusBadge({ status }) {
  const style = STYLES[status] || 'text-steel bg-line'
  const label = LABELS[status] || status

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[13px] font-medium ${style}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  )
}
