/**
 * SidebarModulos (2026-11-25, 4.ª tanda) — la barra de módulos de la Torre de
 * Control como componente COMPARTIDO, extraída de ModulosP:
 *
 * - `modo="hub"`: el sidebar de siempre de /Modulos (con toggle de riel y
 *   estado colapsado persistido en localStorage).
 * - `modo="overlay"`: la misma barra desplegada como overlay sobre cualquier
 *   página (la usa LanzadorModulos): siempre expandida, sin toggle, y llama
 *   `alNavegar()` tras cada navegación para que el overlay se cierre.
 *
 * Autónoma: lee sus cookies (usuario/perfil/clientes/usuarioInfo) y construye
 * el menú con construirMenu() — la matriz de visibilidad vive en menuModulos.
 */
'use client';

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import {
  FaChevronDown,
  FaChevronRight,
  FaSignOutAlt,
  FaExternalLinkAlt,
  FaAngleDoubleLeft,
  FaAngleDoubleRight,
} from "react-icons/fa";
import { LOGO_INTEGRA } from "@/Funciones/logoIntegra";
import { construirMenu, type ItemModulo, type ItemModuloHijo } from "@/Funciones/menuModulos";
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

export const leerUsuarioInfo = (): UsuarioInfo | null => {
  const cruda = Cookies.get("usuarioInfoPedidosCookie");
  if (!cruda) return null;
  try {
    return JSON.parse(decodeURIComponent(cruda)) as UsuarioInfo;
  } catch {
    return null;
  }
};

type Props = {
  modo?: "hub" | "overlay";
  /** Overlay: callback tras navegar (cierra el overlay). */
  alNavegar?: () => void;
};

