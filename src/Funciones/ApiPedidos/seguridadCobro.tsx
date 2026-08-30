// Capa API del módulo de cobro de Estudios de Seguridad (/seguridad/admin/cobro).
// Todas las llamadas van con Bearer del login de baseusuarios (el backend
// recarga la identidad desde la BD — el token solo necesita auth_source/sub).
import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL as string;
const BASE_URL = `${API_BASE}/seguridad/admin/cobro`;

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("baseUsuarioAccessToken");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface PlanSeguridad {
  id: string;
  nombre: string;
  descripcion: string;
  precio_por_estudio: number;
  fuentes_incluidas: string[];
  vigencia_dias: number | null;
  activo: boolean;
  creado_en?: string;
}

export interface PlanPorFuente {
  id: string;
  entrada_id?: string; // "{plan_id}:{fuente}" — único cuando hay varios planes por fuente
  nombre: string;
  precio_por_estudio: number;
  fuentes_incluidas: string[];
  fuente: string;
  retirada?: boolean; // fuente retirada del catálogo: sobrevive (historial) pero no se consume
  ilimitado: boolean;
  cupo_autorizado: number | null;
  cupo_consumido: number;
  cupo_disponible: number | null;
  vence_en: string | null;
}

export interface EmpresaCobro {
  id: string;
  nombre: string;
  activo: boolean;
  planes: PlanPorFuente[];
  consumo_mes_actual: { periodo: string; unidades: number; cop: number };
  saldo_pendiente_cop: number;
}

export interface MovimientoCobro {
  id?: string;
  empresa_nombre: string;
  tipo: "CONSUMO" | "REEMBOLSO" | "PAGO" | "AJUSTE";
  unidades: number;
  monto_cop: number;
  precio_unitario_cop: number | null;
  plan_nombre: string;
  consulta_id: string | null;
  periodo: string;
  motivo: string;
  metodo?: string;
  referencia?: string;
  exento?: boolean;
  reembolsado?: boolean | null;
  periodo_pagado?: string | null;
  estado_estudio?: string;
  cedula?: string;
  canal?: "portal" | "api"; // origen del consumo: humano (portal) o integración
  actor_usuario: string;
  creado_en: string;
}

export interface PeriodoCobro {
  id?: string;
  empresa_nombre: string;
  empresa_id?: string;
  periodo: string;
  totales: {
    consumos: number;
    unidades: number;
    subtotal_cop: number;
    reembolsos_cop: number;
    ajustes_cop: number;
    pagos_cop: number;
    total_cop: number;
  };
  estado: "PENDIENTE_COBRO" | "PAGADA";
  cerrado_por: string;
  cerrado_en: string;
  pdf?: { gcs_ruta: string; tamano: number } | null;
}

export interface DashboardCobro {
  empresas_activas: number;
  con_plan: number;
  cupo_global_disponible: number;
  periodo_actual: string;
  consumo_mes_cop: number;
  cartera_pendiente_cop: number;
  periodos_pendientes: number;
}

// ─── Planes ──────────────────────────────────────────────────────────────────

export const listarPlanes = async (): Promise<PlanSeguridad[]> => {
  const res = await api.get<{ total: number; items: PlanSeguridad[] }>("/planes");
  return res.data.items;
};

export const crearPlan = async (plan: Partial<PlanSeguridad>): Promise<PlanSeguridad> => {
  const res = await api.post<PlanSeguridad>("/planes", plan);
  return res.data;
};

export const actualizarPlan = async (id: string, cambios: Partial<PlanSeguridad>): Promise<PlanSeguridad> => {
  const res = await api.patch<PlanSeguridad>(`/planes/${id}`, cambios);
  return res.data;
};

export const desactivarPlan = async (id: string): Promise<{ empresas_afectadas: string[] }> => {
  const res = await api.delete<{ empresas_afectadas: string[] }>(`/planes/${id}`);
  return res.data;
};

// ─── Empresas ────────────────────────────────────────────────────────────────

export const listarEmpresasCobro = async (): Promise<EmpresaCobro[]> => {
  const res = await api.get<{ total: number; items: EmpresaCobro[] }>("/empresas");
  return res.data.items;
};

export const crearEmpresaCobro = async (empresa: {
  nit: string;
  nombre: string;
  slug?: string;
}): Promise<EmpresaCobro & { id: string; slug: string }> => {
  const res = await api.post<EmpresaCobro & { id: string; slug: string }>("/empresas", empresa);
  return res.data;
};

export const asignarPlanFuente = async (
  empresaId: string,
  fuente: string,
  planId: string,
  cupoAutorizado: number | null // null = sin tope: solo se cobra lo consumido
): Promise<void> => {
  await api.put(`/empresas/${empresaId}/planes/${fuente}`, { plan_id: planId, cupo_autorizado: cupoAutorizado });
};

export const asignarPlanCompleto = async (
  empresaId: string,
  planId: string,
  cupoAutorizado: number | null
): Promise<{ empresa: string; plan: string; fuentes: string[]; cupo_autorizado: number | null; actualizado: boolean }> => {
  const res = await api.put<{ empresa: string; plan: string; fuentes: string[]; cupo_autorizado: number | null; actualizado: boolean }>(
    `/empresas/${empresaId}/plan`,
    { plan_id: planId, cupo_autorizado: cupoAutorizado }
  );
  return res.data;
};

