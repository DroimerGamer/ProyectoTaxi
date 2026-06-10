import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { formatMXN, formatDate, getISOWeek, balanceColor, labelUnidad } from '@/lib/helpers'
import PageHeader from '@/components/PageHeader'
import StatCard from '@/components/StatCard'
import {
  TrendingUp, TrendingDown, Car, ClipboardCheck, Loader2,
  AlertTriangle, CheckCircle, Clock, HelpCircle, Wrench,
} from 'lucide-react'
import { ITEMS_MANTENIMIENTO, getEstadoMantenimiento, ESTADO_STYLES } from '@/lib/mantenimiento'

const ESTADO_ICON = {
  ok:           <CheckCircle className="w-3.5 h-3.5" />,
  proximo:      <Clock className="w-3.5 h-3.5" />,
  vencido:      <AlertTriangle className="w-3.5 h-3.5" />,
  sin_registro: <HelpCircle className="w-3.5 h-3.5" />,
}
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts'

export default function Dashboard() {
  const { perfil } = useAuth()
  const [stats, setStats] = useState(null)
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)

  // Estados para la cuadrícula por unidad
  const [unidades, setUnidades] = useState([])
  const [ingresosSemana, setIngresosSemana] = useState([])
  const [gastosSemana, setGastosSemana] = useState([])
  const [gastosMantenimiento, setGastosMantenimiento] = useState([])

  useEffect(() => {
    fetchDashboardData()
  }, [])

  async function fetchDashboardData() {
    try {
      const now = new Date()
      const semanaActual = getISOWeek(now)
      const anioActual = now.getFullYear()

      // Obtener datos en paralelo
      const [
        { data: unidades_ },
        { data: ingresosSemana_ },
        { data: gastosSemana_ },
        { count: pendientesCount },
        { data: ingresosMes },
        { data: gastosMes },
        { data: gastosMantenimiento_ },
      ] = await Promise.all([
        supabase.from('unidades').select('id, numero, chofer, activa'),
        supabase.from('ingresos')
          .select('monto, unidad_id')
          .eq('semana_iso', semanaActual)
          .eq('anio', anioActual),
        supabase.from('gastos')
          .select('monto, unidad_id')
          .eq('semana_iso', semanaActual)
          .eq('anio', anioActual)
          .eq('estado', 'aprobado'),
        supabase.from('gastos')
          .select('*', { count: 'exact', head: true })
          .eq('estado', 'pendiente'),
        supabase.from('ingresos')
          .select('monto')
          .gte('fecha', `${anioActual}-${String(now.getMonth() + 1).padStart(2, '0')}-01`),
        supabase.from('gastos')
          .select('monto')
          .eq('estado', 'aprobado')
          .gte('fecha', `${anioActual}-${String(now.getMonth() + 1).padStart(2, '0')}-01`),
        supabase.from('gastos')
          .select('unidad_id, mantenimiento_tipo, fecha, monto')
          .not('mantenimiento_tipo', 'is', null)
          .eq('estado', 'aprobado')
          .order('fecha', { ascending: false }),
      ])

      const totalIngresosSemana = (ingresosSemana_ || []).reduce((s, r) => s + Number(r.monto), 0)
      const totalGastosSemana = (gastosSemana_ || []).reduce((s, r) => s + Number(r.monto), 0)
      const totalIngresosMes = (ingresosMes || []).reduce((s, r) => s + Number(r.monto), 0)
      const totalGastosMes = (gastosMes || []).reduce((s, r) => s + Number(r.monto), 0)
      const unidadesActivas = (unidades_ || []).filter(u => u.activa).length

      setStats({
        ingresosSemana: totalIngresosSemana,
        gastosSemana: totalGastosSemana,
        balanceSemana: totalIngresosSemana - totalGastosSemana,
        ingresosMes: totalIngresosMes,
        gastosMes: totalGastosMes,
        unidadesActivas,
        totalUnidades: (unidades_ || []).length,
        pendientes: pendientesCount || 0,
      })

      // Datos para la gráfica por unidad
      const unidadesActivas_ = (unidades_ || []).filter(u => u.activa)
      const chart = unidadesActivas_.map(u => {
        const ing = (ingresosSemana_ || [])
          .filter(i => i.unidad_id === u.id)
          .reduce((s, r) => s + Number(r.monto), 0)
        const gas = (gastosSemana_ || [])
          .filter(g => g.unidad_id === u.id)
          .reduce((s, r) => s + Number(r.monto), 0)
        return {
          unidad: labelUnidad(u),
          Ingresos: ing,
          Gastos: gas,
        }
      })
      setChartData(chart)

      // Guardar datos para la cuadrícula por unidad
      setUnidades(unidades_ || [])
      setIngresosSemana(ingresosSemana_ || [])
      setGastosSemana(gastosSemana_ || [])
      setGastosMantenimiento(gastosMantenimiento_ || [])
    } catch (err) {
      console.error('Error al cargar dashboard:', err)
    } finally {
      setLoading(false)
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
        title={`Buen día, ${perfil?.nombre?.split(' ')[0] || 'Usuario'}`}
        subtitle="Aquí está el resumen de su equipo de taxis"
      />

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={TrendingUp}
          label="Ingresos semana"
          value={formatMXN(stats?.ingresosSemana)}
          color="emerald"
        />
        <StatCard
          icon={TrendingDown}
          label="Gastos semana"
          value={formatMXN(stats?.gastosSemana)}
          color="red"
        />
        <StatCard
          icon={Car}
          label="Unidades activas"
          value={`${stats?.unidadesActivas} / ${stats?.totalUnidades}`}
          color="blue"
        />
        <StatCard
          icon={ClipboardCheck}
          label="Pendientes"
          value={stats?.pendientes}
          sublabel="gastos por revisar"
          color="taxi"
        />
      </div>

      {/* Balance */}
      <div className="card p-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-pizarra-500 uppercase tracking-wider mb-1">
              Balance de la semana
            </p>
            <p className={`text-3xl font-display font-bold ${balanceColor(stats?.balanceSemana)}`}>
              {formatMXN(stats?.balanceSemana)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-pizarra-500 mb-1">Ingresos del mes</p>
            <p className="text-lg font-semibold text-pizarra-200">
              {formatMXN(stats?.ingresosMes)}
            </p>
            <p className="text-xs text-pizarra-500 mt-2 mb-1">Gastos del mes</p>
            <p className="text-lg font-semibold text-pizarra-200">
              {formatMXN(stats?.gastosMes)}
            </p>
          </div>
        </div>
      </div>

      {/* 1. Resumen por unidad */}
      {unidades.length > 0 && (
        <div className="mb-8">
          <h2 className="font-display font-bold text-lg text-pizarra-100 mb-4">
            Resumen por unidad (semana actual)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {unidades.map(u => {
              const ing = ingresosSemana
                .filter(i => i.unidad_id === u.id)
                .reduce((s, r) => s + Number(r.monto), 0)
              const gas = gastosSemana
                .filter(g => g.unidad_id === u.id)
                .reduce((s, r) => s + Number(r.monto), 0)
              const balance = ing - gas

              return (
                <div key={u.id} className="card p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono font-bold text-2xl text-taxi-400">
                      {labelUnidad(u)}
                    </span>
                    <span className={u.activa ? 'badge-activa' : 'badge-inactiva'}>
                      {u.activa ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                  <p className="text-sm text-pizarra-500 mb-5">{u.chofer}</p>

                  <div className="space-y-3">
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm text-pizarra-400 flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4" />
                        Ingresos
                      </span>
                      <span className="text-base font-mono font-semibold text-emerald-400">
                        {formatMXN(ing)}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm text-pizarra-400 flex items-center gap-1.5">
                        <TrendingDown className="w-4 h-4" />
                        Gastos
                      </span>
                      <span className="text-base font-mono font-semibold text-red-400">
                        {formatMXN(gas)}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-pizarra-700/40 mt-4 pt-4 flex justify-between items-baseline">
                    <span className="text-sm font-semibold text-pizarra-400 uppercase tracking-wider">
                      Balance
                    </span>
                    <span className={`text-xl font-mono font-bold ${balanceColor(balance)}`}>
                      {formatMXN(balance)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 2. Mantenimiento preventivo */}
      {unidades.filter(u => u.activa).length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Wrench className="w-5 h-5 text-pizarra-400" />
            <h2 className="font-display font-bold text-lg text-pizarra-100">
              Mantenimiento preventivo
            </h2>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {unidades.filter(u => u.activa).map(u => {
              const hoy = new Date()
              const items = ITEMS_MANTENIMIENTO.map(item => {
                const ultimo = gastosMantenimiento
                  .filter(g => g.unidad_id === u.id && g.mantenimiento_tipo === item.tipo)
                  .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0]
                const diasTranscurridos = ultimo
                  ? Math.floor((hoy - new Date(ultimo.fecha + 'T00:00:00')) / 86400000)
                  : null
                const estado = getEstadoMantenimiento(diasTranscurridos, item.diasAlerta)
                return { ...item, diasTranscurridos, estado, ultimaFecha: ultimo?.fecha }
              })
              const alertas = items.filter(i => i.estado === 'vencido' || i.estado === 'sin_registro').length
              const proximos = items.filter(i => i.estado === 'proximo').length

              return (
                <div key={u.id} className="card overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-pizarra-700/50">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-taxi-400">{labelUnidad(u)}</span>
                      <span className="text-xs text-pizarra-500">{u.chofer}</span>
                    </div>
                    <div className="flex gap-2">
                      {alertas > 0 && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
                          <AlertTriangle className="w-3 h-3" />{alertas}
                        </span>
                      )}
                      {proximos > 0 && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Clock className="w-3 h-3" />{proximos}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px bg-pizarra-700/30">
                    {items.map(item => {
                      const style = ESTADO_STYLES[item.estado]
                      return (
                        <div key={item.tipo} className={`flex flex-col items-center gap-1 p-3 text-center ${style.bg}`}>
                          <span className={`${style.text} mb-0.5`}>{ESTADO_ICON[item.estado]}</span>
                          <span className="text-xs font-medium text-pizarra-300 leading-tight">{item.label}</span>
                          {item.diasTranscurridos !== null ? (
                            <span className={`text-xs font-bold ${style.text}`}>
                              {item.diasTranscurridos === 0 ? 'Hoy'
                                : item.diasTranscurridos < 30 ? `${item.diasTranscurridos}d`
                                : `${Math.round(item.diasTranscurridos / 30)}m`}
                            </span>
                          ) : (
                            <span className="text-[10px] text-pizarra-600">Sin registro</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 3. Ingresos vs Gastos */}
      {chartData.length > 0 && (
        <div className="card p-6 mb-8">
          <h2 className="font-display font-bold text-lg text-pizarra-100 mb-6">
            Ingresos vs Gastos por unidad (semana)
          </h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="unidad"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={{ stroke: '#334155' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    fontSize: '13px',
                    color: '#e2e8f0',
                  }}
                  formatter={(value) => [formatMXN(value), '']}
                />
                <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                <Bar dataKey="Ingresos" fill="#34d399" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Gastos" fill="#f87171" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
