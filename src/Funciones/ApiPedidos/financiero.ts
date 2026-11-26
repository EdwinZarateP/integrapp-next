/**
 * Capa API del Módulo Financiero (schema `fin` del backend integrappi).
 *
 * A diferencia de las demás capas (cookie + usuario en body), este módulo
 * autentica por BEARER:
 *  1. Al entrar, se canjea el token de IntegrApp (localStorage
 *     `baseUsuarioAccessToken`, 20 min) por un token de sesión del módulo
 *     (12 h) vía POST /fin/auth/sesion — queda en `finAccessToken`.
 *  2. Toda petición viaja con ese token; un 401 limpia todo y manda al
 *     login de IntegrApp.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL as string;
const BASE = `${API_BASE}/fin`;

const LLAVE_TOKEN_FIN = 'finAccessToken';
const LLAVE_TOKEN_PORTAL = 'baseUsuarioAccessToken';

// ── Interfaces ─────────────────────────────────────────────────────────────

export interface UsuarioFin {
  id: string;
  username: string;
  nombre: string;
  correo: string;
  rol: string;
  area: string | null;
  activo: boolean;
  es_aprobador_pagos: boolean;
  es_admin_adicional: boolean;
  es_autorizador_viajes: boolean;
  perfil_integrapp?: string | null;
  es_admin?: boolean;
}

export interface TrasladoLinea {
  destinoRubro: string;
  monto: number;
  motivo: string;
  mes?: number | string;
  origen?: string;
  destino?: string;
  origenRubro?: string;
  /** Efecto congelado al aprobar: disponibles antes/después en origen y destino. */
  efecto?: Record<string, number | null>;
  [k: string]: unknown;
}

export interface EventoHistorial {
  fecha: string;
  usuario: string;
  username: string;
  accion: string;
  estado_anterior: string | null;
  estado_nuevo: string | null;
  observacion: string;
}

export interface Traslado {
  id: string;
  consecutivo: string;
  solicitante_id: string;
  solicitante_nombre: string;
  area: string;
  fecha: string;
  observaciones: string | null;
  datos_front: Record<string, unknown> | null;
  lineas: TrasladoLinea[];
  total: number;
  estado: 'PENDIENTE_PRESIDENCIA' | 'APROBADO' | 'RECHAZADO' | 'ANULADO';
  aprobador_id: string | null;
  fecha_aprobacion: string | null;
  observacion_aprobacion: string | null;
  motivo_rechazo: string | null;
  aprobacion: { nombre: string; cargo: string; at: string; comentario: string } | null;
  historial_cambios: EventoHistorial[];
  version: number;
  created_at: string;
  updated_at: string;
}

export interface AdjuntoFin {
  id: string;
  nombre_archivo: string;
  tipo_mime: string;
  tamano_bytes: number;
  modulo_origen: string;
  referencia_id: string;
  tipo_documento?: string | null;
  subido_por_id: string | null;
  created_at: string | null;
}

// ── Sesión ─────────────────────────────────────────────────────────────────

export class FinSinSesion extends Error { constructor() { super('sin-sesion'); } }
export class FinSinAcceso extends Error { constructor() { super('sin-acceso'); } }

export class FinApiError extends Error {
  status: number;
  constructor(status: number, mensaje: string) {
    super(mensaje);
    this.status = status;
  }
}

function leerTokenFin(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(LLAVE_TOKEN_FIN);
}

function guardarTokenFin(token: string) {
  window.localStorage.setItem(LLAVE_TOKEN_FIN, token);
}

function irALogin() {
  window.localStorage.removeItem(LLAVE_TOKEN_FIN);
  window.location.href = '/integrapp/LoginUsuario/';
}

/**
 * Garantiza un token de sesión del módulo (12 h). Estrategia:
 * token fin vigente → usarlo; si no, canjear el de IntegrApp; si no hay
 * nada, FinSinSesion (la página muestra el botón de ir a iniciar sesión).
 */
