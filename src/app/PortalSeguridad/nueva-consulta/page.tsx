"use client";

import dynamic from "next/dynamic";

const PortalSeguridadP = dynamic(() => import("@/Paginas/PortalSeguridadP"), {
  ssr: false,
});

export default function PortalSeguridadNuevaConsulta() {
  return <PortalSeguridadP vistaInicial="consulta" />;
}
