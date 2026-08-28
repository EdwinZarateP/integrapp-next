import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL as string;
const BASE_URL = `${API_BASE}/cuentas-placa`;

// ── Interfaces ───────────────────────────────────────────────────────────────
export interface CuentaPlaca {
  id: string;
  placa: string;
  nombre_conductor: string;
  telefono: string;
  nombre_beneficiario: string;
  cedula: string;
  banco: string;
  tipo_cuenta: string;
  numero_cuenta: string;
  regional: string;
  regional_info?: { co: string; regional: string; bodega: string };
  creado_por?: { usuario: string; nombre: string; rol: string; fecha: string };
  actualizado_por?: { usuario: string; nombre: string; rol: string; fecha: string };
  created_at?: string;
  updated_at?: string;
}

export interface CatalogosCuentasPlaca {
  bancos: { nombre: string; codigo: string }[];
  tipos_cuenta: string[];
  regionales: { co: string; regional: string; bodega: string }[];
}

export interface ResultadoCuentaPlaca {
  encontrada: boolean;
  cuenta?: CuentaPlaca;
  coincidencias?: { placa: string; regional?: string; bodega?: string }[];
}

export interface ResultadoImportarCuentas {
  mensaje: string;
  procesadas: { fila: number; placa: string; accion: string }[];
  errores: { fila: number; placa: string; detalle: string }[];
}

export const extraerErrorApi = (e: any, fallback = 'Ocurrió un error'): string => {
  const d = e?.response?.data?.detail ?? e?.detail;
  if (!d) return e?.message || fallback;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map((x: any) => x?.msg || JSON.stringify(x)).join(' • ');
  return String(d);
};

// ── Consultas ────────────────────────────────────────────────────────────────
export const listarCuentas = async (f: {
  usuario: string;
  placa?: string;
  regional?: string;
  skip?: number;
  limit?: number;
}): Promise<{ total: number; skip: number; limit: number; items: CuentaPlaca[] }> => {
  const res = await axios.get(`${BASE_URL}/`, { params: f });
  return res.data;
};

export const getCatalogosCuentasPlaca = async (usuario: string): Promise<CatalogosCuentasPlaca> => {
  const res = await axios.get<CatalogosCuentasPlaca>(`${BASE_URL}/catalogos`, { params: { usuario } });
  return res.data;
};

export const consultarCuentaPorPlaca = async (
  usuario: string,
  placa: string,
  regional?: string,
): Promise<ResultadoCuentaPlaca> => {
  const res = await axios.get<ResultadoCuentaPlaca>(`${BASE_URL}/por-placa`, {
    params: { usuario, placa, regional: regional || undefined },
  });
  return res.data;
};

// ── CRUD ─────────────────────────────────────────────────────────────────────
export interface CuentaPlacaPayload {
  usuario: string;
  placa: string;
  nombre_conductor: string;
  telefono?: string;
  nombre_beneficiario: string;
  cedula: string;
  banco: string;
  tipo_cuenta: string;
  numero_cuenta: string;
  regional?: string;
}

export const crearCuentaPlaca = async (payload: CuentaPlacaPayload): Promise<{ mensaje: string; cuenta: CuentaPlaca }> => {
  const res = await axios.post(`${BASE_URL}/crear`, payload);
  return res.data;
};

export const editarCuentaPlaca = async (
  id: string,
  payload: CuentaPlacaPayload,
): Promise<{ mensaje: string; cuenta: CuentaPlaca }> => {
  const res = await axios.put(`${BASE_URL}/editar`, payload, { params: { id } });
  return res.data;
};

export const eliminarCuentaPlaca = async (usuario: string, id: string): Promise<{ mensaje: string }> => {
  const res = await axios.delete(`${BASE_URL}/eliminar`, { params: { usuario, id } });
  return res.data;
};

// ── Excel (solo ADMIN) ───────────────────────────────────────────────────────
export const importarCuentasPlaca = async (
  usuario: string,
  regional: string,
  archivo: File,
): Promise<ResultadoImportarCuentas> => {
  const form = new FormData();
  form.append('regional', regional);
  form.append('archivo', archivo);
  const res = await axios.post(`${BASE_URL}/importar-excel?usuario=${encodeURIComponent(usuario)}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

const descargarBlob = (blob: Blob, nombre: string) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

export const descargarPlantillaCuentasPlaca = async (): Promise<void> => {
  const res = await axios.get(`${BASE_URL}/plantilla`, { responseType: 'blob' });
  descargarBlob(res.data as Blob, 'plantilla_cuentas_placa.xlsx');
};

export const exportarCuentasPlaca = async (usuario: string, regional?: string): Promise<void> => {
  const res = await axios.get(`${BASE_URL}/exportar-excel`, {
    params: { usuario, regional: regional || undefined },
    responseType: 'blob',
  });
  descargarBlob(res.data as Blob, `cuentas_por_placa_${new Date().toISOString().slice(0, 10)}.xlsx`);
};
