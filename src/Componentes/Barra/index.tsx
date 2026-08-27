'use client';
import React, { useState, useEffect, useRef } from "react";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";
import { FaUserCircle, FaChevronDown, FaSignOutAlt } from "react-icons/fa";
import logo from "@/Imagenes/albatros.png";
import "./estilos.css";

/**
 * Header de sesión de /revision. Mismo patrón que el header de
 * /PanelConductores (2026-08-27): marca a la izquierda + botón de usuario
 * (avatar + nombre + rol + chevron) con dropdown blanco a la derecha.
 * Reemplazó al menú hamburguesa, que chocaba con la UI de la bandeja.
 */
const BarraSeguridad: React.FC = () => {
  const router = useRouter();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const nombreMostrar = Cookies.get("seguridadNombre") || Cookies.get("seguridadUsuario") || "Usuario";
  const primerNombre = nombreMostrar.split(" ")[0].toUpperCase();

  // Cerrar el menú al hacer click fuera (igual que en /PanelConductores).
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAbierto(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const irInicio = () => router.push("/");

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

  return (
    <div className="barra-superior">
      <div className="barra-izquierda" onClick={irInicio} title="Volver al inicio">
        <img src={logo.src} alt="Logo" className="barra-logo" />
        <div className="barra-titulos-agrupados">
          <span className="barra-marca">Integr<span className="barra-marca-acento">App</span></span>
          <h2 className="barra-titulo">Hoja de Vida Vehículos</h2>
        </div>
      </div>

      <div className="barra-derecha" ref={menuRef}>
        <button
          className="barra-userBtn"
          onClick={() => setMenuAbierto(o => !o)}
          title="Menú de sesión"
        >
          <FaUserCircle className="barra-userIcon" />
          <div className="barra-userInfo">
            <span className="barra-userName">{primerNombre}</span>
            <span className="barra-userPerfil">Seguridad</span>
          </div>
          <FaChevronDown className={`barra-chevron ${menuAbierto ? "barra-chevronOpen" : ""}`} />
        </button>

        {menuAbierto && (
          <div className="menu-desplegable">
            <button className="menu-item menu-itemDanger" onClick={cerrarSesion}>
              <FaSignOutAlt /> Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BarraSeguridad;
