import { Suspense } from 'react';
import dynamic from 'next/dynamic';
const RevisionVehiculos = dynamic(() => import('@/Paginas/revision/index'), { ssr: false });

// Ruta estática del módulo «Estudios por antigüedad» de /revision (2026-10-05):
// misma shell (sidebar + topbar), arranca directo en la vista del listado por
// antigüedad. Reemplaza la renovación automática (eliminada) — la actualización
// de los estudios de cada placa es MANUAL. Patrón de /revision/alta.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <RevisionVehiculos vistaInicial="estudios" />
    </Suspense>
  );
}
