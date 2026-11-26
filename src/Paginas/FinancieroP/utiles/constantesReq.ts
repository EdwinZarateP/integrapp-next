/**
 * Constantes del formulario de requisiciones (FORM-CPR-011).
 * Puerto de views-requisiciones.js del módulo externo (CEDIS, bancos, tope
 * de adjuntos de cotización).
 */

/** CEDIs propios para el lugar de entrega (el original permitía «Otro…» a mano). */
export const CEDIS_INTEGRA_ENTREGA = [
  'CEDI Montevideo',
  'CEDI Funza (San Diego)',
  'CEDI Galapa (Barranquilla)',
  'CEDI Yumbo (Cali)',
  'CEDI Girardota (Medellín)',
  'CEDI Bucaramanga',
] as const;

export const OTRO_LUGAR_ENTREGA = '__OTRO__';

/** Catálogo de bancos colombianos para el datalist del proveedor nuevo. */
export const BANCOS_COLOMBIA = [
  'Bancolombia', 'Davivienda', 'Banco de Bogotá', 'BBVA', 'Banco Caja Social',
  'Nequi', 'Daviplata', 'Banco de Occidente', 'Banco Popular', 'Banco AV Villas',
  'Scotiabank Colpatria', 'Itaú', 'Banco Agrario', 'Banco GNB Sudameris',
  'Banco Pichincha', 'Banco Falabella', 'Lulo Bank', 'Nu Colombia', 'Bancoomeva',
  'Banco Finandina', 'Banco Serfinanza', 'Citibank', 'Coopcentral', 'Confiar',
  'Bancamía', 'Banco Mundo Mujer', 'Banco W',
] as const;

export const TIPOS_CUENTA = ['Ahorros', 'Corriente'] as const;

/** Tope del original: cada cotización adjunta máximo 500 KB. */
export const MAX_KB_COTIZACION = 500;
export const MAX_BYTES_COTIZACION = MAX_KB_COTIZACION * 1024;

/** Tipos de documento tipados de los adjuntos del módulo (espejo del backend). */
export const TIPO_DOC_RUT = 'rut';
export const TIPO_DOC_CERT_BANCARIA = 'cert_bancaria';
export const TIPO_DOC_CAMARA = 'camara_comercio';
export const TIPO_DOC_COTIZACION = 'cotizacion';

/** Título-case de banco («BANCOLLOMBIA» → «Bancolombia»). Puerto de formatearNombreBanco. */
export function formatearNombreBanco(raw: string): string {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return '';
  if (/^(bbva|itau|nu)$/i.test(s)) return s.toUpperCase();
  return s.replace(/\b([a-záéíóúüñ])/g, (_, c: string) => c.toUpperCase());
}

/** NIT sin DV ni separadores. Puerto de reqCleanNitSinDV. */
export function nitSoloDigitos(raw: string): string {
  return String(raw || '').trim().replace(/\s*[-–]\s*\d\s*$/, '').replace(/\D/g, '');
}
