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
  municipio: string;
  ruta: string;
  cedi: string;
  celular: string;
  celular_original: string;
  estado: string;
  llave: string;
  usuario_carga: string;
  fecha_carga: string;
  usuario_actualizacion?: string;
  fecha_actualizacion?: string;
}

export interface PacienteOcupacion {
  paciente: string;
  cedula: string;
  ruta: string;
  llave: string;
  similitud: number;
  llave_v3: string;
  en_v3: boolean;
  estado: string;
}

export interface RutaOcupacion {
  ruta: string;
  total_pacientes: number;
  pacientes_en_v3: number;
  ocupacion_pct: number;
  pacientes: PacienteOcupacion[];
}

export interface OcupacionRutasResponse {
  rutas: RutaOcupacion[];
}

export interface RegistroV3SinPaciente {
  codigo_pedido: string;
  cliente_destino: string;
  direccion_destino: string;
  ruta: string;
  estado_pedido: string;
  telefono: string;
  llave: string;
  similitud: number;
  llave_paciente_cercana: string;
}

export interface RutaV3SinPaciente {
  ruta: string;
  total: number;
  registros: RegistroV3SinPaciente[];
}

export interface V3SinPacienteResponse {
  total_sin_paciente: number;
  rutas: RutaV3SinPaciente[];
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
  estado?: string;
}
