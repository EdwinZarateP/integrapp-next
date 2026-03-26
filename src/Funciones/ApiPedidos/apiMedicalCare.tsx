/**
 * API Integration functions for Medical Care
 */

import axios from 'axios';
import type {
  CargarPacientesResponse,
  ObtenerPacientesResponse,
  BuscarPacientesResponse,
  EliminarPacientesResponse,
  CrearPacienteResponse,
  ActualizarPacienteResponse,
  EliminarPacienteResponse,
  ObtenerPacienteResponse,
  CrearActualizarPacienteData,
  OcupacionRutasResponse,
  V3SinPacienteResponse
} from './tiposMedicalCare';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';

/**
 * Carga masiva de pacientes desde un archivo Excel con progreso en tiempo real (SSE)
 */
export async function cargarPacientesMasivoStream(
  usuario: string,
  archivo: File,
  onProgress: (progress: {
    stage: string;
    progress: number;
    message: string;
    processed?: number;
    total?: number;
    errores?: string[];
  }) => void
): Promise<CargarPacientesResponse> {
  const formData = new FormData();
  formData.append('archivo', archivo);

  const response = await fetch(
    `${API_BASE_URL}/pacientes-medical-care/cargar-masivo-stream?usuario=${encodeURIComponent(usuario)}`,
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
 * Carga masiva de pacientes desde un archivo Excel
 */
export async function cargarPacientesMasivo(
  usuario: string,
  archivo: File
): Promise<CargarPacientesResponse> {
  const formData = new FormData();
  formData.append('archivo', archivo);

  const response = await axios.post<CargarPacientesResponse>(
    `${API_BASE_URL}/pacientes-medical-care/cargar-masivo?usuario=${encodeURIComponent(usuario)}`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );

  return response.data;
}

/**
 * Obtiene la lista de pacientes con paginación
 */
export async function obtenerPacientes(
  skip: number = 0,
  limit: number = 100
): Promise<ObtenerPacientesResponse> {
  const response = await axios.get<ObtenerPacientesResponse>(
    `${API_BASE_URL}/pacientes-medical-care/`,
    {
      params: { skip, limit },
    }
  );

  return response.data;
}

/**
 * Busca pacientes por cédula o nombre
 */
export async function buscarPacientes(
  cedula?: string,
  paciente?: string
): Promise<BuscarPacientesResponse> {
  const params: any = {};
  if (cedula) params.cedula = cedula;
  if (paciente) params.paciente = paciente;

  const response = await axios.get<BuscarPacientesResponse>(
    `${API_BASE_URL}/pacientes-medical-care/buscar`,
    { params }
  );

  return response.data;
}

/**
 * Elimina todos los pacientes (solo ADMIN)
 */
export async function eliminarTodosPacientes(
  usuario: string
): Promise<EliminarPacientesResponse> {
  const response = await axios.delete<EliminarPacientesResponse>(
    `${API_BASE_URL}/pacientes-medical-care/eliminar-todos?usuario=${encodeURIComponent(usuario)}`
  );

  return response.data;
}

/**
 * Crea un nuevo paciente individual
 */
export async function crearPaciente(
  usuario: string,
  pacienteData: CrearActualizarPacienteData
): Promise<CrearPacienteResponse> {
  const response = await axios.post<CrearPacienteResponse>(
    `${API_BASE_URL}/pacientes-medical-care/?usuario=${encodeURIComponent(usuario)}`,
    pacienteData
  );

  return response.data;
}

/**
 * Actualiza un paciente existente
 */
export async function actualizarPaciente(
  pacienteId: string,
  usuario: string,
  pacienteData: CrearActualizarPacienteData
): Promise<ActualizarPacienteResponse> {
  const response = await axios.put<ActualizarPacienteResponse>(
    `${API_BASE_URL}/pacientes-medical-care/${pacienteId}?usuario=${encodeURIComponent(usuario)}`,
    pacienteData
  );

  return response.data;
}

/**
 * Elimina un paciente individual
 */
export async function eliminarPaciente(
  pacienteId: string,
  usuario: string
): Promise<EliminarPacienteResponse> {
  const response = await axios.delete<EliminarPacienteResponse>(
    `${API_BASE_URL}/pacientes-medical-care/${pacienteId}?usuario=${encodeURIComponent(usuario)}`
  );

  return response.data;
}

/**
 * Obtiene ocupación de rutas comparando pacientes vs v3 por similitud de llave
 */
export async function obtenerOcupacionRutas(): Promise<OcupacionRutasResponse> {
  const response = await axios.get<OcupacionRutasResponse>(
    `${API_BASE_URL}/pacientes-medical-care/ocupacion-rutas`
  );
  return response.data;
}

/**
 * Retorna registros de v3 sin paciente coincidente (similitud < 80%)
 */
export async function obtenerV3SinPaciente(): Promise<V3SinPacienteResponse> {
  const response = await axios.get<V3SinPacienteResponse>(
    `${API_BASE_URL}/pacientes-medical-care/v3-sin-paciente`
  );
  return response.data;
}

/**
 * Obtiene un paciente por ID
 */
export async function obtenerPacientePorId(
  pacienteId: string
): Promise<ObtenerPacienteResponse> {
  const response = await axios.get<ObtenerPacienteResponse>(
    `${API_BASE_URL}/pacientes-medical-care/${pacienteId}`
  );

  return response.data;
}
