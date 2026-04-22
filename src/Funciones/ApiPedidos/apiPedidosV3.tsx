/**
 * API Integration functions for Pedidos V3 (Medical Care)
 */

import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';

export interface CargarPedidosV3Response {
  mensaje: string;
  tiempo_segundos: number;
  registros_exitosos: number;
  registros_con_errores: number;
  errores: string[];
}

export interface ObtenerPedidosV3Response {
  pedidos: any[];
  total: number;
  skip: number;
  limit: number;
}

export interface EstadoV3 {
  estado: string;
  count: number;
}

export interface ObtenerEstadosV3Response {
  estados: EstadoV3[];
  total: number;
}

export interface ProgressEvent {
  stage: 'reading' | 'processing' | 'saving' | 'complete';
  progress: number;
  message: string;
  processed?: number;
  total?: number;
  errores?: string[];
}

/**
 * Carga masiva de pedidos v3 desde un archivo Excel con progreso en tiempo real (SSE)
 */
export async function cargarPedidosV3Stream(
  usuario: string,
  archivo: File,
  onProgress: (progress: ProgressEvent) => void
): Promise<CargarPedidosV3Response> {
  const formData = new FormData();
  formData.append('archivo', archivo);

  const response = await fetch(
    `${API_BASE_URL}/pedidos-v3/cargar-masivo-stream?usuario=${encodeURIComponent(usuario)}`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.body) {
    throw new Error('No se pudo leer el stream de respuesta');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    // Procesar líneas completas (SSE events)
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        try {
          const parsed = JSON.parse(data);

          if (parsed.error) {
            throw new Error(parsed.error);
          }

          if (parsed.stage === 'complete') {
            return {
              mensaje: parsed.mensaje,
              tiempo_segundos: parsed.tiempo_segundos,
              registros_exitosos: parsed.registros_exitosos,
              registros_con_errores: parsed.registros_con_errores,
              errores: parsed.errores,
            };
          }

          onProgress(parsed);
        } catch (e) {
          console.error('Error al parsear evento SSE:', e);
        }
      }
    }
  }

  throw new Error('La carga no se completó correctamente');
}

/**
 * Obtiene pedidos V3 con paginación y filtro opcional por estado
 */
export async function obtenerPedidosV3(
  skip: number = 0,
  limit: number = 100,
  estado?: string,
  mes_actual?: boolean
): Promise<ObtenerPedidosV3Response> {
  const params: any = { skip, limit };
  if (estado) {
    params.estado = estado;
  }
  if (mes_actual !== undefined) {
    // Python usa 'mes_actual' con tilde
    params['mes_actual'] = mes_actual;
  }

  const response = await axios.get<ObtenerPedidosV3Response>(
    `${API_BASE_URL}/pedidos-v3/`,
    {
      params,
    }
  );

  return response.data;
}

/**
 * Obtiene los estados únicos de pedidos V3
 */
export async function obtenerEstadosV3(): Promise<ObtenerEstadosV3Response> {
  const response = await axios.get<ObtenerEstadosV3Response>(
    `${API_BASE_URL}/pedidos-v3/estados`
  );

  return response.data;
}

/**
 * Elimina todos los pedidos v3 (solo ADMIN)
 */
export async function eliminarTodosPedidosV3(
  usuario: string
): Promise<{ mensaje: string; usuario: string; registros_eliminados: number }> {
  const response = await axios.delete<{ mensaje: string; usuario: string; registros_eliminados: number }>(
    `${API_BASE_URL}/pedidos-v3/eliminar-todos?usuario=${encodeURIComponent(usuario)}`
  );

  return response.data;
}

/**
 * Crea un nuevo pedido v3
 */
export async function crearPedidoV3(
  usuario: string,
  pedidoData: any
): Promise<any> {
  const response = await axios.post<any>(
    `${API_BASE_URL}/pedidos-v3/?usuario=${encodeURIComponent(usuario)}`,
    pedidoData
  );

  return response.data;
}

/**
 * Actualiza un pedido v3 existente
 */
export async function actualizarPedidoV3(
  pedidoId: string,
  usuario: string,
  pedidoData: any
): Promise<any> {
  const response = await axios.put<any>(
    `${API_BASE_URL}/pedidos-v3/${pedidoId}?usuario=${encodeURIComponent(usuario)}`,
    pedidoData
  );

  return response.data;
}

/**
 * Elimina un pedido v3 individual
 */
export async function eliminarPedidoV3(
  pedidoId: string,
  usuario: string
): Promise<any> {
  const response = await axios.delete<any>(
    `${API_BASE_URL}/pedidos-v3/${pedidoId}?usuario=${encodeURIComponent(usuario)}`
  );

  return response.data;
}

/**
 * Obtiene un pedido v3 por ID
 */
export async function obtenerPedidoV3PorId(
  pedidoId: string
): Promise<any> {
  const response = await axios.get<any>(
    `${API_BASE_URL}/pedidos-v3/${pedidoId}`
  );

  return response.data;
}
