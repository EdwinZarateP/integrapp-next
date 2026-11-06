'use client';
import dynamic from 'next/dynamic';
import { fuenteIntegra } from '@/Fuentes/fuenteIntegra';

// (2026-10-29) Portal «Mis Indicadores» (perfil CLIENTE): reutiliza el
// DashboardCliente en modoExterno — solo «On Time por período» + informe de
// guías TMS, sin cajas/uso de vehículos ni carga de citas.
// (2026-11-05) Nunito Sans (sistema de diseño Integra) vía next/font: la
// variable --fuente-integra la toma .DC-portalClaro.
const DashboardCliente = dynamic(() => import('@/Paginas/IndicadoresClientes/DashboardCliente'), { ssr: false });

export default function Page() {
  return (
    <div className={fuenteIntegra.variable}>
      <DashboardCliente clienteId="fresenius-kabi" modoExterno />
    </div>
  );
}