export async function asegurarSesionFin(): Promise<UsuarioFin> {
  // 1) ¿Hay token de sesión del módulo aún válido?
  const actual = leerTokenFin();
  if (actual) {
    try {
      return await llamada<UsuarioFin>('/auth/me', { token: actual });
    } catch (e) {
      if (e instanceof FinSinAcceso) throw e; // dado de alta pero inactivo
      // 401/expirado → sigue al canje
    }
  }
  // 2) Canjear el token de IntegrApp
  const portal = window.localStorage.getItem(LLAVE_TOKEN_PORTAL);
  if (!portal) throw new FinSinSesion();
  try {
    const r = await fetch(`${BASE}/auth/sesion`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${portal}` },
    });
    if (r.status === 403) throw new FinSinAcceso();
    if (!r.ok) throw new FinSinSesion();
    const data = await r.json();
    guardarTokenFin(data.access_token);
    return data.usuario as UsuarioFin;
  } catch (e) {
    if (e instanceof FinSinAcceso) throw e;
    throw new FinSinSesion();
  }
}

async function llamada<T>(path: string, opts: { method?: string; body?: unknown; token?: string; form?: FormData } = {}): Promise<T> {
  const token = opts.token ?? leerTokenFin();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const r = await fetch(`${BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  });
  if (r.status === 401) { irALogin(); throw new FinApiError(401, 'Sesión expirada'); }
  if (!r.ok) {
    let detalle = `Error ${r.status}`;
    try {
      const j = await r.json();
      if (typeof j.detail === 'string') detalle = j.detail;
      else if (Array.isArray(j.detail)) detalle = j.detail.map((d: { msg?: string }) => d.msg ?? '').join(' · ');
    } catch { /* sin cuerpo */ }
    throw new FinApiError(r.status, detalle);
  }
  return (await r.json()) as T;
}

// ── Traslados ──────────────────────────────────────────────────────────────

export const listarTraslados = (estado?: string) =>
  llamada<Traslado[]>(`/traslados${estado ? `?estado=${estado}` : ''}`);

export const obtenerTraslado = (id: string) => llamada<Traslado>(`/traslados/${id}`);

export const crearTraslado = (payload: { area?: string | null; lineas: TrasladoLinea[]; observaciones?: string | null; datos_front?: Record<string, unknown> | null }) =>
  llamada<Traslado>('/traslados', { method: 'POST', body: payload });

export const reenviarTraslado = (id: string, payload: { lineas: TrasladoLinea[]; observaciones?: string | null; version: number }) =>
  llamada<Traslado>(`/traslados/${id}`, { method: 'PUT', body: payload });

export const transicionTraslado = (id: string, body: { accion: string; observacion?: string; version: number; datos_adicionales?: Record<string, unknown> }) =>
  llamada<Traslado>(`/traslados/${id}/transicion`, { method: 'POST', body });

// ── Adjuntos ───────────────────────────────────────────────────────────────

export const listarAdjuntosFin = (modulo: string, referencia: string) =>
  llamada<AdjuntoFin[]>(`/adjuntos?modulo_origen=${encodeURIComponent(modulo)}&referencia_id=${encodeURIComponent(referencia)}`);

export const subirAdjuntoFin = (archivo: File, modulo: string, referencia: string, tipoDocumento?: string) => {
  const form = new FormData();
  form.append('archivo', archivo);
  form.append('modulo_origen', modulo);
  form.append('referencia_id', referencia);
  if (tipoDocumento) form.append('tipo_documento', tipoDocumento);
  return llamada<AdjuntoFin>('/adjuntos/subir', { method: 'POST', form });
};

export const eliminarAdjuntoFin = (id: string) =>
  llamada<{ mensaje: string }>(`/adjuntos/${id}`, { method: 'DELETE' });

export const urlDescargaAdjunto = async (id: string): Promise<string> => {
  const r = await llamada<{ url: string }>(`/adjuntos/${id}/descargar`);
  return r.url;
};

// ── Viajes ─────────────────────────────────────────────────────────────────

export type EstadoViaje =
  | 'BORRADOR' | 'SOLICITADO' | 'AUTORIZADO' | 'RECHAZADO' | 'TIQUETES_GESTIONADOS'
  | 'PRESUPUESTO_ASIGNADO' | 'ANTICIPO_PAGADO' | 'LEGALIZADO' | 'CERRADO' | 'ANULADO';

export interface Viaje {
  id: string;
  consecutivo: string;
  solicitante_id: string;
  solicitante_nombre: string;
  viajero_nombre: string;
  viajero_cedula: string | null;
  origen: string;
  destino: string;
  fecha_inicio: string;
  fecha_fin: string;
  objetivo: string;
  autorizador_id: string | null;
  fecha_autorizacion: string | null;
  observacion_autorizacion: string | null;
  estado: EstadoViaje;
  requiere_tiquetes: boolean;
  tiquetes_detalle: Record<string, unknown> | null;
  categoria_tarifa: string | null; // enmascarada (null) para no autorizados
  presupuesto_items: Record<string, unknown>[];
  total_presupuesto: number;
  anticipo_pagado: boolean;
  fecha_pago_anticipo: string | null;
  legalizacion_detalle: Record<string, unknown> | null;
  viajero_cargo: string | null;
  categoria_solicitud: string | null;
  observaciones: string | null;
  datos_front: Record<string, unknown> | null;
  presupuesto_detalle: Record<string, unknown> | null;
  anticipo_detalle: Record<string, unknown> | null;
  firmas: { solicito: { nombre: string; fecha: string }; autorizo: { nombre: string; fecha: string } | null; controller: { nombre: string; fecha: string } | null } | null;
  historial_cambios: EventoHistorial[];
  version: number;
  created_at: string;
  updated_at: string;
}

export interface AutorizadorViaje { id: string; nombre: string; rol: string }

export const CIUDADES_VIAJE = [
  'BARRANQUILLA', 'BOGOTA', 'BUCARAMANGA', 'SANTA MARTA', 'PASTO', 'CALI', 'MEDELLIN',
] as const;

export const listarViajes = (estado?: string) =>
  llamada<Viaje[]>(`/viajes${estado ? `?estado=${estado}` : ''}`);

export const obtenerViaje = (id: string) => llamada<Viaje>(`/viajes/${id}`);

export const listarAutorizadores = () => llamada<AutorizadorViaje[]>('/viajes/autorizadores');

export const crearViaje = (payload: {
  viajero_nombre: string; origen: string; destino: string;
  fecha_inicio: string; fecha_fin: string; objetivo: string;
  autorizador_id: string; requiere_tiquetes?: boolean;
  viajero_cargo?: string | null; categoria_solicitud?: string | null;
  observaciones?: string | null; viajero_cedula?: string | null;
}) => llamada<Viaje>('/viajes', { method: 'POST', body: payload });

export const corregirViaje = (id: string, payload: Parameters<typeof crearViaje>[0], version: number) =>
  llamada<Viaje>(`/viajes/${id}?version=${version}`, { method: 'PUT', body: payload });

export const transicionViaje = (id: string, body: {
  accion: string; observacion?: string; version: number;
  datos_adicionales?: Record<string, unknown>;
}) => llamada<Viaje>(`/viajes/${id}/transicion`, { method: 'POST', body });

export const editarPasoViaje = (id: string, paso: 'presupuesto' | 'tiquetes' | 'anticipo', datos: Record<string, unknown>, version: number) =>
  llamada<Viaje>(`/viajes/${id}/editar-paso`, { method: 'POST', body: { paso, datos, version } });

// ── Configuración del módulo ───────────────────────────────────────────────

export const leerConfiguracion = () =>
  llamada<Record<string, unknown>>('/configuracion');

/** Cada parámetro con su versión (0 = valor por defecto, nunca cambiado). */
export const estadoConfiguracion = () =>
  llamada<Record<string, { valor: unknown; version: number }>>('/configuracion/_estado/todo');

export const cambiarConfiguracion = (clave: string, valor: unknown, version?: number) =>
  llamada<{ clave: string; valor: unknown; version: number }>(`/configuracion/${clave}`, {
    method: 'PUT', body: { valor, version },
  });

// ── Requisiciones ──────────────────────────────────────────────────────────

export type EstadoRequisicion =
  | 'BORRADOR' | 'PENDIENTE_JEFE' | 'RECHAZADA_JEFE' | 'PENDIENTE_COMPRAS'
  | 'PENDIENTE_FINANCIERA' | 'RECHAZADA_FINANCIERA' | 'APROBADA'
  | 'EN_ORDEN_COMPRA' | 'RECIBIDO_PARCIAL' | 'RECIBIDO_TOTAL' | 'ANULADA';

export interface ItemRequisicion {
  codigo?: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio_unitario: number;
  total: number;
  centro_costo?: string | null;
  descuento?: number;
  [k: string]: unknown;
}

export interface Requisicion {
  id: string;
  consecutivo: string;
  oc_numero: string | null;
  solicitante_id: string;
  solicitante_nombre: string;
  area: string;
  lugar_entrega: string;
  es_urgente: boolean;
  motivo_urgencia: string | null;
  proveedor_sugerido: string | null;
  proveedor_nit: string | null;
  items: ItemRequisicion[];
  subtotal: number;
  iva: number;
  total: number;
  estado: EstadoRequisicion;
  observacion_jefe: string | null;
  observacion_financiera: string | null;
  proveedor_datos: Record<string, unknown> | null;
  datos_front: Record<string, unknown> | null;
  observaciones: string | null;
  pago_urgente: boolean;
  pago_fecha: string | null;
  pago_aprobado: boolean | null;
  pago_decidido_por: string | null;
  entregado_en: string | null;
  calificacion_proveedor: { notas: Record<string, number>; puntaje: number; letra: string; por: string; at: string } | null;
  historial_cambios: EventoHistorial[];
  version: number;
  created_at: string;
  updated_at: string;
}

export interface PayloadRequisicion {
  lugar_entrega: string;
  es_urgente?: boolean;
  motivo_urgencia?: string | null;
  proveedor_sugerido?: string | null;
  proveedor_nit?: string | null;
  items: ItemRequisicion[];
  subtotal: number;
  iva?: number;
  total: number;
  observaciones?: string | null;
  datos_front?: Record<string, unknown> | null;
}

export const listarRequisiciones = (params: { estado?: string; area?: string; solo_urgentes?: boolean } = {}) => {
  const qs = new URLSearchParams();
  if (params.estado) qs.set('estado', params.estado);
  if (params.area) qs.set('area', params.area);
  if (params.solo_urgentes) qs.set('solo_urgentes', 'true');
  return llamada<Requisicion[]>(`/requisiciones${qs.toString() ? `?${qs}` : ''}`);
};

export const crearRequisicion = (payload: PayloadRequisicion) =>
  llamada<Requisicion>('/requisiciones', { method: 'POST', body: payload });

export const reenviarRequisicion = (id: string, payload: PayloadRequisicion, version: number) =>
  llamada<Requisicion>(`/requisiciones/${id}`, { method: 'PUT', body: { ...payload, version } });

export const transicionRequisicion = (id: string, body: {
  accion: string; observacion?: string; version: number;
  datos_adicionales?: Record<string, unknown>;
}) => llamada<Requisicion>(`/requisiciones/${id}/transicion`, { method: 'POST', body });

export const importarLineasRequisicion = async (archivo: File) => {
  const form = new FormData();
  form.append('archivo', archivo);
  return llamada<{
    items: ItemRequisicion[]; total_lineas: number; subtotal: number;
    errores: { fila: number; errores: string[] }[];
  }>('/requisiciones/importar-lineas', { method: 'POST', form });
};

/** Eliminación administrativa de requisición (snapshot en auditoría). */
export const eliminarRequisicionAdmin = (id: string, motivo: string) =>
  llamada<{ mensaje: string }>(`/admin/requisiciones/${id}?motivo=${encodeURIComponent(motivo)}`, { method: 'DELETE' });

// ── Terceros de Compras (proveedores nuevos) ───────────────────────────────

export type EstadoTercero = 'pendiente_compras' | 'aprobado' | 'rechazado_compras';

export interface TerceroCompras {
  id: string;
  razon_social: string;
  nit: string;
  nit_pago: string | null;
  tipo_cuenta: string | null;
  banco: string | null;
  no_cuenta: string | null;
  area: string | null;
  origen_requisicion: boolean;
  requisicion_id: string | null;
  consecutivo_req: string | null;
  creado_por: string | null;
  creado_por_nombre: string | null;
  estado_compras: EstadoTercero;
  motivo_rechazo_compras: string | null;
  aprobado_por: string | null;
  fecha_aprobacion: string | null;
  creado_en_software: boolean;
  creado_en_software_por: string | null;
  fecha_creado_en_software: string | null;
  historial_cambios: EventoHistorial[];
  version: number;
  created_at: string;
  updated_at: string;
}

export interface PayloadTercero {
  razon_social: string;
  nit: string;
  nit_pago?: string | null;
  tipo_cuenta?: string | null;
  banco?: string | null;
  no_cuenta?: string | null;
  area?: string | null;
  origen_requisicion?: boolean;
  requisicion_id?: string | null;
  consecutivo_req?: string | null;
}

export const listarTerceros = (params: { estado?: string; q?: string; pendientes_software?: boolean } = {}) => {
  const qs = new URLSearchParams();
  if (params.estado) qs.set('estado', params.estado);
  if (params.q) qs.set('q', params.q);
  if (params.pendientes_software) qs.set('pendientes_software', 'true');
  return llamada<TerceroCompras[]>(`/terceros${qs.toString() ? `?${qs}` : ''}`);
};

export const crearTercero = (payload: PayloadTercero) =>
  llamada<TerceroCompras>('/terceros', { method: 'POST', body: payload });

export const aprobarTercero = (id: string) =>
  llamada<TerceroCompras>(`/terceros/${id}/aprobar`, { method: 'POST', body: {} });

export const rechazarTercero = (id: string, motivo: string) =>
  llamada<TerceroCompras>(`/terceros/${id}/rechazar`, { method: 'POST', body: { motivo } });

export const marcarTerceroSoftware = (id: string, marcar?: boolean) =>
  llamada<TerceroCompras>(`/terceros/${id}/cargado-software`, { method: 'POST', body: { marcar: marcar ?? null } });

export const eliminarTercero = (id: string) =>
  llamada<{ mensaje: string; adjuntos_borrados: number }>(`/terceros/${id}`, { method: 'DELETE' });

// ── Catálogos ──────────────────────────────────────────────────────────────

export interface PaginaCatalogo<T> {
  items: T[]; total: number; pagina: number; limite: number; total_paginas: number;
}
export interface CentroCosto { codigo: string; nombre: string; area: string | null }
export interface ProveedorCat { nit: string; razon_social: string; correo: string | null; telefono: string | null }

export const buscarCentrosCosto = (q: string, limite = 20) =>
  llamada<PaginaCatalogo<CentroCosto>>(
    `/catalogos/centros-costo?q=${encodeURIComponent(q)}&limite=${limite}`);

export const buscarProveedores = (q: string, limite = 20) =>
  llamada<PaginaCatalogo<ProveedorCat>>(
    `/catalogos/proveedores?q=${encodeURIComponent(q)}&limite=${limite}`);

/** Presupuesto por responsable/rubro/mes: {responsable: {rubro: {mes: [ppto, ejecutado]}}}. */
export const leerPresupuestoCatalogo = (periodo: number) =>
  llamada<Record<string, Record<string, Record<string, [number, number]>>>>(
    `/catalogos/presupuesto?periodo=${periodo}`);

export interface PersonalViajeCat {
  id: number; nombre: string; cargo: string | null; categoria: string | null;
}

export const listarPersonalViajes = (q?: string) =>
  llamada<PersonalViajeCat[]>(`/catalogos/personal-viajes${q ? `?q=${encodeURIComponent(q)}` : ''}`);

/** Eliminación administrativa de traslado (snapshot en auditoría). */
export const eliminarTrasladoAdmin = (id: string, motivo: string) =>
  llamada<{ mensaje: string }>(`/admin/traslados/${id}?motivo=${encodeURIComponent(motivo)}`, { method: 'DELETE' });

/** Eliminación administrativa de viaje (snapshot en auditoría). */
export const eliminarViajeAdmin = (id: string, motivo: string) =>
  llamada<{ mensaje: string }>(`/admin/viajes/${id}?motivo=${encodeURIComponent(motivo)}`, { method: 'DELETE' });

export const CRITERIOS_CALIFICACION: { clave: string; nombre: string }[] = [
  { clave: 'CE', nombre: 'Calidad del producto/servicio y cumplimiento de especificaciones' },
  { clave: 'EC', nombre: 'Entrega y cumplimiento en fechas' },
  { clave: 'ES', nombre: 'Empaque, rotulado y estado del producto' },
  { clave: 'SQR', nombre: 'Soporte y respuesta a requerimientos' },
  { clave: 'AC', nombre: 'Atención al cliente y comunicación' },
  { clave: 'G', nombre: 'Gestión comercial (cotizaciones a tiempo)' },
  { clave: 'PFC', nombre: 'Postventa, facturación y cartera' },
  { clave: 'MA', nombre: 'Cumplimiento de requisitos ambientales' },
  { clave: 'SST', nombre: 'Cumplimiento de seguridad y salud en el trabajo' },
];

// ── Contabilidad (facturas DIAN) ───────────────────────────────────────────

export interface FacturaDian {
  id: string;
  cufe: string | null;
  numero_factura: string;
  nit_proveedor: string;
  proveedor: string;
  fecha_emision: string | null;
  tipo_documento: string;
  origen: string;
  iva: number;
  total: number;
  estado: 'PENDIENTE' | 'TRAMITADA' | 'LEGALIZACION' | 'RADICADA' | 'CAUSADA' | 'GLOSADA' | 'RECHAZADA' | 'ANULADA';
  oc_vinculada: string | null;
  fecha_radicacion: string | null;
  fecha_causacion: string | null;
  glosas: { motivo: string; por: string; at: string }[];
  // Campos de paridad (validación por área, rechazo, cruce, drive contable)
  validada: boolean;
  area_aprobacion: string | null;
  nota_validacion: string | null;
  motivo_rechazo: string | null;
  rechazado_por: string | null;
  fecha_rechazo: string | null;
  cruzada_id: string | null;
  reemplaza_id: string | null;
  reemplaza_factura: string | null;
  fecha_cruce: string | null;
  cruzado_por: string | null;
  fecha_envio_contab: string | null;
  categoria_contable: string | null;
  num_orden_compra: string | null;
  observacion_recepcion: string | null;
  estado_contable: string | null;
  num_causacion: string | null;
  fecha_contabilizacion: string | null;
  es_cuenta_cobro: boolean;
  origen_doc: string | null;
  caja_menor_sede: string | null;
  detalles: Record<string, unknown> | null;
  historial_cambios: EventoHistorial[];
  version: number;
  created_at: string | null;
}

export interface ResultadoCarga {
  nuevas: number; duplicadas: number; omitidas: number; propias: number;
  errores: string[]; facturas: FacturaDian[];
}

export const listarFacturas = (params: { estado?: string; proveedor?: string; desde?: string; hasta?: string } = {}) => {
  const qs = new URLSearchParams();
  if (params.estado) qs.set('estado', params.estado);
  if (params.proveedor) qs.set('proveedor', params.proveedor);
  if (params.desde) qs.set('desde', params.desde);
  if (params.hasta) qs.set('hasta', params.hasta);
  return llamada<FacturaDian[]>(`/contabilidad/facturas${qs.toString() ? `?${qs}` : ''}`);
};

export const cargarFacturasDian = async (archivo: File) => {
  const form = new FormData();
  form.append('archivo', archivo);
  return llamada<ResultadoCarga>('/contabilidad/facturas/cargar', { method: 'POST', form });
};

export const transicionFactura = (id: string, body: {
  accion: string; observacion?: string; version: number;
  datos_adicionales?: Record<string, unknown>;
}) => llamada<FacturaDian>(`/contabilidad/facturas/${id}/transicion`, { method: 'POST', body });

export interface MovimientoContable {
  id: string; origen: string; referencia: string | null; periodo: string;
  cuenta: string; tercero: string | null; debito: number; credito: number;
  detalle: Record<string, unknown> | null; created_at: string | null;
}

export const listarMovimientos = (periodo?: string) =>
  llamada<{ movimientos: MovimientoContable[]; total_debito: number; total_credito: number; cuadra: boolean }>(
    `/contabilidad/movimientos${periodo ? `?periodo=${periodo}` : ''}`);

// ── Paridad DIAN: preview de carga, validación, cruce, drive ───────────────

export interface PreviewCarga {
  archivo: string | null;
  conteos: { nuevas: number; propias: number; transportadores: number; duplicadas: number; otros: number };
  nuevas: Record<string, unknown>[];
  propias: Record<string, unknown>[];
  transportadores: Record<string, unknown>[];
  duplicadas: Record<string, unknown>[];
  otros: Record<string, unknown>[];
  errores: string[];
}

export const previsualizarCargaDian = async (archivo: File) => {
  const form = new FormData();
  form.append('archivo', archivo);
  return llamada<PreviewCarga>('/contabilidad/facturas/previsualizar', { method: 'POST', form });
};

export interface TransportadorOmitido {
  id: string; nit: string; nombre: string; notas: string | null; activo: boolean;
}

export const listarTransportadores = () => llamada<TransportadorOmitido[]>('/contabilidad/transportadores');
export const crearTransportador = (payload: { nit: string; nombre: string; notas?: string | null }) =>
  llamada<TransportadorOmitido>('/contabilidad/transportadores', { method: 'POST', body: payload });
export const editarTransportador = (id: string, payload: { nit: string; nombre: string; notas?: string | null }) =>
  llamada<TransportadorOmitido>(`/contabilidad/transportadores/${id}`, { method: 'PUT', body: payload });
export const eliminarTransportador = (id: string) =>
  llamada<{ mensaje: string }>(`/contabilidad/transportadores/${id}`, { method: 'DELETE' });
export const archivarPendientesTransportador = (id: string) =>
  llamada<{ archivadas: number }>(`/contabilidad/transportadores/${id}/archivar-pendientes`, { method: 'POST', body: {} });

export const validarFactura = (id: string, body: { area: string; nota?: string | null }) =>
  llamada<FacturaDian>(`/contabilidad/facturas/${id}/validar`, { method: 'POST', body });

export const quitarValidacionFactura = (id: string) =>
  llamada<FacturaDian>(`/contabilidad/facturas/${id}/quitar-validacion`, { method: 'POST', body: {} });

export const rechazarFactura = (id: string, motivo: string) =>
  llamada<FacturaDian>(`/contabilidad/facturas/${id}/rechazar`, { method: 'POST', body: { motivo } });

export const reactivarFactura = (id: string) =>
  llamada<FacturaDian>(`/contabilidad/facturas/${id}/reactivar`, { method: 'POST', body: {} });

export const cruceCandidatos = (id: string) =>
  llamada<(FacturaDian & { diferencia: number })[]>(`/contabilidad/facturas/${id}/cruce-candidatos`);

export const cruzarFacturas = (id: string, body: { cruzada_id: string; motivo: string }) =>
  llamada<{ rechazada: FacturaDian; reemplazo: FacturaDian }>(`/contabilidad/facturas/${id}/cruce`, { method: 'POST', body });

export const deshacerCruce = (id: string) =>
  llamada<{ rechazada: FacturaDian; reemplazo: FacturaDian }>(`/contabilidad/facturas/${id}/cruce/deshacer`, { method: 'POST', body: {} });

export const enviarCajaMenor = (id: string, body: { sede: string; comprobante?: string; responsable?: string; observaciones?: string }) =>
  llamada<FacturaDian>(`/contabilidad/facturas/${id}/enviar-caja-menor`, { method: 'POST', body });

export const registrarNovedad = (id: string, body: {
  estado_contable: string; glosa?: string | null; otra_glosa?: string | null;
  num_causacion?: string | null; observacion?: string | null;
}) => llamada<FacturaDian>(`/contabilidad/facturas/${id}/novedad`, { method: 'POST', body });

export const reabrirContabilizacion = (id: string) =>
  llamada<FacturaDian>(`/contabilidad/facturas/${id}/reabrir`, { method: 'POST', body: {} });

export const radicarCuentaCobro = (payload: {
  beneficiario: string; nit: string; numero_documento?: string; valor: number; iva?: number;
  fecha_documento?: string; fecha_envio?: string; categoria: string; origen: string; concepto?: string;
}) => llamada<FacturaDian>('/contabilidad/facturas/cuenta-cobro', { method: 'POST', body: payload });

export interface UploadDian {
  id: string; archivo: string; usuario: string; fecha: string | null;
  conteos: { nuevas: number; duplicadas: number; propias: number; transportadores: number; otros: number };
}

export const listarUploadsDian = () => llamada<UploadDian[]>('/contabilidad/uploads');

export interface TorreControlDatos {
  pagos_hoy: { id: string; proveedor: string | null; valor: number; fecha: string | null }[];
  servicios_hoy: { servicio: string; inmueble: string; valor: number; fecha_limite: string | null }[];
  agenda: { fecha: string; tipo: 'pago' | 'servicio'; detalle: string; valor: number }[];
  kpis: { facturas_pendientes: number; facturas_por_causar: number; facturas_caja_menor: number;
          pagos_pendientes: number; servicios_pendientes: number };
  ultima_carga: string | null;
}

export const torreControl = () => llamada<TorreControlDatos>('/contabilidad/torre');

export const correoNotificar = (payload: { destinatarios: string[]; asunto: string; lineas: string[] }) =>
  llamada<{ mensaje: string; destinatarios: number }>('/contabilidad/correos/notificar', { method: 'POST', body: payload });

/** Descarga el ZIP de soportes contables (fetch+blob: el <a> no lleva Bearer). */
export const descargarZipSoportes = async (params: { desde?: string; hasta?: string; estado_contable?: string } = {}): Promise<void> => {
  const qs = new URLSearchParams();
  if (params.desde) qs.set('desde', params.desde);
  if (params.hasta) qs.set('hasta', params.hasta);
  if (params.estado_contable) qs.set('estado_contable', params.estado_contable);
  const r = await fetch(`${BASE}/contabilidad/facturas/zip-soportes${qs.toString() ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${window.localStorage.getItem(LLAVE_TOKEN_FIN) ?? ''}` },
  });
  if (!r.ok) throw new FinApiError(r.status, 'No se pudo generar el ZIP de soportes.');
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Soportes_Contabilidad.zip';
  a.click();
  URL.revokeObjectURL(url);
};

