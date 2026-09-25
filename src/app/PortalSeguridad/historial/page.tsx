"use client";

import dynamic from "next/dynamic";

const PortalSeguridadP = dynamic(() => import("@/Paginas/PortalSeguridadP"), {
  ssr: false,
});

export default function PortalSeguridadHistorial() {
  return <PortalSeguridadP vistaInicial="historial" />;
}
