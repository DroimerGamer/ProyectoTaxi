import { Inbox } from 'lucide-react'

export default function EmptyState({ icon: Icon = Inbox, title, message, children }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="p-4 rounded-2xl bg-pizarra-800/50 border border-pizarra-700/40 mb-4">
        <Icon className="w-8 h-8 text-pizarra-500" />
      </div>
      <h3 className="text-lg font-display font-semibold text-pizarra-300 mb-1">
        {title || 'Sin datos'}
      </h3>
      {message && (
        <p className="text-sm text-pizarra-500 text-center max-w-sm">{message}</p>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}
