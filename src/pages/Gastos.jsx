import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { formatMXN, formatDate, labelUnidad } from '@/lib/helpers'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import Modal from '@/components/Modal'
import { TrendingDown, Plus, Pencil, Loader2, Download, Filter, AlertTriangle, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { ITEMS_MANTENIMIENTO } from '@/lib/mantenimiento'

const NOMBRES_CATEGORIA = ['Mano de obra', 'Refacciones', 'Nómina']
const LABEL_CATEGORIA = { 'Mano de obra': 'Mano de obra', 'Refacciones': 'Refacciones', 'Nómina': 'Nómina' }

export default function Gastos() {
  const { user } = useAuth()
  const [gastos, setGastos] = useState([])
  const [unidades, setUnidades] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    unidad_id: '', categoria_id: '', fecha: '', concepto: '', monto: '', notas: '', mantenimiento_tipo: '',
  })
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [alertaMant, setAlertaMant] = useState(null)
  const [gastosRecientes, setGastosRecientes] = useState([])
  const [loadingRecientes, setLoadingRecientes] = useState(false)

  const [filtroUnidad, setFiltroUnidad] = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')

  useEffect(() => {
    fetchBase()
  }, [])

  useEffect(() => {
    fetchGastos()
  }, [filtroUnidad, filtroDesde, filtroHasta])

  async function fetchBase() {
    const [{ data: u }, { data: c }] = await Promise.all([
      supabase.from('unidades').select('id, numero, chofer').eq('activa', true).order('numero'),
      supabase.from('categorias_gasto').select('*').eq('activa', true).order('nombre'),
    ])
    setUnidades(u || [])
    setCategorias(c || [])
  }

  async function fetchGastos() {
    setLoading(true)
    try {
      let query = supabase
        .from('gastos')
        .select('*, unidades(numero, chofer), categorias_gasto(nombre)')
        .order('fecha', { ascending: false })
        .limit(100)

      if (filtroUnidad) query = query.eq('unidad_id', filtroUnidad)
      if (filtroDesde) query = query.gte('fecha', filtroDesde)
      if (filtroHasta) query = query.lte('fecha', filtroHasta)

      const { data, error } = await query
      if (error) throw error
      setGastos(data || [])
    } catch (err) {
      toast.error('Error al cargar gastos')
    } finally {
      setLoading(false)
    }
  }

  function openNew() {
    setForm({
      unidad_id: '',
      categoria_id: '',
      fecha: new Date().toISOString().split('T')[0],
      concepto: '',
      monto: '',
      notas: '',
      mantenimiento_tipo: '',
    })
    setAlertaMant(null)
    setGastosRecientes([])
    setEditId(null)
    setModalOpen(true)
  }

  async function handleDelete(gasto) {
    if (!window.confirm(`¿Eliminar este gasto de ${formatMXN(gasto.monto)}? Esta acción no se puede deshacer.`)) return
    try {
      const { error } = await supabase.from('gastos').delete().eq('id', gasto.id)
      if (error) throw error
      toast.success('Gasto eliminado')
      fetchGastos()
    } catch (err) {
      toast.error(err.message)
    }
  }

  function openEdit(gasto) {
    setForm({
      unidad_id: gasto.unidad_id,
      categoria_id: gasto.categoria_id || '',
      fecha: gasto.fecha,
      concepto: gasto.concepto,
      monto: gasto.monto,
      notas: gasto.notas || '',
      mantenimiento_tipo: gasto.mantenimiento_tipo || '',
    })
    setAlertaMant(null)
    setGastosRecientes([])
    fetchGastosRecientes(gasto.unidad_id)
    setEditId(gasto.id)
    setModalOpen(true)
  }

  async function fetchGastosRecientes(unidad_id) {
    if (!unidad_id) { setGastosRecientes([]); return }
    setLoadingRecientes(true)
    const hace3Meses = new Date()
    hace3Meses.setMonth(hace3Meses.getMonth() - 3)
    const desde = hace3Meses.toISOString().split('T')[0]
    const { data } = await supabase
      .from('gastos')
      .select('fecha, concepto, monto, categorias_gasto(nombre)')
      .eq('unidad_id', unidad_id)
      .gte('fecha', desde)
      .order('fecha', { ascending: false })
      .limit(20)
    setGastosRecientes(data || [])
    setLoadingRecientes(false)
  }

  // Verificar si ya se hizo este mantenimiento recientemente
  async function verificarMantenimiento(unidad_id, mantenimiento_tipo) {
    if (!unidad_id || !mantenimiento_tipo) { setAlertaMant(null); return }
    const { data } = await supabase
      .from('gastos')
      .select('fecha, monto')
      .eq('unidad_id', unidad_id)
      .eq('mantenimiento_tipo', mantenimiento_tipo)
      .eq('estado', 'aprobado')
      .order('fecha', { ascending: false })
      .limit(1)

    if (data && data.length > 0) {
      const ultimo = data[0]
      const dias = Math.floor((new Date() - new Date(ultimo.fecha + 'T00:00:00')) / 86400000)
      const item = ITEMS_MANTENIMIENTO.find(i => i.tipo === mantenimiento_tipo)
      setAlertaMant({ label: item?.label, diasTranscurridos: dias, fecha: ultimo.fecha, diasAlerta: item?.diasAlerta })
    } else {
      setAlertaMant(null)
    }
  }

  async function handleSave() {
    if (!form.unidad_id || !form.fecha || !form.concepto || !form.monto) {
      toast.error('Complete los campos obligatorios')
      return
    }

    setSaving(true)
    try {
      const payload = {
        unidad_id: Number(form.unidad_id),
        categoria_id: form.categoria_id ? Number(form.categoria_id) : null,
        fecha: form.fecha,
        concepto: form.concepto,
        monto: Number(form.monto),
        notas: form.notas || null,
        mantenimiento_tipo: form.mantenimiento_tipo || null,
        estado: 'aprobado',
        registrado_por: user.id,
      }

      if (editId) {
        const { error } = await supabase.from('gastos').update(payload).eq('id', editId)
        if (error) throw error
        toast.success('Gasto actualizado')
      } else {
        const { error } = await supabase.from('gastos').insert(payload)
        if (error) throw error
        toast.success('Gasto registrado')
      }

      setModalOpen(false)
      fetchGastos()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  function exportCSV() {
    if (gastos.length === 0) return
    const headers = ['Fecha', 'Unidad', 'Categoría', 'Concepto', 'Monto', 'Estado']
    const rows = gastos.map(g => [
      g.fecha,
      `#${g.unidades?.numero}`,
      g.categorias_gasto?.nombre || '',
      g.concepto,
      g.monto,
      g.estado,
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gastos_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Archivo exportado')
  }

  const totalFiltrado = gastos.reduce((s, g) => s + Number(g.monto), 0)

  return (
    <div>
      <PageHeader title="Gastos" subtitle="Registro de gastos por unidad">
        <button onClick={exportCSV} className="btn-secondary" disabled={gastos.length === 0}>
          <Download className="w-4 h-4" />
          Exportar
        </button>
        <button onClick={openNew} className="btn-primary">
          <Plus className="w-4 h-4" />
          Nuevo gasto
        </button>
      </PageHeader>

      {/* Filtros */}
      <div className="card p-4 mb-6">
        <div className="flex items-center gap-2 mb-3 text-pizarra-400">
          <Filter className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Filtros</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select className="input" value={filtroUnidad} onChange={(e) => setFiltroUnidad(e.target.value)}>
            <option value="">Todas las unidades</option>
            {unidades.map(u => (
              <option key={u.id} value={u.id}>{labelUnidad(u)} — {u.chofer}</option>
            ))}
          </select>
          <input type="date" className="input" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} />
          <input type="date" className="input" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} />
        </div>
      </div>

      {gastos.length > 0 && (
        <div className="flex justify-between items-center mb-4 px-1">
          <span className="text-sm text-pizarra-400">{gastos.length} registros</span>
          <span className="text-sm font-semibold text-red-400">Total: {formatMXN(totalFiltrado)}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-taxi-500" />
        </div>
      ) : gastos.length === 0 ? (
        <EmptyState icon={TrendingDown} title="Sin gastos" message="No se encontraron gastos con los filtros seleccionados." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-pizarra-700/50">
                  <th className="table-header">Fecha</th>
                  <th className="table-header">Unidad</th>
                  <th className="table-header">Categoría</th>
                  <th className="table-header">Concepto</th>
                  <th className="table-header text-right">Monto</th>
                  <th className="table-header text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pizarra-700/30">
                {gastos.map((g) => (
                  <tr key={g.id} className="hover:bg-pizarra-700/20 transition-colors">
                    <td className="table-cell text-pizarra-300">{formatDate(g.fecha)}</td>
                    <td className="table-cell font-mono font-semibold text-taxi-400">{labelUnidad(g.unidades)}</td>
                    <td className="table-cell text-pizarra-400">
                      {g.categorias_gasto?.nombre
                        ? (LABEL_CATEGORIA[g.categorias_gasto.nombre] ?? g.categorias_gasto.nombre)
                        : '—'}
                    </td>
                    <td className="table-cell">{g.concepto}</td>
                    <td className="table-cell text-right font-mono font-semibold text-red-400">{formatMXN(g.monto)}</td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(g)}
                          className="p-2 rounded-lg hover:bg-pizarra-700/50 text-pizarra-400 hover:text-pizarra-200 transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(g)}
                          className="p-2 rounded-lg hover:bg-red-500/10 text-pizarra-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setAlertaMant(null); setGastosRecientes([]) }} title={editId ? 'Editar gasto' : 'Nuevo gasto'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Unidad *</label>
              <select
                className="input"
                value={form.unidad_id}
                onChange={e => {
                  const val = e.target.value
                  setForm({ ...form, unidad_id: val, mantenimiento_tipo: '' })
                  setAlertaMant(null)
                  fetchGastosRecientes(val)
                }}
              >
                <option value="">Seleccionar</option>
                {unidades.map(u => (
                  <option key={u.id} value={u.id}>{labelUnidad(u)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Categoría</label>
              <select className="input" value={form.categoria_id} onChange={e => {
                setForm({ ...form, categoria_id: e.target.value, mantenimiento_tipo: '' })
                setAlertaMant(null)
              }}>
                <option value="">Seleccionar</option>
                {categorias
                  .filter(c => NOMBRES_CATEGORIA.includes(c.nombre))
                  .map(c => (
                    <option key={c.id} value={c.id}>{LABEL_CATEGORIA[c.nombre] ?? c.nombre}</option>
                  ))
                }
              </select>
            </div>
          </div>

          {/* Mantenimiento preventivo — visible solo si categoría = Refacciones */}
          {categorias.find(c => String(c.id) === String(form.categoria_id))?.nombre === 'Refacciones' && (
            <div>
              <label className="label">Tipo de mantenimiento preventivo</label>
              <select
                className="input"
                value={form.mantenimiento_tipo}
                onChange={e => {
                  const val = e.target.value
                  setForm({ ...form, mantenimiento_tipo: val })
                  verificarMantenimiento(form.unidad_id, val)
                }}
              >
                <option value="">Sin especificar</option>
                {ITEMS_MANTENIMIENTO.map(i => (
                  <option key={i.tipo} value={i.tipo}>{i.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Alerta de mantenimiento reciente */}
          {alertaMant && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-amber-400">
                  Ya se registró este mantenimiento hace {alertaMant.diasTranscurridos === 0 ? 'hoy' : `${alertaMant.diasTranscurridos} día${alertaMant.diasTranscurridos !== 1 ? 's' : ''}`}
                </p>
                <p className="text-pizarra-400 text-xs mt-0.5">
                  Último {alertaMant.label}: {alertaMant.fecha} · Intervalo recomendado: {alertaMant.diasAlerta} días.
                  Verifica si la compra es necesaria.
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="label">Concepto *</label>
            <input className="input" value={form.concepto} onChange={e => setForm({ ...form, concepto: e.target.value })} placeholder="Descripción del gasto" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Fecha *</label>
              <input type="date" className="input" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} />
            </div>
            <div>
              <label className="label">Monto *</label>
              <input type="number" className="input" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} placeholder="0.00" min="0" step="0.01" />
            </div>
          </div>

          <div>
            <label className="label">Notas</label>
            <input className="input" value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} placeholder="Observaciones (opcional)" />
          </div>

          {/* Gastos recientes de la unidad seleccionada */}
          {form.unidad_id && (
            <div className="rounded-xl border border-pizarra-700/40 overflow-hidden">
              <div className="px-3 py-2 bg-pizarra-800/60 border-b border-pizarra-700/40">
                <p className="text-xs font-semibold text-pizarra-400 uppercase tracking-wider">
                  Gastos recientes — últimos 3 meses
                </p>
              </div>
              {loadingRecientes ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-taxi-500" />
                </div>
              ) : gastosRecientes.length === 0 ? (
                <p className="text-xs text-pizarra-500 text-center py-4">Sin gastos en los últimos 3 meses</p>
              ) : (
                <div className="max-h-48 overflow-y-auto divide-y divide-pizarra-700/30">
                  {gastosRecientes.map((g, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 hover:bg-pizarra-700/20 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-pizarra-200 truncate">{g.concepto}</p>
                        <p className="text-[11px] text-pizarra-500 mt-0.5">
                          {formatDate(g.fecha)}
                          {g.categorias_gasto?.nombre && (
                            <span className="ml-1.5 text-pizarra-600">· {g.categorias_gasto.nombre}</span>
                          )}
                        </p>
                      </div>
                      <span className="font-mono text-xs font-semibold text-red-400 ml-3 flex-shrink-0">
                        {formatMXN(g.monto)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setModalOpen(false); setAlertaMant(null); setGastosRecientes([]) }} className="btn-secondary">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editId ? 'Guardar cambios' : 'Registrar')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
