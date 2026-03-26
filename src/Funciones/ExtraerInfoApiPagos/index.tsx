'use client';

import { useContext } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import { ContextoApp } from "../../Contexto/index";

// Interface para cada pago
interface Pago {
  Manifiesto: string;
  Tenedor: string;
  Fecha: string;
  PagoSaldo: string;
}

// Tipado de la respuesta del login
interface LoginResponse {
  data: {
    access_token: string;
  };
}

// Tipado flexible para la respuesta real de la consulta de pagos
interface QueryResponse {
  data: {
    data: {
      data: Pago[];
      current_page: number;
      // otros campos si los usas
    };
  };
}

const ExtraccionPagos = () => {
  const codigoTenedor = Cookies.get("tenedorIntegrapp");

  const contexto = useContext(ContextoApp);
  if (!contexto) {
    throw new Error("Contexto no definido. Asegúrate de usar el proveedor.");
  }

  const { DiccionarioManifiestosPagos, setDiccionarioManifiestosPagos } = contexto;

  const fetchPagos = async (): Promise<Pago[]> => {
    if (DiccionarioManifiestosPagos.length > 0) {
      return DiccionarioManifiestosPagos;
    }

    // 1) Login para obtener token
    const loginUrl = "https://api.nescanis.com/vulcano/cloud/v1/auth/loginDbCustomer";
    const loginPayload = {
      username: "134APIINTEGRA",
      idname: "eyJpdiI6IlZSdVpoaHBhYk02b3ZFRTdMQlhuZnc9PSIsInZhbHVlIjoiTGs4KzM2OGhxWGo4ekVLUkVGMG1yS1EwUDEwNkZxdVl5VzNWcDNCQ0drMD0iLCJtYWMiOiJjMzEzMDEzYTk3OWJhNTM2MTYyYjlmZDRkNDE4ZDFlMzc2OGQ5MTg0ZWYwYzFkMmJkNjY5ZDZhNDI2N2I5ZDBmIiwidGFnIjoiIn0=",
      agency: "001",
      proyect: "1",
      isGroup: 0,
      close_previous_session:1
    };
    console.log("Payload de login:", loginPayload);

    const loginResp = await axios.post<LoginResponse>(
      loginUrl,
      loginPayload,
      { headers: { "Content-Type": "application/json" } }
    );
    const token = loginResp.data.data.access_token;

    // 2) Consulta de pagos con try/catch extendido
    const queryUrl =
      "https://api.nescanis.com/vulcano/cloud/v1/vulcano/customer/00134/index";
    const queryPayload = {
      pageSize: 1000,
      rptId: 27,
      filter: [
        { campo: "Fecha", operador: "YEAR>", valor: "2024" },
        { campo: "Tenedor", operador: "=", valor: codigoTenedor },
      ],
    };

    let queryResp;
    try {
      queryResp = await axios.post<QueryResponse>(
        queryUrl,
        queryPayload,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
    } catch (error: any) {
      throw new Error("Error en la consulta de pagos. Revisa tu conexión y credenciales.");
    }

    const pagos = queryResp.data.data.data;

    if (!Array.isArray(pagos)) {
      console.error(
        "La API no devolvió un array válido. Respuesta recibida:",
        JSON.stringify(queryResp.data, null, 2)
      );
      throw new Error("La API no devolvió un array válido en data.data.data.");
    }

    // 3) Desduplicar por Manifiesto
    const pagosUnicos = pagos.reduce<Pago[]>((acc, item) => {
      if (!acc.some((x) => x.Manifiesto === item.Manifiesto)) {
        acc.push(item);
      }
      return acc;
    }, []);

    // 4) Guardar en contexto y devolver
    setDiccionarioManifiestosPagos(pagosUnicos);
    return pagosUnicos;
  };

  return { fetchPagos };
};

export default ExtraccionPagos;