// ── Pagos urgentes ─────────────────────────────────────────────────────────

export interface PagoUrgente {
  id: string; requisicion_id: string | null; consecutivo_req: string | null; oc_numero: string | null;
  solicitante_nombre: string; proveedor: string | null; valor: number;
  fecha_requerida: string | null; estado: 'PENDIENTE' | 'PAGADO' | 'RECHAZADO';
  referencia: string | null; fecha_pago: string | null; motivo_rechazo: string | null;
  // Campos de paridad (datos bancarios e identificación del original)
  origen: string; nit: string | null; nit_pago: string | null; banco: string | null;
  no_cuenta: string | null; tipo_cuenta: string | null; area: string | null;
  tipo_doc: string | null; numero_doc: string | null;
  requerimiento: string | null; asunto: string | null;
  contabilizada: boolean;
  historial_cambios: EventoHistorial[]; version: number;
  created_at: string | null;
}

export interface ResumenPagos {
  cantidad: number; pendientes: number; total_pendiente: number;
  vencidos: number; total_vencido: number;
}

export const listarPagos = (params: {
  estado?: string; q?: string; tipo_doc?: string; desde?: string; hasta?: string;
  solo_vencidos?: boolean; orden?: string;
} = {}) => {
  const qs = new URLSearchParams();
  if (params.estado) qs.set('estado', params.estado);
  if (params.q) qs.set('q', params.q);
  if (params.tipo_doc) qs.set('tipo_doc', params.tipo_doc);
  if (params.desde) qs.set('desde', params.desde);
  if (params.hasta) qs.set('hasta', params.hasta);
  if (params.solo_vencidos) qs.set('solo_vencidos', 'true');
  if (params.orden) qs.set('orden', params.orden);
  return llamada<{ pagos: PagoUrgente[]; resumen: ResumenPagos }>(`/pagos${qs.toString() ? `?${qs}` : ''}`);
};

