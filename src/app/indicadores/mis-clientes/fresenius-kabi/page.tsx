'use client';
import dynamic from 'next/dynamic';

// (2026-10-29) Portal «Mis Indicadores» (perfil CLIENTE): reutiliza el
// DashboardCliente en modoExterno — solo «On Time por período» + informe de
// guías TMS, sin cajas/uso de vehículos ni carga de citas.
const DashboardCliente = dynamic(() => import('@/Paginas/IndicadoresClientes/DashboardCliente'), { ssr: false });

export default function Page() {
  return <DashboardCliente clienteId="fresenius-kabi" modoExterno />;
}
