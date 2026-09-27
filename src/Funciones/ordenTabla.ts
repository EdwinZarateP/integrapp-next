// ── Orden por columna (clic en el título, como el filtro de Excel) ──────────
// Comparador genérico de los tableros: números por valor, textos con
// collation 'es' numérico ("G9" < "G10"). Los nulos/vacíos se manejan aparte
// en cada tabla para que queden SIEMPRE al final, sin importar la dirección.

export const compararValorColumna = (a: string | number | null, b: string | number | null): number => {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a ?? '').localeCompare(String(b ?? ''), 'es', { numeric: true, sensitivity: 'base' });
};
