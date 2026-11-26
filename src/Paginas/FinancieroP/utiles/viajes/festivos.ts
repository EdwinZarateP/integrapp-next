/**
 * Festivos de Colombia (Ley Emiliani: los festivos «movibles» pasan al lunes
 * siguiente) + Pascua (Jueves/Viernes Santo, Ascensión +43, Corpus +64,
 * Sagrado Corazón +71). Puerto TS de vjPascua/vjFestivosAnio/vjTipoDia de
 * views-viajes.js, con los festivos adicionales y las desactivaciones que
 * guarda el administrador en la clave `viajes_festivos` de la configuración.
 */

export interface FestivosConfig {
  extra?: { fecha: string; nombre?: string }[];
  quitar?: string[];
}

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const vjD = (iso: string): Date => {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const iso = (d: Date): string => d.toISOString().slice(0, 10);
const suma = (d: Date, n: number): Date => new Date(d.getTime() + n * 86400000);
const lunes = (d: Date): Date => (d.getUTCDay() === 1 ? d : suma(d, (8 - d.getUTCDay()) % 7));

function pascua(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(y, mes - 1, dia));
}

const cache: Record<number, Record<string, string>> = {};

/** Festivos oficiales de un año: { 'AAAA-MM-DD': nombre }. */
export function festivosAnio(y: number): Record<string, string> {
  if (cache[y]) return cache[y];
  const f: Record<string, string> = {};
  const put = (d: Date, n: string) => { f[iso(d)] = n; };
  const fijo = (m: number, d: number, n: string) => put(new Date(Date.UTC(y, m - 1, d)), n);
  const mov = (m: number, d: number, n: string) => put(lunes(new Date(Date.UTC(y, m - 1, d))), n);
  fijo(1, 1, 'Año Nuevo'); fijo(5, 1, 'Día del Trabajo'); fijo(7, 20, 'Día de la Independencia');
  fijo(8, 7, 'Batalla de Boyacá'); fijo(12, 8, 'Inmaculada Concepción'); fijo(12, 25, 'Navidad');
  mov(1, 6, 'Reyes Magos'); mov(3, 19, 'San José'); mov(6, 29, 'San Pedro y San Pablo');
  mov(8, 15, 'Asunción de la Virgen'); mov(10, 12, 'Día de la Raza');
  mov(11, 1, 'Todos los Santos'); mov(11, 11, 'Independencia de Cartagena');
  const p = pascua(y);
  put(suma(p, -3), 'Jueves Santo'); put(suma(p, -2), 'Viernes Santo');
  put(suma(p, 43), 'Ascensión del Señor'); put(suma(p, 64), 'Corpus Christi'); put(suma(p, 71), 'Sagrado Corazón');
  return (cache[y] = f);
}

export interface TipoDia {
  tipo: 'habil' | 'sabado' | 'domingo' | 'festivo';
  nombre: string;
}

/** { tipo: hábil|sábado|domingo|festivo, nombre } respetando la configuración del administrador. */
export function tipoDia(isoDia: string, cfg?: FestivosConfig | null): TipoDia {
  const c = cfg ?? { extra: [], quitar: [] };
  const d = vjD(isoDia);
  const nom = festivosAnio(d.getUTCFullYear())[isoDia];
  const extra = (c.extra ?? []).find((x) => x.fecha === isoDia);
  if ((c.quitar ?? []).includes(isoDia) && !extra) {
    /* festivo oficial desactivado por el administrador */
  } else if (extra || nom) {
    return { tipo: 'festivo', nombre: extra ? (extra.nombre || 'Festivo') : nom };
  }
  const w = d.getUTCDay();
  if (w === 0) return { tipo: 'domingo', nombre: '' };
  if (w === 6) return { tipo: 'sabado', nombre: '' };
  return { tipo: 'habil', nombre: '' };
}

/** Días ISO entre ini y fin (tope 62 del original). */
export function listaDias(ini: string, fin: string): string[] {
  const out: string[] = [];
  if (!ini || !fin || fin < ini) return out;
  for (let d = vjD(ini), n = 0; iso(d) <= fin && n < 62; d = suma(d, 1), n++) out.push(iso(d));
  return out;
}

/** «Mar 01/12» para encabezados de la matriz. */
export function fmtDia(isoDia: string): string {
  const d = vjD(isoDia);
  return `${DIAS[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
