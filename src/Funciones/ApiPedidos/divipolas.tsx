// API para Divipolas

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';

export interface Divipola {
  id: string;
  divipola: string;
  ruta: string;
  latitud: number;
  longitud: number;
  poblacion: string;
  departamento: string;
  ubicacion_descargue: string;
  direccion_descargue: string;
}

export async function obtenerDivipolas(): Promise<Divipola[]> {
  const response = await fetch(`${API}/divipolas/`);
  if (!response.ok) throw new Error('Error al obtener divipolas');
  return response.json();
}

export async function crearDivipola(data: { divipola: string; ruta: string; latitud: number; longitud: number; poblacion: string; departamento: string; ubicacion_descargue: string; direccion_descargue: string }): Promise<any> {
  const response = await fetch(`${API}/divipolas/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const error = await response.json();
    throw { response: { data: error, status: response.status } };
  }
  return response.json();
}

export async function actualizarDivipola(id: string, data: { divipola: string; ruta: string; latitud: number; longitud: number; poblacion: string; departamento: string; ubicacion_descargue: string; direccion_descargue: string }): Promise<any> {
  const response = await fetch(`${API}/divipolas/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Error al actualizar divipola');
  return response.json();
}

export async function eliminarDivipola(id: string): Promise<any> {
  const response = await fetch(`${API}/divipolas/${id}`, {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error('Error al eliminar divipola');
  return response.json();
}

export async function cargarDivipolasMasivo(archivo: File): Promise<any> {
  const formData = new FormData();
  formData.append('archivo', archivo);

  const response = await fetch(`${API}/divipolas/cargar-masivo`, {
    method: 'POST',
    body: formData
  });
  if (!response.ok) {
    const error = await response.json();
    throw { response: { data: error, status: response.status } };
  }
  return response.json();
}

export async function descargarPlantillaDivipolas(): Promise<void> {
  const response = await fetch(`${API}/divipolas/descargar-plantilla`);
  if (!response.ok) throw new Error('Error al descargar plantilla');

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `plantilla_divipolas.xlsx`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export async function descargarExcelDivipolas(): Promise<void> {
  const response = await fetch(`${API}/divipolas/descargar-excel`);
  if (!response.ok) throw new Error('Error al descargar Excel');

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `divipolas_${new Date().toISOString().split('T')[0]}.xlsx`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
