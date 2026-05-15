import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { formatMXN, getISOWeek, getWeekRange, formatDateShort, balanceColor, DIAS_SEMANA } from '@/lib/helpers'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import { CalendarRange, ChevronLeft, ChevronRight, Loader2, Lock } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import toast from 'react-hot-toast'

export default function ResumenSemanal() {
  const { user, isAdmin } = useAuth()
  const [unidades, setUnidades] = useState([])
  const [ingresos, setIngresos] = useState([])
  const [gastos, setGastos] = useState([])
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const [semana, setSemana] = useState(getISOWeek(now))
  const [anio, setAnio] = useState(now.getFullYear())

  const { monday, sunday } = useMemo(() => getWeekRange(semana, anio), [semana, anio])

  // Generar array de 7 días (lunes a domingo)
  const diasSemana = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return d.toISOString().split('T')[0]
    })
  }, [monday])

  useEffect(() => {
    fetchData()
  }, [semana, anio])

  async function fetchData() {
    setLoading(true)
    try {
      const fechaInicio = diasSemana[0]
      const fechaFin = diasSemana[6]

      const [{ data: u }, { data: ing }, { data: gas }] = await Promise.all([
        supabase.from('unidades').select('id, numero, chofer').eq('activa', true).order('numero'),
        supabase.from('ingresos').select('*').gte('fecha', fechaInicio).lte('fecha', fechaFin),
        supabase.from('gastos').select('*').gte('fecha', fechaInicio).lte('fecha', fechaFin).eq('estado', 'aprobado'),
      ])

      setUnidades(u || [])
      setIngresos(ing || [])
      setGastos(gas || [])
    } catch (err) {
      toast.error('Error al cargar resumen')
    } finally {
      setLoading(false)
    }
  }

  function cambiarSemana(dir) {
    let newSemana = semana + dir
    let newAnio = anio
    if (newSemana < 1) {
      newAnio--
      newSemana = 52
    } else if (newSemana > 52) {
      newAnio++
      newSemana = 1
    }
    setSemana(newSemana)
    setAnio(newAnio)
  }

  // Construir tabla de resumen
  const resumen = useMemo(() => {
    return unidades.map(u => {
      const porDia = diasSemana.map(fecha => {
        const ingDia = ingresos
          .filter(i => i.unidad_id === u.id && i.fecha === fecha)
          .reduce((s, r) => s + Number(r.monto), 0)
        const gasDia = gastos
          .filter(g => g.unidad_id === u.id && g.fecha === fecha)
          .reduce((s, r) => s + Number(r.monto), 0)
        return { fecha, ingresos: ingDia, gastos: gasDia }
      })

      const totalIng = porDia.reduce((s, d) => s + d.ingresos, 0)
      const totalGas = porDia.reduce((s, d) => s + d.gastos, 0)

      return {
        ...u,
        porDia,
        totalIngresos: totalIng,
        totalGastos: totalGas,
        balance: totalIng - totalGas,
      }
    })
  }, [unidades, ingresos, gastos, diasSemana])

  const granTotalIng = resumen.reduce((s, r) => s + r.totalIngresos, 0)
  const granTotalGas = resumen.reduce((s, r) => s + r.totalGastos, 0)
  const granBalance = granTotalIng - granTotalGas

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

  return (
    <div>
      <PageHeader title="Resumen Semanal" subtitle="Ingresos y gastos por unidad, día a día">
        {isAdmin && (
          <button onClick={cerrarSemana} className="btn-primary">
            <Lock className="w-4 h-4" />
            Cerrar semana
          </button>
        )}
      </PageHeader>

      {/* Navegación de semanas */}
      <div className="flex items-center justify-center gap-4 mb-8">
        <button
          onClick={() => cambiarSemana(-1)}
          className="p-2 rounded-xl hover:bg-pizarra-700/50 text-pizarra-400 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <p className="font-display font-bold text-lg text-pizarra-100">
            Semana {semana}
          </p>
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

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-taxi-500" />
        </div>
      ) : resumen.length === 0 ? (
        <EmptyState icon={CalendarRange} title="Sin datos" message="No hay unidades activas para mostrar." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pizarra-700/50">
                  <th className="table-header sticky left-0 bg-pizarra-800/90 z-10">Unidad</th>
                  {diasSemana.map((d, i) => (
                    <th key={d} className="table-header text-center min-w-[90px]">
                      <div>{DIAS_SEMANA[i]}</div>
                      <div className="text-[10px] text-pizarra-600 font-normal">{formatDateShort(d)}</div>
                    </th>
                  ))}
                  <th className="table-header text-right">Ingresos</th>
                  <th className="table-header text-right">Gastos</th>
                  <th className="table-header text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pizarra-700/30">
                {resumen.map(r => (
                  <tr key={r.id} className="hover:bg-pizarra-700/20 transition-colors">
                    <td className="table-cell sticky left-0 bg-pizarra-800/90 z-10">
                      <span className="font-mono font-semibold text-taxi-400">#{r.numero}</span>
                      <span className="text-pizarra-500 ml-2 text-xs">{r.chofer}</span>
                    </td>
                    {r.porDia.map(d => (
                      <td key={d.fecha} className="table-cell text-center">
                        {d.ingresos > 0 && (
                          <div className="text-emerald-400 text-xs font-mono">
                            +{formatMXN(d.ingresos)}
                          </div>
                        )}
                        {d.gastos > 0 && (
                          <div className="text-red-400 text-xs font-mono">
                            -{formatMXN(d.gastos)}
                          </div>
                        )}
                        {d.ingresos === 0 && d.gastos === 0 && (
                          <span className="text-pizarra-700">—</span>
                        )}
                      </td>
                    ))}
                    <td className="table-cell text-right font-mono font-semibold text-emerald-400">
                      {formatMXN(r.totalIngresos)}
                    </td>
                    <td className="table-cell text-right font-mono font-semibold text-red-400">
                      {formatMXN(r.totalGastos)}
                    </td>
                    <td className={`table-cell text-right font-mono font-bold ${balanceColor(r.balance)}`}>
                      {formatMXN(r.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-pizarra-600/50">
                  <td className="table-cell sticky left-0 bg-pizarra-800/90 font-display font-bold text-pizarra-200" colSpan={1}>
                    TOTALES
                  </td>
                  {diasSemana.map(d => <td key={d} className="table-cell" />)}
                  <td className="table-cell text-right font-mono font-bold text-emerald-400">
                    {formatMXN(granTotalIng)}
                  </td>
                  <td className="table-cell text-right font-mono font-bold text-red-400">
                    {formatMXN(granTotalGas)}
                  </td>
                  <td className={`table-cell text-right font-mono font-bold text-lg ${balanceColor(granBalance)}`}>
                    {formatMXN(granBalance)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
