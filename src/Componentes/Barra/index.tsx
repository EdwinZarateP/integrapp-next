'use client';
import React, { useState } from "react";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";
import logo from "@/Imagenes/albatros.png";
import "./estilos.css";

const BarraSeguridad: React.FC = () => {
  const router = useRouter();

  const nombreMostrar = Cookies.get("seguridadNombre") || Cookies.get("seguridadUsuario") || "Usuario";

  const [menuAbierto, setMenuAbierto] = useState(false);

  const irInicio = () => {
    router.push("/");
  };

  const cerrarSesion = () => {
    Cookies.remove("seguridadNombre");
    Cookies.remove("seguridadCorreo");
    Cookies.remove("seguridadUsuario");
    Cookies.remove("seguridadClave"); // legacy en claro; se purga si quedara
    Cookies.remove("seguridadId");
    Cookies.remove("seguridadPerfil");
    // Cookies de la Torre de Control para volver limpio al login.
    Cookies.remove("clientePedidosCookie");
    Cookies.remove("usuarioPedidosCookie");
    Cookies.remove("perfilPedidosCookie");

    router.replace("/LoginUsuario");
  };

  const handleClickOutside = () => {
    if (menuAbierto) {
      setMenuAbierto(false);
    }
  };

  return (
    <div className="barra-superior" onClick={handleClickOutside}>

      {/* 1. SECCIÓN IZQUIERDA */}
      <div
        className="barra-izquierda"
        onClick={irInicio}
        title="Volver al inicio"
      >
        <img src={logo.src} alt="Logo" className="barra-logo" />
        <div className="barra-titulos-agrupados">
          <span className="barra-marca">Integr<span className="barra-marca-acento">App</span></span>
          <h2 className="barra-titulo">Hoja de Vida Vehículos</h2>
        </div>
      </div>

      {/* 2. SECCIÓN DERECHA */}
      <div className="barra-derecha">
        <div className="barra-usuario">
          👤 {nombreMostrar}
        </div>

        <div className="hamburguesa-container">
          <div
            className={`hamburguesa ${menuAbierto ? "abierta" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              setMenuAbierto(!menuAbierto);
            }}
          >
            <span></span>
            <span></span>
            <span></span>
          </div>

          {menuAbierto && (
            <div className="menu-desplegable" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={cerrarSesion}
                className="btn-cerrar-sesion"
              >
                Cerrar Sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BarraSeguridad;
