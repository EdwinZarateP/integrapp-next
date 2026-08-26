// documentConstants.ts
const API_BASE_URL = "https://integrappi-dvmh.onrender.com/vehiculos";

// Función para normalizar claves
const normalizeKey = (key: string) => key.trim().toLowerCase();

// Endpoints normalizados
export const endpoints: Record<string, string> = Object.fromEntries(
  Object.entries({
    "Tarjeta de Propiedad": `${API_BASE_URL}/subir-documento`,
    "soat": `${API_BASE_URL}/subir-documento`,
    "Revisión Tecnomecánica": `${API_BASE_URL}/subir-documento`,
    "Tarjeta de Remolque": `${API_BASE_URL}/subir-documento`,
    "Fotos": `${API_BASE_URL}/subir-fotos`,
    "Póliza de responsabilidad civil": `${API_BASE_URL}/subir-documento`,
    "Documento de Identidad del Conductor": `${API_BASE_URL}/subir-documento`,
    "Documento de Identidad del Propietario": `${API_BASE_URL}/subir-documento`,
    "Documento de Identidad del Tenedor": `${API_BASE_URL}/subir-documento`,
    "Licencia de Conducción Vigente": `${API_BASE_URL}/subir-documento`,
    "Planilla de EPS y ARL": `${API_BASE_URL}/subir-documento`,
    "Planilla de EPS": `${API_BASE_URL}/subir-documento`,
    "Planilla de ARL": `${API_BASE_URL}/subir-documento`,
    "Foto Conductor": `${API_BASE_URL}/subir-documento`,
    "Certificación Bancaria Conductor": `${API_BASE_URL}/subir-documento`,
    "Certificación Bancaria Propietario": `${API_BASE_URL}/subir-documento`,
    "Certificación Bancaria Tenedor": `${API_BASE_URL}/subir-documento`,
    "Documento que lo acredite como Tenedor": `${API_BASE_URL}/subir-documento`,
    "RUT Tenedor": `${API_BASE_URL}/subir-documento`,
    "RUT Propietario": `${API_BASE_URL}/subir-documento`
  }).map(([key, value]) => [normalizeKey(key), value])
);

// Mapeo de nombres de documentos a sus campos en el backend
export const tiposMapping: Record<string, string> = Object.fromEntries(
  Object.entries({
    "Tarjeta de Propiedad": "tarjetaPropiedad",
    "soat": "soat",
    "Revisión Tecnomecánica": "revisionTecnomecanica",
    "Tarjeta de Remolque": "tarjetaRemolque",
    "Fotos": "fotos",
    "Póliza de responsabilidad civil": "polizaResponsabilidad",
    "Documento de Identidad del Conductor": "documentoIdentidadConductor",
    "Documento de Identidad del Propietario": "documentoIdentidadPropietario",
    "Documento de Identidad del Tenedor": "documentoIdentidadTenedor",
    "Licencia de Conducción Vigente": "licencia",
    "Planilla de EPS y ARL": "planillaEpsArl",
    "Foto Conductor": "condFoto",
    "Certificación Bancaria Conductor": "condCertificacionBancaria",
    "Certificación Bancaria Propietario": "propCertificacionBancaria",
    "Certificación Bancaria Tenedor": "tenedCertificacionBancaria",
    "Documento que lo acredite como Tenedor": "documentoAcreditacionTenedor",
    "RUT Tenedor": "rutTenedor",
    "RUT Propietario": "rutPropietario"
  }).map(([key, value]) => [normalizeKey(key), value])
);

// ── Figuras (Conductor / Propietario / Tenedor) y deduplicación de documentos ──
// Un documento de identidad/bancario/RUT se pide UNA vez cuando las figuras
// coinciden (toggles "Propietario = Conductor" y "Tenedor = Propietario");
// el mismo archivo se replica en los campos de la figura gemela.

// Tipos de documento por familia; el conductor no tiene RUT (lo tiene el
// propietario/tenedor cuando es persona jurídica o distinto del conductor).
export const FAMILIAS_FIGURA: Record<string, Record<string, string>> = {
  identidad: {
    conductor: "documentoIdentidadConductor",
    propietario: "documentoIdentidadPropietario",
    tenedor: "documentoIdentidadTenedor",
  },
  bancaria: {
    conductor: "condCertificacionBancaria",
    propietario: "propCertificacionBancaria",
    tenedor: "tenedCertificacionBancaria",
  },
  rut: {
    propietario: "rutPropietario",
    tenedor: "rutTenedor",
  },
};

// Extrae solo los dígitos de un documento (cédula/NIT) para comparar.
const soloDigitos = (valor: unknown): string =>
  String(valor ?? "").replace(/\D/g, "");

export interface FigurasIguales {
  propIgualCond: boolean;
  tenedIgualProp: boolean;
}

/**
 * Determina si Propietario = Conductor y Tenedor = Propietario.
 * Prioriza los flags persistidos en el vehículo (`propietarioIgualConductor`,
 * `tenedorIgualPropietario`); si no existen (históricos), infiere comparando
 * los dígitos del documento de cada figura.
 */
export function calcularFigurasIguales(v: Record<string, any>): FigurasIguales {
  const tieneFlag = (nombre: string) =>
    typeof v?.[nombre] === "boolean" ? v[nombre] : null;

  const flagProp = tieneFlag("propietarioIgualConductor");
  const flagTened = tieneFlag("tenedorIgualPropietario");

  const cedulaCond = soloDigitos(v?.condCedulaCiudadania);
  const docProp = soloDigitos(v?.propDocumento);
  const docTened = soloDigitos(v?.tenedDocumento);

  const propIgualCond =
    flagProp !== null
      ? flagProp
      : docProp !== "" && docProp === cedulaCond;
  const tenedIgualProp =
    flagTened !== null
      ? flagTened
      : docTened !== "" && docTened === docProp;

  return { propIgualCond, tenedIgualProp };
}

/**
 * Para un tipo de documento subido, devuelve los campos "gemelos" de las
 * figuras iguales de la misma familia donde replicar la misma URL.
 * Ej: documentoIdentidadConductor con prop==cond y tened==prop →
 * ["documentoIdentidadPropietario", "documentoIdentidadTenedor"].
 */
export function gemelosDocumento(
  tipo: string,
  figuras: FigurasIguales
): string[] {
  const gemelos: string[] = [];
  const { propIgualCond, tenedIgualProp } = figuras;
  const tenedIgualCond = tenedIgualProp && propIgualCond;

  for (const familia of Object.values(FAMILIAS_FIGURA)) {
    const cond = familia.conductor;
    const prop = familia.propietario;
    const tened = familia.tenedor;

    if (tipo === prop) {
      if (cond && propIgualCond) gemelos.push(cond);
      if (tened && tenedIgualProp) gemelos.push(tened);
    } else if (tipo === tened) {
      if (prop && tenedIgualProp) gemelos.push(prop);
      if (cond && tenedIgualCond) gemelos.push(cond);
    } else if (tipo === cond && cond) {
      if (prop && propIgualCond) gemelos.push(prop);
      if (tened && tenedIgualCond) gemelos.push(tened);
    }
  }
  return gemelos.filter((g) => g !== tipo);
}

/**
 * Nombre legible de un tipo de documento (para mensajes de faltantes).
 */
export const ETIQUETAS_DOCUMENTO: Record<string, string> = Object.fromEntries(
  Object.entries(tiposMapping).map(([k, v]) => [v, k])
);