export const quitarPlanCompleto = async (
  empresaId: string,
  planId: string
): Promise<{ empresa: string; fuentes_retiradas: string[] }> => {
  const res = await api.delete<{ empresa: string; fuentes_retiradas: string[] }>(`/empresas/${empresaId}/plan/${planId}`);
  return res.data;
};

// ── API keys (integraciones de clientes) ─────────────────────────────────────

export interface ApiKeySeguridad {
  id: string;
  nombre: string;
  prefijo: string;
  activo: boolean;
  scopes: string[];
  creado_en: string;
  ultimo_uso_en: string | null;
  revocada_en: string | null;
}

export const listarApiKeys = async (empresaId: string): Promise<ApiKeySeguridad[]> => {
  const res = await api.get<{ empresa: string; items: ApiKeySeguridad[] }>(`/empresas/${empresaId}/api-keys`);
  return res.data.items;
};

// La clave completa solo existe en la respuesta de crearla (guardarla ya).
export const crearApiKey = async (
  empresaId: string,
  nombre: string
): Promise<ApiKeySeguridad & { api_key: string }> => {
  const res = await api.post<ApiKeySeguridad & { api_key: string }>(`/empresas/${empresaId}/api-keys`, { nombre });
  return res.data;
};

export const revocarApiKey = async (empresaId: string, keyId: string): Promise<void> => {
  await api.delete(`/empresas/${empresaId}/api-keys/${keyId}`);
};

export const obtenerDashboard = async (): Promise<DashboardCobro> => {
  const res = await api.get<DashboardCobro>("/dashboard");
  return res.data;
};

// ─── Pagos / ajustes / reembolsos ────────────────────────────────────────────

export const registrarPago = async (
  empresaId: string,
  pago: {
    monto_cop: number;
    fecha_pago: string;
    metodo: string;
    referencia?: string;
    nota?: string;
    periodo?: string;
  }
): Promise<MovimientoCobro> => {
  const res = await api.post<MovimientoCobro>(`/empresas/${empresaId}/pagos`, pago);
  return res.data;
};

export const registrarAjuste = async (
  empresaId: string,
  montoCop: number,
  motivo: string
): Promise<MovimientoCobro> => {
  const res = await api.post<MovimientoCobro>(`/empresas/${empresaId}/ajustes`, {
    monto_cop: montoCop,
    motivo,
  });
  return res.data;
};

export const reembolsarConsumo = async (
  empresaId: string,
  consultaId: string,
  motivo: string
): Promise<MovimientoCobro | { nota: string }> => {
  const res = await api.post(`/empresas/${empresaId}/reembolsos`, {
    consulta_id: consultaId,
    motivo,
  });
  return res.data;
};

// ─── Movimientos ─────────────────────────────────────────────────────────────

export const listarMovimientos = async (filtros: {
  empresa_id?: string;
  tipo?: string;
  periodo?: string;
  consulta_id?: string;
  limit?: number;
  skip?: number;
}): Promise<{ total: number; items: MovimientoCobro[] }> => {
  const res = await api.get<{ total: number; items: MovimientoCobro[] }>("/movimientos", {
    params: filtros,
  });
  return res.data;
};

// ─── Períodos ────────────────────────────────────────────────────────────────

export const listarPeriodos = async (filtros?: {
  empresa_id?: string;
  estado?: string;
}): Promise<PeriodoCobro[]> => {
  const res = await api.get<{ total: number; items: PeriodoCobro[] }>("/periodos", {
    params: filtros,
  });
  return res.data.items;
};

export const cerrarPeriodo = async (
  empresaId: string,
  periodo: string,
  permitirVacio = false
): Promise<PeriodoCobro> => {
  const res = await api.post<PeriodoCobro>("/periodos/cerrar", {
    empresa_id: empresaId,
    periodo,
    permitir_vacio: permitirVacio,
  });
  return res.data;
};

export const reabrirPeriodo = async (cierreId: string, motivo: string): Promise<void> => {
  await api.post(`/periodos/${cierreId}/reabrir`, { motivo });
};

export const cambiarEstadoPeriodo = async (cierreId: string, estado: string): Promise<void> => {
  await api.patch(`/periodos/${cierreId}`, { estado });
};

export const urlPdfCuenta = (cierreId: string): string =>
  `${BASE_URL}/periodos/${cierreId}/pdf`;

export const descargarPdfCuenta = async (cierreId: string): Promise<Blob> => {
  const res = await api.get(`/periodos/${cierreId}/pdf`, { responseType: "blob" });
  return res.data;
};

export const regenerarPdfCuenta = async (cierreId: string): Promise<void> => {
  await api.post(`/periodos/${cierreId}/pdf/regenerar`);
};

// ─── Utilidades ──────────────────────────────────────────────────────────────

export const pesosColombianos = (cop: number): string => {
  const signo = cop < 0 ? "-" : "";
  return `${signo}$${Math.abs(Math.round(cop)).toLocaleString("es-CO")}`;
};
