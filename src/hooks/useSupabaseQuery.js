import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Hook genérico para consultas a Supabase con estado de carga y error.
 *
 * @param {string} table - Nombre de la tabla
 * @param {object} options
 * @param {string} options.select - Columnas a seleccionar (default: '*')
 * @param {Array}  options.filters - Array de [columna, operador, valor]
 * @param {string} options.orderBy - Columna para ordenar
 * @param {boolean} options.ascending - Orden ascendente (default: false)
 * @param {boolean} options.pause - No ejecutar automáticamente
 */
export function useSupabaseQuery(table, options = {}) {
  const {
    select = '*',
    filters = [],
    orderBy = 'created_at',
    ascending = false,
    pause = false,
  } = options

  const [data, setData] = useState([])
  const [loading, setLoading] = useState(!pause)
  const [error, setError] = useState(null)

  const filtersKey = JSON.stringify(filters)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      let query = supabase.from(table).select(select)

      for (const [col, op, val] of filters) {
        query = query.filter(col, op, val)
      }

      query = query.order(orderBy, { ascending })

      const { data: result, error: err } = await query
      if (err) throw err
      setData(result || [])
    } catch (err) {
      console.error(`Error en consulta a ${table}:`, err)
      setError(err.message)
      setData([])
    } finally {
      setLoading(false)
    }
  }, [table, select, filtersKey, orderBy, ascending])

  useEffect(() => {
    if (!pause) fetchData()
  }, [fetchData, pause])

  return { data, loading, error, refetch: fetchData }
}
