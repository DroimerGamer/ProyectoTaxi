import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { formatMXN, getISOWeek, balanceColor } from '@/lib/helpers'
import PageHeader from '@/components/PageHeader'
import StatCard from '@/components/StatCard'
import {
  TrendingUp,
  TrendingDown,
  Car,
  ClipboardCheck,
  Loader2,
} from 'lucide-react'
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
        { data: unidades },
        { data: ingresosSemana },
        { data: gastosSemana },
        { count: pendientesCount },
        { data: ingresosMes },
        { data: gastosMes },
      ] = await Promise.all([
        supabase.from('unidades').select('id, numero, activa'),
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
      ])

      const totalIngresosSemana = (ingresosSemana || []).reduce((s, r) => s + Number(r.monto), 0)
      const totalGastosSemana = (gastosSemana || []).reduce((s, r) => s + Number(r.monto), 0)
      const totalIngresosMes = (ingresosMes || []).reduce((s, r) => s + Number(r.monto), 0)
      const totalGastosMes = (gastosMes || []).reduce((s, r) => s + Number(r.monto), 0)
      const unidadesActivas = (unidades || []).filter(u => u.activa).length

      setStats({
        ingresosSemana: totalIngresosSemana,
        gastosSemana: totalGastosSemana,
        balanceSemana: totalIngresosSemana - totalGastosSemana,
        ingresosMes: totalIngresosMes,
        gastosMes: totalGastosMes,
        unidadesActivas,
        totalUnidades: (unidades || []).length,
        pendientes: pendientesCount || 0,
      })

      // Datos para la gráfica por unidad
      const unidadesActivas_ = (unidades || []).filter(u => u.activa)
      const chart = unidadesActivas_.map(u => {
        const ing = (ingresosSemana || [])
          .filter(i => i.unidad_id === u.id)
          .reduce((s, r) => s + Number(r.monto), 0)
        const gas = (gastosSemana || [])
          .filter(g => g.unidad_id === u.id)
          .reduce((s, r) => s + Number(r.monto), 0)
        return {
          unidad: `#${u.numero}`,
          Ingresos: ing,
          Gastos: gas,
        }
      })
      setChartData(chart)
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

      {/* Gráfica */}
      {chartData.length > 0 && (
        <div className="card p-6">
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
                <Legend
                  wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }}
                />
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
