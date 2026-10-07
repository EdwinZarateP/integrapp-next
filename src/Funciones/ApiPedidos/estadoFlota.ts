import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL as string;
const BASE_URL = `${API_BASE}/vehiculos`;

// ── Interfaces ───────────────────────────────────────────────────────────────
export interface VehiculoEstado {
  id: string;
  placa: string;
  estado: string;
  estado_legible: string;
  fecha_estado?: string | null;
  conductor: string;
  cedula: string;
  celular: string;
  marca: string;
  linea: string;
  modelo: string;
  observaciones: string;
}

export interface RespuestaEstadoFlota {
  vehiculos: VehiculoEstado[];
  total: number;
  skip: number;
  limit: number;
  conteos: Record<string, number>;
}

export interface EntradaTimeline {
  fecha?: string | null;
  tipo: 'auditoria' | 'estado' | 'edicion';
  accion: string;
  accion_legible: string;
  actor: string;
  via: string;
  via_legible: string;
  detalle: string;
  extra: string;
}

export interface DetalleVehiculoEstado {
  placa: string;
  estado: string;
  estado_legible: string;
  explicacion: string;
  fecha_estado?: string | null;
  observaciones: string;
  conductor: string;
  cedula: string;
  celular: string;
  correo: string;
  marca: string;
  linea: string;
  modelo: string;
  tenedor: string;
  disponible_hoy: boolean;
  disponibilidad_origen: string;
  disponibilidad_destinos: string[];
  timeline: EntradaTimeline[];
}

// Los filtros los procesa TODOS el backend (patrón «Estudios por antigüedad»).
export const listarEstadoFlota = async (f: {
  usuario: string;
  placa?: string;
  estado?: string;
  skip?: number;
  limit?: number;
}): Promise<RespuestaEstadoFlota> => {
  const res = await axios.get<RespuestaEstadoFlota>(`${BASE_URL}/estado-flota`, {
    params: {
      usuario: f.usuario,
      placa: f.placa || undefined,
      estado: f.estado || undefined,
      skip: f.skip,
      limit: f.limit,
    },
  });
  return res.data;
};

// Detalle de una placa: estado, explicación y timeline de lo que ha pasado.
export const consultarDetalleFlota = async (
  usuario: string,
  placa: string,
): Promise<DetalleVehiculoEstado> => {
  const res = await axios.get<DetalleVehiculoEstado>(
    `${BASE_URL}/estado-flota/${encodeURIComponent(placa)}`,
    { params: { usuario } },
  );
  return res.data;
};
