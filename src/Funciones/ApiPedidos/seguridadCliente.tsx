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
  // Fuente runt (vehículo por placa + cédula del propietario)
  placa?: string;
  datos_vehiculo?: Record<string, string>;
  soat?: {
    numero: string;
    aseguradora: string;
    fecha_inicio_vigencia?: string;
    fecha_fin_vigencia?: string;
    estado_portal?: string;
    vigente?: boolean | null;
  } | null;
  polizas?: { numero: string; fecha_fin_vigencia?: string; aseguradora: string; estado: string }[];
  // Fuente simit (comparendos de la placa — sin cédula ni propietario)
  total_comparendos?: number | null;
  total_multas?: number | null;
  total_acuerdos?: number | null;
  total_deuda?: number | null;
  total_a_pagar?: number | null; // saldo EXIGIBLE: >0 → fuente ADVERTENCIA
  comparendos?: {
    numero: string;
    tipo?: string;
    fecha_imposicion?: string | null;
    secretaria?: string;
    infraccion?: string;
    estado?: string;
    valor?: number | null;
    valor_a_pagar?: number | null;
  }[];
  // Fuente sena (certificados de formación por cédula — informativo, sin semáforo)
  total_certificados?: number | null;
  certificados?: {
    registro: string;
    titulo?: string;
    tipo?: string; // Acta / Título / Certificado Aprobación / Certificado de Notas…
    programa?: string;
    fecha_certificacion?: string | null;
    fecha_firma?: string | null;
  }[];
  // Fuente OFAC: coincidencia exacta por identificación en la lista SDN.
  aplica?: boolean;
  total_coincidencias?: number;
  fecha_publicacion?: string;
  total_registros_lista?: number;
  sha256_dataset?: string;
  coincidencias?: {
    uid: string;
    nombre: string;
    tipo?: string;
    programas: string[];
    lista: string;
    tipo_documento?: string;
    numero_documento?: string;
    pais_documento?: string;
  }[];
}

export interface EstudioResumen {
  consulta_id: string;
  cedula: string;
  nit?: string;
  placa?: string | null;
  nombre_consultado: string;
  estado: string;
  creado_en: string;
  usuario_nombre: string;
  empresa_nombre: string;
  costo_cop?: number; // suma de consumos − reembolsos de esta consulta
  canal?: "portal" | "api"; // "api" = hecha por una integración con API key
  // Certificado oficial de la PGN subido a GCS (existe solo si el portal lo
  // entregó y el estudio incluyó procuraduría).
  anexo_procuraduria?: { gcs_ruta: string; sha256: string; tamano: number } | null;
}

// Vehículo validado por runt: el propietario puede ser OTRA persona (el dueño
// del carro ≠ conductor evaluado).
export interface VehiculoEstudio {
  placa: string;
  cedula_propietario: string;
  propietario_es_evaluado: boolean;
}

export interface EstudioDetalle extends EstudioResumen {
  finalizado_en: string | null;
  duracion_s: number | null;
  fuentes?: Record<string, FuenteEstudio>;
  vehiculos?: VehiculoEstudio[];
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
  cedula: string | undefined,
  fuentes?: string[],
  planId?: string,
  placa?: string,
  cedulaPropietario?: string,
  nombres?: string,
  apellidos?: string,
  nit?: string
): Promise<EstudioDetalle> => {
  const res = await api.post<EstudioDetalle>("", {
    ...(cedula ? { cedula } : {}),
    ...(nit ? { nit } : {}),
    ...(fuentes ? { fuentes } : {}),
    ...(planId ? { plan_id: planId } : {}),
    ...(placa ? { placa } : {}),
    // Solo runt: cédula del PROPIETARIO del vehículo cuando el conductor
    // evaluado no es el dueño (vacía → se usa la cédula consultada). simit
    // consulta solo por placa y NO envía propietario.
    ...(placa && cedulaPropietario ? { cedula_propietario: cedulaPropietario } : {}),
    // Solo procuraduria: el captcha de la PGN pregunta por el NOMBRE de la
    // persona consultada ("¿cuál es su primer nombre?") — sin esto esa
    // variante falla.
    ...(nombres ? { nombres } : {}),
    ...(apellidos ? { apellidos } : {}),
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

// Certificado OFICIAL de la Procuraduría (anexo del estudio, cuando existe).
export const descargarAnexoProcuraduria = async (consultaId: string): Promise<Blob> => {
  const res = await api.get(`/${consultaId}/procuraduria.pdf`, { responseType: "blob" });
  return res.data;
};

// ─── Utilidades ──────────────────────────────────────────────────────────────

export const pesosColombianos = (cop: number): string =>
  `${cop < 0 ? "-" : ""}$${Math.abs(Math.round(cop)).toLocaleString("es-CO")}`;

export const mensajeError = (e: any): string => {
  const detalle = e?.response?.data?.detail;
  return typeof detalle === "string" ? detalle : "Error inesperado. Intente de nuevo.";
};
