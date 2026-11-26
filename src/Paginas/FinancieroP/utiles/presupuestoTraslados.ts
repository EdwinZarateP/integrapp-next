/**
 * Cálculo del efecto de los traslados sobre el presupuesto.
 * Puerto TS de trAjuste/trDisp/trEfecto de views-traslados.js:
 *   disponible = presupuesto − ejecutado ± traslados aprobados.
 * El presupuesto viene de GET /fin/catalogos/presupuesto y los traslados
 * aprobados del propio listado (visibilidad ya recortada por el backend).
 */
import type { Traslado, TrasladoLinea, UsuarioFin } from '@/Funciones/ApiPedidos/financiero';

export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'] as const;
export const MES_ANUAL = 'Todo el año';
export const PRESIDENCIA = 'Presidencia';
export const RESERVA = 'Reserva De Presidencia';

export type PresupuestoData = Record<string, Record<string, Record<string, [number, number]>>>;

export const mesActual = () => MESES[new Date().getMonth()];

export function mesIdx(mes: string | null | undefined): number {
  const i = MESES.indexOf((mes ?? '') as (typeof MESES)[number]);
  return i < 0 ? 0 : i + 1; // 0 = todo el año
}

/** Los saldos de la reserva de Presidencia solo los ven Presidencia, admin, Controller y Gerente financiero. */
export function verReserva(u: UsuarioFin): boolean {
  return !!u && (u.es_admin || u.rol === 'admin' || ['presidencia', 'controller', 'gerente_financiero'].includes(u.rol));
}

/** Ajuste acumulado por traslados aprobados (±) sobre un responsable/rubro en un mes (0 = todo el año). */
export function ajuste(aprobados: Traslado[], resp: string, rubro: string, mIdx: number, extra?: TrasladoLinea[]): number {
  let a = 0;
  const sumar = (t: { lineas?: TrasladoLinea[] }) => (t.lineas || []).forEach((l) => {
    const mi = mesIdx(l.mes as string);
    if (mIdx && mi !== mIdx) return;
    if (l.origen === resp && l.origenRubro === rubro) a -= Number(l.monto) || 0;
    if ((l.destino ?? '') === resp && l.destinoRubro === rubro) a += Number(l.monto) || 0;
  });
  aprobados.forEach(sumar);
  (extra ?? []).forEach((l) => sumar({ lineas: [l] }));
  return a;
}

/** Disponible de un responsable/rubro/mes; null si el rubro no está en el presupuesto. */
export function disponible(
  ppto: PresupuestoData | null, aprobados: Traslado[], resp: string, rubro: string, mes: string, extra?: TrasladoLinea[],
): { ppto: number; ejec: number; disp: number } | null {
  const d = ppto?.[resp]?.[rubro];
  if (!d) return null;
  const mi = mesIdx(mes);
  const meses = mi ? [String(mi)] : Object.keys(d);
  let p = 0, e = 0;
  meses.forEach((m) => { p += Number(d[m]?.[0]) || 0; e += Number(d[m]?.[1]) || 0; });
  return { ppto: p, ejec: e, disp: p - e + ajuste(aprobados, resp, rubro, mi, extra) };
}

export interface EfectoLinea {
  monto: number;
  origen?: string; origenRubro?: string;
  destino?: string; destinoRubro: string;
  mes?: string;
  oAntes: number | null; oDespues: number | null;
  dAntes: number | null; dDespues: number | null;
}

/** Efecto de una lista de líneas, acumulando las anteriores de la misma solicitud. */
export function efecto(
  ppto: PresupuestoData | null, aprobados: Traslado[], lineas: TrasladoLinea[],
): EfectoLinea[] {
  const acum: TrasladoLinea[] = [];
  return lineas.map((l) => {
    const monto = Number(l.monto) || 0;
    const o0 = disponible(ppto, aprobados, l.origen ?? PRESIDENCIA, l.origenRubro ?? RESERVA, l.mes as string, acum);
    const d0 = disponible(ppto, aprobados, l.destino ?? '', l.destinoRubro, l.mes as string, acum);
    acum.push(l);
    return {
      monto,
      origen: l.origen ?? PRESIDENCIA, origenRubro: l.origenRubro ?? RESERVA,
      destino: l.destino, destinoRubro: l.destinoRubro, mes: l.mes as string,
      oAntes: o0 ? o0.disp : null, oDespues: o0 ? o0.disp - monto : null,
      dAntes: d0 ? d0.disp : null, dDespues: d0 ? d0.disp + monto : null,
    };
  });
}

/** Congela el efecto dentro de cada línea (para enviar con datos_adicionales.lineas al aprobar). */
export function lineasConEfecto(lineas: TrasladoLinea[], ef: EfectoLinea[]): TrasladoLinea[] {
  return lineas.map((l, i) => ({
    ...l,
    efecto: {
      oAntes: ef[i]?.oAntes ?? null, oDespues: ef[i]?.oDespues ?? null,
      dAntes: ef[i]?.dAntes ?? null, dDespues: ef[i]?.dDespues ?? null,
    },
  }));
}

const norm = (s: string) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** Área del presupuesto que corresponde al área del usuario (p. ej. «Calidad» → «Calidad y HSEQ»). */
export function miAreaResponsable(responsables: string[], areaUsuario: string | null | undefined): string {
  const n = norm(areaUsuario ?? '');
  if (!n) return '';
  const areas = responsables.filter((a) => a !== PRESIDENCIA);
  return areas.find((a) => norm(a) === n)
    || areas.find((a) => norm(a).includes(n) || n.includes(norm(a)))
    || '';
}
