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

// Crear tarifa individual
export const crearTarifaRuta = async (tarifa: TarifaRutaFmc): Promise<TarifaRutaFmc> => {
  try {
    const res = await axios.post<TarifaRutaFmc>(`${BASE_URL}/`, tarifa);
    return res.data;
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};

// Actualizar tarifa
export const actualizarTarifaRuta = async (id: string, tarifa: TarifaRutaFmc): Promise<TarifaRutaFmc> => {
  try {
    const res = await axios.put<TarifaRutaFmc>(`${BASE_URL}/${id}`, tarifa);
    return res.data;
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};

// Eliminar tarifa
export const eliminarTarifaRuta = async (id: string): Promise<void> => {
  try {
    await axios.delete(`${BASE_URL}/${id}`);
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};

// Cargar tarifas masivamente desde archivo plano
export const cargarTarifasMasivo = async (archivo: File): Promise<{
  exitosos: number;
  errores: number;
  mensaje: string;
  detalles?: any[];
}> => {
  const formData = new FormData();
  formData.append('archivo', archivo);

  try {
    const res = await axios.post(`${BASE_URL}/cargar-masivo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
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
