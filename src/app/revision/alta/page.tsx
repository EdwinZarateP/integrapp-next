import { Suspense } from 'react';
import dynamic from 'next/dynamic';
const RevisionVehiculos = dynamic(() => import('@/Paginas/revision/index'), { ssr: false });

// Ruta estática del módulo «Alta conductor» de /revision (2026-09-28):
// misma shell (sidebar + topbar), arranca directo en la vista del alta.
// Patrón de /PortalSeguridad/{panel,nueva-consulta,historial}.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <RevisionVehiculos vistaInicial="alta" />
    </Suspense>
  );
}
