import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg' }) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Content */}
      <div className={`relative w-full ${maxWidth} card border-pizarra-600/50 shadow-2xl animate-in`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-pizarra-700/50">
          <h2 className="font-display font-bold text-lg text-pizarra-50">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-pizarra-700/50 text-pizarra-400 hover:text-pizarra-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  )
}
