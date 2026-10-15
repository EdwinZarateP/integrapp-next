import { Suspense } from 'react';
import dynamic from 'next/dynamic';
const RevisionVehiculos = dynamic(() => import('@/Paginas/revision/index'), { ssr: false });

// Ruta estática del módulo «Indicadores» de /revision (2026-10-14): misma
// shell (sidebar + topbar), arranca directo en la vista de indicadores.
// Patrón de /revision/alta y /revision/estudios.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <RevisionVehiculos vistaInicial="indicadores" />
    </Suspense>
  );
}