export interface PayloadPagoManual {
  proveedor: string; nit?: string | null; nit_pago?: string | null; banco?: string | null;
  no_cuenta?: string | null; tipo_cuenta?: string | null; area?: string | null;
  tipo_doc?: string; numero_doc?: string | null; valor: number; fecha_requerida: string;
  requerimiento?: string | null; asunto?: string | null;
}

export const crearPagoManual = (payload: PayloadPagoManual) =>
  llamada<PagoUrgente>('/pagos', { method: 'POST', body: payload });

export const editarPagoUrgente = (id: string, payload: PayloadPagoManual) =>
  llamada<PagoUrgente>(`/pagos/${id}`, { method: 'PUT', body: payload });

export const eliminarPagoUrgente = (id: string) =>
  llamada<{ mensaje: string }>(`/pagos/${id}`, { method: 'DELETE' });

export const toggleContabilizadaPago = (id: string, version: number) =>
  llamada<PagoUrgente>(`/pagos/${id}/contabilizada`, { method: 'POST', body: { version } });

export const reabrirPagoUrgente = (id: string, version: number) =>
  llamada<PagoUrgente>(`/pagos/${id}/reabrir`, { method: 'POST', body: { version } });

export const reconsiderarPagoUrgente = (id: string, version: number) =>
  llamada<PagoUrgente>(`/pagos/${id}/reconsiderar`, { method: 'POST', body: { version } });

