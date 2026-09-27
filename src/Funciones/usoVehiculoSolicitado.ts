// ── % de uso del vehículo solicitado (espejo del backend) ──────────────────
import type React from 'react';
// Misma regla que TOPES_TIPO_VEH / _tipo_solicitado de
// indicadores_costo_operacion.py: uso_pct = kg reales ÷ tope del tipo × 100
// (puede superar 100: viajaron más kg de los que el tipo solicitado admite).
// El tipo es el SICETAC con el sugerido como respaldo; si no tiene tope
// conocido → null (se pinta '—' en gris).

export const TOPES_USO_TIPO_VEH: Record<string, number> = {
  CARRY: 1000,
  NHR: 2300,
  TURBO: 4500,
  NIES: 6100,
  SENCILLO: 9000,
  PATINETA: 17000,
  TRACTOMULA: 34000,
};

// 'SENCILLO_…' → 'SENCILLO' (split por '_'); vacío o desconocido → null.
const tipoConTope = (valor?: string | null): string | null => {
  const t = String(valor || '').trim().toUpperCase().split('_')[0];
  return t in TOPES_USO_TIPO_VEH ? t : null;
};

export const usoVehiculoSolicitado = (
  kilos: number | string | null | undefined,
  tipoSicetac?: string | null,
  tipoSugerido?: string | null,
): number | null => {
  const tipo = tipoConTope(tipoSicetac) || tipoConTope(tipoSugerido);
  if (!tipo) return null;
  const kg = Number(kilos ?? 0);
  if (!Number.isFinite(kg)) return null;
  return Math.round((kg / TOPES_USO_TIPO_VEH[tipo]) * 1000) / 10;
};

// Color del % de uso (mismo semáforo que el tablero de costo-operación):
// rojo < 80 (subutilizado), verde ≥ 80, gris sin tope evaluable.
export const colorUsoVehiculo = (uso: number | null): string => {
  if (uso == null) return '#94a3b8';
  if (uso < 80) return '#e34948';
  return '#1baf7a';
};

// Badge con FONDO del color del rango (como las barras de los gráficos) y
// letra blanca. Para uso null no hay badge: se pinta '—' plano.
export const badgeUsoVehiculo = (uso: number | null): React.CSSProperties => ({
  display: 'inline-block',
  minWidth: '46px',
  textAlign: 'center',
  fontWeight: 700,
  fontSize: '0.75rem',
  borderRadius: '12px',
  padding: '2px 8px',
  color: '#fff',
  background: colorUsoVehiculo(uso),
});

// Filtro de % de uso de los tableros: '' (todos), 'lt30' (< 30), 'lt80' (< 80),
// 'gte80' (≥ 80). Se aplica al disparar la búsqueda (Buscar/Filtrar), igual
// que los demás filtros. Sin tipo evaluable (null) queda fuera de los rangos.
export const cumpleFiltroUsoVehiculo = (
  uso: number | null,
  filtro: string,
): boolean => {
  if (!filtro) return true;
  if (uso == null) return false;
  if (filtro === 'lt30') return uso < 30;
  if (filtro === 'lt80') return uso < 80;
  return uso >= 80;
};
