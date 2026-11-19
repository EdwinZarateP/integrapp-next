'use client';
import dynamic from 'next/dynamic';
import { fuenteIntegra } from '@/Fuentes/fuenteIntegra';

// (2026-11-19) Telemetría de uso del portal de clientes (solo ADMIN):
// quiénes usan los portales (Kabi, Medical Care), frecuencia diaria,
// pestañas y acciones.
const UsoPortalKP = dynamic(() => import('@/Paginas/UsoPortalKP'), { ssr: false });

export default function Page() {
  return (
    <div className={fuenteIntegra.variable}>
      <UsoPortalKP />
    </div>
  );
}
