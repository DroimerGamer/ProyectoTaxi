import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { formatMXN, formatDate } from '@/lib/helpers'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import { ClipboardCheck, Check, X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Pendientes() {
  const { user } = useAuth()
  const [pendientes, setPendientes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPendientes()
  }, [])

  async function fetchPendientes() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('gastos')
        .select('*, unidades(numero, chofer), categorias_gasto(nombre)')
        .eq('estado', 'pendiente')
        .order('fecha', { ascending: false })

      if (error) throw error
      setPendientes(data || [])
    } catch (err) {
      toast.error('Error al cargar pendientes')
    } finally {
      setLoading(false)
    }
  }

  async function updateEstado(id, estado) {
    try {
      const { error } = await supabase
        .from('gastos')
        .update({
          estado,
          revisado_por: user.id,
          revisado_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) throw error
      toast.success(estado === 'aprobado' ? 'Gasto aprobado' : 'Gasto rechazado')
      fetchPendientes()
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-taxi-500" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Pendientes"
        subtitle={`${pendientes.length} gastos por revisar`}
      />

      {pendientes.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Todo al día"
          message="No hay gastos pendientes de revisión."
        />
      ) : (
        <div className="space-y-3">
          {pendientes.map((g) => (
            <div key={g.id} className="card-hover p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono font-semibold text-taxi-400">
                      #{g.unidades?.numero}
                    </span>
                    <span className="text-pizarra-500">·</span>
                    <span className="text-sm text-pizarra-400">
                      {g.unidades?.chofer}
                    </span>
                    <span className="text-pizarra-500">·</span>
                    <span className="text-sm text-pizarra-500">
                      {formatDate(g.fecha)}
                    </span>
                  </div>

                  <p className="text-pizarra-200 font-medium">{g.concepto}</p>

                  <div className="flex items-center gap-3 mt-1">
                    {g.categorias_gasto && (
                      <span className="text-xs text-pizarra-500 bg-pizarra-700/50 px-2 py-0.5 rounded-md">
                        {g.categorias_gasto.nombre}
                      </span>
                    )}
                    {g.notas && (
                      <span className="text-xs text-pizarra-500 italic truncate max-w-[200px]">
                        {g.notas}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <p className="text-xl font-display font-bold text-pizarra-100">
                    {formatMXN(g.monto)}
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateEstado(g.id, 'aprobado')}
                      className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                      title="Aprobar"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => updateEstado(g.id, 'rechazado')}
                      className="p-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                      title="Rechazar"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
