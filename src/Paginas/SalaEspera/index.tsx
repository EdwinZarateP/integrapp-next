'use client';
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import ExtraccionTotal from "@/Funciones/ExtraccionTotal";
import logo from "@/Imagenes/albatros.png";
import HashLoader from "react-spinners/HashLoader";
import Cookies from 'js-cookie';
import "./estilos.css";

const SalaEspera: React.FC = () => {

  const router = useRouter();
  const nombreIntegrappCookie = Cookies.get('nombreIntegrapp');
  const { ejecutarExtraccion } = ExtraccionTotal();
  const [loading, setLoading] = useState(false);

    // Función para manejar el cierre de sesión
    const cerrarSesion = () => {
      // Remover las cookies
      Cookies.remove('nombreIntegrapp');
      Cookies.remove('tenedorIntegrapp');
      // Redirigir al inicio
      router.push("/loginpropietarios");
    };

  const irManifiestos = async () => {
    setLoading(true);
    try {
      console.log("Iniciando extracción total...");
      await ejecutarExtraccion();
      router.push("/SeleccionEstados");
    } catch (error) {
      console.error("Error durante la extracción total:", error);
      setLoading(false);
    }
  };

  return (
    <div className="SalaEspera-contenedor">
      {loading ? (
        <div className="SalaEspera-loader">
          <HashLoader size={60} color={"rgb(141, 199, 63)"} loading={loading} />
          <p>Cargando información de tus manifiestos, por favor espera...</p>
        </div>
      ) : (
        <>
          <img src={logo.src} alt="Logo Integra" className="SalaEspera-logo" />
          <h1 className="SalaEspera-titulo">Hola {nombreIntegrappCookie}</h1>

          <button className="SalaEspera-boton" onClick={irManifiestos}>
            Manifiestos
          </button>
          {/* Contenedor para el botón de Cerrar Sesión alineado a la derecha */}
          <div className="SalaEspera-cerrar-sesion-container">
            <span onClick={cerrarSesion} className="SalaEspera-cerrar-sesion">Cerrar sesión</span>
          </div>

        </>
      )}
    </div>
  );
};

export default SalaEspera;
