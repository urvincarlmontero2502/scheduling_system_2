import { AlertCircle } from "lucide-react";

/**
 * Custom confirmation modal — replaces window.confirm() popups
 * Usage:
 *   const [confirmOpen, setConfirmOpen] = useState(false);
 *   const [confirmData, setConfirmData] = useState(null);
 *
 *   const handleConfirm = () => {
 *     // perform action
 *     setConfirmOpen(false);
 *     setConfirmData(null);
 *   };
 *
 *   <ConfirmModal
 *     open={confirmOpen}
 *     onClose={() => setConfirmOpen(false)}
 *     onConfirm={handleConfirm}
 *     title="Confirm Status Change"
 *     message={`Are you sure you want to mark "${resource.name}" as under maintenance?`}
 *   />
 */
export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  icon: Icon = AlertCircle,
  iconBg = "bg-amber-50",
  iconColor = "text-amber-600",
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-100 animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon badge */ }
        <div className={`w-10 h-10 rounded-full ${iconBg} ${iconColor} flex items-center justify-center mb-3`}>
          <Icon size={20} />
        </div>

        {/* Title & Message */ }
        <h3 className="text-base font-semibold text-slate-800">{title}</h3>
        <p className="text-xs text-slate-600 mt-1">{message}</p>

        {/* Action Buttons */ }
        <div className="flex items-center gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 rounded-lg bg-[#0B6E4F] hover:bg-[#08523B] text-white text-xs font-medium transition-colors"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
