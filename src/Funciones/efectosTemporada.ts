/**
 * Catálogo de efectos de temporada de la app (2026-11-25, 10.ª tanda).
 *
 * ÚNICA fuente para la página de administración (/Apariencia) y el renderer
 * global (Componentes/EfectoTemporada). Espejo del backend
 * (integrappi/rutas/apariencia.py → EFECTOS_VALIDOS) — mantener sincronizado.
 *
 * `color` pinta el filo inferior del header unificado y de la pestaña del
 * lanzador mientras el efecto está activo.
 */
export type EfectoTemporada = {
  id: string;
  etiqueta: string;
  emoji: string;
  descripcion: string;
  /** Acento del filo del header mientras está activo. */
  color: string;
};

export const EFECTOS: EfectoTemporada[] = [
  { id: 'ninguno', etiqueta: 'Ninguno', emoji: '🚫', descripcion: 'Sin efecto — la app en su look normal.', color: '#8EC045' },
  { id: 'navidad', etiqueta: 'Navidad', emoji: '❄️', descripcion: 'Copos de nieve cayendo y filo rojo navideño.', color: '#dc2626' },
  { id: 'halloween', etiqueta: 'Halloween', emoji: '🎃', descripcion: 'Murciélagos y calabazas flotando, filo naranja.', color: '#f97316' },
  { id: 'patrias', etiqueta: 'Fiestas patrias', emoji: '🇨🇴', descripcion: 'Banderitas de Colombia, filo tricolor (amarillo).', color: '#F2D200' },
  { id: 'celebracion', etiqueta: 'Celebración', emoji: '🎉', descripcion: 'Confeti de colores cayendo — para celebraciones puntuales.', color: '#9333ea' },
  { id: 'san_valentin', etiqueta: 'San Valentín', emoji: '💗', descripcion: 'Corazones flotando hacia arriba, filo rosa.', color: '#ec4899' },
  { id: 'semana_santa', etiqueta: 'Semana Santa', emoji: '🕊️', descripcion: 'Palomas de paz cruzando la pantalla, filo morado sereno.', color: '#7c3aed' },
];

export const efectoDe = (id: string): EfectoTemporada | undefined =>
  EFECTOS.find(e => e.id === id);
