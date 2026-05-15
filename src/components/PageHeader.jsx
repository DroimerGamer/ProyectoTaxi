export default function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
      <div>
        <h1 className="font-display font-bold text-2xl lg:text-3xl text-pizarra-50">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-pizarra-400">{subtitle}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </div>
  )
}
