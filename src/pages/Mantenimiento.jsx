import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDate, formatMXN } from '@/lib/helpers'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import { Wrench, Loader2, Car, AlertTriangle, CheckCircle, Clock, HelpCircle } from 'lucide-react'
import { ITEMS_MANTENIMIENTO, getEstadoMantenimiento, ESTADO_STYLES } from '@/lib/mantenimiento'

// Íconos por estado
const ESTADO_ICON = {
  ok:           <CheckCircle className="w-4 h-4" />,
  proximo:      <Clock className="w-4 h-4" />,
  vencido:      <AlertTriangle className="w-4 h-4" />,
  sin_registro: <HelpCircle className="w-4 h-4" />,
}

export default function Mantenimiento() {
  const [unidades, setUnidades] = useState([])
  const [gastos, setGastos]     = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const [{ data: u }, { data: g }] = await Promise.all([
        supabase.from('unidades').select('id, numero, chofer').eq('activa', true).order('numero'),
        supabase.from('gastos')
          .select('id, unidad_id, mantenimiento_tipo, fecha, monto, concepto')
          .not('mantenimiento_tipo', 'is', null)
          .eq('estado', 'aprobado')
          .order('fecha', { ascending: false }),
      ])
      setUnidades(u || [])
      setGastos(g || [])
    } catch {
      // silencioso
    } finally {
      setLoading(false)
    }
  }

  // Para cada unidad y cada item, encontrar el último gasto
  const panelData = useMemo(() => {
    const hoy = new Date()
    return unidades.map(u => {
      const items = ITEMS_MANTENIMIENTO.map(item => {
        const ultimo = gastos
          .filter(g => g.unidad_id === u.id && g.mantenimiento_tipo === item.tipo)
          .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0]

        let diasTranscurridos = null
        if (ultimo) {
          const diff = hoy - new Date(ultimo.fecha + 'T00:00:00')
          diasTranscurridos = Math.floor(diff / (1000 * 60 * 60 * 24))
        }

        const estado = getEstadoMantenimiento(diasTranscurridos, item.diasAlerta)

        return {
          ...item,
          ultimo,
          diasTranscurridos,
          estado,
        }
      })

      const alertas = items.filter(i => i.estado === 'vencido' || i.estado === 'sin_registro').length
      const proximos = items.filter(i => i.estado === 'proximo').length

      return { ...u, items, alertas, proximos }
    })
  }, [unidades, gastos])

  // Resumen general
  const totalVencidos  = panelData.reduce((s, u) => s + u.alertas, 0)
  const totalProximos  = panelData.reduce((s, u) => s + u.proximos, 0)

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-taxi-500" />
    </div>
  )

  return (
    <div>
      <PageHeader
        title="Mantenimiento"
        subtitle="Seguimiento de mantenimiento preventivo por unidad"
      />

      {/* Resumen rápido */}
      {(totalVencidos > 0 || totalProximos > 0) && (
        <div className="flex flex-wrap gap-3 mb-6">
          {totalVencidos > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold">
              <AlertTriangle className="w-4 h-4" />
              {totalVencidos} {totalVencidos === 1 ? 'mantenimiento vencido' : 'mantenimientos vencidos'}
            </div>
          )}
          {totalProximos > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-semibold">
              <Clock className="w-4 h-4" />
              {totalProximos} {totalProximos === 1 ? 'mantenimiento próximo' : 'mantenimientos próximos'}
            </div>
          )}
        </div>
      )}

      {panelData.length === 0 ? (
        <EmptyState icon={Car} title="Sin unidades" message="No hay unidades activas para mostrar." />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {panelData.map(u => (
            <div key={u.id} className="card overflow-hidden">
              {/* Header de la unidad */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-pizarra-700/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-taxi-500/10 border border-taxi-500/20 flex items-center justify-center">
                    <Car className="w-4 h-4 text-taxi-400" />
                  </div>
                  <div>
                    <p className="font-mono font-bold text-taxi-400">#{u.numero}</p>
                    <p className="text-xs text-pizarra-500">{u.chofer}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {u.alertas > 0 && (
                    <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 font-semibold">
                      <AlertTriangle className="w-3 h-3" />
                      {u.alertas}
                    </span>
                  )}
                  {u.proximos > 0 && (
                    <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">
                      <Clock className="w-3 h-3" />
                      {u.proximos}
                    </span>
                  )}
                </div>
              </div>

              {/* Items de mantenimiento */}
              <div className="divide-y divide-pizarra-700/30">
                {u.items.map(item => {
                  const style = ESTADO_STYLES[item.estado]
                  return (
                    <div key={item.tipo} className="flex items-center justify-between px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className={`flex items-center justify-center w-7 h-7 rounded-lg border ${style.bg} ${style.border} ${style.text} flex-shrink-0`}>
                          {ESTADO_ICON[item.estado]}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-pizarra-200">{item.label}</p>
                          {item.ultimo ? (
                            <p className="text-xs text-pizarra-500">
                              {formatDate(item.ultimo.fecha)} · {formatMXN(item.ultimo.monto)}
                            </p>
                          ) : (
                            <p className="text-xs text-pizarra-600">Sin registro</p>
                          )}
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0 ml-4">
                        {item.diasTranscurridos !== null ? (
                          <>
                            <p className={`text-sm font-bold ${style.text}`}>
                              {item.diasTranscurridos === 0
                                ? 'Hoy'
                                : item.diasTranscurridos < 30
                                  ? `${item.diasTranscurridos}d`
                                  : `${Math.round(item.diasTranscurridos / 30)}m`}
                            </p>
                            <p className="text-[10px] text-pizarra-600">
                              de {item.diasAlerta < 30
                                ? `${item.diasAlerta}d`
                                : `${Math.round(item.diasAlerta / 30)}m`}
                            </p>
                          </>
                        ) : (
                          <span className={`text-xs px-2 py-0.5 rounded-md ${style.bg} ${style.text} border ${style.border}`}>
                            {style.label}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
