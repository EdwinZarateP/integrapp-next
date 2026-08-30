"use client";

import dynamic from "next/dynamic";

const AdminSeguridadP = dynamic(() => import("@/Paginas/AdminSeguridadP"), {
  ssr: false,
});

export default function AdminSeguridadEmpresas() {
  return <AdminSeguridadP pestanaInicial="empresas" />;
}
