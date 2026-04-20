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
  telefono1?: string;
  telefono2?: string;
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
  direccion_original: string;
  ruta: string;
  cedi: string;
  llave: string;
  similitud: number;
  match_tipo?: 'celular' | 'llave' | 'nombre';
  llave_v3: string;
  en_v3: boolean;
  estado: string;
  estado_pedido?: string;
  fecha_pedido?: string;
  fecha_preferente?: string;
  fecha_entrega?: string;
  planilla?: string;
  municipio_destino?: string;
  divipola?: string;
  ruta_v3?: string;
  cliente_destino_v3?: string;
  celular_paciente?: string;
  telefono_v3?: string;
  f_pref_teorica?: string;
}

export interface RutaOcupacion {
  ruta: string;
  cedi: string;
  total_pacientes: number;
  pacientes_en_v3: number;
  ocupacion_pct: number;
  pacientes_entregados?: number;
  pct_entregados?: number;
  vehiculos?: number;
  pacientes: PacienteOcupacion[];
}

export interface OcupacionRutasResponse {
  rutas: RutaOcupacion[];
  fecha_calculo: string | null;
  calculado_por: string | null;
  total_sin_paciente: number;
}

export interface RegistroV3SinPaciente {
  codigo_pedido: string;
  cliente_destino: string;
  direccion_destino: string;
  ruta: string;
  cedi: string;
  estado_pedido: string;
  telefono: string;
  llave: string;
  similitud: number;
  llave_paciente_cercana: string;
}

export interface RutaV3SinPaciente {
  ruta: string;
  cedi: string;
  total: number;
  registros: RegistroV3SinPaciente[];
}

export interface V3SinPacienteResponse {
  total_sin_paciente: number;
  rutas: RutaV3SinPaciente[];
  fecha_calculo: string | null;
  calculado_por: string | null;
}

export interface MesHistorico {
  anio: number;
  mes: number;
  fecha_corte: string;
  total: number;
}

export interface HistoricoMesesResponse {
  meses: MesHistorico[];
}

export interface HistoricoMesDetalle {
  anio: number;
  mes: number;
  fecha_corte: string;
  total: number;
  rutas: RutaOcupacion[];
  v3_sin_paciente: RutaV3SinPaciente[];
  total_sin_paciente: number;
}

export interface RecalcularCruceProgress {
  stage: 'loading' | 'comparing_patients' | 'comparing_v3' | 'saving' | 'complete';
  progress: number;
  message: string;
  processed?: number;
  total?: number;
}

export interface RecalcularCruceResponse {
  rutas: RutaOcupacion[];
  v3_sin_paciente: RutaV3SinPaciente[];
  total_sin_paciente: number;
  fecha_calculo: string;
  calculado_por: string;
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

export interface CronogramaPaciente {
  cedula: string;
  fecha_entrega: string;
  fecha_cronograma: string;
}

export interface CronogramaMesResponse {
  anio_mes: string;
  total: number;
  registros: CronogramaPaciente[];
}

export interface CargarCronogramaResponse {
  mensaje: string;
  tiempo_segundos: number;
  registros_nuevos: number;
  registros_actualizados: number;
  registros_con_errores: number;
  errores?: string[];
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
