// Capa API del PORTAL CLIENTE de Estudios de Seguridad (/seguridad/estudios).
// El cliente (usuario SEGURIDAD de una empresa) ingresa con su correo+clave
// al login del módulo y obtiene un Bearer propio (8 h).
import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL as string;
const BASE_URL = `${API_BASE}/seguridad/estudios`;

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("seguridadEstudiosToken");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface SesionCliente {
  access_token: string;
  expira_en_min: number;
  usuario: {
    id: string;
    usuario: string;
    nombre: string;
    correo: string;
    perfil: string;
    rol: string;
    empresa: { id: string; nombre: string; slug: string } | null;
  };
}

export interface FuenteCupo {
  fuente: string;
  plan_nombre: string;
  precio_por_estudio: number;
  ilimitado: boolean;
  cupo_autorizado: number | null;
  cupo_consumido: number;
  cupo_disponible: number | null;
}

export interface PlanElegible {
  plan_id: string;
  nombre: string;
  precio_por_estudio: number;
  fuentes: string[];
  ilimitado: boolean;
  cupo_autorizado: number | null;
  cupo_consumido: number;
  cupo_disponible: number | null;
}

export interface CupoCliente {
  empresa: string;
  vigente: boolean;
  fuentes: FuenteCupo[];
  planes?: PlanElegible[];
  consumo_mes: { periodo: string; unidades: number; cop: number };
}

export interface FuenteEstudio {
  estado: string;
  origen: string | null;
  intentos?: number;
  error?: { tipo: string; mensaje: string } | null;
  total?: number;
  no_registra?: boolean | null;
  mensaje?: string;
  nombre_certificado?: string;
}

export interface EstudioResumen {
  consulta_id: string;
  cedula: string;
  nombre_consultado: string;
  estado: string;
  creado_en: string;
  usuario_nombre: string;
  empresa_nombre: string;
}

export interface EstudioDetalle extends EstudioResumen {
  finalizado_en: string | null;
  duracion_s: number | null;
  fuentes?: Record<string, FuenteEstudio>;
  pdf?: { gcs_ruta: string; version: number } | null;
}

// ─── Sesión ──────────────────────────────────────────────────────────────────

export const loginCliente = async (correo: string, clave: string): Promise<SesionCliente> => {
  const res = await axios.post<SesionCliente>(`${BASE_URL}/login`, { correo, clave });
  if (typeof window !== "undefined") {
    window.localStorage.setItem("seguridadEstudiosToken", res.data.access_token);
    window.localStorage.setItem("seguridadEstudiosUsuario", JSON.stringify(res.data.usuario));
  }
  return res.data;
};

export const cerrarSesionCliente = (): void => {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("seguridadEstudiosToken");
    window.localStorage.removeItem("seguridadEstudiosUsuario");
  }
};

export const usuarioCliente = (): SesionCliente["usuario"] | null => {
  if (typeof window === "undefined") return null;
  const crudo = window.localStorage.getItem("seguridadEstudiosUsuario");
  try {
    return crudo ? (JSON.parse(crudo) as SesionCliente["usuario"]) : null;
  } catch {
    return null;
  }
};

export const haySesionCliente = (): boolean =>
  typeof window !== "undefined" && !!window.localStorage.getItem("seguridadEstudiosToken");

// ─── Datos ───────────────────────────────────────────────────────────────────

export const obtenerCupo = async (): Promise<CupoCliente> => {
  const res = await api.get<CupoCliente>("/cupo");
  return res.data;
};

export const crearEstudio = async (
  cedula: string,
  fuentes?: string[],
  planId?: string
): Promise<EstudioDetalle> => {
  const res = await api.post<EstudioDetalle>("", {
    cedula,
    ...(fuentes ? { fuentes } : {}),
    ...(planId ? { plan_id: planId } : {}),
  });
  return res.data;
};

export const listarEstudios = async (filtros: {
  cedula?: string;
  estado?: string;
  limit?: number;
  skip?: number;
}): Promise<{ total: number; items: EstudioResumen[] }> => {
  const res = await api.get<{ total: number; items: EstudioResumen[] }>("", { params: filtros });
  return res.data;
};

export const obtenerEstudio = async (consultaId: string): Promise<EstudioDetalle> => {
  const res = await api.get<EstudioDetalle>(`/${consultaId}`);
  return res.data;
};

export const descargarPdfEstudio = async (consultaId: string): Promise<Blob> => {
  const res = await api.get(`/${consultaId}/pdf`, { responseType: "blob" });
  return res.data;
};

// ─── Utilidades ──────────────────────────────────────────────────────────────

export const pesosColombianos = (cop: number): string =>
  `${cop < 0 ? "-" : ""}$${Math.abs(Math.round(cop)).toLocaleString("es-CO")}`;

export const mensajeError = (e: any): string => {
  const detalle = e?.response?.data?.detail;
  return typeof detalle === "string" ? detalle : "Error inesperado. Intente de nuevo.";
};
