'use client';
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import {
  FaChevronDown,
  FaChevronRight,
  FaSignOutAlt,
  FaExternalLinkAlt,
} from "react-icons/fa";
import logo from "@/Imagenes/albatros.png";
import { construirMenu, type ItemModulo } from "@/Funciones/menuModulos";
import "./estilos.css";

/** Info de usuario persistida por el login (cookie JSON, 14 días). */
type UsuarioInfo = {
  id: string;
  usuario: string;
  nombre?: string;
  correo?: string;
  perfil: string;
  perfiles_adicionales?: string[];
};

const leerUsuarioInfo = (): UsuarioInfo | null => {
  const cruda = Cookies.get("usuarioInfoPedidosCookie");
  if (!cruda) return null;
  try {
    return JSON.parse(decodeURIComponent(cruda)) as UsuarioInfo;
  } catch {
    return null;
  }
};

const Modulos: React.FC = () => {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [info, setInfo] = useState<UsuarioInfo | null>(null);
  const [menuUsuarioAbierto, setMenuUsuarioAbierto] = useState(false);
  const [gruposAbiertos, setGruposAbiertos] = useState<Record<string, boolean>>({});
  const usuarioRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const usuario = Cookies.get("usuarioPedidosCookie");
    const token = window.localStorage.getItem("baseUsuarioAccessToken");
    if (!usuario || !token) {
      router.replace("/LoginUsuario");
      return;
    }
    setInfo(leerUsuarioInfo());
    setListo(true);
  }, [router]);

  // Cerrar el popover de usuario al hacer click fuera.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (usuarioRef.current && !usuarioRef.current.contains(e.target as Node)) {
        setMenuUsuarioAbierto(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const perfil = Cookies.get("perfilPedidosCookie") || info?.perfil || "";
  const clientes = (Cookies.get("clientesPedidosCookie") || "").split(",").filter(Boolean);
  const nombreUsuario = info?.nombre || Cookies.get("usuarioPedidosCookie") || "Usuario";
  const iniciales = nombreUsuario.split(" ").map((p) => p[0]).slice(0, 2).join("");

  const menu = construirMenu({
    perfil,
    perfilesAdicionales: info?.perfiles_adicionales || [],
    clientes,
  });

  /* ---------------------------------------------------------------- */
  /* Navegación: setea las cookies de portal antes de entrar           */
  /* (misma lógica que tenía seleccionarCliente en el login).          */
  /* ---------------------------------------------------------------- */

  const expiracionCookie = () => {
    const expiracion = new Date();
    expiracion.setDate(expiracion.getDate() + 14);
    return { expires: expiracion, path: "/" };
  };

  const abrir = (item: ItemModulo) => {
    if (item.deshabilitado) return;

    // (2026-11-03) Protocolo LOCAL de Windows (p. ej. «planeadorkabi:» del
    // ítem PLANEACIÓN): abre el planeador de Access del PC de Edwin al
    // clic. La navegación a un protocolo registrado SÍ está permitida desde
    // https (a diferencia de file://, que los navegadores bloquean); el
    // navegador pide confirmación la primera vez y ofrece «Permitir
    // siempre». En PCs sin el registro, el clic no hace nada.
    if (item.externo && !/^https?:/i.test(item.externo)) {
      window.location.href = item.externo;
      return;
    }

    // Link externo: nueva pestaña, sin tocar la sesión actual.
    if (item.externo) {
      window.open(item.externo, "_blank", "noopener,noreferrer");
      return;
    }

    // Portal de Seguridad: /revision gatea por las cookies seguridad*.
    if (item.esSeguridad) {
      // Sesión creada antes de este cambio (sin info persistida): pedir
      // re-login una sola vez para poder setear las cookies del portal.
      if (!info) {
        router.replace("/LoginUsuario");
        return;
      }
      const opts = expiracionCookie();
      Cookies.set("clientePedidosCookie", "SEGURIDAD", opts);
      // (2026-10-15) Perfil ADICIONAL: quien NO es Seguridad/Admin entra al
      // portal en modo PADRINO (vista simplificada + guards).
      const perfilSeguridad = ["ADMIN", "SEGURIDAD"].includes((info.perfil || "").toUpperCase())
        ? info.perfil
        : "PADRINO";
      Cookies.set("seguridadId", info.id, opts);
      Cookies.set("seguridadNombre", info.nombre || info.usuario, opts);
      Cookies.set("seguridadPerfil", perfilSeguridad, opts);
      if (info.correo) Cookies.set("seguridadCorreo", info.correo, opts);
      router.push("/revision");
      return;
    }

    // Portales KABI / MEDICAL_CARE: sus guards leen clientePedidosCookie.
    if (item.portal) {
      Cookies.set("clientePedidosCookie", item.portal, expiracionCookie());
    }
    router.push(item.destino || "/Modulos");
  };

  const cerrarSesion = () => {
    Cookies.remove("usuarioPedidosCookie");
    Cookies.remove("regionalPedidosCookie");
    Cookies.remove("perfilPedidosCookie");
    Cookies.remove("clientePedidosCookie");
    Cookies.remove("clientesPedidosCookie");
    Cookies.remove("usuarioInfoPedidosCookie");
    Cookies.remove("seguridadId");
    Cookies.remove("seguridadNombre");
    Cookies.remove("seguridadPerfil");
    Cookies.remove("seguridadCorreo");
    window.localStorage.removeItem("baseUsuarioAccessToken");
    router.replace("/LoginUsuario");
  };

  const alternarGrupo = (id: string) =>
    setGruposAbiertos((prev) => ({ ...prev, [id]: !(prev[id] ?? false) }));

  // Los submenús NO se ven por defecto: sólo al hacer clic para ampliar.
  const grupoAbierto = (id: string) => gruposAbiertos[id] ?? false;

  /* ---------------------------------------------------------------- */
  /* Sidebar: SIEMPRE visible y completa (con textos) en cualquier     */
  /* tamaño de pantalla — no hay modo compacto ni drawer.              */
  /* ---------------------------------------------------------------- */

  const itemNav = (item: ItemModulo, esSub: boolean) => {
    const Icono = item.icono;
    const contenido = (
      <>
        <Icono />
        <span className="modx-nav-texto">{item.etiqueta}</span>
        {item.badge && <span className="modx-nav-badge">{item.badge}</span>}
        {item.externo && <FaExternalLinkAlt className="modx-nav-externo" />}
      </>
    );
    const tip = item.deshabilitado && item.badge ? `${item.etiqueta} · ${item.badge}` : item.etiqueta;

    if (item.deshabilitado) {
      return (
        <span
          key={item.id}
          className={`modx-nav-item ${esSub ? "modx-nav-item--sub" : "modx-nav-item--directo"} modx-nav-item--deshabilitado`}
          aria-disabled="true"
          title={tip}
        >
          {contenido}
        </span>
      );
    }
    return (
      <button
        key={item.id}
        className={`modx-nav-item ${esSub ? "modx-nav-item--sub" : "modx-nav-item--directo"}`}
        onClick={() => abrir(item)}
        title={tip}
      >
        {contenido}
      </button>
    );
  };

  const sidebar = (
    <aside className="modx-sidebar">
      <div className="modx-sidebar-logo">
        <img src={logo.src} alt="IntegrApp" className="modx-logo" />
        <div className="modx-logo-texto">
          <span>Integr<span>App</span></span>
        </div>
      </div>
      <nav className="modx-sidebar-nav" aria-label="Módulos">
        {menu.directos.map((item) => itemNav(item, false))}
        {menu.grupos.length > 0 && <div className="modx-nav-divisor" />}
        {menu.grupos.map((grupo) => {
          const IconoGrupo = grupo.icono;
          return (
            <div key={grupo.id} className="modx-grupo">
              <button
                className="modx-grupo-cab"
                onClick={() => alternarGrupo(grupo.id)}
                aria-expanded={grupoAbierto(grupo.id)}
              >
                <IconoGrupo />
                <span>{grupo.etiqueta}</span>
                {grupoAbierto(grupo.id) ? (
                  <FaChevronDown className="modx-grupo-chevron" />
                ) : (
                  <FaChevronRight className="modx-grupo-chevron" />
                )}
              </button>
              {grupoAbierto(grupo.id) && (
                <div className="modx-grupo-items">
                  {grupo.items.map((item) => itemNav(item, true))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <div className="modx-sidebar-pie" ref={usuarioRef}>
        {/* Popover de usuario (info + cerrar sesión). */}
        {menuUsuarioAbierto && (
          <div className="modx-user-pop" role="menu">
            <div className="modx-user-pop-cab">
              <strong>{nombreUsuario}</strong>
              <small>Perfil {perfil || "—"}</small>
            </div>
            <button
              className="modx-user-pop-item modx-user-pop-item--rojo"
              onClick={() => { setMenuUsuarioAbierto(false); cerrarSesion(); }}
              role="menuitem"
            >
              <FaSignOutAlt /> Cerrar sesión
            </button>
          </div>
        )}
        <button
          className={`modx-sidebar-usuario ${menuUsuarioAbierto ? "modx-sidebar-usuario--activo" : ""}`}
          onClick={() => setMenuUsuarioAbierto((o) => !o)}
          aria-label="Menú de usuario"
          aria-expanded={menuUsuarioAbierto}
        >
          <div className="modx-avatar">{iniciales}</div>
          <div className="modx-sidebar-usuario-datos">
            <strong>{nombreUsuario}</strong>
            <small>{perfil || "Usuario"}</small>
          </div>
        </button>
      </div>
    </aside>
  );

  if (!listo) {
    return (
      <div className="modx-app modx-cargando">
        <span>Verificando sesión…</span>
      </div>
    );
  }

  return (
    <div className="modx-app">
      {/* Sidebar completa SIEMPRE visible, en cualquier tamaño. */}
      {sidebar}

      {/* Área central: logo corporativo centrado. */}
      <main className="modx-lienzo">
        <img src={logo.src} alt="IntegrApp" className="modx-logo-central" />
      </main>
    </div>
  );
};

export default Modulos;
