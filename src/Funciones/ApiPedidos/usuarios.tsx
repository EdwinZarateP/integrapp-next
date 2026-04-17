import axios from "axios";
import { BaseUsuario, LoginRespuesta } from "./tipos";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL as string;
const BASE_URL = `${API_BASE}/baseusuarios`;

// Obtener perfiles distintos que existen en la colección
export const obtenerPerfilesDisponibles = async (): Promise<string[]> => {
  const res = await axios.get<string[]>(`${BASE_URL}/perfiles-disponibles`);
  return res.data;
};

// Obtener todos los usuarios
export const obtenerUsuarios = async (): Promise<BaseUsuario[]> => {
  const res = await axios.get<BaseUsuario[]>(`${BASE_URL}/`);
  return res.data;
};

// Obtener usuario por ID
export const obtenerUsuarioPorId = async (id: string): Promise<BaseUsuario> => {
  const res = await axios.get<BaseUsuario>(`${BASE_URL}/${id}`);
  return res.data;
};

// Crear usuario
export const crearUsuario = async (
  usuario: BaseUsuario
): Promise<{ mensaje: string; usuario: BaseUsuario }> => {
  const res = await axios.post<{ mensaje: string; usuario: BaseUsuario }>(`${BASE_URL}/`, usuario);
  return res.data;
};

// Actualizar usuario por ID
export const actualizarUsuario = async (
  id: string,
  usuario: BaseUsuario
): Promise<{ mensaje: string; usuario: BaseUsuario }> => {
  const res = await axios.put<{ mensaje: string; usuario: BaseUsuario }>(`${BASE_URL}/${id}`, usuario);
  return res.data;
};

// Eliminar usuario por ID
export const eliminarUsuario = async (
  id: string
): Promise<{ mensaje: string }> => {
  const res = await axios.delete<{ mensaje: string }>(`${BASE_URL}/${id}`);
  return res.data;
};

// Actualizar perfil de un usuario
export const actualizarPerfilUsuario = async (
  id: string,
  perfil: string
): Promise<{ mensaje: string; perfil: string }> => {
  const res = await axios.patch<{ mensaje: string; perfil: string }>(
    `${BASE_URL}/${id}/perfil`,
    { perfil }
  );
  return res.data;
};

// Actualizar clientes permitidos de un usuario
export const actualizarClientesUsuario = async (
  id: string,
  clientes: string[]
): Promise<{ mensaje: string; clientes: string[] }> => {
  const res = await axios.patch<{ mensaje: string; clientes: string[] }>(
    `${BASE_URL}/${id}/clientes`,
    { clientes }
  );
  return res.data;
};

// Login de usuario
export const loginUsuario = async (
  usuario: string,
  clave: string
): Promise<LoginRespuesta> => {
  const res = await axios.post<LoginRespuesta>(`${BASE_URL}/login`, {
    usuario,
    clave,
  });
  return res.data;
};

// Login de Seguridad
export const loginSeguridad = async (
  usuario: string,
  clave: string
): Promise<LoginRespuesta> => {
  const res = await axios.post<LoginRespuesta>(`${BASE_URL}/loginseguridad`, {
    usuario,
    clave,
  });
  return res.data;
};

// Login de Conductor
export const loginConductor = async (
  usuario: string,
  clave: string
): Promise<LoginRespuesta> => {
  const res = await axios.post<LoginRespuesta>(`${BASE_URL}/loginConductor`, {
    usuario,
    clave,
  });
  return res.data;
};
