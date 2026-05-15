import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { formatMXN, formatDate } from '@/lib/helpers'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import Modal from '@/components/Modal'
import { TrendingUp, Plus, Pencil, Loader2, Download, Filter } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Ingresos() {
  const { user } = useAuth()
  const [ingresos, setIngresos] = useState([])
  const [unidades, setUnidades] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ unidad_id: '', fecha: '', monto: '', notas: '' })
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)

  // Filtros
  const [filtroUnidad, setFiltroUnidad] = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')

  useEffect(() => {
    fetchUnidades()
    fetchIngresos()
  }, [filtroUnidad, filtroDesde, filtroHasta])

  async function fetchUnidades() {
    const { data } = await supabase
      .from('unidades')
      .select('id, numero, chofer')
      .eq('activa', true)
      .order('numero')
    setUnidades(data || [])
  }

  async function fetchIngresos() {
    setLoading(true)
    try {
      let query = supabase
        .from('ingresos')
        .select('*, unidades(numero, chofer)')
        .order('fecha', { ascending: false })
        .limit(100)

      if (filtroUnidad) query = query.eq('unidad_id', filtroUnidad)
      if (filtroDesde) query = query.gte('fecha', filtroDesde)
      if (filtroHasta) query = query.lte('fecha', filtroHasta)

      const { data, error } = await query
      if (error) throw error
      setIngresos(data || [])
    } catch (err) {
      toast.error('Error al cargar ingresos')
    } finally {
      setLoading(false)
    }
  }

  function openNew() {
    setForm({
      unidad_id: unidades[0]?.id || '',
      fecha: new Date().toISOString().split('T')[0],
      monto: '',
      notas: '',
    })
    setEditId(null)
    setModalOpen(true)
  }

  function openEdit(ingreso) {
    setForm({
      unidad_id: ingreso.unidad_id,
      fecha: ingreso.fecha,
      monto: ingreso.monto,
      notas: ingreso.notas || '',
    })
    setEditId(ingreso.id)
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.unidad_id || !form.fecha || !form.monto) {
      toast.error('Complete los campos obligatorios')
      return
    }

    setSaving(true)
    try {
      const payload = {
        unidad_id: Number(form.unidad_id),
        fecha: form.fecha,
        monto: Number(form.monto),
        notas: form.notas || null,
        registrado_por: user.id,
      }

      if (editId) {
        const { error } = await supabase.from('ingresos').update(payload).eq('id', editId)
        if (error) throw error
        toast.success('Ingreso actualizado')
      } else {
        const { error } = await supabase.from('ingresos').insert(payload)
        if (error) throw error
        toast.success('Ingreso registrado')
      }

      setModalOpen(false)
      fetchIngresos()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  function exportCSV() {
    if (ingresos.length === 0) return
    const headers = ['Fecha', 'Unidad', 'Chofer', 'Monto', 'Notas']
    const rows = ingresos.map(i => [
      i.fecha,
      `#${i.unidades?.numero}`,
      i.unidades?.chofer,
      i.monto,
      i.notas || '',
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ingresos_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Archivo exportado')
  }

  const totalFiltrado = ingresos.reduce((s, i) => s + Number(i.monto), 0)

  return (
    <div>
      <PageHeader title="Ingresos" subtitle="Registro de ingresos por unidad">
        <button onClick={exportCSV} className="btn-secondary" disabled={ingresos.length === 0}>
          <Download className="w-4 h-4" />
          Exportar
        </button>
        <button onClick={openNew} className="btn-primary">
          <Plus className="w-4 h-4" />
          Nuevo ingreso
        </button>
      </PageHeader>

      {/* Filtros */}
      <div className="card p-4 mb-6">
        <div className="flex items-center gap-2 mb-3 text-pizarra-400">
          <Filter className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Filtros</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            className="input"
            value={filtroUnidad}
            onChange={(e) => setFiltroUnidad(e.target.value)}
          >
            <option value="">Todas las unidades</option>
            {unidades.map(u => (
              <option key={u.id} value={u.id}>#{u.numero} — {u.chofer}</option>
            ))}
          </select>
          <input
            type="date"
            className="input"
            value={filtroDesde}
            onChange={(e) => setFiltroDesde(e.target.value)}
            placeholder="Desde"
          />
          <input
            type="date"
            className="input"
            value={filtroHasta}
            onChange={(e) => setFiltroHasta(e.target.value)}
            placeholder="Hasta"
          />
        </div>
      </div>

      {/* Total filtrado */}
      {ingresos.length > 0 && (
        <div className="flex justify-between items-center mb-4 px-1">
          <span className="text-sm text-pizarra-400">{ingresos.length} registros</span>
          <span className="text-sm font-semibold text-emerald-400">
            Total: {formatMXN(totalFiltrado)}
          </span>
        </div>
      )}

      {/* Tabla */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-taxi-500" />
        </div>
      ) : ingresos.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="Sin ingresos"
          message="No se encontraron ingresos con los filtros seleccionados."
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-pizarra-700/50">
                  <th className="table-header">Fecha</th>
                  <th className="table-header">Unidad</th>
                  <th className="table-header">Chofer</th>
                  <th className="table-header text-right">Monto</th>
                  <th className="table-header">Notas</th>
                  <th className="table-header text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pizarra-700/30">
                {ingresos.map((i) => (
                  <tr key={i.id} className="hover:bg-pizarra-700/20 transition-colors">
                    <td className="table-cell text-pizarra-300">{formatDate(i.fecha)}</td>
                    <td className="table-cell font-mono font-semibold text-taxi-400">
                      #{i.unidades?.numero}
                    </td>
                    <td className="table-cell">{i.unidades?.chofer}</td>
                    <td className="table-cell text-right font-mono font-semibold text-emerald-400">
                      {formatMXN(i.monto)}
                    </td>
                    <td className="table-cell text-pizarra-500 max-w-[200px] truncate">
                      {i.notas || '—'}
                    </td>
                    <td className="table-cell text-right">
                      <button
                        onClick={() => openEdit(i)}
                        className="p-2 rounded-lg hover:bg-pizarra-700/50 text-pizarra-400 hover:text-pizarra-200 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Editar ingreso' : 'Nuevo ingreso'}
      >
        <div className="space-y-4">
          <div>
            <label className="label">Unidad *</label>
            <select
              className="input"
              value={form.unidad_id}
              onChange={(e) => setForm({ ...form, unidad_id: e.target.value })}
            >
              <option value="">Seleccionar unidad</option>
              {unidades.map(u => (
                <option key={u.id} value={u.id}>#{u.numero} — {u.chofer}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Fecha *</label>
              <input
                type="date"
                className="input"
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Monto *</label>
              <input
                type="number"
                className="input"
                value={form.monto}
                onChange={(e) => setForm({ ...form, monto: e.target.value })}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div>
            <label className="label">Notas</label>
            <input
              className="input"
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              placeholder="Observaciones (opcional)"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editId ? 'Guardar cambios' : 'Registrar')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
