/**
 * Utilidades de Servicios públicos (puerto de views-servicios.js):
 * categorías con color, semáforo de vencimientos y alerta de recepción
 * de factura por día de corte.
 */

export interface CategoriaInfo {
  clave: string;
  etiqueta: string;
  color: string;
}

export const CATEGORIAS_INFO: CategoriaInfo[] = [
  { clave: 'publicos', etiqueta: 'Públicos', color: '#2563eb' },
  { clave: 'corporativos', etiqueta: 'Corporativos', color: '#7c3aed' },
  { clave: 'orion', etiqueta: 'Orión', color: '#0d9488' },
];

export const ESTADOS_CAUSADO: { clave: string; etiqueta: string; badge: string }[] = [
  { clave: 'NO_GENERADO', etiqueta: 'No generado', badge: 'fin-badgeGris' },
  { clave: 'PENDIENTE', etiqueta: 'Pendiente', badge: 'fin-badgeAmb' },
  { clave: 'CAUSADO', etiqueta: 'Causado', badge: 'fin-badgeInfo' },
  { clave: 'ENVIADO_CONTAB', etiqueta: 'Enviado a Contabilidad', badge: 'fin-badgeInfo' },
  { clave: 'PAGADO', etiqueta: 'Pagado', badge: 'fin-badgeOk' },
  { clave: 'PAGADO_NO_CONTAB', etiqueta: 'Pagado - No contabilizado', badge: 'fin-badgeAmb' },
];

export interface Semanaforo {
  texto: string;
  color: string;       // borde/fondo de la celda
  chip: string;        // clase fin-badge
  gravedad: number;    // 0 a tiempo … 3 vencido
}

/** Fórmula del original (calcularObservacionTesoreria): VENCIDO / ¡VENCE HOY! / PRÓXIMO 3 días / A TIEMPO. */
export function semaforo(fechaLimite: string | null | undefined, pagado: boolean): Semanaforo | null {
  if (!fechaLimite) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const limite = new Date(fechaLimite + 'T00:00:00');
  if (pagado) return { texto: 'Pagado', color: '#f0fdf4', chip: 'fin-badgeOk', gravedad: -1 };
  const dias = Math.round((limite.getTime() - hoy.getTime()) / 86400000);
  if (dias < 0) return { texto: `VENCIDO (${Math.abs(dias)}d)`, color: '#fef2f2', chip: 'fin-badgeMal', gravedad: 3 };
  if (dias === 0) return { texto: '¡VENCE HOY!', color: '#fef2f2', chip: 'fin-badgeMal', gravedad: 2 };
  if (dias <= 3) return { texto: `Próximo a vencer (${dias}d)`, color: '#fff7e0', chip: 'fin-badgeAmb', gravedad: 1 };
  return { texto: 'A tiempo', color: '', chip: 'fin-badgeGris', gravedad: 0 };
}

/** Alerta de recepción de factura según el día de corte (parseDiaExp del original). */
export function alertaRecepcion(fechaExp: string | null | undefined, urgente: string | null | undefined): { texto: string; chip: string } | null {
  if (urgente === 'URGENTE') return { texto: 'URGENTE: factura por recibir', chip: 'fin-badgeMal' };
  if (urgente === 'PROXIMA') return { texto: 'Factura próxima a llegar', chip: 'fin-badgeAmb' };
  return null;
}

/** Día de corte numérico desde «20 de cada mes» (puerto de parseDiaExp). */
export function diaCorte(fechaExp: string | null | undefined): number | null {
  const m = String(fechaExp ?? '').match(/(\d{1,2})/);
  return m ? parseInt(m[1], 10) : null;
}

/** Fecha límite sugerida = día de corte + 14 (cap 28) del mes del periodo. */
export function fechaLimiteSugerida(periodo: string, fechaExp: string | null | undefined): string | null {
  const d = diaCorte(fechaExp);
  if (!d) return null;
  const [y, m] = periodo.split('-').map(Number);
  const limite = Math.min(28, d + 14);
  return `${y}-${String(m).padStart(2, '0')}-${String(limite).padStart(2, '0')}`;
}
