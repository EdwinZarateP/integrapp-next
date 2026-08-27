'use client';
import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import logo from "@/Imagenes/albatros.png";
import { FaUserCircle, FaChevronDown, FaSignOutAlt, FaTruck, FaClipboardList } from "react-icons/fa";
import "./estilos.css";

type Modo = "conductor" | "personal";

/**
 * Header de marca (degradado + "IntegrApp") con zona derecha de usuario en el
 * MISMO patrón del header de /PanelConductores: botón avatar+nombre+perfil+
 * chevron con dropdown blanco (click-fuera cierra, «Cerrar sesión» en rojo).
 *
 * `modo` define qué cookies se limpian y a qué login se vuelve:
 *  - "conductor": cookies conductor* → /LoginConductores (dropdown: «Mi panel»)
 *  - "personal":  cookies *PedidosCookie → /LoginUsuario
 */
const HeaderSesion: React.FC<{ modo: Modo }> = ({ modo }) => {
  const router = useRouter();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const nombre = (() => {
    if (modo === "conductor") {
      const n = Cookies.get("conductorPrimerNombre");
      return n ? n.toUpperCase() : "CONDUCTOR";
    }
    return Cookies.get("usuarioPedidosCookie") || "USUARIO";
  })();

  const perfil = (() => {
    if (modo === "conductor") {
      return (Cookies.get("conductorPerfil") || "").toUpperCase() === "TENEDOR"
        ? "Tenedor"
        : "Conductor";
    }
    return "Personal";
  })();

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

  const cerrarSesion = () => {
    if (modo === "conductor") {
      ["conductorCorreo", "conductorClave", "conductorId", "conductorPerfil",
       "conductorPrimerNombre", "conductorNombre", "conductorUsuario", "tenedorIntegrapp"]
        .forEach((c) => Cookies.remove(c));
      router.replace("/LoginConductores");
    } else {
      window.localStorage.removeItem("baseUsuarioAccessToken");
      window.localStorage.removeItem("sicetacJobId");
      ["usuarioPedidosCookie", "perfilPedidosCookie", "regionalPedidosCookie",
       "clientePedidosCookie", "clientesPedidosCookie"]
        .forEach((c) => Cookies.remove(c));
      router.replace("/LoginUsuario");
    }
  };

  return (
    <header className="HS-header">
      <button className="HS-brand" onClick={() => router.push("/")} title="Inicio">
        <Image src={logo} alt="Integra" height={40} priority />
        <span className="HS-brandName">
          Integr<span className="HS-brandAccent">App</span>
        </span>
      </button>

      <div className="HS-derecha" ref={menuRef}>
        <button
          className="HS-userBtn"
          onClick={() => setMenuAbierto(o => !o)}
          aria-expanded={menuAbierto}
        >
          <FaUserCircle className="HS-userIcon" />
          <div className="HS-userInfo">
            <span className="HS-userName">{nombre}</span>
            <span className="HS-userPerfil">{perfil}</span>
          </div>
          <FaChevronDown className={`HS-chevron ${menuAbierto ? "HS-chevronOpen" : ""}`} />
        </button>

        {menuAbierto && (
          <div className="HS-menuDesplegable">
            {modo === "conductor" && (
              <>
                <button
                  className="HS-menuItem"
                  onClick={() => { setMenuAbierto(false); router.push("/PanelConductores"); }}
                >
                  <FaTruck /> Mi panel
                </button>
                <div className="HS-menuDivisor" />
              </>
            )}
            {modo === "personal" && (
              <>
                <button
                  className="HS-menuItem"
                  onClick={() => { setMenuAbierto(false); router.push("/FlotaDisponible"); }}
                >
                  <FaTruck /> Flota disponible
                </button>
                <button
                  className="HS-menuItem"
                  onClick={() => { setMenuAbierto(false); router.push("/FlotaUsada"); }}
                >
                  <FaClipboardList /> Vehículos en uso
                </button>
                <div className="HS-menuDivisor" />
              </>
            )}
            <button className="HS-menuItem HS-menuItemDanger" onClick={cerrarSesion}>
              <FaSignOutAlt /> Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default HeaderSesion;
