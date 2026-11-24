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
  efecto?: string;
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

export const subirAdjuntoFin = (archivo: File, modulo: string, referencia: string) => {
  const form = new FormData();
  form.append('archivo', archivo);
  form.append('modulo_origen', modulo);
  form.append('referencia_id', referencia);
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
  estado: 'PENDIENTE' | 'TRAMITADA' | 'RADICADA' | 'CAUSADA' | 'GLOSADA' | 'ANULADA';
  oc_vinculada: string | null;
  fecha_radicacion: string | null;
  fecha_causacion: string | null;
  glosas: { motivo: string; por: string; at: string }[];
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

// ── Pagos urgentes ─────────────────────────────────────────────────────────

export interface PagoUrgente {
  id: string; requisicion_id: string; consecutivo_req: string; oc_numero: string | null;
  solicitante_nombre: string; proveedor: string | null; valor: number;
  fecha_requerida: string | null; estado: 'PENDIENTE' | 'PAGADO' | 'RECHAZADO';
  referencia: string | null; fecha_pago: string | null; motivo_rechazo: string | null;
  historial_cambios: EventoHistorial[]; version: number;
}

export const listarPagos = (estado?: string) =>
  llamada<PagoUrgente[]>(`/pagos${estado ? `?estado=${estado}` : ''}`);

export const pagarPagoUrgente = (id: string, body: { referencia?: string; version: number }) =>
  llamada<PagoUrgente>(`/pagos/${id}/pagar`, { method: 'POST', body });

export const rechazarPagoUrgente = (id: string, body: { motivo: string; version: number }) =>
  llamada<PagoUrgente>(`/pagos/${id}/rechazar`, { method: 'POST', body });

// ── Servicios públicos ─────────────────────────────────────────────────────

export interface ServicioPublicoFin {
  id: string; servicio: string; inmueble: string; periodo: string; valor: number;
  fecha_limite: string | null; estado: 'PENDIENTE' | 'CAUSADO' | 'PAGADO';
  fecha_pago: string | null; datos: Record<string, unknown>; version: number;
}

export interface PayloadServicio {
  servicio: string; inmueble: string; periodo: string; valor: number;
  fecha_limite?: string | null; datos?: Record<string, unknown> | null;
}

export const listarServicios = (params: { periodo?: string; servicio?: string; estado?: string } = {}) => {
  const qs = new URLSearchParams();
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

// ── Cajas menores ──────────────────────────────────────────────────────────

export interface MovimientoCajaFin {
  fecha?: string | null; concepto: string; valor: number;
  tipo: 'gasto' | 'reposicion'; centro_costo?: string | null;
  factura_dian_id?: string | null; datos?: Record<string, unknown> | null;
}

export interface CajaMenorFin {
  id: string; sede: string; responsable: string; periodo: string;
  saldo_inicial: number; total_gastos: number;
  estado: 'EN_EDICION' | 'LEGALIZADA' | 'CONTABILIZADA';
  movimientos: MovimientoCajaFin[]; datos: Record<string, unknown>; version: number;
}

export interface PayloadCaja {
  sede: string; responsable: string; periodo: string; saldo_inicial: number;
  movimientos: MovimientoCajaFin[]; datos?: Record<string, unknown> | null;
}

export const listarCajas = (params: { periodo?: string; sede?: string; estado?: string } = {}) => {
  const qs = new URLSearchParams();
  if (params.periodo) qs.set('periodo', params.periodo);
  if (params.sede) qs.set('sede', params.sede);
  if (params.estado) qs.set('estado', params.estado);
  return llamada<CajaMenorFin[]>(`/cajas${qs.toString() ? `?${qs}` : ''}`);
};

export const crearCaja = (payload: PayloadCaja) =>
  llamada<CajaMenorFin>('/cajas', { method: 'POST', body: payload });

export const guardarCaja = (id: string, payload: PayloadCaja) =>
  llamada<CajaMenorFin>(`/cajas/${id}`, { method: 'PUT', body: payload });

export const transicionCaja = (id: string, body: { accion: string; version: number; observacion?: string }) =>
  llamada<CajaMenorFin>(`/cajas/${id}/transicion`, { method: 'POST', body });

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
  'pagos', 'servicios', 'cajas', 'administracion',
] as const;

const _TODAS = new Set<string>(SECCIONES_FIN);
export const SECCIONES_POR_ROL: Record<string, Set<string>> = {
  admin: _TODAS,
  tesoreria: new Set(['requisiciones', 'viajes', 'facturas', 'pagos', 'servicios', 'cajas']),
  contabilidad: new Set(['facturas', 'servicios', 'cajas', 'viajes', 'pagos']),
  compras: new Set(['requisiciones', 'facturas', 'pagos', 'viajes']),
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
