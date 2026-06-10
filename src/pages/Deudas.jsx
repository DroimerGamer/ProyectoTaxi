import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { formatMXN, formatDate, labelUnidad } from '@/lib/helpers'
import PageHeader from '@/components/PageHeader'
import Modal from '@/components/Modal'
import EmptyState from '@/components/EmptyState'
import {
  HandCoins, Plus, Loader2, ChevronDown, ChevronUp,
  CheckCircle2, Clock, Filter, Banknote, AlertCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'

const EMPTY_DEUDA = {
  unidad_id: '',
  concepto: '',
  monto_total: '',
  fecha: new Date().toISOString().split('T')[0],
  notas: '',
}

const EMPTY_ABONO = {
  monto: '',
  fecha: new Date().toISOString().split('T')[0],
  notas: '',
}

export default function Deudas() {
  const { user } = useAuth()
  const [unidades, setUnidades] = useState([])
  const [deudas, setDeudas] = useState([])
  const [abonosPorDeuda, setAbonosPorDeuda] = useState({}) // { deuda_id: [abonos] }
  const [loading, setLoading] = useState(true)

  // Filtros
  const [filtroUnidad, setFiltroUnidad] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('activa') // 'activa' | 'pagada' | ''

  // Modal nueva deuda
  const [modalDeuda, setModalDeuda] = useState(false)
  const [formDeuda, setFormDeuda] = useState(EMPTY_DEUDA)
  const [savingDeuda, setSavingDeuda] = useState(false)

  // Modal abonos
  const [modalAbono, setModalAbono] = useState(false)
  const [deudaSeleccionada, setDeudaSeleccionada] = useState(null)
  const [formAbono, setFormAbono] = useState(EMPTY_ABONO)
  const [savingAbono, setSavingAbono] = useState(false)
  const [loadingAbonos, setLoadingAbonos] = useState(false)

  // Panel colapsable por deuda
  const [expandidas, setExpandidas] = useState({})

  useEffect(() => {
    fetchBase()
  }, [])

  useEffect(() => {
    fetchDeudas()
  }, [filtroUnidad, filtroEstado])

  async function fetchBase() {
    const { data: u } = await supabase
      .from('unidades')
      .select('id, numero, chofer')
      .eq('activa', true)
      .order('numero')
    setUnidades(u || [])
  }

  async function fetchDeudas() {
    setLoading(true)
    try {
      let query = supabase
        .from('deudas')
        .select('*, unidades(numero, chofer)')
        .order('fecha', { ascending: false })

      if (filtroUnidad) query = query.eq('unidad_id', filtroUnidad)
      if (filtroEstado) query = query.eq('estado', filtroEstado)

      const { data, error } = await query
      if (error) throw error
      setDeudas(data || [])

      // Cargar abonos de todas las deudas visibles
      if (data && data.length > 0) {
        const ids = data.map(d => d.id)
        const { data: abs } = await supabase
          .from('abonos')
          .select('*')
          .in('deuda_id', ids)
          .order('fecha', { ascending: false })

        const mapa = {}
        ;(abs || []).forEach(a => {
          if (!mapa[a.deuda_id]) mapa[a.deuda_id] = []
          mapa[a.deuda_id].push(a)
        })
        setAbonosPorDeuda(mapa)
      } else {
        setAbonosPorDeuda({})
      }
    } catch (err) {
      toast.error('Error al cargar deudas')
    } finally {
      setLoading(false)
    }
  }

  // ── Nueva deuda ──────────────────────────────────────────────────────────────

  function openNuevaDeuda() {
    setFormDeuda({
      ...EMPTY_DEUDA,
      unidad_id: unidades[0]?.id || '',
      fecha: new Date().toISOString().split('T')[0],
    })
    setModalDeuda(true)
  }

  async function guardarDeuda() {
    if (!formDeuda.unidad_id || !formDeuda.concepto || !formDeuda.monto_total || !formDeuda.fecha) {
      toast.error('Completa los campos obligatorios')
      return
    }
    setSavingDeuda(true)
    try {
      const { error } = await supabase.from('deudas').insert({
        unidad_id: Number(formDeuda.unidad_id),
        concepto: formDeuda.concepto,
        monto_total: Number(formDeuda.monto_total),
        fecha: formDeuda.fecha,
        notas: formDeuda.notas || null,
        estado: 'activa',
        registrado_por: user.id,
      })
      if (error) throw error
      toast.success('Deuda registrada')
      setModalDeuda(false)
      fetchDeudas()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSavingDeuda(false)
    }
  }

  // ── Abonos ───────────────────────────────────────────────────────────────────

  function openAbonos(deuda) {
    setDeudaSeleccionada(deuda)
    setFormAbono({ ...EMPTY_ABONO, fecha: new Date().toISOString().split('T')[0] })
    setModalAbono(true)
  }

  async function guardarAbono() {
    if (!formAbono.monto || !formAbono.fecha) {
      toast.error('Ingresa el monto y la fecha del abono')
      return
    }
    setSavingAbono(true)
    try {
      const { error } = await supabase.from('abonos').insert({
        deuda_id: deudaSeleccionada.id,
        monto: Number(formAbono.monto),
        fecha: formAbono.fecha,
        notas: formAbono.notas || null,
        registrado_por: user.id,
      })
      if (error) throw error

      // Si el total abonado cubre la deuda, marcar como pagada automáticamente
      const absPrevios = abonosPorDeuda[deudaSeleccionada.id] || []
      const totalAbonado = absPrevios.reduce((s, a) => s + Number(a.monto), 0) + Number(formAbono.monto)
      if (totalAbonado >= Number(deudaSeleccionada.monto_total)) {
        await supabase.from('deudas').update({ estado: 'pagada' }).eq('id', deudaSeleccionada.id)
        toast.success('Abono registrado — deuda saldada ✓')
      } else {
        toast.success('Abono registrado')
      }

      setModalAbono(false)
      fetchDeudas()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSavingAbono(false)
    }
  }

  async function marcarPagada(deuda) {
    const { error } = await supabase.from('deudas').update({ estado: 'pagada' }).eq('id', deuda.id)
    if (error) { toast.error(error.message); return }
    toast.success('Deuda marcada como pagada')
    fetchDeudas()
  }

  async function marcarActiva(deuda) {
    const { error } = await supabase.from('deudas').update({ estado: 'activa' }).eq('id', deuda.id)
    if (error) { toast.error(error.message); return }
    toast.success('Deuda reactivada')
    fetchDeudas()
  }

  // ── Helpers de cálculo ────────────────────────────────────────────────────

  function totalAbonado(deudaId) {
    return (abonosPorDeuda[deudaId] || []).reduce((s, a) => s + Number(a.monto), 0)
  }

  function saldoPendiente(deuda) {
    return Math.max(0, Number(deuda.monto_total) - totalAbonado(deuda.id))
  }

  function porcentajePagado(deuda) {
    const pct = (totalAbonado(deuda.id) / Number(deuda.monto_total)) * 100
    return Math.min(100, pct)
  }

  function toggleExpand(id) {
    setExpandidas(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // ── Totales resumen ───────────────────────────────────────────────────────

  const totalDeuda = deudas.reduce((s, d) => s + Number(d.monto_total), 0)
  const totalAbos  = deudas.reduce((s, d) => s + totalAbonado(d.id), 0)
  const totalSaldo = deudas.reduce((s, d) => s + saldoPendiente(d), 0)

  return (
    <div>
      <PageHeader title="Deudas" subtitle="Control de adeudos por chofer">
        <button onClick={openNuevaDeuda} className="btn-primary">
          <Plus className="w-4 h-4" />
          Nueva deuda
        </button>
      </PageHeader>

      {/* Filtros */}
      <div className="card p-4 mb-6">
        <div className="flex items-center gap-2 mb-3 text-pizarra-400">
          <Filter className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Filtros</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select className="input" value={filtroUnidad} onChange={e => setFiltroUnidad(e.target.value)}>
            <option value="">Todos los choferes</option>
            {unidades.map(u => (
              <option key={u.id} value={u.id}>{labelUnidad(u)} — {u.chofer}</option>
            ))}
          </select>
          <select className="input" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="activa">Solo activas</option>
            <option value="pagada">Solo pagadas</option>
            <option value="">Todas</option>
          </select>
        </div>
      </div>

      {/* Tarjetas de resumen */}
      {!loading && deudas.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="card p-4 text-center">
            <p className="text-xs text-pizarra-400 uppercase tracking-wider mb-1">Total adeudado</p>
            <p className="text-lg font-bold text-red-400 font-mono">{formatMXN(totalDeuda)}</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-xs text-pizarra-400 uppercase tracking-wider mb-1">Total abonado</p>
            <p className="text-lg font-bold text-emerald-400 font-mono">{formatMXN(totalAbos)}</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-xs text-pizarra-400 uppercase tracking-wider mb-1">Saldo pendiente</p>
            <p className="text-lg font-bold text-amber-400 font-mono">{formatMXN(totalSaldo)}</p>
          </div>
        </div>
      )}

      {/* Lista de deudas */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-taxi-500" />
        </div>
      ) : deudas.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title="Sin deudas registradas"
          message="No hay adeudos que coincidan con los filtros seleccionados."
        />
      ) : (
        <div className="space-y-3">
          {deudas.map(deuda => {
            const abonados = totalAbonado(deuda.id)
            const saldo = saldoPendiente(deuda)
            const pct = porcentajePagado(deuda)
            const pagada = deuda.estado === 'pagada'
            const absDeuda = abonosPorDeuda[deuda.id] || []
            const expanded = expandidas[deuda.id]

            return (
              <div
                key={deuda.id}
                className={`card overflow-hidden border ${pagada ? 'border-emerald-500/20' : 'border-pizarra-700/50'}`}
              >
                {/* Encabezado de la deuda */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    {/* Info principal */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-mono font-bold text-taxi-400 text-sm">
                          {labelUnidad(deuda.unidades)}
                        </span>
                        <span className="text-pizarra-500 text-xs">·</span>
                        <span className="text-pizarra-400 text-xs">{deuda.unidades?.chofer}</span>
                        <span className="text-pizarra-500 text-xs">·</span>
                        <span className="text-pizarra-400 text-xs">{formatDate(deuda.fecha)}</span>
                        {pagada ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" /> Pagada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            <Clock className="w-3 h-3" /> Activa
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-pizarra-100">{deuda.concepto}</p>
                      {deuda.notas && (
                        <p className="text-xs text-pizarra-500 mt-0.5">{deuda.notas}</p>
                      )}
                    </div>

                    {/* Montos */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-pizarra-400">Total</p>
                      <p className="font-bold text-pizarra-100 font-mono">{formatMXN(deuda.monto_total)}</p>
                      {!pagada && (
                        <>
                          <p className="text-xs text-pizarra-400 mt-1">Pendiente</p>
                          <p className="font-bold text-amber-400 font-mono">{formatMXN(saldo)}</p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Barra de progreso */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-pizarra-400 mb-1">
                      <span>Abonado: {formatMXN(abonados)}</span>
                      <span>{Math.round(pct)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-pizarra-700/50 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pagada ? 'bg-emerald-500' : 'bg-taxi-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-2 mt-3">
                    {!pagada && (
                      <>
                        <button
                          onClick={() => openAbonos(deuda)}
                          className="btn-primary text-xs py-1.5 px-3"
                        >
                          <Banknote className="w-3.5 h-3.5" />
                          Registrar abono
                        </button>
                        <button
                          onClick={() => marcarPagada(deuda)}
                          className="btn-secondary text-xs py-1.5 px-3"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Marcar pagada
                        </button>
                      </>
                    )}
                    {pagada && (
                      <button
                        onClick={() => marcarActiva(deuda)}
                        className="btn-secondary text-xs py-1.5 px-3"
                      >
                        <AlertCircle className="w-3.5 h-3.5" />
                        Reactivar
                      </button>
                    )}
                    {absDeuda.length > 0 && (
                      <button
                        onClick={() => toggleExpand(deuda.id)}
                        className="ml-auto flex items-center gap-1 text-xs text-pizarra-400 hover:text-pizarra-200 transition-colors"
                      >
                        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        {absDeuda.length} abono{absDeuda.length !== 1 ? 's' : ''}
                      </button>
                    )}
                  </div>
                </div>

                {/* Historial de abonos colapsable */}
                {expanded && absDeuda.length > 0 && (
                  <div className="border-t border-pizarra-700/40 bg-pizarra-800/30">
                    <div className="px-4 py-2">
                      <p className="text-xs font-semibold text-pizarra-400 uppercase tracking-wider mb-2">
                        Historial de abonos
                      </p>
                      <div className="space-y-1.5">
                        {absDeuda.map(a => (
                          <div key={a.id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-pizarra-400 text-xs">{formatDate(a.fecha)}</span>
                              {a.notas && <span className="text-pizarra-500 text-xs italic">— {a.notas}</span>}
                            </div>
                            <span className="font-mono font-semibold text-emerald-400">{formatMXN(a.monto)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal nueva deuda ──────────────────────────────────────────────────── */}
      <Modal open={modalDeuda} onClose={() => setModalDeuda(false)} title="Nueva deuda">
        <div className="space-y-4">
          <div>
            <label className="label">Chofer / Unidad *</label>
            <select
              className="input"
              value={formDeuda.unidad_id}
              onChange={e => setFormDeuda({ ...formDeuda, unidad_id: e.target.value })}
            >
              <option value="">Seleccionar</option>
              {unidades.map(u => (
                <option key={u.id} value={u.id}>{labelUnidad(u)} — {u.chofer}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Concepto *</label>
            <input
              className="input"
              placeholder="Descripción de la deuda"
              value={formDeuda.concepto}
              onChange={e => setFormDeuda({ ...formDeuda, concepto: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Monto total *</label>
              <input
                type="number"
                className="input"
                placeholder="0.00"
                min="0"
                step="0.01"
                value={formDeuda.monto_total}
                onChange={e => setFormDeuda({ ...formDeuda, monto_total: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Fecha *</label>
              <input
                type="date"
                className="input"
                value={formDeuda.fecha}
                onChange={e => setFormDeuda({ ...formDeuda, fecha: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="label">Notas</label>
            <input
              className="input"
              placeholder="Observaciones (opcional)"
              value={formDeuda.notas}
              onChange={e => setFormDeuda({ ...formDeuda, notas: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalDeuda(false)} className="btn-secondary">Cancelar</button>
            <button onClick={guardarDeuda} disabled={savingDeuda} className="btn-primary">
              {savingDeuda ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Registrar deuda'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal abono ───────────────────────────────────────────────────────── */}
      <Modal
        open={modalAbono}
        onClose={() => setModalAbono(false)}
        title="Registrar abono"
      >
        {deudaSeleccionada && (
          <div className="space-y-4">
            {/* Info de la deuda */}
            <div className="p-3 rounded-xl bg-pizarra-800/50 border border-pizarra-700/40">
              <p className="text-sm font-semibold text-pizarra-100">{deudaSeleccionada.concepto}</p>
              <p className="text-xs text-pizarra-400 mt-0.5">
                {labelUnidad(deudaSeleccionada.unidades)} — {deudaSeleccionada.unidades?.chofer}
              </p>
              <div className="flex gap-4 mt-2 text-xs">
                <span className="text-pizarra-400">
                  Total: <span className="font-mono text-pizarra-200">{formatMXN(deudaSeleccionada.monto_total)}</span>
                </span>
                <span className="text-pizarra-400">
                  Abonado: <span className="font-mono text-emerald-400">{formatMXN(totalAbonado(deudaSeleccionada.id))}</span>
                </span>
                <span className="text-pizarra-400">
                  Pendiente: <span className="font-mono text-amber-400">{formatMXN(saldoPendiente(deudaSeleccionada))}</span>
                </span>
              </div>
            </div>

            {/* Historial previo */}
            {(abonosPorDeuda[deudaSeleccionada.id] || []).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-pizarra-400 uppercase tracking-wider mb-2">Abonos anteriores</p>
                <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                  {(abonosPorDeuda[deudaSeleccionada.id] || []).map(a => (
                    <div key={a.id} className="flex justify-between text-sm">
                      <span className="text-pizarra-400 text-xs">{formatDate(a.fecha)}{a.notas ? ` — ${a.notas}` : ''}</span>
                      <span className="font-mono text-emerald-400 text-xs">{formatMXN(a.monto)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Formulario nuevo abono */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Monto del abono *</label>
                <input
                  type="number"
                  className="input"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  value={formAbono.monto}
                  onChange={e => setFormAbono({ ...formAbono, monto: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Fecha *</label>
                <input
                  type="date"
                  className="input"
                  value={formAbono.fecha}
                  onChange={e => setFormAbono({ ...formAbono, fecha: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="label">Notas</label>
              <input
                className="input"
                placeholder="Referencia, método de pago, etc. (opcional)"
                value={formAbono.notas}
                onChange={e => setFormAbono({ ...formAbono, notas: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setModalAbono(false)} className="btn-secondary">Cancelar</button>
              <button onClick={guardarAbono} disabled={savingAbono} className="btn-primary">
                {savingAbono ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Registrar abono'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
