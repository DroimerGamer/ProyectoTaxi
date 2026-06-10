import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { formatMXN, getISOWeek, getWeekRange, formatDateShort, balanceColor, DIAS_SEMANA } from '@/lib/helpers'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import Modal from '@/components/Modal'
import {
  CalendarRange, ChevronLeft, ChevronRight, Loader2, Lock,
  ChevronDown, Filter, TrendingUp, TrendingDown, X,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import toast from 'react-hot-toast'

// Nombres exactos de las filas en categorias_gasto
const NOMBRES_CATEGORIA = ['Mano de obra', 'Refacciones']

// Etiqueta legible (en este caso igual al nombre de BD)
const LABEL_CATEGORIA = { 'Mano de obra': 'Mano de obra', 'Refacciones': 'Refacciones' }

export default function ResumenSemanal() {
  const { user, isAdmin } = useAuth()
  const [unidades, setUnidades] = useState([])
  const [ingresos, setIngresos] = useState([])
  const [gastos, setGastos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const [semana, setSemana] = useState(getISOWeek(now))
  const [anio, setAnio] = useState(now.getFullYear())

  // Filtros
  const [filtroUnidad, setFiltroUnidad] = useState(null) // null = General
  const [filtroGasto, setFiltroGasto] = useState(null)  // null = todos, o string nombre de BD
  const [showUnitDropdown, setShowUnitDropdown] = useState(false)
  const [showGastoDropdown, setShowGastoDropdown] = useState(false)

  // Modal agregar
  const [clickedFecha, setClickedFecha] = useState(null)
  const [tipoModalOpen, setTipoModalOpen] = useState(false)
  const [tipoSeleccionado, setTipoSeleccionado] = useState(null) // 'ingreso' | 'gasto'
  const [formModalOpen, setFormModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formIngreso, setFormIngreso] = useState({ unidad_id: '', fecha: '', monto: '', notas: '' })
  const [formGasto, setFormGasto] = useState({ unidad_id: '', fecha: '', concepto: '', monto: '', categoria_id: '', notas: '' })

  const unitDropdownRef = useRef(null)
  const gastoDropdownRef = useRef(null)

  const { monday } = useMemo(() => getWeekRange(semana, anio), [semana, anio])

  const diasSemana = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return d.toISOString().split('T')[0]
    })
  }, [monday])

  useEffect(() => { fetchData() }, [semana, anio])

  // Cerrar dropdowns al hacer click fuera
  useEffect(() => {
    function handleClickOutside(e) {
      if (unitDropdownRef.current && !unitDropdownRef.current.contains(e.target)) {
        setShowUnitDropdown(false)
      }
      if (gastoDropdownRef.current && !gastoDropdownRef.current.contains(e.target)) {
        setShowGastoDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const fechaInicio = diasSemana[0]
      const fechaFin = diasSemana[6]

      const [{ data: u }, { data: ing }, { data: gas }, { data: cats }] = await Promise.all([
        supabase.from('unidades').select('id, numero, chofer').eq('activa', true).order('numero'),
        supabase.from('ingresos').select('*').gte('fecha', fechaInicio).lte('fecha', fechaFin),
        supabase.from('gastos')
          .select('*, categorias_gasto(nombre)')
          .gte('fecha', fechaInicio)
          .lte('fecha', fechaFin)
          .eq('estado', 'aprobado'),
        supabase.from('categorias_gasto').select('*').eq('activa', true).order('nombre'),
      ])

      setUnidades(u || [])
      setIngresos(ing || [])
      setGastos(gas || [])
      setCategorias(cats || [])
    } catch {
      toast.error('Error al cargar resumen')
    } finally {
      setLoading(false)
    }
  }

  function cambiarSemana(dir) {
    let newSemana = semana + dir
    let newAnio = anio
    if (newSemana < 1) { newAnio--; newSemana = 52 }
    else if (newSemana > 52) { newAnio++; newSemana = 1 }
    setSemana(newSemana)
    setAnio(newAnio)
  }

  const tablaDias = useMemo(() => {
    return diasSemana.map((fecha, i) => {
      const ingFiltrados = filtroUnidad
        ? ingresos.filter(r => r.unidad_id === filtroUnidad && r.fecha === fecha)
        : ingresos.filter(r => r.fecha === fecha)

      let gasFiltrados = filtroUnidad
        ? gastos.filter(g => g.unidad_id === filtroUnidad && g.fecha === fecha)
        : gastos.filter(g => g.fecha === fecha)

      if (filtroGasto) {
        gasFiltrados = gasFiltrados.filter(g => g.categorias_gasto?.nombre === filtroGasto)
      }

      const ingDia = ingFiltrados.reduce((s, r) => s + Number(r.monto), 0)
      const gasDia = gasFiltrados.reduce((s, r) => s + Number(r.monto), 0)

      return {
        fecha,
        diaNombre: DIAS_SEMANA[i],
        ingresos: ingDia,
        gastos: gasDia,
        balance: ingDia - gasDia,
        hasData: ingDia > 0 || gasDia > 0,
      }
    })
  }, [diasSemana, ingresos, gastos, filtroUnidad, filtroGasto])

  const totalIng = tablaDias.reduce((s, d) => s + d.ingresos, 0)
  const totalGas = tablaDias.reduce((s, d) => s + d.gastos, 0)
  const totalBal = totalIng - totalGas

  // Gran total general (sin filtros) para cerrar semana
  const granTotalIng = useMemo(() => ingresos.reduce((s, r) => s + Number(r.monto), 0), [ingresos])
  const granTotalGas = useMemo(() => gastos.reduce((s, r) => s + Number(r.monto), 0), [gastos])
  const granBalance = granTotalIng - granTotalGas

  function handleRowClick(fecha) {
    setClickedFecha(fecha)
    setTipoModalOpen(true)
  }

  function handleTipoSelect(tipo) {
    setTipoSeleccionado(tipo)
    setTipoModalOpen(false)
    const defaultUnidadId = filtroUnidad || unidades[0]?.id || ''
    if (tipo === 'ingreso') {
      setFormIngreso({ unidad_id: String(defaultUnidadId), fecha: clickedFecha, monto: '', notas: '' })
    } else {
      setFormGasto({ unidad_id: String(defaultUnidadId), fecha: clickedFecha, concepto: '', monto: '', categoria_id: '', notas: '' })
    }
    setFormModalOpen(true)
  }

  async function handleSaveIngreso() {
    if (!formIngreso.unidad_id || !formIngreso.fecha || !formIngreso.monto) {
      toast.error('Complete los campos obligatorios')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.from('ingresos').insert({
        unidad_id: Number(formIngreso.unidad_id),
        fecha: formIngreso.fecha,
        monto: Number(formIngreso.monto),
        notas: formIngreso.notas || null,
        registrado_por: user.id,
      })
      if (error) throw error
      toast.success('Ingreso registrado')
      setFormModalOpen(false)
      fetchData()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveGasto() {
    if (!formGasto.unidad_id || !formGasto.fecha || !formGasto.monto || !formGasto.concepto || !formGasto.categoria_id) {
      toast.error('Complete los campos obligatorios')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.from('gastos').insert({
        unidad_id: Number(formGasto.unidad_id),
        categoria_id: Number(formGasto.categoria_id),
        fecha: formGasto.fecha,
        concepto: formGasto.concepto,
        monto: Number(formGasto.monto),
        notas: formGasto.notas || null,
        estado: 'aprobado',
        registrado_por: user.id,
      })
      if (error) throw error
      toast.success('Gasto registrado')
      setFormModalOpen(false)
      fetchData()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function cerrarSemana() {
    if (!isAdmin) {
      toast.error('Solo la administradora puede cerrar la semana')
      return
    }
    try {
      const { error } = await supabase.from('cortes_semanales').upsert({
        semana_iso: semana,
        anio,
        total_ingresos: granTotalIng,
        total_gastos: granTotalGas,
        balance: granBalance,
        estado: 'cerrado',
        cerrado_por: user.id,
        cerrado_at: new Date().toISOString(),
      })
      if (error) throw error
      toast.success('Semana cerrada exitosamente')
    } catch (err) {
      toast.error(err.message)
    }
  }

  const unidadLabel = filtroUnidad
    ? (() => { const u = unidades.find(x => x.id === filtroUnidad); return u ? `#${u.numero} — ${u.chofer}` : 'Unidad' })()
    : 'General'

  return (
    <div>
      <PageHeader title="Resumen Semanal" subtitle="Ingresos y gastos por día">
        {isAdmin && (
          <button onClick={cerrarSemana} className="btn-primary">
            <Lock className="w-4 h-4" />
            Cerrar semana
          </button>
        )}
      </PageHeader>

      {/* Navegación de semanas */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <button
          onClick={() => cambiarSemana(-1)}
          className="p-2 rounded-xl hover:bg-pizarra-700/50 text-pizarra-400 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <p className="font-display font-bold text-lg text-pizarra-100">Semana {semana}</p>
          <p className="text-xs text-pizarra-500">
            {formatDateShort(diasSemana[0])} — {formatDateShort(diasSemana[6])}, {anio}
          </p>
        </div>
        <button
          onClick={() => cambiarSemana(1)}
          className="p-2 rounded-xl hover:bg-pizarra-700/50 text-pizarra-400 transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Filtro de unidad */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-xs text-pizarra-500 uppercase tracking-wider font-semibold">Vista:</span>
        <div className="relative" ref={unitDropdownRef}>
          <button
            onClick={() => setShowUnitDropdown(v => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors text-sm font-semibold ${
              filtroUnidad
                ? 'bg-taxi-500/10 border-taxi-500/40 text-taxi-400 hover:bg-taxi-500/20'
                : 'bg-pizarra-700/50 border-pizarra-600/50 text-pizarra-200 hover:bg-pizarra-700'
            }`}
          >
            {unidadLabel}
            <ChevronDown className={`w-4 h-4 transition-transform ${showUnitDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showUnitDropdown && (
            <div className="absolute top-full mt-1 left-0 z-20 bg-pizarra-800 border border-pizarra-700/70 rounded-xl shadow-2xl min-w-[200px] overflow-hidden">
              <button
                onClick={() => { setFiltroUnidad(null); setShowUnitDropdown(false) }}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-pizarra-700 transition-colors ${
                  !filtroUnidad ? 'text-taxi-400 font-semibold bg-taxi-500/5' : 'text-pizarra-300'
                }`}
              >
                General
              </button>
              <div className="border-t border-pizarra-700/50" />
              {unidades.map(u => (
                <button
                  key={u.id}
                  onClick={() => { setFiltroUnidad(u.id); setShowUnitDropdown(false) }}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-pizarra-700 transition-colors ${
                    filtroUnidad === u.id ? 'text-taxi-400 font-semibold bg-taxi-500/5' : 'text-pizarra-300'
                  }`}
                >
                  <span className="font-mono text-taxi-500">#{u.numero}</span>
                  <span className="ml-2 text-pizarra-400">{u.chofer}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {filtroUnidad && (
          <button
            onClick={() => setFiltroUnidad(null)}
            className="p-1.5 rounded-lg hover:bg-pizarra-700/50 text-pizarra-500 hover:text-pizarra-300 transition-colors"
            title="Limpiar filtro"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-taxi-500" />
        </div>
      ) : unidades.length === 0 ? (
        <EmptyState icon={CalendarRange} title="Sin datos" message="No hay unidades activas para mostrar." />
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-pizarra-700/50">
                    <th className="table-header">Día</th>
                    <th className="table-header text-right">Ingreso</th>
                    <th className="table-header text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span>Gasto</span>
                        <div className="relative" ref={gastoDropdownRef}>
                          <button
                            onClick={e => { e.stopPropagation(); setShowGastoDropdown(v => !v) }}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs transition-colors ${
                              filtroGasto
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : 'bg-pizarra-700/50 text-pizarra-400 hover:bg-pizarra-700 border border-transparent'
                            }`}
                          >
                            <Filter className="w-3 h-3" />
                            {filtroGasto ? (LABEL_CATEGORIA[filtroGasto] ?? filtroGasto) : 'Filtrar'}
                          </button>

                          {showGastoDropdown && (
                            <div className="absolute top-full mt-1 right-0 z-20 bg-pizarra-800 border border-pizarra-700/70 rounded-xl shadow-2xl min-w-[160px] overflow-hidden">
                              <button
                                onClick={() => { setFiltroGasto(null); setShowGastoDropdown(false) }}
                                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-pizarra-700 transition-colors ${
                                  !filtroGasto ? 'text-taxi-400 font-semibold bg-taxi-500/5' : 'text-pizarra-300'
                                }`}
                              >
                                Todos
                              </button>
                              <div className="border-t border-pizarra-700/50" />
                              {NOMBRES_CATEGORIA.map(nombre => (
                                <button
                                  key={nombre}
                                  onClick={() => { setFiltroGasto(nombre); setShowGastoDropdown(false) }}
                                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-pizarra-700 transition-colors ${
                                    filtroGasto === nombre ? 'text-red-400 font-semibold bg-red-500/5' : 'text-pizarra-300'
                                  }`}
                                >
                                  {LABEL_CATEGORIA[nombre] ?? nombre}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </th>
                    <th className="table-header text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pizarra-700/30">
                  {tablaDias.map(dia => (
                    <tr
                      key={dia.fecha}
                      onClick={() => handleRowClick(dia.fecha)}
                      className="hover:bg-pizarra-700/30 cursor-pointer transition-colors group"
                    >
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="font-semibold text-pizarra-200">{dia.diaNombre}</div>
                            <div className="text-xs text-pizarra-500">{formatDateShort(dia.fecha)}</div>
                          </div>
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-pizarra-600 text-xs">
                            + agregar
                          </span>
                        </div>
                      </td>
                      <td className="table-cell text-right font-mono">
                        {dia.ingresos > 0
                          ? <span className="text-emerald-400">+{formatMXN(dia.ingresos)}</span>
                          : <span className="text-pizarra-700">—</span>
                        }
                      </td>
                      <td className="table-cell text-right font-mono">
                        {dia.gastos > 0
                          ? <span className="text-red-400">-{formatMXN(dia.gastos)}</span>
                          : <span className="text-pizarra-700">—</span>
                        }
                      </td>
                      <td className={`table-cell text-right font-mono font-bold ${dia.hasData ? balanceColor(dia.balance) : 'text-pizarra-700'}`}>
                        {dia.hasData ? formatMXN(dia.balance) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-pizarra-600/50 bg-pizarra-800/60">
                    <td className="table-cell font-display font-bold text-pizarra-200">
                      Total semana
                      {filtroGasto && (
                        <span className="ml-2 text-xs font-normal text-red-400">({LABEL_CATEGORIA[filtroGasto] ?? filtroGasto})</span>
                      )}
                    </td>
                    <td className="table-cell text-right font-mono font-bold text-emerald-400">
                      {formatMXN(totalIng)}
                    </td>
                    <td className="table-cell text-right font-mono font-bold text-red-400">
                      {formatMXN(totalGas)}
                    </td>
                    <td className={`table-cell text-right font-mono font-bold text-lg ${balanceColor(totalBal)}`}>
                      {formatMXN(totalBal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <p className="text-center text-xs text-pizarra-600 mt-3">
            Haz clic en cualquier día para agregar un ingreso o gasto
          </p>
        </>
      )}

      {/* Modal: elegir tipo */}
      <Modal open={tipoModalOpen} onClose={() => setTipoModalOpen(false)} title="¿Qué deseas agregar?" maxWidth="max-w-sm">
        {clickedFecha && (
          <p className="text-center text-sm text-pizarra-400 mb-4">
            {DIAS_SEMANA[diasSemana.indexOf(clickedFecha)]} · {formatDateShort(clickedFecha)}
          </p>
        )}
        <div className="grid grid-cols-2 gap-4 pb-2">
          <button
            onClick={() => handleTipoSelect('ingreso')}
            className="flex flex-col items-center gap-3 p-6 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500/60 transition-all"
          >
            <TrendingUp className="w-8 h-8 text-emerald-400" />
            <span className="font-semibold text-emerald-400">Ingreso</span>
          </button>
          <button
            onClick={() => handleTipoSelect('gasto')}
            className="flex flex-col items-center gap-3 p-6 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/60 transition-all"
          >
            <TrendingDown className="w-8 h-8 text-red-400" />
            <span className="font-semibold text-red-400">Gasto</span>
          </button>
        </div>
      </Modal>

      {/* Modal: formulario */}
      <Modal
        open={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        title={tipoSeleccionado === 'ingreso' ? 'Nuevo ingreso' : 'Nuevo gasto'}
      >
        {tipoSeleccionado === 'ingreso' ? (
          <div className="space-y-4">
            <div>
              <label className="label">Unidad *</label>
              <select
                className="input"
                value={formIngreso.unidad_id}
                onChange={e => setFormIngreso({ ...formIngreso, unidad_id: e.target.value })}
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
                  value={formIngreso.fecha}
                  onChange={e => setFormIngreso({ ...formIngreso, fecha: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Monto *</label>
                <input
                  type="number"
                  className="input"
                  value={formIngreso.monto}
                  onChange={e => setFormIngreso({ ...formIngreso, monto: e.target.value })}
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
                value={formIngreso.notas}
                onChange={e => setFormIngreso({ ...formIngreso, notas: e.target.value })}
                placeholder="Observaciones (opcional)"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setFormModalOpen(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSaveIngreso} disabled={saving} className="btn-primary">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Registrar ingreso'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Unidad *</label>
                <select
                  className="input"
                  value={formGasto.unidad_id}
                  onChange={e => setFormGasto({ ...formGasto, unidad_id: e.target.value })}
                >
                  <option value="">Seleccionar unidad</option>
                  {unidades.map(u => (
                    <option key={u.id} value={u.id}>#{u.numero} — {u.chofer}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Categoría *</label>
                <select
                  className="input"
                  value={formGasto.categoria_id}
                  onChange={e => setFormGasto({ ...formGasto, categoria_id: e.target.value })}
                >
                  <option value="">Seleccionar</option>
                  {categorias
                    .filter(c => NOMBRES_CATEGORIA.includes(c.nombre))
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        {LABEL_CATEGORIA[c.nombre] ?? c.nombre}
                      </option>
                    ))
                  }
                </select>
              </div>
            </div>
            <div>
              <label className="label">Concepto *</label>
              <input
                className="input"
                value={formGasto.concepto}
                onChange={e => setFormGasto({ ...formGasto, concepto: e.target.value })}
                placeholder="Descripción del gasto"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Fecha *</label>
                <input
                  type="date"
                  className="input"
                  value={formGasto.fecha}
                  onChange={e => setFormGasto({ ...formGasto, fecha: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Monto *</label>
                <input
                  type="number"
                  className="input"
                  value={formGasto.monto}
                  onChange={e => setFormGasto({ ...formGasto, monto: e.target.value })}
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
                value={formGasto.notas}
                onChange={e => setFormGasto({ ...formGasto, notas: e.target.value })}
                placeholder="Observaciones (opcional)"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setFormModalOpen(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSaveGasto} disabled={saving} className="btn-primary">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Registrar gasto'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
