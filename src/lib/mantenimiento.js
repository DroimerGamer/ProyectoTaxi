/**
 * Items de mantenimiento preventivo con sus intervalos recomendados
 */
export const ITEMS_MANTENIMIENTO = [
  { tipo: 'afinacion',        label: 'Afinación',          diasAlerta: 90 },
  { tipo: 'cambio_aceite',    label: 'Cambio de aceite',   diasAlerta: 90  },
  { tipo: 'llantas',          label: 'Llantas',            diasAlerta: 90 },
  { tipo: 'bateria',          label: 'Batería',            diasAlerta: 90 },
  { tipo: 'balatas',          label: 'Balatas',            diasAlerta: 90 },
  { tipo: 'amortiguadores',   label: 'Amortiguadores',     diasAlerta: 90 },
  { tipo: 'chicote_clutch',   label: 'Chicote de clutch',  diasAlerta: 90 },
]

/**
 * Dado el número de días transcurridos y el intervalo recomendado,
 * devuelve el estado del mantenimiento
 */
export function getEstadoMantenimiento(diasTranscurridos, diasAlerta) {
  if (diasTranscurridos === null) return 'sin_registro'
  if (diasTranscurridos >= diasAlerta) return 'vencido'
  if (diasTranscurridos >= diasAlerta * 0.75) return 'proximo'
  return 'ok'
}

/**
 * Clases CSS por estado
 */
export const ESTADO_STYLES = {
  ok:           { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'Al día' },
  proximo:      { text: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   label: 'Próximo' },
  vencido:      { text: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/30',     label: 'Vencido' },
  sin_registro: { text: 'text-pizarra-500', bg: 'bg-pizarra-700/20', border: 'border-pizarra-700/40', label: 'Sin registro' },
}
