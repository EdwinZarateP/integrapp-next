/**
 * Telemetría general de la aplicación (2026-11-25) — evolución del patrón del
 * beacon del portal Kabi (DashboardCliente/telemetria.ts, que NO se toca):
 * un beacon fire-and-forget por cambio de RUTA (pageview con el módulo
 * derivado de la URL) y por acciones clave (trackAccion) — para medir quién
 * usa qué módulo y en qué horas se concentra el trabajo (/indicadores/uso-app).
 *
 * - Identidad: cookie usuarioPedidosCookie (app) o conductorCorreo (portal de
 *   conductores). Sin identidad (logins públicos) → no-op: nada que medir.
 * - Sesión: MISMA clave sessionStorage `tlm_sesion` del portal Kabi → una
 *   sesión por pestaña compartida entre portales.
 * - Backend: POST /telemetria/evento (colección eventos_portal; el endpoint
 *   resuelve perfil en baseusuarios best-effort y computa hora_col 0-23 en
 *   hora Colombia para el análisis de horas pico).
 * - ⚠️ Requiere el backend extendido (cliente_id opcional + campo modulo):
 *   contra un backend viejo el POST cae en 422 y el catch lo traga en
 *   silencio — deployar backend ANTES que este frontend.
 */

const API = process.env.NEXT_PUBLIC_API_BASE_URL || '';

/** Ruta (prefijo) → módulo. La PRIMERA coincidencia gana (orden importa). */
const MODULOS_POR_RUTA: [string, string][] = [
  ['/PedidosCompletados', 'kabi_pedidos'],
  ['/Pedidos', 'kabi_pedidos'],
  ['/CargarPedidos', 'kabi_pedidos'],
  ['/MedicalCare', 'medical_care'],
  ['/ConfigMC', 'medical_care'],
  ['/GestionPacientes', 'medical_care'],
  ['/GestionPedidosV3', 'medical_care'],
  ['/CrucePacientesV3', 'medical_care'],
  ['/SolicitudVehiculos', 'solicitud_vehiculos'],
  ['/OtrosCostos', 'otros_costos'],
  ['/HistoricoOtrosCostos', 'otros_costos'],
  ['/HistoricoPedidos', 'historico_pedidos'],
  ['/PedidosAnulados', 'pedidos_anulados'],
  ['/EstadoVehiculos', 'estado_vehiculos'],
  ['/CuentasPlaca', 'cuentas_placa'],
  ['/NovedadesOT', 'novedades_ot'],
  ['/CitasEntrega', 'citas_entrega'],
  ['/GestionTarifasRutas', 'tarifas'],
  ['/Tarifas', 'tarifas'],
  ['/GestionDivipolas', 'divipolas'],
  ['/GestionUsuarios', 'usuarios'],
  ['/Apariencia', 'usuarios'],
  ['/Financiero', 'financiero'],
  ['/EleccionFinanciero', 'financiero'],
  ['/indicadores/uso-kabi', 'indicadores_admin'],
  ['/indicadores/uso-app', 'indicadores_admin'],
  ['/indicadores/mis-clientes', 'indicadores'],
  ['/indicadores/clientes', 'indicadores'],
  ['/indicadores', 'indicadores'],
  ['/revision', 'seguridad'],
  ['/PortalSeguridad', 'seguridad'],
  ['/AdminSeguridad', 'seguridad'],
  ['/Modulos', 'modulos'],
  ['/FlotaDisponible', 'flota'],
  ['/FlotaUsada', 'flota'],
  ['/Disponibilidad', 'flota'],
  ['/Sicetac', 'flota'],
  ['/PanelConductores', 'conductores'],
  ['/RegistroConductor', 'conductores'],
  ['/LoginConductores', 'conductores'],
  ['/AceptarInvitacion', 'conductores'],
];

export const moduloDeRuta = (ruta: string): string => {
  const r = normalizarRuta(ruta);
  for (const [prefijo, modulo] of MODULOS_POR_RUTA) {
    if (r === prefijo || r.startsWith(`${prefijo}/`)) return modulo;
  }
  return 'otros';
};

/** Sin basePath (defensivo: usePathname NO lo incluye, pero tolera ambos) ni
 *  query params; nos quedamos con la RUTA limpia (nada de ids en la URL). */
export const normalizarRuta = (ruta: string): string => {
  let r = (ruta || '').split('?')[0];
  r = r.replace(/\/+$/, '') || '/';
  if (r.startsWith('/integrapp')) r = r.slice('/integrapp'.length) || '/';
  return r;
};

const leerCookie = (nombre: string): string => {
  if (typeof document === 'undefined') return '';
  return document.cookie.match(new RegExp(`(^| )${nombre}=([^;]+)`))?.[2] || '';
};

const sesion = (): string => {
  try {
    let s = sessionStorage.getItem('tlm_sesion');
    if (!s) {
      s = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem('tlm_sesion', s);
    }
    return s;
  } catch {
    return 'sin-sesion';
  }
};

type Identidad = { usuario: string; modulo: string } | null;

/** usuarioPedidosCookie (app) → módulo por ruta; si no, conductorCorreo
 *  (portal de conductores) → módulo fijo conductores. Sin identidad → null. */
const identidad = (ruta: string): Identidad => {
  const usuario = leerCookie('usuarioPedidosCookie');
  if (usuario) return { usuario, modulo: moduloDeRuta(ruta) };
  const conductor = leerCookie('conductorCorreo');
  if (conductor) return { usuario: conductor, modulo: 'conductores' };
  return null;
};

const enviar = (evento: string, detalle: Record<string, unknown>, id: Identidad | null) => {
  if (!API || !id) return;
  fetch(`${API}/telemetria/evento`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      usuario: id.usuario,
      cliente_id: null,
      modulo: id.modulo,
      modo: 'interno',
      evento,
      detalle,
      sesion_id: sesion(),
    }),
    keepalive: true,
  }).catch(() => {}); // fire-and-forget: NUNCA toca la UI
};

/** Un pageview por cambio de ruta (el módulo se deriva de la ruta). */
export const trackPageview = (ruta: string) => {
  const r = normalizarRuta(ruta);
  enviar('pageview', { ruta: r, modulo: moduloDeRuta(r) }, identidad(r));
};

/**
 * Acción clave de un módulo (export Excel, consulta, creación, aprobación…).
 * Se llama al INICIO del handler, tras los guards — 1 línea por acción.
 */
export const trackAccion = (accion: string, detalle: Record<string, string | number> = {}) => {
  const r = typeof location !== 'undefined' ? normalizarRuta(location.pathname) : '/';
  enviar('accion', { accion, ...detalle }, identidad(r));
};

/** Login exitoso (app o portal de conductores). */
export const trackLogin = (tipo: 'app' | 'conductor', usuario: string) => {
  if (!API || !usuario) return;
  fetch(`${API}/telemetria/evento`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      usuario,
      cliente_id: null,
      modulo: tipo === 'conductor' ? 'conductores' : 'login',
      modo: 'interno',
      evento: 'login',
      detalle: { tipo },
      sesion_id: sesion(),
    }),
    keepalive: true,
  }).catch(() => {});
};
