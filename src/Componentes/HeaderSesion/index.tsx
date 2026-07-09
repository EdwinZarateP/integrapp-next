'use client';
import React, { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import logo from "@/Imagenes/albatros.png";
import { FaUserCircle, FaBars } from "react-icons/fa";
import "./estilos.css";

type Modo = "conductor" | "personal";

/**
 * Header de marca (igual que HeaderApp: degradado + "IntegrApp") con zona derecha
 * de usuario y menú hamburguesa para Cerrar Sesión.
 *
 * `modo` define qué cookies se limpian y a qué login se vuelve:
 *  - "conductor": cookies conductor* → /LoginConductores
 *  - "personal":  cookies *PedidosCookie → /LoginUsuario
 */
const HeaderSesion: React.FC<{ modo: Modo }> = ({ modo }) => {
  const router = useRouter();
  const [menuAbierto, setMenuAbierto] = useState(false);

  const nombre = (() => {
    if (modo === "conductor") {
      const n = Cookies.get("conductorPrimerNombre");
      return n ? n.toUpperCase() : "CONDUCTOR";
    }
    return Cookies.get("usuarioPedidosCookie") || "USUARIO";
  })();

  const cerrarSesion = () => {
    if (modo === "conductor") {
      ["conductorCorreo", "conductorClave", "conductorId", "conductorPerfil",
       "conductorPrimerNombre", "conductorNombre", "conductorUsuario", "tenedorIntegrapp"]
        .forEach((c) => Cookies.remove(c));
      router.replace("/LoginConductores");
    } else {
      ["usuarioPedidosCookie", "perfilPedidosCookie", "regionalPedidosCookie",
       "clientePedidosCookie", "clientesPedidosCookie"]
        .forEach((c) => Cookies.remove(c));
      router.replace("/LoginUsuario");
    }
  };

  return (
    <header className="HS-header" onClick={() => menuAbierto && setMenuAbierto(false)}>
      <button className="HS-brand" onClick={() => router.push("/")} title="Inicio">
        <Image src={logo} alt="Integra" height={40} priority />
        <span className="HS-brandName">
          Integr<span className="HS-brandAccent">App</span>
        </span>
      </button>

      <div className="HS-derecha">
        <div className="HS-usuario" title={nombre}>
          <FaUserCircle size={20} />
          <span className="HS-usuarioNombre">{nombre}</span>
        </div>
        <div className="HS-hamburguesa">
          <FaBars size={22} onClick={(e) => { e.stopPropagation(); setMenuAbierto(!menuAbierto); }} />
          {menuAbierto && (
            <div className="HS-menu" onClick={(e) => e.stopPropagation()}>
              <button onClick={cerrarSesion} className="HS-cerrar">Cerrar Sesión</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default HeaderSesion;