export const motivosRechazoPago = () =>
  llamada<{ motivos: string[] }>('/pagos/motivos-rechazo');

export const pagarPagoUrgente = (id: string, body: { referencia?: string; version: number }) =>
  llamada<PagoUrgente>(`/pagos/${id}/pagar`, { method: 'POST', body });

export const rechazarPagoUrgente = (id: string, body: { motivo: string; version: number }) =>
  llamada<PagoUrgente>(`/pagos/${id}/rechazar`, { method: 'POST', body });

// ── Cotizaciones y anticipos internos (ex 'quotes') ────────────────────────

export interface QuoteFin {
  id: string; tipo: 'COTIZACION' | 'ANTICIPO'; tipo_comprobante: string | null;
  proceso: string | null; sede_cm: string | null;
  proveedor: string; nit: string | null; valor: number;
  fecha: string | null; estado: 'PENDIENTE' | 'CRUZADA' | 'LEGALIZADA' | 'CERRADA';
  factura_id: string | null; factura_numero: string | null; pago_id: string | null;
  legalizacion: Record<string, unknown>;
  historial_cambios: EventoHistorial[]; version: number;
  created_at: string | null;
}

export interface PayloadQuote {
  tipo: 'COTIZACION' | 'ANTICIPO'; tipo_comprobante?: string | null;
  proceso?: string | null; sede_cm?: string | null;
  proveedor: string; nit?: string | null; valor: number; fecha?: string | null;
  crear_pago?: boolean; observaciones?: string | null;
}

