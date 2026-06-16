import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { formatMXN, getISOWeek, getWeekRange, formatDateShort, balanceColor, DIAS_SEMANA, labelUnidad } from '@/lib/helpers'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import Modal from '@/components/Modal'
import {
  CalendarRange, ChevronLeft, ChevronRight, Loader2, Lock,
  ChevronDown, Filter, TrendingUp, TrendingDown, AlertTriangle,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import toast from 'react-hot-toast'
import { ITEMS_MANTENIMIENTO } from '@/lib/mantenimiento'

const NOMBRES_CATEGORIA = ['Mano de obra', 'Refacciones', 'Nómina']
const LABEL_CATEGORIA = { 'Mano de obra': 'Mano de obra', 'Refacciones': 'Refacciones', 'Nómina': 'Nómina' }

export default function ResumenSemanalV2() {
  const { user, isAdmin } = useAuth()
  const [unidades, setUnidades]     = useState([])
  const [ingresos, setIngresos]     = useState([])
  const [gastos, setGastos]         = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading]       = useState(true)

  const now = new Date()
  const [semana, setSemana] = useState(getISOWeek(now))
  const [anio, setAnio]     = useState(now.getFullYear())

  // Filtros
  const [filtroUnidad, setFiltroUnidad]         = useState(null)  // null = General
  const [filtroGasto, setFiltroGasto]           = useState(null)  // null = Todos
  const [showUnitDropdown, setShowUnitDropdown] = useState(false)
  const [showGastoDropdown, setShowGastoDropdown] = useState(false)

  // Modal agregar
  const [clickedFecha, setClickedFecha]         = useState(null)
  const [tipoPreselect, setTipoPreselect]       = useState(null)  // 'ingreso' | 'gasto' | null
  const [tipoModalOpen, setTipoModalOpen]       = useState(false)
  const [tipoSeleccionado, setTipoSeleccionado] = useState(null)
  const [formModalOpen, setFormModalOpen]       = useState(false)
  const [saving, setSaving]                     = useState(false)
  const [formIngreso, setFormIngreso] = useState({ unidad_id: '', fecha: '', monto: '', notas: '' })
  const [formGasto, setFormGasto]     = useState({ unidad_id: '', fecha: '', concepto: '', monto: '', categoria_id: '', mantenimiento_tipo: '', notas: '' })
  const [alertaMant, setAlertaMant]   = useState(null)
  const [gastosRecientes, setGastosRecientes] = useState([])
  const [loadingRecientes, setLoadingRecientes] = useState(false)
  const [paginaMeses, setPaginaMeses] = useState(0)

  const unitDropdownRef  = useRef(null)
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

  useEffect(() => {
    function handleClickOutside(e) {
      if (unitDropdownRef.current && !unitDropdownRef.current.contains(e.target))
        setShowUnitDropdown(false)
      if (gastoDropdownRef.current && !gastoDropdownRef.current.contains(e.target))
        setShowGastoDropdown(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const fechaInicio = diasSemana[0]
      const fechaFin    = diasSemana[6]

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
    let s = semana + dir, a = anio
    if (s < 1)  { a--; s = 52 }
    if (s > 52) { a++; s = 1  }
    setSemana(s); setAnio(a)
  }

  // Totales por día ya filtrados
  const totalesPorDia = useMemo(() => {
    return diasSemana.map(fecha => {
      const ingFiltrados = filtroUnidad
        ? ingresos.filter(r => r.unidad_id === filtroUnidad && r.fecha === fecha)
        : ingresos.filter(r => r.fecha === fecha)

      let gasFiltrados = filtroUnidad
        ? gastos.filter(g => g.unidad_id === filtroUnidad && g.fecha === fecha)
        : gastos.filter(g => g.fecha === fecha)

      if (filtroGasto) {
        gasFiltrados = gasFiltrados.filter(g => g.categorias_gasto?.nombre === filtroGasto)
      }

      const ing = ingFiltrados.reduce((s, r) => s + Number(r.monto), 0)
      const gas = gasFiltrados.reduce((s, r) => s + Number(r.monto), 0)
      return { fecha, ing, gas, bal: ing - gas }
    })
  }, [diasSemana, ingresos, gastos, filtroUnidad, filtroGasto])

  const totalIng = totalesPorDia.reduce((s, d) => s + d.ing, 0)
  const totalGas = totalesPorDia.reduce((s, d) => s + d.gas, 0)
  const totalBal = totalIng - totalGas

  // Gran total general para cerrar semana
  const granTotalIng = useMemo(() => ingresos.reduce((s, r) => s + Number(r.monto), 0), [ingresos])
  const granTotalGas = useMemo(() => gastos.reduce((s, r) => s + Number(r.monto), 0), [gastos])
  const granBalance  = granTotalIng - granTotalGas

  // Click en celda: ingreso directo, gasto directo, o elegir
  function handleCellClick(fecha, tipo = null) {
    setClickedFecha(fecha)
    if (tipo) {
      openForm(tipo, fecha)
    } else {
      setTipoModalOpen(true)
    }
  }

  function openForm(tipo, fecha) {
    const defaultUnidadId = filtroUnidad ? String(filtroUnidad) : ''
    setTipoSeleccionado(tipo)
    setAlertaMant(null)
    setGastosRecientes([])
    setPaginaMeses(0)
    if (tipo === 'ingreso') {
      setFormIngreso({ unidad_id: defaultUnidadId, fecha, monto: '', notas: '' })
    } else {
      setFormGasto({ unidad_id: defaultUnidadId, fecha, concepto: '', monto: '', categoria_id: '', notas: '' })
      if (defaultUnidadId) fetchGastosRecientes(defaultUnidadId, 0)
    }
    setFormModalOpen(true)
  }

  function handleTipoSelect(tipo) {
    setTipoModalOpen(false)
    openForm(tipo, clickedFecha)
  }

  async function handleSaveIngreso() {
    if (!formIngreso.unidad_id || !formIngreso.fecha || !formIngreso.monto) {
      toast.error('Complete los campos obligatorios'); return
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
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function fetchGastosRecientes(unidad_id, pagina = 0) {
    if (!unidad_id) { setGastosRecientes([]); return }
    setLoadingRecientes(true)
    const hoy = new Date()
    const hasta = new Date(hoy); hasta.setMonth(hasta.getMonth() - pagina * 3)
    const desde = new Date(hoy); desde.setMonth(desde.getMonth() - (pagina + 1) * 3)
    const { data } = await supabase
      .from('gastos')
      .select('fecha, concepto, monto, categorias_gasto(nombre)')
      .eq('unidad_id', unidad_id)
      .gte('fecha', desde.toISOString().split('T')[0])
      .lte('fecha', hasta.toISOString().split('T')[0])
      .order('fecha', { ascending: false })
    setGastosRecientes(data || [])
    setLoadingRecientes(false)
  }

  function getPeriodoLabel(pagina) {
    const M = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
    const hoy = new Date()
    const hasta = new Date(hoy); hasta.setMonth(hasta.getMonth() - pagina * 3)
    const desde = new Date(hoy); desde.setMonth(desde.getMonth() - (pagina + 1) * 3)
    return `${M[desde.getMonth()]} — ${M[hasta.getMonth()]} ${hasta.getFullYear()}`
  }

  async function verificarMantenimiento(unidad_id, mantenimiento_tipo) {
    if (!unidad_id || !mantenimiento_tipo) { setAlertaMant(null); return }
    const { data } = await supabase
      .from('gastos')
      .select('fecha')
      .eq('unidad_id', unidad_id)
      .eq('mantenimiento_tipo', mantenimiento_tipo)
      .eq('estado', 'aprobado')
      .order('fecha', { ascending: false })
      .limit(1)
    if (data && data.length > 0) {
      const dias = Math.floor((new Date() - new Date(data[0].fecha + 'T00:00:00')) / 86400000)
      const item = ITEMS_MANTENIMIENTO.find(i => i.tipo === mantenimiento_tipo)
      setAlertaMant({ label: item?.label, diasTranscurridos: dias, fecha: data[0].fecha, diasAlerta: item?.diasAlerta })
    } else {
      setAlertaMant(null)
    }
  }

  async function handleSaveGasto() {
    if (!formGasto.unidad_id || !formGasto.fecha || !formGasto.monto || !formGasto.concepto || !formGasto.categoria_id) {
      toast.error('Complete los campos obligatorios'); return
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
        mantenimiento_tipo: formGasto.mantenimiento_tipo || null,
        estado: 'aprobado',
        registrado_por: user.id,
      })
      if (error) throw error
      toast.success('Gasto registrado')
      setFormModalOpen(false)
      fetchData()
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function cerrarSemana() {
    if (!isAdmin) { toast.error('Solo la administradora puede cerrar la semana'); return }
    try {
      const { error } = await supabase.from('cortes_semanales').upsert({
        semana_iso: semana, anio,
        total_ingresos: granTotalIng,
        total_gastos: granTotalGas,
        balance: granBalance,
        estado: 'cerrado',
        cerrado_por: user.id,
        cerrado_at: new Date().toISOString(),
      })
      if (error) throw error
      toast.success('Semana cerrada exitosamente')
    } catch (err) { toast.error(err.message) }
  }

  const unidadLabel = filtroUnidad
    ? (() => { const u = unidades.find(x => x.id === filtroUnidad); return u ? `${labelUnidad(u)} — ${u.chofer}` : 'Unidad' })()
    : 'General'

  // ─── RENDER ────────────────────────────────────────────────────────────────
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
      <div className="flex items-center justify-center gap-4 mb-8">
        <button onClick={() => cambiarSemana(-1)} className="p-2 rounded-xl hover:bg-pizarra-700/50 text-pizarra-400 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <p className="font-display font-bold text-lg text-pizarra-100">Semana {semana}</p>
          <p className="text-xs text-pizarra-500">
            {formatDateShort(diasSemana[0])} — {formatDateShort(diasSemana[6])}, {anio}
          </p>
        </div>
        <button onClick={() => cambiarSemana(1)} className="p-2 rounded-xl hover:bg-pizarra-700/50 text-pizarra-400 transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-taxi-500" />
        </div>
      ) : unidades.length === 0 ? (
        <EmptyState icon={CalendarRange} title="Sin datos" message="No hay unidades activas para mostrar." />
      ) : (
        <>
          {/* Barra de filtros encima de la tabla */}
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            {/* Filtro unidad — fuera del overflow-x-auto */}
            <div className="relative" ref={unitDropdownRef}>
              <button
                onClick={() => setShowUnitDropdown(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors text-xs font-semibold ${
                  filtroUnidad
                    ? 'bg-taxi-500/10 border-taxi-500/40 text-taxi-400 hover:bg-taxi-500/20'
                    : 'bg-pizarra-700/50 border-pizarra-600/50 text-pizarra-200 hover:bg-pizarra-700'
                }`}
              >
                {unidadLabel}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showUnitDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showUnitDropdown && (
                <div className="absolute top-full mt-1 left-0 z-50 bg-pizarra-800 border border-pizarra-700/70 rounded-xl shadow-2xl min-w-[210px]">
                  <button
                    onClick={() => { setFiltroUnidad(null); setShowUnitDropdown(false) }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-pizarra-700 rounded-t-xl transition-colors ${!filtroUnidad ? 'text-taxi-400 font-semibold bg-taxi-500/5' : 'text-pizarra-300'}`}
                  >
                    General
                  </button>
                  <div className="border-t border-pizarra-700/50" />
                  {unidades.map((u, i) => (
                    <button
                      key={u.id}
                      onClick={() => { setFiltroUnidad(u.id); setShowUnitDropdown(false) }}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-pizarra-700 transition-colors ${i === unidades.length - 1 ? 'rounded-b-xl' : ''} ${filtroUnidad === u.id ? 'text-taxi-400 font-semibold bg-taxi-500/5' : 'text-pizarra-300'}`}
                    >
                      <span className="font-mono text-taxi-500">{labelUnidad(u)}</span>
                      <span className="ml-2 text-pizarra-400 text-xs">{u.chofer}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative" ref={gastoDropdownRef}>
              <button
                onClick={e => { e.stopPropagation(); setShowGastoDropdown(v => !v) }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  filtroGasto
                    ? 'bg-red-500/20 text-red-400 border-red-500/30'
                    : 'bg-pizarra-700/50 text-pizarra-400 hover:bg-pizarra-700 border-pizarra-600/50'
                }`}
              >
                <Filter className="w-3 h-3" />
                Gastos: {filtroGasto ? (LABEL_CATEGORIA[filtroGasto] ?? filtroGasto) : 'Todos'}
                <ChevronDown className={`w-3 h-3 transition-transform ${showGastoDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showGastoDropdown && (
                <div className="absolute top-full mt-1 right-0 z-30 bg-pizarra-800 border border-pizarra-700/70 rounded-xl shadow-2xl min-w-[160px] overflow-hidden">
                  <button
                    onClick={() => { setFiltroGasto(null); setShowGastoDropdown(false) }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-pizarra-700 transition-colors ${!filtroGasto ? 'text-taxi-400 font-semibold bg-taxi-500/5' : 'text-pizarra-300'}`}
                  >
                    Todos
                  </button>
                  <div className="border-t border-pizarra-700/50" />
                  {NOMBRES_CATEGORIA.map(nombre => (
                    <button
                      key={nombre}
                      onClick={() => { setFiltroGasto(nombre); setShowGastoDropdown(false) }}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-pizarra-700 transition-colors ${filtroGasto === nombre ? 'text-red-400 font-semibold bg-red-500/5' : 'text-pizarra-300'}`}
                    >
                      {LABEL_CATEGORIA[nombre] ?? nombre}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">

                {/* ── ENCABEZADOS: primera celda = filtro unidad, resto = días ── */}
                <thead>
                  <tr className="border-b border-pizarra-700/50">

                    {/* Columna 1: etiqueta de la unidad seleccionada */}
                    <th className="table-header sticky left-0 bg-pizarra-800/95 z-20 min-w-[120px] text-taxi-400 font-semibold">
                      {unidadLabel}
                    </th>

                    {/* Columnas de días */}
                    {diasSemana.map((fecha, i) => (
                      <th key={fecha} className="table-header text-center min-w-[110px]">
                        <div className="font-semibold">{DIAS_SEMANA[i]}</div>
                        <div className="text-[10px] text-pizarra-500 font-normal">{formatDateShort(fecha)}</div>
                      </th>
                    ))}

                    {/* Columna total */}
                    <th className="table-header text-right min-w-[110px]">Total</th>
                  </tr>
                </thead>

                {/* ── FILAS: Ingreso / Gasto / Balance ── */}
                <tbody className="divide-y divide-pizarra-700/30">

                  {/* Fila Ingreso */}
                  <tr className="hover:bg-emerald-500/5 transition-colors group">
                    <td className="table-cell sticky left-0 bg-pizarra-800/95 z-10">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                        <span className="text-emerald-400 font-semibold text-xs uppercase tracking-wide">Ingreso</span>
                      </div>
                    </td>
                    {totalesPorDia.map(d => (
                      <td
                        key={d.fecha}
                        onClick={() => handleCellClick(d.fecha, 'ingreso')}
                        className="table-cell text-center font-mono cursor-pointer hover:bg-emerald-500/10 transition-colors rounded"
                        title="Clic para agregar ingreso"
                      >
                        {d.ing > 0
                          ? <span className="text-emerald-400">+{formatMXN(d.ing)}</span>
                          : <span className="text-pizarra-700 group-hover:text-pizarra-600 text-xs">+ agregar</span>
                        }
                      </td>
                    ))}
                    <td className="table-cell text-right font-mono font-bold text-emerald-400">
                      {formatMXN(totalIng)}
                    </td>
                  </tr>

                  {/* Fila Gasto */}
                  <tr className="hover:bg-red-500/5 transition-colors group">
                    <td className="table-cell sticky left-0 bg-pizarra-800/95 z-10">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                        <span className="text-red-400 font-semibold text-xs uppercase tracking-wide">Gasto</span>
                        {filtroGasto && (
                          <span className="text-[10px] text-red-400/70 font-normal">({LABEL_CATEGORIA[filtroGasto] ?? filtroGasto})</span>
                        )}
                      </div>
                    </td>
                    {totalesPorDia.map(d => (
                      <td
                        key={d.fecha}
                        onClick={() => handleCellClick(d.fecha, 'gasto')}
                        className="table-cell text-center font-mono cursor-pointer hover:bg-red-500/10 transition-colors rounded"
                        title="Clic para agregar gasto"
                      >
                        {d.gas > 0
                          ? <span className="text-red-400">-{formatMXN(d.gas)}</span>
                          : <span className="text-pizarra-700 group-hover:text-pizarra-600 text-xs">+ agregar</span>
                        }
                      </td>
                    ))}
                    <td className="table-cell text-right font-mono font-bold text-red-400">
                      {formatMXN(totalGas)}
                    </td>
                  </tr>

                  {/* Fila Balance */}
                  <tr className="bg-pizarra-800/40">
                    <td className="table-cell sticky left-0 bg-pizarra-800/95 z-10">
                      <span className="text-pizarra-300 font-bold text-xs uppercase tracking-wide">Balance</span>
                    </td>
                    {totalesPorDia.map(d => (
                      <td key={d.fecha} className={`table-cell text-center font-mono font-semibold ${(d.ing > 0 || d.gas > 0) ? balanceColor(d.bal) : 'text-pizarra-700'}`}>
                        {(d.ing > 0 || d.gas > 0) ? formatMXN(d.bal) : '—'}
                      </td>
                    ))}
                    <td className={`table-cell text-right font-mono font-bold text-lg ${balanceColor(totalBal)}`}>
                      {formatMXN(totalBal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-center text-xs text-pizarra-600 mt-3">
            Clic en una celda de Ingreso o Gasto para registrar un movimiento
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
        onClose={() => { setFormModalOpen(false); setAlertaMant(null); setGastosRecientes([]); setPaginaMeses(0) }}
        title={tipoSeleccionado === 'ingreso' ? 'Nuevo ingreso' : 'Nuevo gasto'}
        maxWidth={tipoSeleccionado === 'gasto' ? 'max-w-4xl' : 'max-w-lg'}
      >
        {tipoSeleccionado === 'ingreso' ? (
          <div className="space-y-4">
            <div>
              <label className="label">Unidad *</label>
              <select className="input" value={formIngreso.unidad_id} onChange={e => setFormIngreso({ ...formIngreso, unidad_id: e.target.value })}>
                <option value="">Seleccionar unidad</option>
                {unidades.map(u => <option key={u.id} value={u.id}>{labelUnidad(u)} — {u.chofer}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Fecha *</label>
                <input type="date" className="input" value={formIngreso.fecha} onChange={e => setFormIngreso({ ...formIngreso, fecha: e.target.value })} />
              </div>
              <div>
                <label className="label">Monto *</label>
                <input type="number" className="input" value={formIngreso.monto} onChange={e => setFormIngreso({ ...formIngreso, monto: e.target.value })} placeholder="0.00" min="0" step="0.01" />
              </div>
            </div>
            <div>
              <label className="label">Notas</label>
              <input className="input" value={formIngreso.notas} onChange={e => setFormIngreso({ ...formIngreso, notas: e.target.value })} placeholder="Observaciones (opcional)" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setFormModalOpen(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSaveIngreso} disabled={saving} className="btn-primary">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Registrar ingreso'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-6">
            {/* ── Izquierda: historial de gastos ── */}
            <div className="w-64 flex-shrink-0 border-r border-pizarra-700/40 pr-5">
              <p className="text-xs font-semibold text-pizarra-400 uppercase tracking-wider mb-3">
                Gastos anteriores
              </p>
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => { const p = paginaMeses + 1; setPaginaMeses(p); fetchGastosRecientes(formGasto.unidad_id, p) }}
                  className="p-1 rounded-lg hover:bg-pizarra-700/50 text-pizarra-400 hover:text-pizarra-200 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-pizarra-400 font-medium">{getPeriodoLabel(paginaMeses)}</span>
                <button
                  disabled={paginaMeses === 0}
                  onClick={() => { const p = paginaMeses - 1; setPaginaMeses(p); fetchGastosRecientes(formGasto.unidad_id, p) }}
                  className="p-1 rounded-lg hover:bg-pizarra-700/50 text-pizarra-400 hover:text-pizarra-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              {!formGasto.unidad_id ? (
                <p className="text-xs text-pizarra-600 text-center py-8">Selecciona una unidad</p>
              ) : loadingRecientes ? (
                <div className="flex justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-taxi-500" /></div>
              ) : gastosRecientes.length === 0 ? (
                <p className="text-xs text-pizarra-600 text-center py-8">Sin gastos en este período</p>
              ) : (
                <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
                  {gastosRecientes.map((g, i) => (
                    <div key={i} className="px-2 py-1.5 rounded-lg hover:bg-pizarra-700/30 transition-colors">
                      <div className="flex justify-between items-baseline gap-2">
                        <span className="text-xs text-pizarra-200 truncate flex-1">{g.concepto}</span>
                        <span className="text-xs font-mono font-semibold text-red-400 flex-shrink-0">{formatMXN(g.monto)}</span>
                      </div>
                      <p className="text-[10px] text-pizarra-500 mt-0.5">
                        {formatDateShort(g.fecha)}
                        {g.categorias_gasto?.nombre && <span className="ml-1">· {g.categorias_gasto.nombre}</span>}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Derecha: formulario ── */}
            <div className="flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Unidad *</label>
                  <select
                    className="input"
                    value={formGasto.unidad_id}
                    onChange={e => {
                      const val = e.target.value
                      setFormGasto({ ...formGasto, unidad_id: val, mantenimiento_tipo: '' })
                      setAlertaMant(null)
                      setPaginaMeses(0)
                      fetchGastosRecientes(val, 0)
                    }}
                  >
                    <option value="">Seleccionar unidad</option>
                    {unidades.map(u => <option key={u.id} value={u.id}>{labelUnidad(u)} — {u.chofer}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Categoría *</label>
                  <select
                    className="input"
                    value={formGasto.categoria_id}
                    onChange={e => {
                      setFormGasto({ ...formGasto, categoria_id: e.target.value, mantenimiento_tipo: '' })
                      setAlertaMant(null)
                    }}
                  >
                    <option value="">Seleccionar</option>
                    {categorias.filter(c => NOMBRES_CATEGORIA.includes(c.nombre)).map(c => (
                      <option key={c.id} value={c.id}>{LABEL_CATEGORIA[c.nombre] ?? c.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              {categorias.find(c => String(c.id) === String(formGasto.categoria_id))?.nombre === 'Refacciones' && (
                <div>
                  <label className="label">Tipo de mantenimiento preventivo</label>
                  <select
                    className="input"
                    value={formGasto.mantenimiento_tipo}
                    onChange={e => {
                      const val = e.target.value
                      setFormGasto({ ...formGasto, mantenimiento_tipo: val })
                      verificarMantenimiento(formGasto.unidad_id, val)
                    }}
                  >
                    <option value="">Sin especificar</option>
                    {ITEMS_MANTENIMIENTO.map(i => <option key={i.tipo} value={i.tipo}>{i.label}</option>)}
                  </select>
                </div>
              )}

              {alertaMant && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-amber-400">
                      Ya se registró este mantenimiento hace {alertaMant.diasTranscurridos === 0 ? 'hoy' : `${alertaMant.diasTranscurridos} día${alertaMant.diasTranscurridos !== 1 ? 's' : ''}`}
                    </p>
                    <p className="text-pizarra-400 text-xs mt-0.5">
                      Último {alertaMant.label}: {alertaMant.fecha} · Intervalo recomendado: {alertaMant.diasAlerta} días.
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="label">Concepto *</label>
                <input className="input" value={formGasto.concepto} onChange={e => setFormGasto({ ...formGasto, concepto: e.target.value })} placeholder="Descripción del gasto" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Fecha *</label>
                  <input type="date" className="input" value={formGasto.fecha} onChange={e => setFormGasto({ ...formGasto, fecha: e.target.value })} />
                </div>
                <div>
                  <label className="label">Monto *</label>
                  <input type="number" className="input" value={formGasto.monto} onChange={e => setFormGasto({ ...formGasto, monto: e.target.value })} placeholder="0.00" min="0" step="0.01" />
                </div>
              </div>
              <div>
                <label className="label">Notas</label>
                <input className="input" value={formGasto.notas} onChange={e => setFormGasto({ ...formGasto, notas: e.target.value })} placeholder="Observaciones (opcional)" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => { setFormModalOpen(false); setAlertaMant(null); setGastosRecientes([]); setPaginaMeses(0) }} className="btn-secondary">Cancelar</button>
                <button onClick={handleSaveGasto} disabled={saving} className="btn-primary">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Registrar gasto'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
