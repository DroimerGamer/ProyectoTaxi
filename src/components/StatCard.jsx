export default function StatCard({ icon: Icon, label, value, sublabel, color = 'taxi' }) {
  const colorClasses = {
    taxi:    'bg-taxi-500/10 text-taxi-400 border-taxi-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    red:     'bg-red-500/10 text-red-400 border-red-500/20',
    blue:    'bg-blue-500/10 text-blue-400 border-blue-500/20',
  }

  const iconColors = {
    taxi:    'text-taxi-500',
    emerald: 'text-emerald-500',
    red:     'text-red-500',
    blue:    'text-blue-500',
  }

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-pizarra-500 uppercase tracking-wider mb-2">
            {label}
          </p>
          <p className="text-2xl font-display font-bold text-pizarra-50 truncate">
            {value}
          </p>
          {sublabel && (
            <p className="mt-1 text-xs text-pizarra-500">{sublabel}</p>
          )}
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-xl border ${colorClasses[color]}`}>
            <Icon className={`w-5 h-5 ${iconColors[color]}`} />
          </div>
        )}
      </div>
    </div>
  )
}
