'use client';

import { GoogleOAuthProvider } from "@react-oauth/google";
import { ProveedorVariables } from "@/Contexto/index";
import TelemetriaGlobal from "@/Componentes/TelemetriaGlobal";
import LanzadorModulos from "@/Componentes/LanzadorModulos";
import EfectoTemporada from "@/Componentes/EfectoTemporada";

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <GoogleOAuthProvider clientId="870542988514-rbpof111fdk5vlbn75vi62i06moko46s.apps.googleusercontent.com">
      <ProveedorVariables hijo={children} />
      {/* (2026-11-25) Telemetría general de la app: un pageview por cambio de
          ruta en TODAS las páginas (colección eventos_portal, módulo por URL). */}
      <TelemetriaGlobal />
      {/* (2026-11-25, 4.ª tanda) Pestaña de módulos en el borde izquierdo de
          todas las páginas autenticadas (overlay con la Torre de Control). */}
      <LanzadorModulos />
      {/* (2026-11-25, 10.ª tanda) Efecto de temporada global (navidad,
          halloween…), configurable por el ADMIN en /Apariencia. */}
      <EfectoTemporada />
    </GoogleOAuthProvider>
  );
}
