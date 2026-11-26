/**
 * Presupuesto de viáticos día × concepto — replica la «PLANTILLA DE PPTO
 * VIAJES BASE.xlsx» del original. Puerto TS de VJ_CONCEPTOS/VJ_TARIFAS_DEF/
 * vjCalcular de views-viajes.js.
 *
 * Reglas de la plantilla:
 *  · Alimentación: todos los días del viaje (también sáb/dom/fest).
 *  · Casa→Aeropuerto y Aeropuerto→CEDI: día de ida. CEDI→Aeropuerto y
 *    Aeropuerto→Casa: día de regreso (siempre).
 *  · CEDI→Hotel: todos menos el último; Hotel→CEDI: todos menos el primero;
 *    ambos solo en días hábiles (transporte interno no se paga sáb/dom/fest).
 *  · Hotel: una noche por cada día menos el último.
 *  · El Controller puede agregar (trae la tarifa) o quitar (deja 0) cualquier
 *    celda, por clave "índiceDeDía|concepto".
 */
import { FestivosConfig, listaDias, tipoDia } from './festivos';

export interface Concepto {
  k: string;
  g: 'ALIMENTACIÓN' | 'TRANSPORTE' | 'ALOJAMIENTO';
  l: string;
}

export const CONCEPTOS: Concepto[] = [
  { k: 'desayuno', g: 'ALIMENTACIÓN', l: 'Desayuno' },
  { k: 'almuerzo', g: 'ALIMENTACIÓN', l: 'Almuerzo' },
  { k: 'cena', g: 'ALIMENTACIÓN', l: 'Cena' },
  { k: 'casaAero', g: 'TRANSPORTE', l: 'Casa - Aeropuerto (solo ida)' },
  { k: 'aeroCedi', g: 'TRANSPORTE', l: 'Aeropuerto - CEDI (solo ida)' },
  { k: 'cediHotel', g: 'TRANSPORTE', l: 'CEDI - Hotel' },
  { k: 'hotelCedi', g: 'TRANSPORTE', l: 'Hotel - CEDI' },
  { k: 'cediAero', g: 'TRANSPORTE', l: 'CEDI - Aeropuerto (solo vuelta)' },
  { k: 'aeroCasa', g: 'TRANSPORTE', l: 'Aeropuerto - Casa (solo vuelta)' },
  { k: 'hotel', g: 'ALOJAMIENTO', l: 'Hotel' },
];

export type Tarifas = Record<string, Record<string, number>>;

/** Valores de la hoja VALORES de la plantilla (vigencia inicial). */
export const TARIFAS_DEF: Tarifas = {
  A: { desayuno: 30000, almuerzo: 35000, cena: 30000, casaAero: 50000, aeroCedi: 50000, cediHotel: 35000, hotelCedi: 35000, cediAero: 50000, aeroCasa: 50000, hotel: 198000 },
  B: { desayuno: 20000, almuerzo: 25000, cena: 20000, casaAero: 50000, aeroCedi: 50000, cediHotel: 35000, hotelCedi: 35000, cediAero: 50000, aeroCasa: 50000, hotel: 165000 },
  C: { desayuno: 18000, almuerzo: 22500, cena: 18000, casaAero: 50000, aeroCedi: 50000, cediHotel: 35000, hotelCedi: 35000, cediAero: 50000, aeroCasa: 50000, hotel: 148500 },
};

export interface DiaPresupuesto {
  f: string;                    // ISO del día
  tipo: 'habil' | 'sabado' | 'domingo' | 'festivo';
  fest: string;                 // nombre del festivo (o '')
  v: Record<string, number>;    // valor por concepto
}

/** Matriz de días con los valores de la tarifa según las reglas de la plantilla. */
export function calcularDias(
  ini: string, fin: string, categoria: string, tarifas: Tarifas | null,
  agregados: string[] = [], quitados: string[] = [], festivos: FestivosConfig | null = null,
): DiaPresupuesto[] {
  const t = tarifas ?? TARIFAS_DEF;
  const tar = t[categoria] ?? t.B;
  const dias = listaDias(ini, fin);
  return dias.map((f, i) => {
    const td = tipoDia(f, festivos);
    const esp = td.tipo !== 'habil';
    const primero = i === 0, ultimo = i === dias.length - 1, unico = dias.length === 1;
    const v: Record<string, number> = {};
    CONCEPTOS.forEach((c) => { v[c.k] = 0; });
    v.desayuno = tar.desayuno; v.almuerzo = tar.almuerzo; v.cena = tar.cena;
    if (primero && !unico) { v.casaAero = tar.casaAero; v.aeroCedi = tar.aeroCedi; }
    if (ultimo && !unico) { v.cediAero = tar.cediAero; v.aeroCasa = tar.aeroCasa; }
    if (unico) { v.casaAero = tar.casaAero; v.aeroCedi = tar.aeroCedi; v.cediAero = tar.cediAero; v.aeroCasa = tar.aeroCasa; }
    if (!ultimo && !esp) v.cediHotel = tar.cediHotel;
    if (!primero && !esp) v.hotelCedi = tar.hotelCedi;
    if (!ultimo) v.hotel = tar.hotel;
    CONCEPTOS.forEach((c) => {
      const key = `${i}|${c.k}`;
      if (agregados.includes(key)) v[c.k] = Number(tar[c.k]) || 0;
      else if (quitados.includes(key)) v[c.k] = 0;
    });
    return { f, tipo: td.tipo, fest: td.nombre, v };
  });
}

export const totalDia = (d: DiaPresupuesto): number =>
  CONCEPTOS.reduce((s, c) => s + (Number(d.v[c.k]) || 0), 0);

export const totalOtros = (otros?: { n?: string; v?: number[] }[]): number =>
  (otros ?? []).reduce((s, o) => s + (o.v ?? []).reduce((a, x) => a + (Number(x) || 0), 0), 0);

export const otrosDia = (otros: { n?: string; v?: number[] }[] | undefined, i: number): number =>
  (otros ?? []).reduce((s, o) => s + (Number(o.v?.[i]) || 0), 0);

export const totalPresupuesto = (dias: DiaPresupuesto[], otros?: { n?: string; v?: number[] }[]): number =>
  (dias ?? []).reduce((s, d) => s + totalDia(d), 0) + totalOtros(otros);

export const totalGrupo = (dias: DiaPresupuesto[], g: string): number =>
  (dias ?? []).reduce((s, d) => s + CONCEPTOS.filter((c) => c.g === g).reduce((a, c) => a + (Number(d.v[c.k]) || 0), 0), 0);

/** Valor que da la regla por defecto para una celda (sin cambios del Controller). */
export function defectoCelda(
  i: number, k: string, ini: string, fin: string, categoria: string, tarifas: Tarifas | null, festivos: FestivosConfig | null,
): number {
  const dias = calcularDias(ini, fin, categoria, tarifas, [], [], festivos);
  return Number(dias[i]?.v[k]) || 0;
}