const SidebarModulos: React.FC<Props> = ({ modo = "hub", alNavegar }) => {
  const esHub = modo === "hub";
  const router = useRouter();
  const [info, setInfo] = useState<UsuarioInfo | null>(null);
  const [menuUsuarioAbierto, setMenuUsuarioAbierto] = useState(false);
  const [gruposAbiertos, setGruposAbiertos] = useState<Record<string, boolean>>({});
  // Padres con submenú (Kabi / Medical Care): cerrados por defecto, igual
  // que los grupos.
  const [padresAbiertos, setPadresAbiertos] = useState<Record<string, boolean>>({});
  // Riel de iconos 64px (SOLO modo hub; en overlay siempre expandida). Se lee
  // de localStorage DENTRO de un effect (nunca en render).
  const [colapsada, setColapsada] = useState(false);
  const usuarioRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInfo(leerUsuarioInfo());
    if (esHub) {
      try {
        if (window.localStorage.getItem("integrapp.modx.sidebarColapsada") === "1") {
          setColapsada(true);
        }
      } catch { /* sin localStorage */ }
    }
  }, [esHub]);

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

  // Ítems y sub-ítems (hijos) navegan igual: campos estructurales comunes.
  const abrir = (item: ItemModulo | ItemModuloHijo) => {
    if (item.deshabilitado) return;
    alNavegar?.();

    // (2026-11-03) Protocolo LOCAL de Windows (p. ej. «planeadorkabi:» del
    // ítem PLANEACIÓN): abre el planeador de Access del PC de Edwin al
    // clic. La navegación a un protocolo registrado SÍ está permitida desde
    // https (a diferencia de file://, que los navegadores bloquean); el
    // navegador pide confirmación la primera vez y ofrece «Permitir
    // siempre». En PCs sin el registro, el clic no hace nada.
    if ("externo" in item && item.externo && !/^https?:/i.test(item.externo)) {
      window.location.href = item.externo;
      return;
    }

    // Link externo: nueva pestaña, sin tocar la sesión actual.
    if ("externo" in item && item.externo) {
      window.open(item.externo, "_blank", "noopener,noreferrer");
      return;
    }

    // Portal de Seguridad: /revision gatea por las cookies seguridad*.
    if ("esSeguridad" in item && item.esSeguridad) {
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

  const grupoAbierto = (id: string) => gruposAbiertos[id] ?? false;

  const alternarPadre = (id: string) =>
    setPadresAbiertos((prev) => ({ ...prev, [id]: !(prev[id] ?? false) }));
  const padreAbierto = (id: string) => padresAbiertos[id] ?? false;

  // Toggle del riel (solo hub). Persistido en localStorage.
  const alternarSidebar = () => {
    setColapsada((prev) => {
      const nuevo = !prev;
      try {
        window.localStorage.setItem("integrapp.modx.sidebarColapsada", nuevo ? "1" : "0");
      } catch { /* sin localStorage */ }
      return nuevo;
    });
  };

  // En modo riel, los GRUPOS y PADRES no alternan: expanden la sidebar y
  // abren su contenido (los ítems directos sí navegan directo).
  const activarGrupoEnRiel = (id: string) => {
    if (colapsada) {
      setColapsada(false);
      try { window.localStorage.setItem("integrapp.modx.sidebarColapsada", "0"); } catch { /* noop */ }
    }
    setGruposAbiertos((prev) => ({ ...prev, [id]: true }));
  };
  const activarPadreEnRiel = (id: string) => {
    if (colapsada) {
      setColapsada(false);
      try { window.localStorage.setItem("integrapp.modx.sidebarColapsada", "0"); } catch { /* noop */ }
    }
    setPadresAbiertos((prev) => ({ ...prev, [id]: true }));
  };

  const itemNav = (item: ItemModulo, esSub: boolean) => {
    const Icono = item.icono;

    // Ítem PADRE con submenú (Kabi / Medical Care): botón principal que
    // navega a la home del portal + chevron que despliega los hijos. En modo
    // riel el botón principal EXPANDE y despliega (no navega).
    if (item.hijos && item.hijos.length > 0) {
      const abierto = padreAbierto(item.id);
      return (
        <div key={item.id} className="modx-item-padre">
          <div className="modx-item-padre-fila">
            <button
              className="modx-nav-item modx-item-padre-principal"
              onClick={() => (colapsada ? activarPadreEnRiel(item.id) : abrir(item))}
              title={item.etiqueta}
            >
              <Icono />
              <span className="modx-nav-texto">{item.etiqueta}</span>
            </button>
            <button
              className="modx-item-padre-chevron"
              onClick={() => alternarPadre(item.id)}
              aria-expanded={abierto}
              aria-label={`Subopciones de ${item.etiqueta}`}
              title={abierto ? "Ocultar subopciones" : "Ver subopciones"}
            >
              {abierto ? <FaChevronDown /> : <FaChevronRight />}
            </button>
          </div>
          {abierto && (
            <div className="modx-item-hijos">
              {item.hijos.map((h) => itemNavHijo(h))}
            </div>
          )}
        </div>
      );
    }

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

  // Sub-ítem (hoja) de un padre: reusa modx-nav-item--sub con indentación
  // extra y siempre navega interno (setea la cookie de portal si la lleva).
  const itemNavHijo = (h: ItemModuloHijo) => {
    const Icono = h.icono;
    if (h.deshabilitado) {
      return (
        <span key={h.id} className="modx-nav-item modx-nav-item--sub modx-nav-item--hoja modx-nav-item--deshabilitado" aria-disabled="true" title={h.etiqueta}>
          <Icono />
          <span className="modx-nav-texto">{h.etiqueta}</span>
        </span>
      );
    }
    return (
      <button
        key={h.id}
        className="modx-nav-item modx-nav-item--sub modx-nav-item--hoja"
        onClick={() => abrir(h)}
        title={h.etiqueta}
      >
        <Icono />
        <span className="modx-nav-texto">{h.etiqueta}</span>
        {h.badge && <span className="modx-nav-badge">{h.badge}</span>}
      </button>
    );
  };

  return (
    <aside className={`modx-sidebar${esHub ? "" : " modx-sidebar--overlay"}`}>
      <div className="modx-sidebar-logo">
        <img src={LOGO_INTEGRA} alt="Integra Logística" className="modx-logo" />
        {/* Alterna expandido ↔ riel de iconos (64px). En riel el logo
            horizontal no cabe: queda solo este botón. Solo modo hub. */}
        {esHub && (
          <button
            className="modx-toggle"
            onClick={alternarSidebar}
            title={colapsada ? "Expandir menú" : "Contraer menú"}
            aria-label={colapsada ? "Expandir menú" : "Contraer menú"}
          >
            {colapsada ? <FaAngleDoubleRight /> : <FaAngleDoubleLeft />}
          </button>
        )}
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
                onClick={() => (colapsada ? activarGrupoEnRiel(grupo.id) : alternarGrupo(grupo.id))}
                aria-expanded={grupoAbierto(grupo.id)}
                title={grupo.etiqueta}
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
              onClick={() => { setMenuUsuarioAbierto(false); alNavegar?.(); cerrarSesion(); }}
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
};

export default SidebarModulos;