export const listarQuotes = (params: { segmento?: string; q?: string } = {}) => {
  const qs = new URLSearchParams();
  if (params.segmento) qs.set('segmento', params.segmento);
  if (params.q) qs.set('q', params.q);
  return llamada<QuoteFin[]>(`/quotes${qs.toString() ? `?${qs}` : ''}`);
};

export const crearQuote = (payload: PayloadQuote) =>
  llamada<QuoteFin>('/quotes', { method: 'POST', body: payload });

export const legalizarQuote = (id: string, body: { fecha?: string; observaciones?: string; recibos?: string[] }) =>
  llamada<QuoteFin>(`/quotes/${id}/legalizar`, { method: 'POST', body });

export const deshacerLegalizacionQuote = (id: string) =>
  llamada<QuoteFin>(`/quotes/${id}/deshacer-legalizacion`, { method: 'POST', body: {} });

export const cerrarQuote = (id: string) =>
  llamada<QuoteFin>(`/quotes/${id}/cerrar`, { method: 'POST', body: {} });

export const candidatosQuote = (id: string) =>
  llamada<{ id: string; numero_factura: string; proveedor: string; total: number; estado: string; diferencia: number }[]>(
    `/quotes/${id}/candidatos`);

export const cruzarQuote = (id: string, factura_id: string) =>
  llamada<QuoteFin>(`/quotes/${id}/cruzar`, { method: 'POST', body: { factura_id } });

export const descruzarQuote = (id: string) =>
  llamada<QuoteFin>(`/quotes/${id}/descruzar`, { method: 'POST', body: {} });

export const eliminarQuote = (id: string) =>
  llamada<{ mensaje: string }>(`/quotes/${id}`, { method: 'DELETE' });

// ── Servicios públicos ─────────────────────────────────────────────────────

export interface ServicioPublicoFin {
  id: string; servicio: string; inmueble: string; periodo: string; valor: number;
  fecha_limite: string | null; estado: 'PENDIENTE' | 'CAUSADO' | 'PAGADO' | 'ENVIADO_CONTAB' | 'PAGADO_NO_CONTAB' | 'NO_GENERADO';
  fecha_pago: string | null; datos: Record<string, unknown>; version: number;
  categoria: string; concepto: string | null; contrato: string | null;
  nit_tercero: string | null; tercero: string | null; fecha_exp: string | null;
  observacion: string | null; urgente_recepcion: string | null;
  url_pago: string | null; url_drive: string | null;
}

export interface PayloadServicio {
  servicio: string; inmueble: string; periodo: string; valor: number;
  fecha_limite?: string | null; datos?: Record<string, unknown> | null;
}

export const listarServicios = (params: { periodo?: string; servicio?: string; estado?: string; categoria?: string; solo_vencidos?: boolean; modo_calidad?: string; q?: string } = {}) => {
  const qs = new URLSearchParams();
  if (params.categoria) qs.set('categoria', params.categoria);
  if (params.solo_vencidos) qs.set('solo_vencidos', 'true');
  if (params.modo_calidad) qs.set('modo_calidad', params.modo_calidad);
  if (params.q) qs.set('q', params.q);
  if (params.periodo) qs.set('periodo', params.periodo);
  if (params.servicio) qs.set('servicio', params.servicio);
  if (params.estado) qs.set('estado', params.estado);
  return llamada<{ servicios: ServicioPublicoFin[]; resumen: { total: number; pendiente: number; cantidad: number } }>(
    `/servicios${qs.toString() ? `?${qs}` : ''}`);
};

export const crearServicio = (payload: PayloadServicio) =>
  llamada<ServicioPublicoFin>('/servicios', { method: 'POST', body: payload });

export const editarServicio = (id: string, payload: PayloadServicio) =>
  llamada<ServicioPublicoFin>(`/servicios/${id}`, { method: 'PUT', body: payload });

export const transicionServicio = (id: string, body: { accion: string; fecha_pago?: string; version: number }) =>
  llamada<ServicioPublicoFin>(`/servicios/${id}/transicion`, { method: 'POST', body });

export const parchearCeldaServicio = (id: string, body: { campo: string; valor: string | number | null; version?: number }) =>
  llamada<ServicioPublicoFin>(`/servicios/${id}/celda`, { method: 'PATCH', body });

export const ciclarUrgenciaServicio = (id: string) =>
  llamada<ServicioPublicoFin>(`/servicios/${id}/urgencia`, { method: 'POST', body: {} });

export const soporteCargadoServicio = (id: string) =>
  llamada<ServicioPublicoFin>(`/servicios/${id}/soporte-cargado`, { method: 'POST', body: {} });

export const generarPeriodoServicios = (periodo: string) =>
  llamada<{ creados: number; contratos_activos: number }>(`/servicios/generar-periodo?periodo=${periodo}`, { method: 'POST', body: {} });

export interface ContratoServicioFin {
  id: string; servicio: string; inmueble: string; categoria: string;
  concepto: string | null; contrato: string; nit_tercero: string | null;
  tercero: string | null; fecha_exp: string | null; url_pago: string | null; activo: boolean;
}

export const listarContratosServicios = () =>
  llamada<ContratoServicioFin[]>('/servicios/contratos');

export const crearContratoServicio = (payload: Partial<ContratoServicioFin>) =>
  llamada<ContratoServicioFin>('/servicios/contratos', { method: 'POST', body: payload });

export const editarContratoServicio = (id: string, payload: Partial<ContratoServicioFin>) =>
  llamada<ContratoServicioFin>(`/servicios/contratos/${id}`, { method: 'PUT', body: payload });

