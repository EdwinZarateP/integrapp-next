import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL as string;
const BASE_URL = `${API_BASE}/clientes`;

// Obtener todos los clientes
export const obtenerClientes = async () => {
  const res = await axios.get(`${BASE_URL}/`);
  return res.data;
};

// Obtener cliente por ID
export const obtenerClientePorId = async (id: string) => {
  const res = await axios.get(`${BASE_URL}/${id}`);
  return res.data;
};

// Crear cliente
export const crearCliente = async (cliente: any) => {
  const res = await axios.post(`${BASE_URL}/`, cliente);
  return res.data;
};

// Actualizar cliente por ID
export const actualizarCliente = async (id: string, cliente: any) => {
  const res = await axios.put(`${BASE_URL}/${id}`, cliente);
  return res.data;
};

// Eliminar cliente por ID
export const eliminarCliente = async (id: string) => {
  const res = await axios.delete(`${BASE_URL}/${id}`);
  return res.data;
};

// Cargar clientes masivamente (Excel)
export const cargarClientesMasivo = async (archivo: File) => {
  const formData = new FormData();
  formData.append("archivo", archivo);
  const res = await axios.post(`${BASE_URL}/cargar-masivo`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return res.data;
};
