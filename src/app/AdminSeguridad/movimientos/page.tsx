"use client";

import dynamic from "next/dynamic";

const AdminSeguridadP = dynamic(() => import("@/Paginas/AdminSeguridadP"), {
  ssr: false,
});

export default function AdminSeguridadMovimientos() {
  return <AdminSeguridadP pestanaInicial="movimientos" />;
}
