/**
 * Formatea un número como moneda MXN
 */
export function formatMXN(amount) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(amount || 0)
}

/**
 * Formatea una fecha ISO a formato legible
 */
export function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr + 'T00:00:00')
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

/**
 * Formatea una fecha ISO a formato corto (día y mes)
 */
export function formatDateShort(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr + 'T00:00:00')
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
  }).format(date)
}

/**
 * Obtiene el número de semana ISO de una fecha
 */
export function getISOWeek(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
}

/**
 * Obtiene el rango de fechas (lunes a domingo) de una semana ISO
 */
export function getWeekRange(weekNumber, year) {
  const jan4 = new Date(year, 0, 4)
  const dayOfWeek = jan4.getDay() || 7
  const monday = new Date(jan4)
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (weekNumber - 1) * 7)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  return { monday, sunday }
}

/**
 * Nombres de días de la semana
 */
export const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

/**
 * Retorna la etiqueta de una unidad.
 * Si el numero es 'ENC' o el chofer es 'Encargado', muestra solo el nombre.
 * De lo contrario muestra #numero.
 */
export function labelUnidad(u) {
  if (!u) return '—'
  if (String(u.numero) === 'ENC' || u.chofer === 'Encargado') return u.chofer
  return `#${u.numero}`
}

/**
 * Clase CSS según el valor del balance
 */
export function balanceColor(value) {
  if (value > 0) return 'text-emerald-400'
  if (value < 0) return 'text-red-400'
  return 'text-pizarra-400'
}
