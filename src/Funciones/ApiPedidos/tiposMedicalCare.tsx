/**
 * Interfaces TypeScript para Medical Care
 */

export interface PacienteMedicalCare {
  _id: string;
  sede: string;
  paciente: string;
  paciente_original: string;
  cedula: string;
  cedula_original: string;
  direccion: string;
  direccion_original: string;
  departamento: string;
  departamento_original: string;
  municipio: string;
  municipio_original: string;
  ruta: string;
  ruta_original: string;
  cedi: string;
  cedi_original: string;
  celular: string;
  celular_original: string;
  usuario_carga: string;
  fecha_carga: string;
  usuario_actualizacion?: string;
  fecha_actualizacion?: string;
}

export interface CargarPacientesResponse {
  mensaje: string;
  tiempo_segundos: number;
  registros_exitosos: number;
  registros_con_errores: number;
  errores?: string[];
}

export interface ObtenerPacientesResponse {
  pacientes: PacienteMedicalCare[];
  total: number;
  skip: number;
  limit: number;
}

export interface BuscarPacientesResponse {
  pacientes: PacienteMedicalCare[];
  total: number;
}

export interface EliminarPacientesResponse {
  mensaje: string;
  usuario: string;
  registros_eliminados: number;
}

export interface CrearPacienteResponse {
  mensaje: string;
  paciente: PacienteMedicalCare;
}

export interface ActualizarPacienteResponse {
  mensaje: string;
  paciente: PacienteMedicalCare;
}

export interface EliminarPacienteResponse {
  mensaje: string;
  paciente_id: string;
  usuario: string;
}

export interface ObtenerPacienteResponse {
  paciente: PacienteMedicalCare;
}

export interface CrearActualizarPacienteData {
  sede?: string;
  paciente: string;
  cedula: string;
  direccion?: string;
  departamento?: string;
  municipio?: string;
  ruta?: string;
  cedi?: string;
  celular?: string;
}
