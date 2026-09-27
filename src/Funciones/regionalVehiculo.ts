// ── Regional del vehículo (vive DENTRO del consecutivo) ─────────────────────
// Formato: 'CELTA-20260924-M-2026924-ANTIOQUIA-2' → regional 'ANTIOQUIA'.
// La regional es el segmento separado por '-' cuyo nombre coincide con una de
// la operación (se busca por nombre, no por posición, por si el formato varía).
// El campo `regional` de los documentos es la BODEGA (CELTA, FUNZA…) — distinto.

export const REGIONALES_OPERACION = [
  'ANTIOQUIA',
  'BOGOTA CENTRO ALTO',
  'BOGOTA CENTRO BAJO',
  'BOGOTA NORTE ALTO',
  'CENTRO 1',
  'CENTRO 2',
  'CENTRO 3',
  'CENTRO 4',
  'COSTA NORTE 1',
  'COSTA NORTE 2',
  'COSTA NORTE 3',
  'EJE CAFETERO',
  'OCCIDENTE',
  'SANTANDER',
  'SUR',
] as const;

// '' si el consecutivo no trae ninguna regional reconocida.
export const regionalDeVehiculo = (consecutivo?: string | null): string => {
  for (const seg of String(consecutivo || '').split('-')) {
    const s = seg.trim().toUpperCase();
    if ((REGIONALES_OPERACION as readonly string[]).includes(s)) return s;
  }
  return '';
};
