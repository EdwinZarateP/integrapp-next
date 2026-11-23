import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL as string;
const BASE_URL = `${API_BASE}/fletes-rutas-fmc`;

export interface TarifaRutaFmc {
  id?: string;
  centro_costo: string;
  ruta: string;
  carry: number;
  nhr: number;
  turbo: number;
  nies: number;
  sencillo: number;
  patineta: number;
  tractomula: number;
  requiere_descargue: string;
  // Promesa de entrega en días (ej. GUACHETA = 1). Default 0 para las
  // tarifas creadas antes de 2026-08-21.
  promesa_entrega_dias: number;
}

// Obtener todas las tarifas de rutas
export const obtenerTarifasRutas = async (): Promise<TarifaRutaFmc[]> => {
  try {
    const res = await axios.get<TarifaRutaFmc[]>(`${BASE_URL}/`);
    return res.data;
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};

// Crear tarifa individual (usuario obligatorio: auditoría + permiso ADMIN/CONTROL)
export const crearTarifaRuta = async (tarifa: TarifaRutaFmc, usuario: string): Promise<TarifaRutaFmc> => {
  try {
    const res = await axios.post<TarifaRutaFmc>(`${BASE_URL}/`, tarifa, { params: { usuario } });
    return res.data;
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};

// Actualizar tarifa (usuario obligatorio: auditoría + permiso ADMIN/CONTROL)
export const actualizarTarifaRuta = async (id: string, tarifa: TarifaRutaFmc, usuario: string): Promise<TarifaRutaFmc> => {
  try {
    const res = await axios.put<TarifaRutaFmc>(`${BASE_URL}/${id}`, tarifa, { params: { usuario } });
    return res.data;
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};

// Eliminar tarifa (usuario obligatorio: auditoría + permiso ADMIN/CONTROL)
export const eliminarTarifaRuta = async (id: string, usuario: string): Promise<void> => {
  try {
    await axios.delete(`${BASE_URL}/${id}`, { params: { usuario } });
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};

// Cargar tarifas masivamente desde archivo plano
// `usuario` viaja en el FormData: el backend lo resuelve en baseusuarios y
// audita la carga en historial_tarifas.
export const cargarTarifasMasivo = async (archivo: File, usuario: string): Promise<{
  exitosos: number;
  errores: number;
  mensaje: string;
  detalles?: any[];
}> => {
  const formData = new FormData();
  formData.append('archivo', archivo);
  formData.append('usuario', usuario);

  try {
    const res = await axios.post(`${BASE_URL}/cargar-masivo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};

// Descargar todas las tarifas en Excel
export const descargarTarifasExcel = async (): Promise<void> => {
  try {
    const res = await axios.get(`${BASE_URL}/descargar-excel`, {
      responseType: 'blob',
    });

    const contentDisposition = res.headers['content-disposition'];
    let filename = 'tarifas_rutas_fmc.xlsx';

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename\*?=(?:UTF-8'')?([^;]+)/i);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/"/g, '');
      }
    }

    const url = window.URL.createObjectURL(new Blob([res.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};

// Descargar plantilla de tarifas
export const descargarPlantillaTarifas = async (): Promise<void> => {
  try {
    const res = await axios.get(`${BASE_URL}/descargar-plantilla`, {
      responseType: 'blob',
    });

    // Obtener el nombre del archivo desde los headers o usar uno por defecto
    const contentDisposition = res.headers['content-disposition'];
    let filename = 'plantilla_tarifas_rutas.xlsx';

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename\*?=(?:UTF-8'')?([^;]+)/i);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/"/g, '');
      }
    }

    const url = window.URL.createObjectURL(new Blob([res.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};
