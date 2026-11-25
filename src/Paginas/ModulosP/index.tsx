'use client';
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { LOGO_INTEGRA } from "@/Funciones/logoIntegra";
import { hogarPorPerfil } from "@/Funciones/hogarPorPerfil";
import SidebarModulos from "@/Componentes/SidebarModulos";
import "./estilos.css";

/**
 * Torre de Control (/Modulos) — hub post-login para los perfiles
 * multi-módulo. La barra de módulos vive en el componente compartido
 * SidebarModulos (2026-11-25, 4.ª tanda; también la usa LanzadorModulos
 * como overlay global en el resto de páginas).
 */
const Modulos: React.FC = () => {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  // Riel de iconos: la clase raíz modx-app--colapsada la gobierna el
  // SidebarModulos (estado propio persistido en localStorage).
  const [colapsada, setColapsada] = useState(false);

  useEffect(() => {
    const usuario = Cookies.get("usuarioPedidosCookie");
    const token = window.localStorage.getItem("baseUsuarioAccessToken");
    if (!usuario || !token) {
      router.replace("/LoginUsuario");
      return;
    }
    // (2026-11-24) Guardia: los perfiles micro-portal no ven la Torre de
    // Control aunque escriban la URL — cada uno vuelve a SU hogar (mismo
    // mapa que el login; helper compartido 2026-11-25). Así /Modulos queda
    // para los perfiles multi-módulo.
    const hogar = hogarPorPerfil();
    if (hogar !== "/Modulos") {
      router.replace(hogar);
      return;
    }
    try {
      if (window.localStorage.getItem("integrapp.modx.sidebarColapsada") === "1") {
        setColapsada(true);
      }
    } catch { /* sin localStorage */ }
    setListo(true);
  }, [router]);

  if (!listo) {
    return (
      <div className="modx-app modx-cargando">
        <span>Verificando sesión…</span>
      </div>
    );
  }

  return (
    <div className={`modx-app${colapsada ? " modx-app--colapsada" : ""}`}>
      {/* Sidebar SIEMPRE visible (expandida o en riel de iconos). */}
      <SidebarModulos modo="hub" />

      {/* Área central: logo corporativo centrado. */}
      <main className="modx-lienzo">
        <img src={LOGO_INTEGRA} alt="Integra Logística" className="modx-logo-central" />
      </main>
    </div>
  );
};

export default Modulos;
