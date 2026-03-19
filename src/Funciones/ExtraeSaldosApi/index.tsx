'use client';

import { useContext } from "react";
import axios from "axios";
import Cookies from 'js-cookie';
import { ContextoApp } from "../../Contexto/index";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL as string;
const BASE_URL = `${API_BASE}`;


// Define una interfaz para los datos de saldos
interface Saldo {
  _id: string;        // ID único del manifiesto en MongoDB
  Tenedor: string;
  Manifiesto: string;
  Fecha: string;
  Monto: number;      // Ajusta conforme a tu esquema real
  [key: string]: any; // Permite otros campos dinámicos
}

const ExtraeSaldos = () => {
  const CodigoTenedorCookie = Cookies.get('tenedorIntegrapp');
  const almacenVariables = useContext(ContextoApp);

  if (!almacenVariables) {
    throw new Error("Contexto no definido. Asegúrate de usar el proveedor correctamente.");
  }

  const { setDiccionarioSaldos } = almacenVariables;

  const fetchSaldos = async (): Promise<Saldo[]> => {
    try {
      const url = `${BASE_URL}/manifiestos/tenedor/${CodigoTenedorCookie}`;
      const respuesta = await axios.get<Saldo[]>(url);

      const data = respuesta.data;
      if (!Array.isArray(data)) {
        throw new Error("La respuesta de la API no contiene un array válido.");
      }

      setDiccionarioSaldos(data);
      return data;
    } catch (err: any) {
      console.error("Error al extraer saldos:", err);
      throw new Error("Error al extraer saldos: " + err.message);
    }
  };

  return { fetchSaldos };
};

export default ExtraeSaldos;
