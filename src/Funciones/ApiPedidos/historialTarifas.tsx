import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL as string;
const BASE_URL = `${API_BASE}/historial-tarifas`;

export interface CampoModificado {
  campo: string;
  valor_anterior: any;
  valor_nuevo: any;
}

export interface EventoHistorial {
  id: string;
  accion: 'creacion' | 'edicion' | 'eliminacion' | 'carga_masiva';
  tarifario: 'fletes' | 'fletes_rutas_fmc';
  registro: string;
  registro_id: string | null;
  usuario: string;
  nombre_usuario: string;
  rol: string;
  fecha: string;
  campos_modificados: CampoModificado[];
  snapshot?: any;
  resumen?: {
    insertados?: number;
    errores?: number;
    borrados?: number;
    snapshot_borrados?: any[];
  };
  ip: string;
}

// Usuario logueado (cookie de sesión del portal interno)
export const usuarioDeCookie = (): string =>
  decodeURIComponent(document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/)?.[2] || '');

// Obtener el historial de cambios de tarifas (más reciente primero).
// Solo ADMIN/CONTROL: el backend resuelve el perfil real del usuario.
export const obtenerHistorialTarifas = async (tarifario?: string): Promise<EventoHistorial[]> => {
  const usuario = usuarioDeCookie();
  try {
    const res = await axios.get<EventoHistorial[]>(`${BASE_URL}/`, {
      params: { usuario, ...(tarifario ? { tarifario } : {}) },
    });
    return res.data;
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};
