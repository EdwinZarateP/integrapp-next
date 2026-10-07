// Avance porcentual (0-100) de la DOCUMENTACIÓN de un vehículo, calculado con
// la MISMA semántica que el gate del backend (`_documentos_faltantes` en
// rutas/vehiculos.py): documentos exigidos, opcionalidad dinámica (figuras
// iguales, empresa NIT, remolque declarado, vehículo nuevo sin tecnomecánica)
// y cobertura por gemelos. Lo consume la tabla de bandejas de /revision.
import { calcularFigurasIguales, gemelosDocumento } from './documentConstants';

// Espejo de DOCUMENTOS_REQUERIDOS del backend.
const REQUERIDOS_BASE: string[] = [
  'tarjetaPropiedad', 'tarjetaPropiedadReverso', 'soat', 'revisionTecnomecanica',
  'documentoIdentidadConductor', 'documentoIdentidadConductorReverso',
  'documentoIdentidadPropietario', 'documentoIdentidadPropietarioReverso',
  'documentoIdentidadTenedor', 'documentoIdentidadTenedorReverso',
  'licencia', 'licenciaReverso', 'planillaEpsArl', 'condFoto',
  'condCertificacionBancaria', 'tenedCertificacionBancaria',
  'documentoAcreditacionTenedor', 'rutTenedor', 'fotos',
];

// Espejo de CAMPOS_REMOLQUE del backend.
const CAMPOS_REMOLQUE: string[] = [
  'RemolPlaca', 'RemolModelo', 'RemolClase', 'RemolTipoCarroceria',
  'RemolAlto', 'RemolLargo', 'RemolAncho',
  'RemolDuenoNombre', 'RemolDuenoDocumento', 'RemolDuenoCorreo',
];

export const docLleno = (v: any): boolean => {
  if (Array.isArray(v)) {
    return v.some((u: any) => u && String(u).trim() && String(u) !== 'null' && String(u) !== 'undefined');
  }
  return Boolean(v && String(v).trim() && String(v) !== 'null' && String(v) !== 'undefined');
};

/** Vehículo de modelo con MENOS de 2 años (incluye modelos del año
 *  siguiente): exento de Revisión Tecnomecánica (2026-10-07). */
export const exentoTecnomecanica = (veh: any): boolean => {
  const modelo = parseInt(String(veh?.vehModelo ?? '').replace(/\D/g, '').slice(0, 4), 10);
  if (isNaN(modelo) || modelo < 1900) return false;
  return modelo >= new Date().getFullYear() - 1;
};

const tieneRemolque = (veh: any): boolean =>
  CAMPOS_REMOLQUE.some((k) => {
    const v = String(veh?.[k] ?? '').trim();
    return v && v !== 'null' && v !== 'undefined';
  });

/** Avance de documentación 0-100 (porcentaje de documentos exigidos cargados,
 *  contando la cobertura por gemelos de figuras iguales). */
export const avanceDocumentosVehiculo = (veh: any): number => {
  if (!veh) return 0;
  const figuras = calcularFigurasIguales(veh);
  const propEmpresa = String(veh.propTipoDocumento || '').toUpperCase().includes('NIT');
  const tenedEmpresa = String(veh.tenedTipoDocumento || '').toUpperCase().includes('NIT');

  const requeridos = REQUERIDOS_BASE.filter((c) => {
    if (c === 'documentoAcreditacionTenedor' && figuras.tenedIgualProp) return false;
    if (propEmpresa && c.startsWith('documentoIdentidadPropietario')) return false;
    if (tenedEmpresa && c.startsWith('documentoIdentidadTenedor')) return false;
    if (c === 'revisionTecnomecanica' && exentoTecnomecanica(veh)) return false;
    return true;
  });
  // Propietario empresa: el RUT reemplaza la cédula.
  if (propEmpresa) requeridos.push('rutPropietario');
  // Remolque declarado: la tarjeta de remolque es obligatoria.
  if (tieneRemolque(veh)) requeridos.push('tarjetaRemolque');

  if (requeridos.length === 0) return 0;
  const llenos = requeridos.filter(
    (c) => docLleno(veh[c]) || gemelosDocumento(c, figuras).some((g) => docLleno(veh[g])),
  );
  return Math.round((llenos.length / requeridos.length) * 100);
};
