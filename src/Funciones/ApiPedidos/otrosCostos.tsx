import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL as string;
const BASE_URL = `${API_BASE}/otros-costos`;

// ── Interfaces ───────────────────────────────────────────────────────────────
export interface CostoConcepto {
  tipo_costo: string;
  descripcion: string;
  valor: number;
}

export interface DatosServicio {
  cliente: string;
  centro_distribucion: string;
  fecha_servicio: string | null;
  piezas: number;
  peso_real: number;
  tipo_vehiculo: string;
  placa: string;
  municipio_destino: string;
  departamento_destino: string;
  transportador: string;
  manifiesto: string;
}

export interface DatosBancarios {
  banco: string;
  codigo_banco?: string;
  tipo_cuenta: string;
  numero_cuenta: string;
  tipo_id_titular?: string;
  cedula_titular: string;
  nombre_titular: string;
}

export interface Conductor {
  nombre: string;
  telefono: string;
}

export interface Movimiento {
  accion: string;
  estado_anterior: string | null;
  estado_nuevo: string | null;
  usuario: string;
  nombre_usuario: string;
  rol: string;
  fecha: string;
  observacion: string;
  ip: string;
}

export interface OtroCosto {
  _id?: string;
  consecutivo?: string;
  pedido_vulcano_original: string;
  pedidos_normalizados: string[];
  pedido_encontrado: boolean;
  motivo_no_encontrado: string;
  datos_servicio: DatosServicio;
  costos: CostoConcepto[];
  valor_total: number;
  requiere_aprobacion_control: boolean;
  datos_bancarios: DatosBancarios;
  conductor: Conductor;
  observaciones: string;
  manifiesto: string;
  estado: string;
  usuario_registro: string;
  perfil_registro: string;
  creado_por: { usuario: string; nombre: string; rol: string; fecha: string };
  aprobacion: { usuario: string; nombre: string; rol: string; fecha: string; observacion: string };
  pago: {
    usuario: string; nombre: string; rol: string; estado_pago: string;
    fecha_pago: string; fecha_pago_ingresada: string | null;
    referencia: string; observaciones: string;
  };
  tramite_vulcano?: 'ok' | 'pendiente';
  tramite_vulcano_info?: {
    usuario: string; nombre: string; rol: string; fecha: string; observacion: string;
  };
  historial_movimientos: Movimiento[];
  created_at?: string;
  updated_at?: string;
}

export interface PedidoEncontrado {
  _id_origen: string;
  pedido_vulcano: string;
  cliente: string;
  centro_distribucion: string;
  fecha_servicio: string | null;
  piezas: number;
  peso_real: number;
  tipo_vehiculo: string;
  placa: string;
  municipio_destino: string;
  departamento_destino: string;
  transportador: string;
  manifiesto: string;
  total_solicitado: number;
  regional: string;
  estado_pedido: string;
}

export interface ResultadoBusquedaPedidos {
  pedido_vulcano_original: string;
  pedidos_normalizados: string[];
  pedidos_encontrados: PedidoEncontrado[];
  pedidos_no_encontrados: string[];
  pedido_encontrado: boolean;
  totales: { piezas: number; peso_real: number; total_solicitado: number };
  diferencias: Record<string, string[]>;
  advertencia_servicios_diferentes: boolean;
}

export interface ListadoOtrosCostos {
  total: number;
  skip: number;
  limit: number;
  items: OtroCosto[];
}

// ── Enums ────────────────────────────────────────────────────────────────────
export const getTiposCosto = async (): Promise<string[]> => {
  const res = await axios.get<string[]>(`${BASE_URL}/tipos-costo`);
  return res.data;
};

export interface BancoCatalogo {
  nombre: string;
  codigo: string;
}

export const getBancos = async (): Promise<BancoCatalogo[]> => {
  const res = await axios.get<BancoCatalogo[]>(`${BASE_URL}/bancos`);
  return res.data;
};

export const getTiposCuenta = async (): Promise<string[]> => {
  const res = await axios.get<string[]>(`${BASE_URL}/tipos-cuenta`);
  return res.data;
};

export const getClientes = async (): Promise<string[]> => {
  const res = await axios.get<string[]>(`${BASE_URL}/clientes`);
  return res.data;
};

// ── Búsqueda de pedidos ──────────────────────────────────────────────────────
export const buscarPedidos = async (
  usuario: string,
  pedido_vulcano: string,
): Promise<ResultadoBusquedaPedidos> => {
  const res = await axios.post<ResultadoBusquedaPedidos>(`${BASE_URL}/buscar-pedidos`, {
    usuario,
    pedido_vulcano,
  });
  return res.data;
};