export const propagarContratoServicio = (id: string, alcance: 'todos' | 'futuros' = 'todos') =>
  llamada<{ cambiadas: number; alcance: string }>(`/servicios/contratos/${id}/propagar?alcance=${alcance}`, { method: 'PUT', body: {} });

export const eliminarContratoServicio = (id: string) =>
  llamada<{ mensaje: string }>(`/servicios/contratos/${id}`, { method: 'DELETE' });

/** Descarga el ZIP de facturas del periodo (fetch+blob con Bearer). */
export const descargarZipServicios = async (periodo?: string): Promise<void> => {
  const r = await fetch(`${BASE}/servicios/zip-facturas${periodo ? `?periodo=${periodo}` : ''}`, {
    headers: { Authorization: `Bearer ${window.localStorage.getItem(LLAVE_TOKEN_FIN) ?? ''}` },
  });
  if (!r.ok) throw new FinApiError(r.status, 'No se pudo generar el ZIP de servicios.');
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Servicios_${periodo ?? 'Consolidado'}.zip`;
  a.click();
  URL.revokeObjectURL(url);
};

// ── Cajas menores ──────────────────────────────────────────────────────────

/** Circuitos de paridad DIAN: catálogos del texto original (listas exportadas al front). */
export const MOTIVOS_RECHAZO_FACTURA = [
  'Error en tarifa / valores facturados',
  'Mercancía o servicio no recibido / no conforme',
  'Falta orden de compra / soportes obligatorios',
  'Solicitada refacturación al proveedor',
  'Factura duplicada o errónea',
] as const;

export const GLOSAS_CONTABILIDAD = [
  'CENTRO DE COSTO NO CREADO', 'PENDIENTE RUT Y CERTIFICACIÓN', 'NOTA CRÉDITO PENDIENTE',
  'ERROR EN VALOR O RETENCIÓN', 'FALTA APROBACIÓN DE ÁREA', 'ORDEN DE COMPRA ERRADA',
  'FACTURA DUPLICADA', 'DATOS FISCALES / NIT ERRADO', 'FALTA SOPORTE DE ENTREGA O REMISIÓN',
  'PROVEEDOR BLOQUEADO',
] as const;

export const CATEGORIAS_GASTO = ['OPERACIÓN', 'ADMINISTRACIÓN', 'LOGÍSTICA', 'MANTENIMIENTO', 'COMERCIAL', 'INFRAESTRUCTURA', 'OTRA'] as const;
export const CATEGORIAS_CUENTA_COBRO = ['OPERACIÓN', 'HONORARIOS', 'LOGÍSTICA Y TRANSPORTES', 'ADMINISTRACIÓN', 'MANTENIMIENTO', 'COMERCIAL', 'INFRAESTRUCTURA', 'OTRA'] as const;
export const AREAS_APROBACION = ['Compras', 'Gerencia', 'Operaciones', 'General'] as const;
export const CONCEPTOS_SUGERIDOS_CC = ['HONORARIOS SERVICIOS', 'TRANSPORTE Y FLETES', 'LEGALIZACIÓN CAJA MENOR', 'MANTENIMIENTO SEDE', 'REEMBOLSO DE GASTOS', 'URGENTE CAUSACIÓN'] as const;

export interface MovimientoCajaFin {
  fecha?: string | null; concepto: string; valor: number;
  tipo: 'gasto' | 'reposicion'; centro_costo?: string | null;
  factura_dian_id?: string | null; datos?: Record<string, unknown> | null;
  // Campos del circuito FORM-FIN-007 (puerto del original)
  folio?: number; nit?: string | null; proveedor?: string | null;
  tipo_documento?: 'recibo_caja' | 'cuenta_cobro' | 'factura_electronica' | null;
  no_factura?: string | null; invoice_id?: string | null;
  contabilizado?: boolean | null; cruzado?: boolean | null;
}

export interface SedeCajaFin {
  id: string; nombre: string; etiqueta: string | null; responsable: string | null;
  identificacion: string | null; jefe_inmediato: string | null;
  cco: string | null; cuenta: string | null; activo: boolean;
}

export interface CajaMenorFin {
  id: string; consecutivo: string | null; sede: string; responsable: string;
  responsable_cc: string | null; centro_costo_principal: string | null;
  periodo: string; saldo_inicial: number; total_gastos: number; total_reembolso: number;
  estado: 'EN_EDICION' | 'RADICADA' | 'APROBADA_JEFE' | 'APROBADA_CONTROLLER'
    | 'CONTABILIZADA' | 'CRUZADA' | 'REEMBOLSADA' | 'RECHAZADA';
  movimientos: MovimientoCajaFin[]; datos: Record<string, unknown>;
  politica: Record<string, unknown>;
  version: number; created_at: string | null; updated_at: string | null;
}

export interface PayloadCaja {
  sede: string; responsable: string; periodo: string; saldo_inicial: number;
  responsable_cc?: string | null; centro_costo_principal?: string | null;
  movimientos: MovimientoCajaFin[]; datos?: Record<string, unknown> | null;
}

export interface KpisCajas {
  total_en_proceso: number; monto_en_proceso: number; por_jefe: number;
  por_controller: number; por_contabilizar: number; por_cruce: number; por_egreso: number;
}

export const listarCajas = (params: { periodo?: string; sede?: string; estado?: string; semaforo?: string; q?: string } = {}) => {
  const qs = new URLSearchParams();
  if (params.periodo) qs.set('periodo', params.periodo);
  if (params.sede) qs.set('sede', params.sede);
  if (params.estado) qs.set('estado', params.estado);
  if (params.semaforo) qs.set('semaforo', params.semaforo);
  if (params.q) qs.set('q', params.q);
  return llamada<CajaMenorFin[]>(`/cajas${qs.toString() ? `?${qs}` : ''}`);
};

export const kpisCajas = () => llamada<KpisCajas>('/cajas/kpis');

export const listarSedesCajas = () => llamada<SedeCajaFin[]>('/catalogos/sedes-cajas');

export const crearSedeCaja = (payload: Partial<SedeCajaFin>) =>
  llamada<SedeCajaFin>('/catalogos/sedes-cajas', { method: 'POST', body: payload });

export const editarSedeCaja = (id: string, payload: Partial<SedeCajaFin>) =>
  llamada<SedeCajaFin>(`/catalogos/sedes-cajas/${id}`, { method: 'PUT', body: payload });

export const crearCaja = (payload: PayloadCaja) =>
  llamada<CajaMenorFin>('/cajas', { method: 'POST', body: payload });

export const guardarCaja = (id: string, payload: PayloadCaja) =>
  llamada<CajaMenorFin>(`/cajas/${id}`, { method: 'PUT', body: payload });

export const radicarCaja = (id: string) =>
  llamada<CajaMenorFin>(`/cajas/${id}/radicar`, { method: 'POST', body: {}});

export const transicionCaja = (id: string, body: {
  accion: string; version?: number; motivo?: string;
  no_comprobante_fc?: string; bg_ef?: string; subcuenta?: string;
  no_egreso_banco?: string; banco?: string;
}) => llamada<CajaMenorFin>(`/cajas/${id}/transicion`, { method: 'POST', body });

export const parchearItemCaja = (id: string, body: { folio: number; contabilizado?: boolean; cruzado?: boolean }) =>
  llamada<CajaMenorFin>(`/cajas/${id}/items`, { method: 'PATCH', body });

export const vincularFacturaCaja = (id: string, body: { folio: number; factura_id: string }) =>
  llamada<CajaMenorFin>(`/cajas/${id}/vincular-factura`, { method: 'POST', body });

export const eliminarCaja = (id: string) =>
  llamada<{ mensaje: string }>(`/cajas/${id}`, { method: 'DELETE' });

// ── Administración ─────────────────────────────────────────────────────────

export interface UsuarioFinAdmin {
  id: string; username: string; nombre: string; correo: string; rol: string;
  area: string | null; activo: boolean;
  es_aprobador_pagos: boolean; es_admin_adicional: boolean; es_autorizador_viajes: boolean;
  permisos?: Record<string, boolean>;
  secciones_efectivas?: string[];
}

// ── Secciones del módulo y su default por rol (espejo del backend) ────────

export const SECCIONES_FIN = [
  'requisiciones', 'traslados', 'viajes', 'facturas',
  'pagos', 'servicios', 'cajas', 'administracion', 'proveedores',
] as const;

const _TODAS = new Set<string>(SECCIONES_FIN);
export const SECCIONES_POR_ROL: Record<string, Set<string>> = {
  admin: _TODAS,
  tesoreria: new Set(['requisiciones', 'viajes', 'facturas', 'pagos', 'servicios', 'cajas']),
  contabilidad: new Set(['facturas', 'servicios', 'cajas', 'viajes', 'pagos', 'proveedores']),
  compras: new Set(['requisiciones', 'facturas', 'pagos', 'viajes', 'proveedores']),
  controller: new Set(['requisiciones', 'traslados', 'viajes']),
  gerente_financiero: new Set(['requisiciones', 'traslados', 'viajes']),
  presidencia: new Set(['traslados', 'viajes']),
  requisicion: new Set(['requisiciones', 'viajes']),
  jefe_area: new Set(['requisiciones', 'traslados', 'viajes']),
  calidad: new Set(['servicios']),
  autorizador_viajes: new Set(['viajes']),
  consulta: new Set<string>(),
};

/** Secciones que el usuario puede ver según su rol y overrides. */
export function seccionesEfectivas(rol: string, permisos?: Record<string, boolean> | null): Set<string> {
  if (rol === 'admin') return _TODAS;
  const base = new Set(SECCIONES_POR_ROL[rol] ?? []);
  for (const [seccion, permitido] of Object.entries(permisos ?? {})) {
    if ((SECCIONES_FIN as readonly string[]).includes(seccion)) {
      if (permitido) base.add(seccion);
      else base.delete(seccion);
    }
  }
  return base;
}

/** Solo los overrides (diferencias vs el rol) para enviar al backend. */
export function calcularOverrides(rol: string, marcadas: Set<string>): Record<string, boolean> {
  const porDefecto = SECCIONES_POR_ROL[rol] ?? new Set<string>();
  const overrides: Record<string, boolean> = {};
  for (const s of SECCIONES_FIN) {
    const efectiva = marcadas.has(s);
    const defaultRol = rol === 'admin' ? true : porDefecto.has(s);
    if (efectiva !== defaultRol) overrides[s] = efectiva;
  }
  return overrides;
}

/** Roles asignables por pantalla — SIN 'admin': el Administrador Principal
 * (rol admin) no se crea desde aquí; nace de la semilla o lo nombra otro
 * principal. Para poder pleno usa la casilla «admin adicional». */
export const ROLES_FINANCIERO = [
  'tesoreria', 'contabilidad', 'calidad', 'consulta', 'requisicion',
  'jefe_area', 'compras', 'controller', 'gerente_financiero', 'presidencia', 'autorizador_viajes',
] as const;

export const listarUsuariosFin = (params: { solo_activos?: boolean; rol?: string } = {}) => {
  const qs = new URLSearchParams();
  if (params.solo_activos) qs.set('solo_activos', 'true');
  if (params.rol) qs.set('rol', params.rol);
  return llamada<UsuarioFinAdmin[]>(`/usuarios${qs.toString() ? `?${qs}` : ''}`);
};

export interface CandidatoFinanciero {
  correo: string; nombre: string; celular: string | null; en_modulo: boolean;
}

/** Candidatos a dar de alta: usuarios de IntegrApp con perfil FINANCIERO. */
export const buscarCandidatosFin = (q: string) =>
  llamada<CandidatoFinanciero[]>(`/usuarios/candidatos?q=${encodeURIComponent(q)}`);

export const crearUsuarioFin = (payload: Partial<UsuarioFinAdmin>) =>
  llamada<UsuarioFinAdmin>('/usuarios', { method: 'POST', body: payload });

export const actualizarUsuarioFin = (id: string, payload: Partial<UsuarioFinAdmin>) =>
  llamada<UsuarioFinAdmin>(`/usuarios/${id}`, { method: 'PUT', body: payload });

export const eliminarUsuarioFin = (id: string) =>
  llamada<{ eliminado: boolean; username: string }>(`/usuarios/${id}`, { method: 'DELETE' });

export interface FilaImportacion {
  fila: number; valida: boolean;
  datos: { nombre: string; username: string; correo: string; rol: string; area: string };
  errores: string[];
}

export const previsualizarImportacion = async (archivo: File) => {
  const form = new FormData();
  form.append('archivo', archivo);
  return llamada<FilaImportacion[]>('/usuarios/importar/vista-previa', { method: 'POST', form });
};

export const confirmarImportacion = (filas: FilaImportacion[]) =>
  llamada<{ creados: { username: string; nombre: string }[]; omitidos: { fila: number; motivo?: string }[] }>(
    '/usuarios/importar/confirmar', { method: 'POST', body: { filas } });

export interface EventoAuditoria {
  id: string; fecha: string; usuario: string | null; rol: string | null;
  modulo: string; accion: string; entidad_id: string | null;
  ip: string | null; detalles: Record<string, unknown>;
}

export const consultarAuditoria = (params: {
  modulo?: string; accion?: string; usuario?: string; desde?: string; hasta?: string;
  limite?: number; desplazamiento?: number;
} = {}) => {
  const qs = new URLSearchParams(Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])));
  return llamada<{ eventos: EventoAuditoria[]; total: number }>(`/auditoria${qs.toString() ? `?${qs}` : ''}`);
};