export const verificarDuplicado = async (payload: {
  usuario: string;
  pedido_vulcano: string;
  manifiesto: string;
  tipo_costo: string;
  valor: number;
}): Promise<{ posible_duplicado: boolean; coincidencias: any[] }> => {
  const res = await axios.post(`${BASE_URL}/verificar-duplicado`, payload);
  return res.data;
};

// ── Crear / Editar ───────────────────────────────────────────────────────────
export const crearSolicitud = async (payload: any): Promise<any> => {
  const res = await axios.post(`${BASE_URL}/crear`, payload);
  return res.data;
};

export const editarSolicitud = async (payload: any): Promise<any> => {
  const res = await axios.put(`${BASE_URL}/editar`, payload);
  return res.data;
};

// ── Flujo de aprobación ──────────────────────────────────────────────────────
export const enviarAprobacion = async (consecutivo: string, usuario: string, observacion = '') => {
  const res = await axios.post(`${BASE_URL}/enviar-aprobacion`, { consecutivo, usuario, observacion });
  return res.data;
};

export const aprobarSolicitud = async (consecutivo: string, usuario: string, observacion = '') => {
  const res = await axios.post(`${BASE_URL}/aprobar`, { consecutivo, usuario, observacion });
  return res.data;
};

export const devolverSolicitud = async (consecutivo: string, usuario: string, observacion = '') => {
  const res = await axios.post(`${BASE_URL}/devolver`, { consecutivo, usuario, observacion });
  return res.data;
};

export const rechazarSolicitud = async (consecutivo: string, usuario: string, observacion = '') => {
  const res = await axios.post(`${BASE_URL}/rechazar`, { consecutivo, usuario, observacion });
  return res.data;
};

export const marcarTramiteVulcano = async (
  consecutivo: string,
  usuario: string,
  tramite_vulcano: 'ok' | 'pendiente',
  observacion = '',
) => {
  const res = await axios.post(`${BASE_URL}/marcar-tramite-vulcano`, { consecutivo, usuario, tramite_vulcano, observacion });
  return res.data;
};

export const registrarPago = async (payload: {
  consecutivo: string;
  usuario: string;
  estado_pago?: string;
  fecha_pago?: string;
  referencia?: string;
  observaciones?: string;
}) => {
  const res = await axios.post(`${BASE_URL}/registrar-pago`, payload);
  return res.data;
};

export const anularSolicitud = async (consecutivo: string, usuario: string, motivo = '') => {
  const res = await axios.post(`${BASE_URL}/anular`, { consecutivo, usuario, motivo });
  return res.data;
};

// ── Consultas ────────────────────────────────────────────────────────────────
export interface FiltrosListado {
  usuario: string;
  estado?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  pedido?: string;
  placa?: string;
  manifiesto?: string;
  cliente?: string;
  regional?: string;
  skip?: number;
  limit?: number;
}

const aParams = (f: FiltrosListado): Record<string, string | number> => {
  const p: Record<string, string | number> = { usuario: f.usuario };
  (['estado', 'fecha_inicio', 'fecha_fin', 'pedido', 'placa', 'manifiesto', 'cliente', 'regional'] as const).forEach((k) => {
    if (f[k]) p[k] = f[k] as string;
  });
  if (f.skip !== undefined) p.skip = f.skip;
  if (f.limit !== undefined) p.limit = f.limit;
  return p;
};

export const listarActivos = async (f: FiltrosListado): Promise<ListadoOtrosCostos> => {
  const res = await axios.get<ListadoOtrosCostos>(`${BASE_URL}/`, { params: aParams(f) });
  return res.data;
};

export const listarHistorico = async (f: FiltrosListado): Promise<ListadoOtrosCostos> => {
  const res = await axios.get<ListadoOtrosCostos>(`${BASE_URL}/historico`, { params: aParams(f) });
  return res.data;
};

export const obtenerDetalleActivo = async (consecutivo: string, usuario: string): Promise<OtroCosto> => {
  const res = await axios.get<OtroCosto>(`${BASE_URL}/${consecutivo}`, { params: { usuario } });
  return res.data;
};

export const obtenerDetalleHistorico = async (consecutivo: string, usuario: string): Promise<OtroCosto> => {
  const res = await axios.get<OtroCosto>(`${BASE_URL}/historico/${consecutivo}`, { params: { usuario } });
  return res.data;
};

// ── Exportar Excel ───────────────────────────────────────────────────────────
export const exportarExcel = async (payload: any): Promise<Blob> => {
  const res = await axios.post(`${BASE_URL}/exportar-excel`, payload, { responseType: 'blob' });
  return res.data;
};
